// ============================================================
// Route Handler: /api/dashboard/stats
// GET — Aggregated dashboard statistics (SWR endpoint)
// ============================================================

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { getTodayRangeInTimezone, getDateKeyInTimezone } from '@/lib/utils'
import { getHabitProgressSnapshot } from '@/lib/habits'

export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { data: profile } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', user.id)
      .maybeSingle()

    const timezone =
      typeof profile?.preferences === 'object' &&
      profile.preferences &&
      'timezone' in profile.preferences &&
      typeof profile.preferences.timezone === 'string'
        ? profile.preferences.timezone
        : 'Asia/Jakarta'

    const { todayKey, startIso, endIso } = getTodayRangeInTimezone(timezone)
    const habitReferenceDate = new Date(`${todayKey}T12:00:00`)

    const [tasks, habits, notes, events] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, status, priority, completed_at')
        .eq('user_id', user.id)
        .eq('is_deleted', false),
      supabase
        .from('habits')
        .select('id, cadence_mode, cadence_config, habit_logs(is_completed, log_date)')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('is_active', true),
      supabase
        .from('brain_notes')
        .select('id, is_pinned')
        .eq('user_id', user.id)
        .eq('is_deleted', false),
      supabase
        .from('calendar_events')
        .select('id, start_at')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .gte('start_at', startIso),
    ])

    // Calculate stats
    const taskData = tasks.data || []
    const activeTasks = taskData.filter(t => t.status !== 'done').length
    const urgentTasks = taskData.filter(t => t.priority === 'urgent' && t.status !== 'done').length
    const completedToday = taskData.filter(t =>
      t.completed_at && getDateKeyInTimezone(t.completed_at, timezone) === todayKey
    ).length

    // Habit completion: average progress of habits that are relevant today/this period
    const habitData = habits.data || []
    const habitSnapshots = habitData
      .map((habit) =>
        getHabitProgressSnapshot(
          {
            cadence_mode: habit.cadence_mode,
            cadence_config: habit.cadence_config,
            logs: ((habit.habit_logs as Array<{ is_completed: boolean; log_date: string }> | null) ?? []).map((log) => ({
              id: '',
              habit_id: habit.id,
              created_at: '',
              is_completed: log.is_completed,
              log_date: log.log_date,
            })),
          },
          habitReferenceDate
        )
      )
      .filter((snapshot) => snapshot.target > 0)
    const habitCompletion = habitSnapshots.length > 0
      ? Math.round(
          (habitSnapshots.reduce((total, snapshot) => total + snapshot.ratio, 0) / habitSnapshots.length) * 100
        )
      : 0

    const noteData = notes.data || []
    const totalNotes = noteData.length
    const pinnedNotes = noteData.filter(n => n.is_pinned).length

    const eventData = events.data || []
    const todayEvents = eventData.filter(e =>
      e.start_at >= startIso && e.start_at <= endIso
    ).length
    const upcomingEvents = eventData.length

    return Response.json({
      activeTasks,
      urgentTasks,
      completedToday,
      habitCompletion,
      totalNotes,
      pinnedNotes,
      todayEvents,
      upcomingEvents,
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
