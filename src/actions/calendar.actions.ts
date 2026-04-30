// ============================================================
// Server Actions: Calendar Events
// Handles: create, update, delete calendar events
// ============================================================

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import {
  getPrimaryReminderMinutes,
  normalizeCalendarReminderRules,
  queueCalendarReminderNotifications,
} from '@/lib/notification-queue'
import type { ActionResult, CalendarEvent, CalendarReminderRule } from '@/core/types'

/**
 * Create a new calendar event
 */
export async function createEvent(data: {
  title: string
  description?: string
  start_at: string
  end_at?: string | null
  is_all_day?: boolean
  reminder_minutes?: number | null
  reminder_config?: CalendarReminderRule[] | null
  contextual_role?: string
  recurrence?: string
}): Promise<ActionResult<CalendarEvent>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    if (!data.title?.trim()) {
      return { data: null, error: 'Title wajib diisi' }
    }
    if (!data.start_at) {
      return { data: null, error: 'Waktu mulai wajib diisi' }
    }

    const reminderConfig = normalizeCalendarReminderRules({
      reminder_minutes: data.reminder_minutes ?? null,
      reminder_config: data.reminder_config ?? [],
    })

    const { data: event, error } = await supabase
      .from('calendar_events')
      .insert({
        user_id: user.id,
        title: data.title.trim(),
        description: data.description || null,
        start_at: data.start_at,
        end_at: data.end_at || null,
        is_all_day: data.is_all_day || false,
        reminder_minutes: getPrimaryReminderMinutes(reminderConfig),
        reminder_config: reminderConfig,
        contextual_role: data.contextual_role || 'general',
        recurrence: data.recurrence || 'none',
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    await queueCalendarReminderNotifications(supabase, user.id, event as CalendarEvent)
    return { data: event as CalendarEvent, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Update an existing calendar event
 */
export async function updateEvent(
  id: string,
  updates: Partial<{
    title: string
    description: string | null
    start_at: string
    end_at: string | null
    is_all_day: boolean
    reminder_minutes: number | null
    reminder_config: CalendarReminderRule[] | null
    contextual_role: string
    recurrence: string
  }>
): Promise<ActionResult<CalendarEvent>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const normalizedUpdates = { ...updates }

    if ('reminder_config' in updates || 'reminder_minutes' in updates) {
      const reminderConfig = normalizeCalendarReminderRules({
        reminder_minutes: updates.reminder_minutes ?? null,
        reminder_config: updates.reminder_config ?? [],
      })
      normalizedUpdates.reminder_config = reminderConfig
      normalizedUpdates.reminder_minutes = getPrimaryReminderMinutes(reminderConfig)
    }

    const { data: event, error } = await supabase
      .from('calendar_events')
      .update(normalizedUpdates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    if (normalizedUpdates.start_at || 'reminder_minutes' in normalizedUpdates || Array.isArray(normalizedUpdates.reminder_config)) {
      await queueCalendarReminderNotifications(supabase, user.id, event as CalendarEvent)
    }
    return { data: event as CalendarEvent, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Soft delete a calendar event
 */
export async function deleteEvent(id: string): Promise<ActionResult<null>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('calendar_events')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}
