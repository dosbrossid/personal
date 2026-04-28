import { type NextRequest } from 'next/server'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { createClassCourseWithSessions } from '@/lib/class-management'
import type { ClassCourse, ClassSession } from '@/core/types'

function attachNextSessions(courses: ClassCourse[], sessions: ClassSession[]) {
  const nextSessionMap = new Map<string, ClassSession>()

  for (const session of sessions) {
    const existing = nextSessionMap.get(session.class_course_id)
    if (!existing) {
      nextSessionMap.set(session.class_course_id, session)
    }
  }

  return courses.map((course) => ({
    ...course,
    next_session: nextSessionMap.get(course.id) ?? null,
  }))
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const { searchParams } = request.nextUrl

    let query = supabase
      .from('class_courses')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    const status = searchParams.get('status')
    if (status) query = query.eq('status', status)

    const semester = searchParams.get('semester')
    if (semester) query = query.eq('semester_label', semester)

    const search = searchParams.get('query')
    if (search?.trim()) query = query.ilike('name', `%${search.trim()}%`)

    const { data: courses, error } = await query
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    const classCourses = (courses ?? []) as ClassCourse[]
    if (classCourses.length === 0) {
      return Response.json([])
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .in('class_course_id', classCourses.map((course) => course.id))
      .in('status', ['planned', 'rescheduled'])
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })

    if (sessionsError) {
      return Response.json({ error: sessionsError.message }, { status: 500 })
    }

    return Response.json(attachNextSessions(classCourses, (sessions ?? []) as ClassSession[]))
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const body = await request.json()

    if (!body.name?.trim()) {
      return Response.json({ error: 'Nama kelas wajib diisi' }, { status: 400 })
    }
    if (!body.first_session_date) {
      return Response.json({ error: 'Tanggal pertemuan pertama wajib diisi' }, { status: 400 })
    }
    if (!body.default_start_time) {
      return Response.json({ error: 'Jam mulai kelas wajib diisi' }, { status: 400 })
    }
    if (![8, 16].includes(Number(body.meeting_target))) {
      return Response.json({ error: 'Target pertemuan harus 8 atau 16' }, { status: 400 })
    }

    const course = await createClassCourseWithSessions(supabase, user.id, {
      name: body.name.trim(),
      course_code: body.course_code || null,
      semester_label: body.semester_label || null,
      meeting_target: Number(body.meeting_target) as 8 | 16,
      student_count: Number(body.student_count || 0),
      first_session_date: body.first_session_date,
      default_day_of_week: typeof body.default_day_of_week === 'number' ? body.default_day_of_week : null,
      default_start_time: body.default_start_time,
      default_end_time: body.default_end_time || null,
      location: body.location || null,
      contextual_role: body.contextual_role || 'dosen',
      notes: body.notes || null,
    })

    return Response.json(course, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: e instanceof Error ? e.message : 'Internal server error' }, { status: 500 })
  }
}
