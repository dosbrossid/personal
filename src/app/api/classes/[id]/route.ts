import { type NextRequest } from 'next/server'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import type { ClassCourse, ClassSession } from '@/core/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const supabase = await createServerClient()

    const { data: course, error } = await supabase
      .from('class_courses')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 404 })
    }

    const { data: nextSession } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('class_course_id', id)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .in('status', ['planned', 'rescheduled'])
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    return Response.json({
      ...(course as ClassCourse),
      next_session: (nextSession as ClassSession | null) ?? null,
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const supabase = await createServerClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from('class_courses')
      .update(body)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json(data)
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const supabase = await createServerClient()

    const { data: sessions, error: sessionsError } = await supabase
      .from('class_sessions')
      .select('calendar_event_id')
      .eq('class_course_id', id)
      .eq('user_id', user.id)
      .eq('is_deleted', false)

    if (sessionsError) {
      return Response.json({ error: sessionsError.message }, { status: 400 })
    }

    const calendarEventIds = (sessions ?? [])
      .map((session) => session.calendar_event_id)
      .filter((value): value is string => Boolean(value))

    if (calendarEventIds.length > 0) {
      await supabase
        .from('calendar_events')
        .update({ is_deleted: true })
        .in('id', calendarEventIds)
        .eq('user_id', user.id)
    }

    await supabase
      .from('class_sessions')
      .update({ is_deleted: true })
      .eq('class_course_id', id)
      .eq('user_id', user.id)

    const { error } = await supabase
      .from('class_courses')
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
