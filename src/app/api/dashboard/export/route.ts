// ============================================================
// Route Handler: /api/dashboard/export
// GET — Export dashboard snapshot for the authenticated user.
// ============================================================

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const [profile, tasks, notes, habits, events, notifications] = await Promise.all([
      supabase.from('users').select('id, email, full_name, preferences').eq('id', user.id).single(),
      supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, contextual_role, completed_at')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('brain_notes')
        .select('id, title, note_type, contextual_role, is_pinned, updated_at')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .limit(20),
      supabase
        .from('habits')
        .select('id, name, cadence_mode, cadence_config, contextual_role, is_active')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('calendar_events')
        .select('id, title, start_at, end_at, contextual_role, reminder_minutes')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('start_at', { ascending: true })
        .limit(20),
      supabase
        .from('notifications')
        .select('id, title, body, channel, status, scheduled_at, sent_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const payload = {
      exported_at: new Date().toISOString(),
      profile: profile.data ?? null,
      tasks: tasks.data ?? [],
      notes: notes.data ?? [],
      habits: habits.data ?? [],
      events: events.data ?? [],
      notifications: notifications.data ?? [],
    }

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="dashboard-export-${user.id}.json"`,
      },
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
