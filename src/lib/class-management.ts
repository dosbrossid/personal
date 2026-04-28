import { addDays, format } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { ClassCourse, ClassSession } from '@/core/types'
import { queueCalendarReminderNotifications } from '@/lib/notification-queue'

const DEFAULT_CLASS_REMINDER_CONFIG = [
  { type: 'before_minutes', minutes: 1440 },
  { type: 'same_day_at', hour: 6, minute: 0 },
  { type: 'before_minutes', minutes: 15 },
] as const

interface CreateClassCourseInput {
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
}

interface CreateClassSessionInput {
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
}

export async function getUserTimezone(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('users')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle()

  const timezone = data?.preferences && typeof data.preferences === 'object'
    ? (data.preferences as { timezone?: string }).timezone
    : null

  return timezone || 'Asia/Jakarta'
}

function buildSessionTopicTitle(meetingNumber: number, explicitTitle?: string) {
  const trimmed = explicitTitle?.trim()
  if (trimmed) {
    return trimmed
  }

  return `Pertemuan ${meetingNumber}`
}

function buildCalendarTitle(courseName: string, meetingNumber: number, sessionTitle: string) {
  return `${courseName} · Pertemuan ${meetingNumber}${sessionTitle && sessionTitle !== `Pertemuan ${meetingNumber}` ? ` · ${sessionTitle}` : ''}`
}

function buildIsoForDateAndTime(dateKey: string, timeValue: string, timezone: string) {
  return fromZonedTime(`${dateKey}T${timeValue}`, timezone).toISOString()
}

export function buildGeneratedClassSessions(
  input: CreateClassCourseInput,
  timezone: string
) {
  const firstDate = new Date(`${input.first_session_date}T12:00:00`)

  return Array.from({ length: input.meeting_target }, (_, index) => {
    const meetingNumber = index + 1
    const date = addDays(firstDate, index * 7)
    const dateKey = format(date, 'yyyy-MM-dd')
    const title = buildSessionTopicTitle(meetingNumber)

    return {
      meeting_number: meetingNumber,
      title,
      description: null,
      session_date: dateKey,
      start_at: buildIsoForDateAndTime(dateKey, input.default_start_time, timezone),
      end_at: input.default_end_time
        ? buildIsoForDateAndTime(dateKey, input.default_end_time, timezone)
        : null,
      status: 'planned' as const,
      attendance_count: 0,
      assignment_given: false,
      assignment_title: null,
      assignment_due_at: null,
      reflection_note: null,
    }
  })
}

async function createCalendarEventForSession(
  supabase: SupabaseClient,
  payload: {
    userId: string
    courseName: string
    contextualRole: string
    location?: string | null
    session: Omit<ClassSession, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_deleted' | 'calendar_event_id'> | {
      meeting_number: number
      title: string
      description: string | null
      start_at: string
      end_at: string | null
      class_course_id: string
    }
  }
) {
  const descriptionLines = [
    payload.location ? `Lokasi: ${payload.location}` : null,
    payload.session.description || null,
  ].filter(Boolean)

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      user_id: payload.userId,
      title: buildCalendarTitle(payload.courseName, payload.session.meeting_number, payload.session.title),
      description: descriptionLines.length > 0 ? descriptionLines.join('\n\n') : null,
      start_at: payload.session.start_at,
      end_at: payload.session.end_at,
      is_all_day: false,
      reminder_minutes: 15,
      reminder_config: DEFAULT_CLASS_REMINDER_CONFIG,
      contextual_role: payload.contextualRole || 'dosen',
      recurrence: 'none',
      origin: 'class_management',
      source_metadata: {
        class_course_id: payload.session.class_course_id,
        meeting_number: payload.session.meeting_number,
      },
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await queueCalendarReminderNotifications(supabase, payload.userId, {
    id: data.id as string,
    title: buildCalendarTitle(payload.courseName, payload.session.meeting_number, payload.session.title),
    start_at: payload.session.start_at,
    reminder_minutes: 15,
    reminder_config: [...DEFAULT_CLASS_REMINDER_CONFIG],
  })

  return data.id as string
}

