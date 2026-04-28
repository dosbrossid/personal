// ============================================================
// Server Actions: Calendar Events
// Handles: create, update, delete calendar events
// ============================================================

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import type { ActionResult, CalendarEvent } from '@/core/types'

async function createCalendarReminderNotification(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  event: Pick<CalendarEvent, 'id' | 'title' | 'start_at' | 'reminder_minutes'>
) {
  if (!event.reminder_minutes || event.reminder_minutes < 1) return

  const scheduledAt = new Date(event.start_at)
  scheduledAt.setMinutes(scheduledAt.getMinutes() - event.reminder_minutes)

  await supabase.from('notifications').insert({
    user_id: userId,
    channel: 'push',
    title: 'Reminder kalender',
    body: `${event.title} dimulai dalam ${event.reminder_minutes} menit`,
    reference_type: 'calendar',
    reference_id: event.id,
    scheduled_at: scheduledAt.toISOString(),
    status: 'pending',
  })
}

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

    const { data: event, error } = await supabase
      .from('calendar_events')
      .insert({
        user_id: user.id,
        title: data.title.trim(),
        description: data.description || null,
        start_at: data.start_at,
        end_at: data.end_at || null,
        is_all_day: data.is_all_day || false,
        reminder_minutes: data.reminder_minutes ?? null,
        contextual_role: data.contextual_role || 'general',
        recurrence: data.recurrence || 'none',
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    await createCalendarReminderNotification(supabase, user.id, event as CalendarEvent)
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
    contextual_role: string
    recurrence: string
  }>
): Promise<ActionResult<CalendarEvent>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { data: event, error } = await supabase
      .from('calendar_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    if (updates.start_at || typeof updates.reminder_minutes === 'number') {
      await createCalendarReminderNotification(supabase, user.id, event as CalendarEvent)
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
    await requireAuth()
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('calendar_events')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}
