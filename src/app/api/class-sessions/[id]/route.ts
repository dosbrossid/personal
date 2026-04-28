import { type NextRequest } from 'next/server'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { softDeleteCalendarEvent, syncCalendarEventForClassSession, syncClassCourseStatus } from '@/lib/class-management'
import type { ClassCourse } from '@/core/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const supabase = await createServerClient()
    const body = await request.json()

    const { data: existing, error: existingError } = await supabase
      .from('class_sessions')
      .select('*, class_courses(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (existingError) {
      return Response.json({ error: existingError.message }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('class_sessions')
      .update(body)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    const course = existing.class_courses as ClassCourse
    await syncCalendarEventForClassSession(supabase, {
      userId: user.id,
      courseName: course.name,
      contextualRole: course.contextual_role,
      location: course.location,
      sessionId: id,
      meetingNumber: body.meeting_number ?? existing.meeting_number,
      title: body.title?.trim() || existing.title,
      description: body.description ?? existing.description,
      startAt: body.start_at ?? existing.start_at,
      endAt: body.end_at ?? existing.end_at,
      classCourseId: existing.class_course_id,
      calendarEventId: existing.calendar_event_id,
    })

    await syncClassCourseStatus(supabase, existing.class_course_id, user.id)
    return Response.json(data)
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: e instanceof Error ? e.message : 'Internal server error' }, { status: 500 })
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

    const { data: existing, error: existingError } = await supabase
      .from('class_sessions')
      .select('class_course_id, calendar_event_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (existingError) {
      return Response.json({ error: existingError.message }, { status: 404 })
    }

    await softDeleteCalendarEvent(supabase, user.id, existing.calendar_event_id)

    const { error } = await supabase
      .from('class_sessions')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    await syncClassCourseStatus(supabase, existing.class_course_id, user.id)
    return Response.json({ success: true })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
