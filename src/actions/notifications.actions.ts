// ============================================================
// Server Actions: Notifications
// Handles notification queue mutations for the current user.
// ============================================================

'use server'

import { requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import type { ActionResult, Notification } from '@/core/types'

export async function createNotification(input: {
  channel?: 'push' | 'telegram'
  title: string
  body: string
  reference_type?: string | null
  reference_id?: string | null
  scheduled_at?: string | null
}): Promise<ActionResult<Notification>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    if (!input.title?.trim()) {
      return { data: null, error: 'Judul notifikasi wajib diisi' }
    }

    if (!input.body?.trim()) {
      return { data: null, error: 'Isi notifikasi wajib diisi' }
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        channel: input.channel ?? 'push',
        title: input.title.trim(),
        body: input.body.trim(),
        reference_type: input.reference_type ?? null,
        reference_id: input.reference_id ?? null,
        scheduled_at: input.scheduled_at ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: data as Notification, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

export async function markNotificationSent(id: string): Promise<ActionResult<Notification>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('notifications')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: data as Notification, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

export async function markAllNotificationsSent(): Promise<ActionResult<{ updated: number }>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('notifications')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .select('id')

    if (error) return { data: null, error: error.message }
    return { data: { updated: data?.length ?? 0 }, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}
