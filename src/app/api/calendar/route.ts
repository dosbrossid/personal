// ============================================================
// Route Handler: /api/calendar
// GET  — List calendar events (SWR endpoint)
// POST — Create calendar event
// ============================================================

import { type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

// GET /api/calendar?month=2026-04&role=dosen
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const { searchParams } = request.nextUrl

    let query = supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('start_at', { ascending: true })

    const month = searchParams.get('month')
    if (month) {
      // Filter by month: e.g., "2026-04" → start_at between 2026-04-01 and 2026-04-30
      const startOfMonth = `${month}-01T00:00:00`
      const [year, mon] = month.split('-').map(Number)
      const endOfMonth = new Date(year, mon, 0, 23, 59, 59).toISOString()
      query = query.gte('start_at', startOfMonth).lte('start_at', endOfMonth)
    }

    const role = searchParams.get('role')
    if (role) query = query.eq('contextual_role', role)

    const { data, error } = await query

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json(data)
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/calendar
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const body = await request.json()

    if (!body.title?.trim()) {
      return Response.json({ error: 'Title wajib diisi' }, { status: 400 })
    }
    if (!body.start_at) {
      return Response.json({ error: 'Waktu mulai wajib diisi' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        user_id: user.id,
        title: body.title.trim(),
        description: body.description || null,
        start_at: body.start_at,
        end_at: body.end_at || null,
        is_all_day: body.is_all_day || false,
        reminder_minutes: body.reminder_minutes || null,
        contextual_role: body.contextual_role || 'general',
        recurrence: body.recurrence || 'none',
      })
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json(data, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
