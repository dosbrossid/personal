// ============================================================
// Route Handler: /api/ai/command
// POST — Parse natural language command via AI Command Hub
// OPTIMIZED: Parallel DB queries + streaming SSE
// ============================================================

import { type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import {
  analyzeImageWithVision,
  callLLM,
  callLLMStream,
  fetchWebWithAgent,
  logAIInteraction,
  searchWithAgent,
} from '@/lib/ai/client'
import {
  buildAICommandMessages,
  buildAIAssistantMessages,
  buildAIExecutionMessage,
  buildMainModelInputWithVisionAnalysis,
  executeAIResponseItems,
  normalizeAIResponseForCommand,
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
      const parsedResponse = response ?? parseAIResponse(raw)
      const aiResponse = parsedResponse ? normalizeAIResponseForCommand(input, parsedResponse) : null

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

    if (!input.trim() && !attachment) {
      return Response.json({ error: 'Input tidak boleh kosong' }, { status: 400 })
    }

    const toolResponse = await handleInAppAgentTool(user.id, input.trim())
    if (toolResponse) {
      return toolResponse
    }

    const visionResult = attachment
      ? await analyzeImageWithVision({
          userPrompt: input.trim() || 'Analisis gambar ini dan bantu saya memahami atau mengolahnya.',
          imageDataUrl: attachment.dataUrl!,
          mimeType: attachment.mimeType!,
        })
      : null
    const mainModelInput = buildMainModelInputWithVisionAnalysis(
      input.trim(),
      visionResult?.analysis ?? null
    )

    const messages = await buildAIAssistantMessages(user.id, {
      input: mainModelInput,
      conversation,
      attachment: null,
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

              const parsedResponse = parseAIResponse(fullContent)
              const aiResponse = parsedResponse
                ? normalizeAIResponseForCommand(input, parsedResponse)
                : null

              if (!aiResponse) {
                // Don't await logging — fire and forget
                logAIInteraction({
                  userId: user.id,
                  rawInput: buildLoggedInput(input, attachment?.name),
                  aiResponse: null,
                  status: 'failed',
                  errorMessage: 'AI response could not be parsed as JSON',
                  tokensUsed: addTokenCounts(tokensUsed, visionResult?.tokensUsed ?? null),
                  latencyMs: latencyMs + (visionResult?.latencyMs ?? 0),
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
                tokensUsed: addTokenCounts(tokensUsed, visionResult?.tokensUsed ?? null),
                latencyMs: latencyMs + (visionResult?.latencyMs ?? 0),
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

function extractFirstUrl(input: string) {
  const match = input.match(/https?:\/\/[^\s)>\]]+/i)
  return match?.[0] ?? null
}

function normalizeToolText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function stripToolCommandPrefix(input: string, prefixes: RegExp[]) {
  let output = input.trim()
  for (const pattern of prefixes) {
    output = output.replace(pattern, '').trim()
  }
  return output
}

function getInAppWebSearchQuery(input: string) {
  const normalized = normalizeToolText(input)
  const isCommand = normalized.startsWith('/search') || normalized.startsWith('/cariweb') || normalized.startsWith('/websearch')
  const hasSearchIntent = /\b(search|cari|googling|riset|telusuri|cek|lihat|update|trend|trending|berita|news|referensi|sumber|artikel|review|bandingkan|compare|harga)\b/i.test(input)
  const hasFreshnessCue = /\b(terbaru|terkini|hari ini|sekarang|2026|rilis|launch|viral|pasar|kompetitor)\b/i.test(input)
  const hasWebCue = /\b(web|internet|online|berita|news|artikel|sumber|referensi|google)\b/i.test(input)
  const isLocalDashboardIntent = /\b(agenda|jadwal|calendar|kalender|tugas|task|habit|catatan|note|kelas|vault|reminder)\b/i.test(input)
  if ((!isCommand && !(hasSearchIntent && (hasWebCue || hasFreshnessCue))) || (!isCommand && isLocalDashboardIntent)) return null

  const query = stripToolCommandPrefix(input, [
    /^\/search\s*/i,
    /^\/cariweb\s*/i,
    /^\/websearch\s*/i,
    /^(?:tolong\s+)?(?:search|cari|googling|riset|telusuri|cek|lihat|update|review|bandingkan|compare)\s+(?:di\s+)?(?:web|internet|online|google)?\s*/i,
  ])

  return query.length >= 3 ? query : null
}

function getInAppWebFetchUrl(input: string) {
  const url = extractFirstUrl(input)
  if (!url) return null

  const normalized = normalizeToolText(input)
  const wantsFetch = normalized.startsWith('/fetch') ||
    normalized.startsWith('/ringkaslink') ||
    /\b(fetch|baca|ringkas|rangkum|analisa|analisis|cek|lihat)\b/i.test(input) ||
    !/\b(simpan|save|tambah|add|masukkan|catat)\b/i.test(input)

  return wantsFetch ? url : null
}

function getSearchSourceLabel(item: { title: string; url?: string; displayUrl?: string }) {
  if (item.displayUrl) return item.displayUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '')
  if (!item.url) return item.title
  try {
    return new URL(item.url).hostname.replace(/^www\./, '')
  } catch {
    return item.title
  }
}

function formatInAppSearchResult(item: { title: string; url?: string; displayUrl?: string; snippet?: string }, index: number) {
  return [
    `${index + 1}. ${item.title}`,
    item.snippet ? item.snippet : null,
    `Sumber: ${getSearchSourceLabel(item)}`,
  ].filter(Boolean).join('\n')
}

function createCompleteStream(aiMessage: string) {
  const encoder = new TextEncoder()
  const response = {
    items: [],
    ai_message: aiMessage,
  }

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', response, items: [] })}\n\n`))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

async function handleInAppAgentTool(userId: string, input: string) {
  if (!input) return null

  const fetchUrl = getInAppWebFetchUrl(input)
  if (fetchUrl) {
    const started = Date.now()
    try {
      const page = await fetchWebWithAgent({ url: fetchUrl })
      const content = page.content.trim()
      const aiMessage = [
        `Web fetch selesai untuk ${page.url ?? fetchUrl}.`,
        page.title ? `Judul: ${page.title}` : null,
        content
          ? `Ringkasan konten:\n${content.slice(0, 1800)}${content.length > 1800 ? '...' : ''}`
          : 'Konten halaman kosong atau tidak bisa diekstrak oleh provider fetch.',
      ].filter(Boolean).join('\n\n')

      await logAIInteraction({
        userId,
        rawInput: input,
        aiResponse: { items: [], ai_message: aiMessage },
        status: 'confirmed',
        tokensUsed: null,
        latencyMs: Date.now() - started,
        source: 'in_app',
      })

      return createCompleteStream(aiMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Web fetch gagal tanpa pesan error.'
      await logAIInteraction({
        userId,
        rawInput: input,
        aiResponse: { items: [], ai_message: 'Web fetch failed' },
        status: 'failed',
        errorMessage: message,
        tokensUsed: null,
        latencyMs: Date.now() - started,
        source: 'in_app',
      })
      return createCompleteStream(`Web fetch gagal: ${message}`)
    }
  }

  const searchQuery = getInAppWebSearchQuery(input)
  if (searchQuery) {
    const started = Date.now()
    try {
      const results = await searchWithAgent({ query: searchQuery, limit: 5 })
      const aiMessage = results.length
        ? [
            `Hasil pencarian untuk "${searchQuery}":`,
            ...results.slice(0, 5).map(formatInAppSearchResult),
          ].join('\n\n')
        : `Saya belum menemukan hasil web search untuk "${searchQuery}".`

      await logAIInteraction({
        userId,
        rawInput: input,
        aiResponse: { items: [], ai_message: aiMessage },
        status: 'confirmed',
        tokensUsed: null,
        latencyMs: Date.now() - started,
        source: 'in_app',
      })

      return createCompleteStream(aiMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Web search gagal tanpa pesan error.'
      await logAIInteraction({
        userId,
        rawInput: input,
        aiResponse: { items: [], ai_message: 'Web search failed' },
        status: 'failed',
        errorMessage: message,
        tokensUsed: null,
        latencyMs: Date.now() - started,
        source: 'in_app',
      })
      return createCompleteStream(`Web search gagal: ${message}`)
    }
  }

  return null
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

function addTokenCounts(first: number | null, second: number | null) {
  const total = (first ?? 0) + (second ?? 0)
  return total > 0 ? total : null
}
