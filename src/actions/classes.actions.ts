'use server'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import {
  createClassCourseWithSessions,
  createSingleClassSession,
  softDeleteCalendarEvent,
  syncCalendarEventForClassSession,
  syncClassCourseStatus,
} from '@/lib/class-management'
import type { ActionResult, ClassCourse, ClassSession } from '@/core/types'

function isInvalidTimeRange(start?: string | null, end?: string | null) {
  if (!start || !end) return false
  return new Date(end).getTime() <= new Date(start).getTime()
}

function isInvalidClockRange(start?: string | null, end?: string | null) {
  if (!start || !end) return false
  return end <= start
}

export async function createClassCourse(data: {
  name: string
  course_code?: string | null
  semester_label?: string | null
  meeting_target: 8 | 16
  student_count?: number
  first_session_date: string
  default_day_of_week?: number | null
  default_start_time: string
  default_end_time?: string | null
  location?: string | null
  contextual_role?: string
  notes?: string | null
}): Promise<ActionResult<ClassCourse>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    if (!data.name?.trim()) {
      return { data: null, error: 'Nama kelas wajib diisi' }
    }

    if (!data.first_session_date) {
      return { data: null, error: 'Tanggal pertemuan pertama wajib diisi' }
    }

    if (!data.default_start_time) {
      return { data: null, error: 'Jam mulai kelas wajib diisi' }
    }
    if (isInvalidClockRange(data.default_start_time, data.default_end_time)) {
      return { data: null, error: 'Jam selesai harus setelah jam mulai' }
    }

    const course = await createClassCourseWithSessions(supabase, user.id, data)
    return { data: course, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

export async function updateClassCourse(
  id: string,
  updates: Partial<{
    name: string
    course_code: string | null
    semester_label: string | null
    student_count: number
    default_day_of_week: number | null
    default_start_time: string | null
    default_end_time: string | null
    location: string | null
    contextual_role: string
    status: 'active' | 'completed' | 'archived'
    notes: string | null
  }>
): Promise<ActionResult<ClassCourse>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('class_courses')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: data as ClassCourse, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

export async function deleteClassCourse(id: string): Promise<ActionResult<null>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { data: sessions, error: sessionsError } = await supabase
      .from('class_sessions')
      .select('id, calendar_event_id')
      .eq('class_course_id', id)
      .eq('user_id', user.id)
      .eq('is_deleted', false)

    if (sessionsError) {
      return { data: null, error: sessionsError.message }
    }

    for (const session of sessions ?? []) {
      await softDeleteCalendarEvent(supabase, user.id, session.calendar_event_id)
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

    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

export async function createClassSession(data: {
  class_course_id: string
  meeting_number: number
  title?: string
  description?: string | null
  session_date: string
  start_at: string
  end_at?: string | null
  status?: 'planned' | 'completed' | 'canceled' | 'rescheduled'
  attendance_count?: number
  assignment_given?: boolean
  assignment_title?: string | null
  assignment_due_at?: string | null
  reflection_note?: string | null
}): Promise<ActionResult<ClassSession>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { data: course, error: courseError } = await supabase
      .from('class_courses')
      .select('*')
      .eq('id', data.class_course_id)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .single()

    if (courseError) {
      return { data: null, error: courseError.message }
    }
    if (isInvalidTimeRange(data.start_at, data.end_at)) {
      return { data: null, error: 'Jam selesai pertemuan harus setelah jam mulai' }
    }
    if (data.assignment_given && isInvalidTimeRange(data.start_at, data.assignment_due_at)) {
      return { data: null, error: 'Deadline tugas harus setelah jam mulai pertemuan' }
    }

    const session = await createSingleClassSession(supabase, {
      userId: user.id,
      course: course as ClassCourse,
      session: data,
    })

    await syncClassCourseStatus(supabase, course.id, user.id)
    return { data: session, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

export async function updateClassSession(
  id: string,
  updates: Partial<{
    meeting_number: number
    title: string
    description: string | null
    session_date: string
    start_at: string
    end_at: string | null
    status: 'planned' | 'completed' | 'canceled' | 'rescheduled'
    attendance_count: number
    assignment_given: boolean
    assignment_title: string | null
    assignment_due_at: string | null
    reflection_note: string | null
  }>
): Promise<ActionResult<ClassSession>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { data: existing, error: existingError } = await supabase
      .from('class_sessions')
      .select('*, class_courses(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (existingError) {
      return { data: null, error: existingError.message }
    }

    const nextStartAt = updates.start_at ?? existing.start_at
    const nextEndAt = updates.end_at ?? existing.end_at
    const nextAssignmentDueAt = updates.assignment_due_at ?? existing.assignment_due_at
    const nextAssignmentGiven = updates.assignment_given ?? existing.assignment_given

    if (isInvalidTimeRange(nextStartAt, nextEndAt)) {
      return { data: null, error: 'Jam selesai pertemuan harus setelah jam mulai' }
    }
    if (nextAssignmentGiven && isInvalidTimeRange(nextStartAt, nextAssignmentDueAt)) {
      return { data: null, error: 'Deadline tugas harus setelah jam mulai pertemuan' }
    }

    const { data: session, error } = await supabase
      .from('class_sessions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    const course = existing.class_courses as ClassCourse
    await syncCalendarEventForClassSession(supabase, {
      userId: user.id,
      courseName: course.name,
      contextualRole: course.contextual_role,
      location: course.location,
      sessionId: id,
      meetingNumber: updates.meeting_number ?? existing.meeting_number,
      title: updates.title?.trim() || existing.title,
      description: updates.description ?? existing.description,
      startAt: updates.start_at ?? existing.start_at,
      endAt: updates.end_at ?? existing.end_at,
      classCourseId: existing.class_course_id,
      calendarEventId: existing.calendar_event_id,
    })

    await syncClassCourseStatus(supabase, existing.class_course_id, user.id)
    return { data: session as ClassSession, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

export async function markClassSessionCompleted(
  id: string,
  payload?: {
    attendance_count?: number
    assignment_given?: boolean
    assignment_title?: string | null
    assignment_due_at?: string | null
    reflection_note?: string | null
  }
): Promise<ActionResult<ClassSession>> {
  return updateClassSession(id, {
    status: 'completed',
    attendance_count: payload?.attendance_count,
    assignment_given: payload?.assignment_given,
    assignment_title: payload?.assignment_title,
    assignment_due_at: payload?.assignment_due_at,
    reflection_note: payload?.reflection_note,
  })
}

export async function deleteClassSession(id: string): Promise<ActionResult<null>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { data: existing, error: existingError } = await supabase
      .from('class_sessions')
      .select('class_course_id, calendar_event_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (existingError) {
      return { data: null, error: existingError.message }
    }

    await softDeleteCalendarEvent(supabase, user.id, existing.calendar_event_id)

    const { error } = await supabase
      .from('class_sessions')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return { data: null, error: error.message }

    await syncClassCourseStatus(supabase, existing.class_course_id, user.id)
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}
