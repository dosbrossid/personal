import { type NextRequest } from 'next/server'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { createSingleClassSession } from '@/lib/class-management'
import type { ClassCourse, ClassSession } from '@/core/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('class_course_id', id)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('meeting_number', { ascending: true })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json((data ?? []) as ClassSession[])
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const supabase = await createServerClient()
    const body = await request.json()

    const { data: course, error: courseError } = await supabase
      .from('class_courses')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .single()

    if (courseError) {
      return Response.json({ error: courseError.message }, { status: 404 })
    }

    if (!body.meeting_number || !body.session_date || !body.start_at) {
      return Response.json({ error: 'Meeting number, session date, dan start_at wajib diisi' }, { status: 400 })
    }

    const session = await createSingleClassSession(supabase, {
      userId: user.id,
      course: course as ClassCourse,
      session: {
        class_course_id: id,
        meeting_number: Number(body.meeting_number),
        title: body.title,
        description: body.description || null,
        session_date: body.session_date,
        start_at: body.start_at,
        end_at: body.end_at || null,
        status: body.status || 'planned',
        attendance_count: Number(body.attendance_count || 0),
        assignment_given: Boolean(body.assignment_given),
        assignment_title: body.assignment_title || null,
        assignment_due_at: body.assignment_due_at || null,
        reflection_note: body.reflection_note || null,
      },
    })

    return Response.json(session, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: e instanceof Error ? e.message : 'Internal server error' }, { status: 500 })
  }
}
