import type { CalendarEvent, Task } from '@/core/types'

type QueryResult = Promise<{ data: { preferences: unknown; telegram_chat_id: string | null } | null; error: { message: string } | null }>

interface UserSelectChain {
  eq: (column: string, value: string) => {
    single: () => QueryResult
  }
}

interface InsertChain {
  insert: (values: unknown) => Promise<{ error: { message: string } | null }>
}

type NotificationClient = {
  from(table: 'users'): {
    select: (columns: string) => UserSelectChain
  }
  from(table: 'notifications'): InsertChain
}

interface NotificationPreferenceSnapshot {
  pushEnabled: boolean
  telegramEnabled: boolean
  telegramChatId: string | null
  taskDeadline: boolean
  calendarEvent: boolean
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

export async function queueCalendarReminderNotifications(
  supabase: unknown,
  userId: string,
  event: Pick<CalendarEvent, 'id' | 'title' | 'start_at' | 'reminder_minutes'>
) {
  if (event.reminder_minutes === null || event.reminder_minutes === undefined || event.reminder_minutes < 0) {
    return
  }

  const snapshot = await getNotificationPreferenceSnapshot(supabase, userId)
  if (!snapshot.calendarEvent) return

  const scheduledAt = new Date(event.start_at)
  scheduledAt.setMinutes(scheduledAt.getMinutes() - event.reminder_minutes)

  const body =
    event.reminder_minutes === 0
      ? `${event.title} dimulai sekarang`
      : `${event.title} dimulai dalam ${event.reminder_minutes} menit`

  await enqueueNotifications(supabase, userId, resolveChannels(snapshot), {
    title: 'Reminder kalender',
    body,
    reference_type: 'calendar',
    reference_id: event.id,
    scheduled_at: scheduledAt.toISOString(),
  })
}
