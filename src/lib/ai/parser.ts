// ============================================================
// AI Response Parser
// Validates and normalizes raw AI JSON into typed AIResponse
// ============================================================

import type { AIResponse, AIResponseItem, CalendarReminderRule } from '@/core/types'
import type { RoleContext, Priority } from '@/core/constants'

const VALID_ACTIONS = ['TASK', 'NOTE', 'CALENDAR', 'ACADEMIC', 'CLASS'] as const
const VALID_ROLES = ['dosen', 'creator', 'affiliate', 'consultant', 'general'] as const
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

function parseReminderConfig(value: unknown): CalendarReminderRule[] | null {
  if (!Array.isArray(value)) return null

  const rules = value
    .map((rule): CalendarReminderRule | null => {
      if (!rule || typeof rule !== 'object') return null
      const candidate = rule as Record<string, unknown>

      const rawMinutes = typeof candidate.minutes === 'number'
        ? candidate.minutes
        : typeof candidate.minutes === 'string'
          ? Number(candidate.minutes)
          : null

      if (candidate.type === 'before_minutes' && typeof rawMinutes === 'number' && Number.isFinite(rawMinutes)) {
        const minutes = Math.max(0, Math.round(rawMinutes))
        return { type: 'before_minutes', minutes }
      }

      const rawHour = typeof candidate.hour === 'number'
        ? candidate.hour
        : typeof candidate.hour === 'string'
          ? Number(candidate.hour)
          : null
      const rawMinute = typeof candidate.minute === 'number'
        ? candidate.minute
        : typeof candidate.minute === 'string'
          ? Number(candidate.minute)
          : 0

      if (candidate.type === 'same_day_at' && typeof rawHour === 'number' && Number.isFinite(rawHour)) {
        const hour = Math.max(0, Math.min(23, Math.round(rawHour)))
        const minute = typeof rawMinute === 'number' && Number.isFinite(rawMinute)
          ? Math.max(0, Math.min(59, Math.round(rawMinute)))
          : 0
        return { type: 'same_day_at', hour, minute }
      }

      return null
    })
    .filter((rule): rule is CalendarReminderRule => Boolean(rule))

  return rules.length ? rules : null
}

function parseMeetingTarget(value: unknown): 8 | 16 | null {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : null

  return numeric === 8 || numeric === 16 ? numeric : null
}

function parseOptionalNumber(value: unknown) {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : null

  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : null
}

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
          reminder_config: parseReminderConfig(data.reminder_config),
          semester: data.semester ? String(data.semester) : null,
          mata_kuliah: data.mata_kuliah ? String(data.mata_kuliah) : null,
          meeting_target: parseMeetingTarget(data.meeting_target),
          student_count: parseOptionalNumber(data.student_count),
          course_code: data.course_code ? String(data.course_code) : null,
          location: data.location ? String(data.location) : null,
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
    case 'CLASS': {
      const meetings = item.data.meeting_target ? `${item.data.meeting_target} pertemuan` : 'kelas baru'
      return item.data.start_at ? `${meetings} · mulai ${new Date(item.data.start_at).toLocaleDateString('id-ID')}` : meetings
    }
    default:
      return ''
  }
}