export async function syncCalendarEventForClassSession(
  supabase: SupabaseClient,
  payload: {
    userId: string
    courseName: string
    contextualRole: string
    location?: string | null
    sessionId: string
    meetingNumber: number
    title: string
    description?: string | null
    startAt: string
    endAt?: string | null
    classCourseId: string
    calendarEventId?: string | null
  }
) {
  const descriptionLines = [
    payload.location ? `Lokasi: ${payload.location}` : null,
    payload.description || null,
  ].filter(Boolean)

  const calendarPayload = {
    title: buildCalendarTitle(payload.courseName, payload.meetingNumber, payload.title),
    description: descriptionLines.length > 0 ? descriptionLines.join('\n\n') : null,
    start_at: payload.startAt,
    end_at: payload.endAt ?? null,
    reminder_minutes: 15,
    reminder_config: DEFAULT_CLASS_REMINDER_CONFIG,
    contextual_role: payload.contextualRole || 'dosen',
    origin: 'class_management',
    source_metadata: {
      class_course_id: payload.classCourseId,
      class_session_id: payload.sessionId,
      meeting_number: payload.meetingNumber,
    },
  }

  if (payload.calendarEventId) {
    const { error } = await supabase
      .from('calendar_events')
      .update(calendarPayload)
      .eq('id', payload.calendarEventId)
      .eq('user_id', payload.userId)

    if (error) {
      throw new Error(error.message)
    }

    await queueCalendarReminderNotifications(supabase, payload.userId, {
      id: payload.calendarEventId,
      title: calendarPayload.title,
      start_at: payload.startAt,
      reminder_minutes: 15,
      reminder_config: [...DEFAULT_CLASS_REMINDER_CONFIG],
    })

    return payload.calendarEventId
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      user_id: payload.userId,
      ...calendarPayload,
      is_all_day: false,
      reminder_minutes: 15,
      recurrence: 'none',
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await supabase
    .from('class_sessions')
    .update({ calendar_event_id: data.id })
    .eq('id', payload.sessionId)
    .eq('user_id', payload.userId)

  await queueCalendarReminderNotifications(supabase, payload.userId, {
    id: data.id as string,
    title: calendarPayload.title,
    start_at: payload.startAt,
    reminder_minutes: 15,
    reminder_config: [...DEFAULT_CLASS_REMINDER_CONFIG],
  })

  return data.id as string
}

export async function syncClassCourseStatus(supabase: SupabaseClient, courseId: string, userId: string) {
  const { data, error } = await supabase
    .from('class_courses')
    .select('meeting_target, completed_meeting_count, status')
    .eq('id', courseId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return
  }

  const nextStatus =
    data.completed_meeting_count >= data.meeting_target
      ? 'completed'
      : data.status === 'completed'
        ? 'active'
        : data.status

  if (nextStatus !== data.status) {
    const { error: updateError } = await supabase
      .from('class_courses')
      .update({ status: nextStatus })
      .eq('id', courseId)
      .eq('user_id', userId)

    if (updateError) {
      throw new Error(updateError.message)
    }
  }
}

export async function softDeleteCalendarEvent(
  supabase: SupabaseClient,
  userId: string,
  calendarEventId: string | null
) {
  if (!calendarEventId) return

  const { error } = await supabase
    .from('calendar_events')
    .update({ is_deleted: true })
    .eq('id', calendarEventId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function createClassCourseWithSessions(
  supabase: SupabaseClient,
  userId: string,
  input: CreateClassCourseInput
) {
  const timezone = await getUserTimezone(supabase, userId)
  const createdSessionIds: string[] = []
  const createdCalendarIds: string[] = []

  const { data: course, error: courseError } = await supabase
    .from('class_courses')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      course_code: input.course_code || null,
      semester_label: input.semester_label || null,
      meeting_target: input.meeting_target,
      student_count: input.student_count ?? 0,
      default_day_of_week:
        typeof input.default_day_of_week === 'number'
          ? input.default_day_of_week
          : new Date(`${input.first_session_date}T12:00:00`).getDay(),
      default_start_time: input.default_start_time,
      default_end_time: input.default_end_time || null,
      location: input.location || null,
      contextual_role: input.contextual_role || 'dosen',
      status: 'active',
      notes: input.notes || null,
    })
    .select()
    .single()

  if (courseError) {
    throw new Error(courseError.message)
  }

  try {
    const generatedSessions = buildGeneratedClassSessions(input, timezone)

    for (const sessionDraft of generatedSessions) {
      const calendarEventId = await createCalendarEventForSession(supabase, {
        userId,
        courseName: course.name,
        contextualRole: course.contextual_role,
        location: course.location,
        session: {
          ...sessionDraft,
          class_course_id: course.id,
        },
      })

      createdCalendarIds.push(calendarEventId)

      const { data: session, error: sessionError } = await supabase
        .from('class_sessions')
        .insert({
          user_id: userId,
          class_course_id: course.id,
          ...sessionDraft,
          calendar_event_id: calendarEventId,
        })
        .select()
        .single()

      if (sessionError) {
        throw new Error(sessionError.message)
      }

      createdSessionIds.push(session.id)
    }

    return course as ClassCourse
  } catch (error) {
    if (createdSessionIds.length > 0) {
      await supabase
        .from('class_sessions')
        .update({ is_deleted: true })
        .in('id', createdSessionIds)
    }

    if (createdCalendarIds.length > 0) {
      await supabase
        .from('calendar_events')
        .update({ is_deleted: true })
        .in('id', createdCalendarIds)
    }

    await supabase
      .from('class_courses')
      .update({ is_deleted: true })
      .eq('id', course.id)

    throw error
  }
}

export async function createSingleClassSession(
  supabase: SupabaseClient,
  payload: {
    userId: string
    course: ClassCourse
    session: CreateClassSessionInput
  }
) {
  const calendarEventId = await createCalendarEventForSession(supabase, {
    userId: payload.userId,
      courseName: payload.course.name,
      contextualRole: payload.course.contextual_role,
      location: payload.course.location,
      session: {
        class_course_id: payload.course.id,
        meeting_number: payload.session.meeting_number,
        title: payload.session.title?.trim() || buildSessionTopicTitle(payload.session.meeting_number),
        description: payload.session.description || null,
        start_at: payload.session.start_at,
        end_at: payload.session.end_at || null,
    },
  })

  const { data, error } = await supabase
    .from('class_sessions')
    .insert({
      user_id: payload.userId,
      class_course_id: payload.course.id,
      meeting_number: payload.session.meeting_number,
      title: payload.session.title?.trim() || buildSessionTopicTitle(payload.session.meeting_number),
      description: payload.session.description || null,
      session_date: payload.session.session_date,
      start_at: payload.session.start_at,
      end_at: payload.session.end_at || null,
      status: payload.session.status || 'planned',
      attendance_count: payload.session.attendance_count ?? 0,
      assignment_given: payload.session.assignment_given ?? false,
      assignment_title: payload.session.assignment_title || null,
      assignment_due_at: payload.session.assignment_due_at || null,
      reflection_note: payload.session.reflection_note || null,
      calendar_event_id: calendarEventId,
    })
    .select()
    .single()

  if (error) {
    await softDeleteCalendarEvent(supabase, payload.userId, calendarEventId)
    throw new Error(error.message)
  }

  return data as ClassSession
}
