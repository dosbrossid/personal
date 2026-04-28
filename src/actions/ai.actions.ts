// ============================================================
// Server Actions: AI Command Hub
// Handles: parse natural language → AI draft, execute confirmed drafts
// ============================================================

'use server'

import { requireAuth } from '@/lib/auth'
import { callLLM, logAIInteraction } from '@/lib/ai/client'
import { parseAIResponse, mapDraftDetail } from '@/lib/ai/parser'
import { buildAICommandMessages, executeAIResponseItems } from '@/lib/ai/command-hub'
import type { ActionResult, AIResponse, AIResponseItem } from '@/core/types'

/**
 * Parse user's natural language input into structured AI draft items.
 * Calls the LLM, logs the interaction, and returns typed AIResponse.
 */
export async function parseCommandDraft(input: string): Promise<
  ActionResult<{
    response: AIResponse
    items: Array<AIResponseItem & { detail: string }>
  }>
> {
  try {
    const user = await requireAuth()
    if (!input?.trim()) {
      return { data: null, error: 'Input tidak boleh kosong' }
    }

    const messages = await buildAICommandMessages(user.id, input.trim())
    const { response, raw, tokensUsed, latencyMs } = await callLLM(messages)

    // If LLM returned parseable JSON, use it; otherwise try raw parse
    let aiResponse: AIResponse | null = response

    if (!aiResponse) {
      aiResponse = parseAIResponse(raw)
    }

    if (!aiResponse) {
      // Log failure
      await logAIInteraction({
        userId: user.id,
        rawInput: input,
        aiResponse: null,
        status: 'failed',
        errorMessage: 'AI response could not be parsed as valid JSON',
        tokensUsed,
        latencyMs,
        source: 'in_app',
      })

      return {
        data: null,
        error: 'AI tidak dapat memproses permintaan. Silakan coba lagi.',
      }
    }

    // Log success
    await logAIInteraction({
      userId: user.id,
      rawInput: input,
      aiResponse,
      status: 'draft',
      tokensUsed,
      latencyMs,
      source: 'in_app',
    })

    // Enrich items with display detail
    const itemsWithDetail = aiResponse.items.map((item) => ({
      ...item,
      detail: mapDraftDetail(item),
    }))

    return {
      data: {
        response: aiResponse,
        items: itemsWithDetail,
      },
      error: null,
    }
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : 'Terjadi kesalahan saat memproses AI',
    }
  }
}

/**
 * Execute a confirmed draft — insert items into appropriate Supabase tables.
 * Uses atomic operations for each item. If any insertion fails, we rollback
 * by soft-deleting already inserted items.
 */
export async function executeConfirmedDraft(
  items: AIResponseItem[]
): Promise<ActionResult<{ created: string[]; errors: string[] }>> {
  try {
    const user = await requireAuth()
    const execution = await executeAIResponseItems(user.id, items)
    const created = execution.created.map((item) => `${item.action}:${item.id}`)
    const { errors } = execution

    // If some items failed, we still return success for the ones that worked
    // The user can see which items were created vs which had errors
    if (errors.length > 0 && created.length === 0) {
      return { data: null, error: 'Semua item gagal disimpan' }
    }

    return {
      data: { created, errors },
      error: null,
    }
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : 'Terjadi kesalahan',
    }
  }
}

export async function generateNoteSummary(input: {
  title?: string
  content: string
}): Promise<ActionResult<string>> {
  try {
    await requireAuth()

    if (!input.content?.trim()) {
      return { data: null, error: 'Konten catatan masih kosong' }
    }

    const { raw } = await callLLM(
      [
        {
          role: 'system',
          content:
            'Buat ringkasan catatan dalam Bahasa Indonesia. Jawab plain text saja, 2-4 bullet pendek, tanpa JSON.',
        },
        {
          role: 'user',
          content: `Judul: ${input.title || 'Catatan'}\n\nKonten:\n${input.content}`,
        },
      ],
      { temperature: 0.2 }
    )

    const summary = raw
      .replace(/```[\s\S]*?```/g, '')
      .trim()

    if (!summary) {
      return { data: null, error: 'AI belum menghasilkan ringkasan' }
    }

    return { data: summary, error: null }
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : 'Terjadi kesalahan saat membuat ringkasan AI',
    }
  }
}
