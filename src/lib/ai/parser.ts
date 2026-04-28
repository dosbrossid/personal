// ============================================================
// AI Response Parser
// Validates and normalizes raw AI JSON into typed AIResponse
// ============================================================

import type { AIResponse, AIResponseItem } from '@/core/types'
import type { RoleContext, Priority } from '@/core/constants'

const VALID_ACTIONS = ['TASK', 'NOTE', 'CALENDAR', 'ACADEMIC'] as const
const VALID_ROLES = ['dosen', 'creator', 'affiliate', 'consultant', 'general'] as const
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

export function parseAIResponse(raw: string): AIResponse | null {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    if (!parsed.items || !Array.isArray(parsed.items)) {
      return null
    }

    const items: AIResponseItem[] = []

    for (const item of parsed.items) {
      if (!item.data || typeof item.data !== 'object') continue

      const action = String(item.action ?? '').toUpperCase()
      if (!VALID_ACTIONS.includes(action as unknown as typeof VALID_ACTIONS[number])) continue

      const data = item.data as Record<string, unknown>

      let role = String(data.contextual_role ?? 'general')
      if (!VALID_ROLES.includes(role as unknown as typeof VALID_ROLES[number])) role = 'general'

      let priority = String(data.priority ?? 'medium')
      if (!VALID_PRIORITIES.includes(priority as unknown as typeof VALID_PRIORITIES[number])) priority = 'medium'

      const categoryNames = Array.isArray(data.category_names)
        ? data.category_names.filter((c: unknown) => typeof c === 'string')
        : []

      const responseItem: AIResponseItem = {
        action: action as AIResponseItem['action'],
        data: {
          title: String(data.title ?? 'Untitled').trim(),
          description: data.description ? String(data.description) : null,
          contextual_role: role as RoleContext,
          category_names: categoryNames as string[],
          suggested_new_category: data.suggested_new_category ? String(data.suggested_new_category) : null,
          due_date: data.due_date ? String(data.due_date) : null,
          start_at: data.start_at ? String(data.start_at) : null,
          end_at: data.end_at ? String(data.end_at) : null,
          priority: priority as Priority,
          source_url: data.source_url ? String(data.source_url) : null,
          file_format: data.file_format ? String(data.file_format) : null,
          reminder_minutes: typeof data.reminder_minutes === 'number' ? data.reminder_minutes : 15,
          semester: data.semester ? String(data.semester) : null,
          mata_kuliah: data.mata_kuliah ? String(data.mata_kuliah) : null,
        },
      }

      items.push(responseItem)
    }

    return {
      items,
      ai_message: String(parsed.ai_message ?? 'Draft telah dibuat. Silakan review dan simpan.'),
    }
  } catch {
    return null
  }
}

export function mapDraftDetail(item: AIResponseItem): string {
  switch (item.action) {
    case 'TASK': {
      const due = item.data.due_date ? `Due: ${item.data.due_date.split('T')[0]}` : 'No due date'
      return due
    }
    case 'NOTE': {
      const desc = item.data.description ? item.data.description.slice(0, 60) : 'Catatan baru'
      return desc
    }
    case 'CALENDAR': {
      if (item.data.start_at) {
        const d = new Date(item.data.start_at)
        return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
      }
      return 'Event baru'
    }
    case 'ACADEMIC': {
      const mk = item.data.mata_kuliah ? ` · ${item.data.mata_kuliah}` : ''
      return `${item.data.file_format ?? 'Dokumen'}${mk}`
    }
    default:
      return ''
  }
}