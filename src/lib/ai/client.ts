// ============================================================
// OpenCode Go API Client
// Server-only — calls the LLM API with auth header
// NEVER expose OPENCODE_API_KEY to the browser
// Supports both blocking and streaming modes
// ============================================================

import { parseAIResponse } from '@/lib/ai/parser'
import { createServerClient } from '@/lib/supabase/server'
import type { AIResponse } from '@/core/types'

const OPENCODE_API_URL = process.env.OPENCODE_API_URL
const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY
// Model can be configured via env — try faster models like 'mimo-v2-pro' or 'minimax-m2.5'
const OPENCODE_MODEL = process.env.OPENCODE_MODEL || 'minimax-m2.5'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenCodeResponse {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface StreamCallbacks {
  onToken: (token: string) => void
  onComplete: (content: string, tokensUsed: number | null) => Promise<void>
  onError: (error: Error) => void
}

/**
 * Blocking LLM call — waits for full response.
 * Used by Server Actions (parseCommandDraft).
 */
export async function callLLM(
  messages: ChatMessage[],
  options?: { model?: string; temperature?: number }
): Promise<{ response: AIResponse | null; raw: string; tokensUsed: number | null; latencyMs: number }> {
  if (!OPENCODE_API_URL || !OPENCODE_API_KEY) {
    throw new Error(
      `Missing env vars: OPENCODE_API_URL=${OPENCODE_API_URL ? 'set' : 'MISSING'}, OPENCODE_API_KEY=${OPENCODE_API_KEY ? 'set' : 'MISSING'}`
    )
  }

  const startTime = Date.now()

  const res = await fetch(OPENCODE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENCODE_API_KEY}`,
    },
    body: JSON.stringify({
      model: options?.model ?? OPENCODE_MODEL,
      messages,
      temperature: options?.temperature ?? 0.3,
    }),
  })

  const latencyMs = Date.now() - startTime

  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'Unknown error')
    throw new Error(`OpenCode API error (${res.status}): ${errorBody}`)
  }

  const data: OpenCodeResponse = await res.json()

  const rawContent = data.choices?.[0]?.message?.content ?? ''
  const tokensUsed = data.usage?.total_tokens ?? null

  const parsed = parseAIResponse(rawContent)

  return {
    response: parsed,
    raw: rawContent,
    tokensUsed,
    latencyMs,
  }
}

/**
 * Streaming LLM call — sends tokens as they arrive.
 * Used by the /api/ai/command route for real-time chat UX.
 * Falls back to blocking call if streaming fails.
 */
export async function callLLMStream(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<void> {
  if (!OPENCODE_API_URL || !OPENCODE_API_KEY) {
    callbacks.onError(new Error('Missing API configuration'))
    return
  }

  try {
    const res = await fetch(OPENCODE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCODE_API_KEY}`,
      },
      body: JSON.stringify({
        model: options?.model ?? OPENCODE_MODEL,
        messages,
        temperature: options?.temperature ?? 0.3,
        stream: true,
        ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'Unknown error')
      callbacks.onError(new Error(`OpenCode API error (${res.status}): ${errorBody}`))
      return
    }

    // Check if the response is actually streaming (SSE)
    const contentType = res.headers.get('content-type') || ''

    if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
      // Parse SSE stream
      const reader = res.body?.getReader()
      if (!reader) {
        callbacks.onError(new Error('No response body'))
        return
      }

      const decoder = new TextDecoder()
      let fullContent = ''
      let tokensUsed: number | null = null
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE events from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          const jsonStr = trimmed.slice(6)
          try {
            const chunk = JSON.parse(jsonStr)

            // OpenAI-compatible SSE format
            const delta = chunk.choices?.[0]?.delta
            if (delta?.content) {
              fullContent += delta.content
              callbacks.onToken(delta.content)
            }

            // Capture usage info from the last chunk
            if (chunk.usage?.total_tokens) {
              tokensUsed = chunk.usage.total_tokens
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }

      await callbacks.onComplete(fullContent, tokensUsed)
    } else {
      // Fallback: API returned non-streaming JSON response
      const data: OpenCodeResponse = await res.json()
      const rawContent = data.choices?.[0]?.message?.content ?? ''
      const tokensUsed = data.usage?.total_tokens ?? null

      // Simulate streaming by sending content in small chunks
      const chunkSize = 8
      for (let i = 0; i < rawContent.length; i += chunkSize) {
        const chunk = rawContent.slice(i, i + chunkSize)
        callbacks.onToken(chunk)
      }

      await callbacks.onComplete(rawContent, tokensUsed)
    }
  } catch (e) {
    callbacks.onError(e instanceof Error ? e : new Error('Unknown streaming error'))
  }
}

export async function logAIInteraction(params: {
  userId: string
  rawInput: string
  aiResponse: AIResponse | null
  status: 'draft' | 'confirmed' | 'failed'
  errorMessage?: string | null
  tokensUsed?: number | null
  latencyMs?: number
  source?: 'in_app' | 'telegram'
}) {
  try {
    const supabase = await createServerClient()

    await supabase.from('ai_hub_logs').insert({
      user_id: params.userId,
      source: params.source ?? 'in_app',
      raw_input: params.rawInput,
      ai_response: params.aiResponse,
      status: params.status,
      error_message: params.errorMessage ?? null,
      tokens_used: params.tokensUsed ?? null,
      latency_ms: params.latencyMs ?? null,
    })
  } catch (logError) {
    console.error('Failed to log AI interaction:', logError)
  }
}
