// ============================================================
// Route Handler: /api/calendar
// GET  — List calendar events (SWR endpoint)
// POST — Create calendar event
// ============================================================

import { type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/auth'
import {
  buildHolidayDateRangeForYear,
  ensureIndonesiaPublicHolidaysForYear,
  getIndonesiaPublicHolidaysForRange,
} from '@/lib/holidays'
import type { CalendarDisplayEvent, CalendarEvent } from '@/core/types'

function mapUserCalendarEvent(event: CalendarEvent): CalendarDisplayEvent {
  return {
    ...event,
    event_source: 'user',
    is_readonly: false,
    holiday_date: null,
  }
}

function buildMonthDateRange(month: string) {
  const [year, monthIndex] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0))
  const end = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59))

  return {
    from: start.toISOString(),
    to: end.toISOString(),
    fromDate: `${month}-01`,
    toDate: end.toISOString().slice(0, 10),
  }
}

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
      const range = buildMonthDateRange(month)
      query = query.gte('start_at', range.from).lte('start_at', range.to)
    }

    const role = searchParams.get('role')
    if (role) query = query.eq('contextual_role', role)

    const { data, error } = await query

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    const includeHolidays = searchParams.get('include_holidays') === '1'
    const userEvents = (data ?? []) as CalendarEvent[]

    if (!includeHolidays) {
      return Response.json(userEvents.map(mapUserCalendarEvent))
    }

    const holidayYearParam = searchParams.get('holiday_year')
    const derivedYear = month ? Number(month.split('-')[0]) : new Date().getFullYear()
    const holidayYear = holidayYearParam ? Number(holidayYearParam) : derivedYear

    const serviceClient = createServiceRoleClient()
    await ensureIndonesiaPublicHolidaysForYear(serviceClient, holidayYear)

    const dateRange = month
      ? (() => {
          const range = buildMonthDateRange(month)
          return { from: range.fromDate, to: range.toDate }
        })()
      : buildHolidayDateRangeForYear(holidayYear)

    const mergedEvents = [
      ...userEvents.map(mapUserCalendarEvent),
      ...await getIndonesiaPublicHolidaysForRange(serviceClient, dateRange),
    ].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

    return Response.json(mergedEvents)
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
        reminder_minutes: body.reminder_minutes ?? null,
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
