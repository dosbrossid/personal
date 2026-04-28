// ============================================================
// Route Handler: /api/ai/command
// POST — Parse natural language command via AI Command Hub
// OPTIMIZED: Parallel DB queries + streaming SSE
// ============================================================

import { type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { callLLM, callLLMStream, logAIInteraction } from '@/lib/ai/client'
import {
  buildAICommandMessages,
  buildAIAssistantMessages,
  buildAIExecutionMessage,
  executeAIResponseItems,
} from '@/lib/ai/command-hub'
import { parseAIResponse, mapDraftDetail } from '@/lib/ai/parser'
import type { AIResponseItem } from '@/core/types'

interface ConversationMessagePayload {
  role: 'user' | 'assistant'
  content: string
}

interface ImageAttachmentPayload {
  name?: string
  mimeType?: string
  dataUrl?: string
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const input = typeof body.input === 'string' ? body.input : ''
    const conversation = Array.isArray(body.conversation)
      ? body.conversation.filter(isConversationMessage).slice(-8)
      : []
    const attachment = isImageAttachment(body.attachment) ? body.attachment : null
    const mode = body.mode === 'execute' ? 'execute' : 'draft'

    if (mode === 'execute') {
      if (Array.isArray(body.items) && body.items.length > 0) {
        const execution = await executeAIResponseItems(user.id, body.items as AIResponseItem[])

        if (execution.created.length === 0) {
          return Response.json(
            {
              mode: 'execute',
              execution,
              ai_message: buildAIExecutionMessage(execution),
              error: 'Semua item gagal disimpan',
            },
            { status: 422 }
          )
        }

        return Response.json({
          mode: 'execute',
          execution,
          ai_message: buildAIExecutionMessage(execution),
        })
      }

      if (!input.trim()) {
        return Response.json({ error: 'Input tidak boleh kosong' }, { status: 400 })
      }

      const messages = await buildAICommandMessages(user.id, input.trim())
      const { response, raw, tokensUsed, latencyMs } = await callLLM(messages)
      const aiResponse = response ?? parseAIResponse(raw)

      if (!aiResponse) {
        await logAIInteraction({
          userId: user.id,
          rawInput: input,
          aiResponse: null,
          status: 'failed',
          errorMessage: 'AI response could not be parsed as JSON',
          tokensUsed,
          latencyMs,
          source: 'in_app',
        })

        return Response.json(
          {
            mode: 'execute',
            error: 'AI tidak dapat memproses perintah tersebut.',
          },
          { status: 422 }
        )
      }

      const execution = await executeAIResponseItems(user.id, aiResponse.items)
      const executionMessage = buildAIExecutionMessage(execution)

      await logAIInteraction({
        userId: user.id,
        rawInput: input,
        aiResponse,
        status: execution.created.length > 0 ? 'confirmed' : 'failed',
        errorMessage: execution.errors.length > 0 ? execution.errors.join('; ') : null,
        tokensUsed,
        latencyMs,
        source: 'in_app',
      })

      const itemsWithDetail = aiResponse.items.map((item) => ({
        ...item,
        detail: mapDraftDetail(item),
      }))

      if (execution.created.length === 0) {
        return Response.json(
          {
            mode: 'execute',
            response: aiResponse,
            items: itemsWithDetail,
            execution,
            ai_message: executionMessage,
            error: 'Semua item gagal disimpan',
          },
          { status: 422 }
        )
      }

      return Response.json({
        mode: 'execute',
        response: aiResponse,
        items: itemsWithDetail,
        execution,
        ai_message: executionMessage,
      })
    }

    if (!input.trim()) {
      return Response.json({ error: 'Input tidak boleh kosong' }, { status: 400 })
    }

    const messages = await buildAIAssistantMessages(user.id, {
      input: input.trim(),
      conversation,
      attachment: attachment
        ? {
            mimeType: attachment.mimeType!,
            dataUrl: attachment.dataUrl!,
          }
        : null,
    })

    const startTime = Date.now()
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullContent = ''

          await callLLMStream(messages, {
            onToken(token: string) {
              fullContent += token
              const sseData = JSON.stringify({ type: 'token', content: token })
              controller.enqueue(encoder.encode(`data: ${sseData}\n\n`))
            },
            async onComplete(content: string, tokensUsed: number | null) {
              const latencyMs = Date.now() - startTime
              fullContent = content

              const aiResponse = parseAIResponse(fullContent)

              if (!aiResponse) {
                // Don't await logging — fire and forget
                logAIInteraction({
                  userId: user.id,
                  rawInput: buildLoggedInput(input, attachment?.name),
                  aiResponse: null,
                  status: 'failed',
                  errorMessage: 'AI response could not be parsed as JSON',
                  tokensUsed,
                  latencyMs,
                  source: 'in_app',
                })

                // If LLM returned non-JSON text, use it as ai_message (graceful fallback)
                const cleanedContent = fullContent
                  .replace(/```[\s\S]*?```/g, '')
                  .replace(/[*#_~`]/g, '')
                  .trim()

                const fallbackData = JSON.stringify({
                  type: 'complete',
                  response: {
                    items: [],
                    ai_message: cleanedContent || 'Maaf, saya tidak dapat memproses permintaan Anda. Silakan coba lagi.',
                  },
                  items: [],
                })
                controller.enqueue(encoder.encode(`data: ${fallbackData}\n\n`))
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
                controller.close()
                return
              }

              // Don't await logging
              logAIInteraction({
                userId: user.id,
                rawInput: buildLoggedInput(input, attachment?.name),
                aiResponse,
                status: 'draft',
                tokensUsed,
                latencyMs,
                source: 'in_app',
              })

              const itemsWithDetail = aiResponse.items.map((item) => ({
                ...item,
                detail: mapDraftDetail(item),
              }))

              const finalData = JSON.stringify({
                type: 'complete',
                response: aiResponse,
                items: itemsWithDetail,
              })
              controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
              controller.close()
            },
            onError(error: Error) {
              const errorData = JSON.stringify({
                type: 'error',
                error: error.message || 'Terjadi kesalahan saat memproses AI',
              })
              controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
              controller.close()
            },
          }, {
            // Use max_tokens to limit output size → faster completion
            maxTokens: 1024,
          })
        } catch (e) {
          const errorData = JSON.stringify({
            type: 'error',
            error: e instanceof Error ? e.message : 'Internal server error',
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('AI command error:', e)
    const message = e instanceof Error ? e.message : 'Internal server error'
    return Response.json(
      { error: 'Internal server error', detail: message },
      { status: 500 }
    )
  }
}

function isConversationMessage(value: unknown): value is ConversationMessagePayload {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  return (
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string'
  )
}

function isImageAttachment(value: unknown): value is ImageAttachmentPayload {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  if (typeof candidate.mimeType !== 'string' || !candidate.mimeType.startsWith('image/')) {
    return false
  }

  if (typeof candidate.dataUrl !== 'string' || !candidate.dataUrl.startsWith('data:image/')) {
    return false
  }

  return true
}

function buildLoggedInput(input: string, attachmentName?: string) {
  if (!attachmentName) return input
  return `${input}\n[Image attached: ${attachmentName}]`
}
