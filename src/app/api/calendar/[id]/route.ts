// ============================================================
// Route Handler: /api/calendar/[id]
// PATCH  — Update calendar event
// DELETE — Soft delete calendar event
// ============================================================

import { type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import {
  getPrimaryReminderMinutes,
  normalizeCalendarReminderRules,
  queueCalendarReminderNotifications,
} from '@/lib/notification-queue'
import type { CalendarEvent, CalendarReminderRule } from '@/core/types'

// PATCH /api/calendar/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const supabase = await createServerClient()
    const body = await request.json()
    const updates = { ...body }

    if ('reminder_config' in updates || 'reminder_minutes' in updates) {
      const reminderConfig = normalizeCalendarReminderRules({
        reminder_minutes: typeof updates.reminder_minutes === 'number' ? updates.reminder_minutes : null,
        reminder_config: (updates.reminder_config as CalendarReminderRule[] | undefined) ?? [],
      })
      updates.reminder_config = reminderConfig
      updates.reminder_minutes = getPrimaryReminderMinutes(reminderConfig)
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    if ('start_at' in updates || 'reminder_minutes' in updates || 'reminder_config' in updates) {
      await queueCalendarReminderNotifications(supabase, user.id, data as CalendarEvent)
    }

    return Response.json(data)
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/calendar/:id (soft delete)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('calendar_events')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json({ success: true })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
