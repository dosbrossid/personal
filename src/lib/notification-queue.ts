import { fromZonedTime } from 'date-fns-tz'

import type { CalendarEvent, CalendarReminderRule, Task } from '@/core/types'

type QueryResult = Promise<{ data: { preferences: unknown; telegram_chat_id: string | null } | null; error: { message: string } | null }>

interface UserSelectChain {
  eq: (column: string, value: string) => {
    single: () => QueryResult
  }
}

interface InsertChain {
  insert: (values: unknown) => Promise<{ error: { message: string } | null }>
}

interface DeleteFilterChain {
  eq: (column: string, value: string) => DeleteFilterChain & Promise<{ error: { message: string } | null }>
}

type NotificationClient = {
  from(table: 'users'): {
    select: (columns: string) => UserSelectChain
  }
  from(table: 'notifications'): InsertChain & {
    delete: () => DeleteFilterChain
  }
}

interface NotificationPreferenceSnapshot {
  pushEnabled: boolean
  telegramEnabled: boolean
  telegramChatId: string | null
  taskDeadline: boolean
  calendarEvent: boolean
  timezone: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

export async function getNotificationPreferenceSnapshot(
  supabase: unknown,
  userId: string
): Promise<NotificationPreferenceSnapshot> {
  const client = supabase as NotificationClient
  const { data, error } = await client
    .from('users')
    .select('preferences, telegram_chat_id')
    .eq('id', userId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const preferences = isRecord(data?.preferences) ? data.preferences : {}
  const notifications = isRecord(preferences.notifications) ? preferences.notifications : {}

  return {
    pushEnabled: readBoolean(notifications.push_enabled, true),
    telegramEnabled: readBoolean(notifications.telegram_enabled, false),
    telegramChatId: data?.telegram_chat_id ?? null,
    taskDeadline: readBoolean(notifications.task_deadline, true),
    calendarEvent: readBoolean(notifications.calendar_event, true),
    timezone: typeof preferences.timezone === 'string' ? preferences.timezone : 'Asia/Jakarta',
  }
}

async function enqueueNotifications(
  supabase: unknown,
  userId: string,
  channels: Array<'push' | 'telegram'>,
  payload: {
    title: string
    body: string
    reference_type: string
    reference_id: string
    scheduled_at: string
  }
) {
  if (!channels.length) return

  const client = supabase as NotificationClient

  const rows = channels.map((channel) => ({
    user_id: userId,
    channel,
    title: payload.title,
    body: payload.body,
    reference_type: payload.reference_type,
    reference_id: payload.reference_id,
    scheduled_at: payload.scheduled_at,
    status: 'pending',
  }))

  const { error } = await client.from('notifications').insert(rows)
  if (error) {
    throw new Error(error.message)
  }
}

async function clearPendingNotificationsForReference(
  supabase: unknown,
  userId: string,
  referenceType: string,
  referenceId: string
) {
  const client = supabase as NotificationClient
  const deleteQuery = client
    .from('notifications')
    .delete()

  const { error } = await (deleteQuery
    .eq('user_id', userId)
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .eq('status', 'pending') as Promise<{ error: { message: string } | null }>)

  if (error) {
    throw new Error(error.message)
  }
}

function resolveChannels(
  snapshot: NotificationPreferenceSnapshot
): Array<'push' | 'telegram'> {
  const channels: Array<'push' | 'telegram'> = []

  if (snapshot.pushEnabled) {
    channels.push('push')
  }

  if (snapshot.telegramEnabled && snapshot.telegramChatId) {
    channels.push('telegram')
  }

  return channels
}

export async function queueTaskDeadlineNotifications(
  supabase: unknown,
  userId: string,
  task: Pick<Task, 'id' | 'title' | 'due_date'>
) {
  if (!task.due_date) return

  const snapshot = await getNotificationPreferenceSnapshot(supabase, userId)
  if (!snapshot.taskDeadline) return

  await enqueueNotifications(supabase, userId, resolveChannels(snapshot), {
    title: 'Deadline task',
    body: `Deadline: ${task.title}`,
    reference_type: 'task',
    reference_id: task.id,
    scheduled_at: `${task.due_date}T08:00:00+07:00`,
  })
}

function getLocalDateKey(dateValue: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(new Date(dateValue))
}

export function normalizeCalendarReminderRules(
  event: Pick<CalendarEvent, 'reminder_minutes' | 'reminder_config'>
) {
  const normalizedRules = Array.isArray(event.reminder_config)
    ? event.reminder_config
        .map((rule): CalendarReminderRule | null => {
          if (rule.type === 'before_minutes') {
            const minutes = Math.max(0, Math.round(rule.minutes))
            return { type: 'before_minutes', minutes }
          }

          if (rule.type === 'same_day_at') {
            const hour = Math.max(0, Math.min(23, Math.round(rule.hour)))
            const minute = Math.max(0, Math.min(59, Math.round(rule.minute)))
            return { type: 'same_day_at', hour, minute }
          }

          return null
        })
        .filter((rule): rule is CalendarReminderRule => Boolean(rule))
    : []

  if (normalizedRules.length > 0) {
    return normalizedRules.filter((rule, index, rules) =>
      rules.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(rule)) === index
    )
  }

  if (event.reminder_minutes === null || event.reminder_minutes === undefined || event.reminder_minutes < 0) {
    return []
  }

  return [{ type: 'before_minutes', minutes: event.reminder_minutes } satisfies CalendarReminderRule]
}

export function getPrimaryReminderMinutes(rules: CalendarReminderRule[]) {
  return rules.find((rule) => rule.type === 'before_minutes')?.minutes ?? null
}

function buildReminderSchedules(
  event: Pick<CalendarEvent, 'title' | 'start_at' | 'reminder_minutes' | 'reminder_config'>,
  timezone: string
) {
  const rules = normalizeCalendarReminderRules(event)
  const startAt = new Date(event.start_at)

  return rules
    .map((rule) => {
      if (rule.type === 'before_minutes') {
        const scheduledAt = new Date(startAt)
        scheduledAt.setMinutes(scheduledAt.getMinutes() - rule.minutes)

        return {
          scheduled_at: scheduledAt.toISOString(),
          body:
            rule.minutes === 0
              ? `${event.title} dimulai sekarang`
              : `${event.title} dimulai dalam ${rule.minutes} menit`,
        }
      }

      const localDateKey = getLocalDateKey(event.start_at, timezone)
      const scheduledAt = fromZonedTime(
        `${localDateKey}T${String(rule.hour).padStart(2, '0')}:${String(rule.minute).padStart(2, '0')}:00`,
        timezone
      )

      return {
        scheduled_at: scheduledAt.toISOString(),
        body: `${event.title} mulai hari ini. Reminder jam ${String(rule.hour).padStart(2, '0')}:${String(rule.minute).padStart(2, '0')}`,
      }
    })
    .filter((item, index, array) => array.findIndex((candidate) => candidate.scheduled_at === item.scheduled_at) === index)
}

export async function queueCalendarReminderNotifications(
  supabase: unknown,
  userId: string,
  event: Pick<CalendarEvent, 'id' | 'title' | 'start_at' | 'reminder_minutes' | 'reminder_config'>
) {
  const snapshot = await getNotificationPreferenceSnapshot(supabase, userId)
  if (!snapshot.calendarEvent) return
  const schedules = buildReminderSchedules(event, snapshot.timezone)
  if (schedules.length === 0) return

  await clearPendingNotificationsForReference(supabase, userId, 'calendar', event.id)

  for (const schedule of schedules) {
    await enqueueNotifications(supabase, userId, resolveChannels(snapshot), {
      title: 'Reminder kalender',
      body: schedule.body,
      reference_type: 'calendar',
      reference_id: event.id,
      scheduled_at: schedule.scheduled_at,
    })
  }
}
