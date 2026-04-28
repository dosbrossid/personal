// ============================================================
// Route Handler: /api/habits/[id]/logs
// POST — Toggle habit log for a specific date
// ============================================================

import { type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

// POST /api/habits/:id/logs
// Body: { log_date: "2026-04-21" }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id: habitId } = await params
    const supabase = await createServerClient()
    const body = await request.json()

    const logDate = body.log_date
    if (!logDate) {
      return Response.json({ error: 'log_date wajib diisi' }, { status: 400 })
    }

    // Check if log already exists for this date
    const { data: existing } = await supabase
      .from('habit_logs')
      .select('id, is_completed')
      .eq('habit_id', habitId)
      .eq('log_date', logDate)
      .single()

    if (existing) {
      // Toggle: if completed → mark incomplete (delete), else → complete
      if (existing.is_completed) {
        // Un-complete: delete the log entry
        const { error } = await supabase
          .from('habit_logs')
          .delete()
          .eq('id', existing.id)

        if (error) {
          return Response.json({ error: error.message }, { status: 400 })
        }

        return Response.json({ toggled: false, message: 'Log removed' })
      } else {
        // Mark as completed
        const { data, error } = await supabase
          .from('habit_logs')
          .update({ is_completed: true })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) {
          return Response.json({ error: error.message }, { status: 400 })
        }

        return Response.json({ toggled: true, data })
      }
    } else {
      // Create new completed log
      const { data, error } = await supabase
        .from('habit_logs')
        .insert({
          habit_id: habitId,
          log_date: logDate,
          is_completed: true,
        })
        .select()
        .single()

      if (error) {
        return Response.json({ error: error.message }, { status: 400 })
      }

      return Response.json({ toggled: true, data }, { status: 201 })
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
