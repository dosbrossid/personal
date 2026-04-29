import { addDays, endOfWeek, startOfWeek } from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'
import type { RoleContext } from '@/core/constants'
import { getHabitCadenceLabel, getHabitProgressSnapshot } from '@/lib/habits'

interface TelegramQueryChain {
  select: (columns: string) => TelegramQueryChain
  eq: (column: string, value: string | boolean) => TelegramQueryChain
  neq: (column: string, value: string) => TelegramQueryChain
  gte: (column: string, value: string) => TelegramQueryChain
  lte: (column: string, value: string) => TelegramQueryChain
  in: (column: string, values: string[]) => TelegramQueryChain
  order: (
    column: string,
    options: {
      ascending: boolean
      nullsFirst?: boolean
    }
  ) => TelegramQueryChain
  limit: (value: number) => Promise<{ data: unknown[] | null }>
}

type TelegramRecallClient = {
  from: (table: string) => TelegramQueryChain
}

export interface TelegramRecallUser {
  id: string
  full_name: string
  preferences: {
    timezone?: string
    active_roles?: RoleContext[]
  } | null
}

type DateScope = 'today' | 'tomorrow' | 'day_after_tomorrow' | 'this_week' | 'upcoming'

const RECALL_KEYWORDS = [
  'apa',
  'siapa',
  'mana',
  'berapa',
  'kapan',
  'ringkas',
  'rekap',
  'overview',
  'fokus',
  'ingat',
  'cari',
  'cek',
  'lihat',
  'tunjukkan',
  'show',
  'summary',
  'recall',
  'task',
  'tugas',
  'agenda',
  'kalender',
  'jadwal',
  'catatan',
  'note',
  'habit',
  'kebiasaan',
  'vault',
  'dokumen',
  'jurnal',
  'materi',
  'rps',
  'silabus',
  'deadline',
  'meeting',
  'kelas',
  'bentrok',
]

const CREATE_KEYWORDS = [
  'buat',
  'bikinkan',
  'tambah',
  'tambahkan',
  'simpan',
  'jadwalkan',
  'ingatkan',
  'buatkan',
  'create',
]

const STOPWORDS = new Set([
  'apa',
  'aja',
  'ada',
  'yang',
  'saya',
  'aku',
  'gue',
  'di',
  'ke',
  'dari',
  'untuk',
  'dan',
  'atau',
  'the',
  'tentang',
  'milik',
  'punya',
  'jadi',
  'dong',
  'nih',
  'kah',
  'ya',
  'yg',
  'aku',
  'hari',
  'ini',
  'besok',
  'minggu',
  'bulan',
  'task',
  'tugas',
  'deadline',
  'tenggat',
  'jatuh',
  'tempo',
  'belum',
  'selesai',
  'kelar',
  'aktif',
  'open',
  'pending',
  'todo',
  'status',
  'semua',
  'daftar',
  'list',
  'agenda',
  'kalender',
  'jadwal',
  'catatan',
  'note',
  'habit',
  'kebiasaan',
  'vault',
  'dokumen',
])

function normalizeInput(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function containsAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value))
}

function isLikelyRecallIntent(input: string) {
  return containsAny(input, RECALL_KEYWORDS) || input.includes('?')
}

function isLikelyCreateIntent(input: string) {
  return containsAny(input, CREATE_KEYWORDS)
}

function getTimezone(user: TelegramRecallUser) {
  return user.preferences?.timezone?.trim() || 'Asia/Jakarta'
}

function formatDateKey(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd')
}

function buildDayRange(date: Date, timezone: string) {
  const dayKey = formatDateKey(date, timezone)
  return {
    label: formatIndonesianDate(fromZonedTime(`${dayKey}T00:00:00`, timezone), timezone),
    fromDateKey: dayKey,
    toDateKey: dayKey,
    fromIso: fromZonedTime(`${dayKey}T00:00:00`, timezone).toISOString(),
    toIso: fromZonedTime(`${dayKey}T23:59:59`, timezone).toISOString(),
  }
}

function buildDateScope(scope: DateScope, timezone: string) {
  const zonedNow = toZonedTime(new Date(), timezone)

  if (scope === 'today') {
    return buildDayRange(zonedNow, timezone)
  }

  if (scope === 'tomorrow') {
    return buildDayRange(addDays(zonedNow, 1), timezone)
  }

  if (scope === 'day_after_tomorrow') {
    return buildDayRange(addDays(zonedNow, 2), timezone)
  }

  if (scope === 'this_week') {
    const start = startOfWeek(zonedNow, { weekStartsOn: 1 })
    const end = endOfWeek(zonedNow, { weekStartsOn: 1 })
    const fromDateKey = formatDateKey(start, timezone)
    const toDateKey = formatDateKey(end, timezone)

    return {
      label: 'pekan ini',
      fromDateKey,
      toDateKey,
      fromIso: fromZonedTime(`${fromDateKey}T00:00:00`, timezone).toISOString(),
      toIso: fromZonedTime(`${toDateKey}T23:59:59`, timezone).toISOString(),
    }
  }

  const startKey = formatDateKey(zonedNow, timezone)
  const endKey = formatDateKey(addDays(zonedNow, 7), timezone)
  return {
    label: '7 hari ke depan',
    fromDateKey: startKey,
    toDateKey: endKey,
    fromIso: fromZonedTime(`${startKey}T00:00:00`, timezone).toISOString(),
    toIso: fromZonedTime(`${endKey}T23:59:59`, timezone).toISOString(),
  }
}

function resolveDateScope(input: string): DateScope {
  if (input.includes('lusa')) return 'day_after_tomorrow'
  if (input.includes('besok')) return 'tomorrow'
  if (input.includes('minggu ini') || input.includes('pekan ini')) return 'this_week'
  if (input.includes('hari ini') || input.includes('today')) return 'today'
  return 'upcoming'
}

function hasExplicitDateScope(input: string) {
  return containsAny(input, ['hari ini', 'today', 'besok', 'lusa', 'minggu ini', 'pekan ini'])
}

function isDeadlineRecall(input: string) {
  return containsAny(input, ['deadline', 'tenggat', 'jatuh tempo'])
}

function extractKeywords(input: string) {
  return input
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
    .slice(0, 4)
}

function formatIndonesianDate(value: Date | string, timezone: string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function formatIndonesianDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function handleOverviewRecall(client: TelegramRecallClient, user: TelegramRecallUser, input: string) {
  const timezone = getTimezone(user)
  const scope = buildDateScope(resolveDateScope(input), timezone)

  const [tasksResult, eventsResult, habitsResult] = await Promise.all([
    client
      .from('tasks')
      .select('title, priority, due_date')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .neq('status', 'done')
      .gte('due_date', scope.fromDateKey)
      .lte('due_date', scope.toDateKey)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(5),
    client
      .from('calendar_events')
      .select('title, start_at')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .gte('start_at', scope.fromIso)
      .lte('start_at', scope.toIso)
      .order('start_at', { ascending: true })
      .limit(5),
    client
      .from('habits')
      .select('name, cadence_mode, cadence_config, habit_logs(log_date, is_completed)')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const tasks = (tasksResult.data ?? []) as Array<{ title: string; priority: string; due_date: string | null }>
  const events = (eventsResult.data ?? []) as Array<{ title: string; start_at: string }>

  const taskLines = tasks.length
    ? tasks.map((task, index) => `${index + 1}. ${task.title} (${task.priority}${task.due_date ? ` · ${task.due_date}` : ''})`).join('\n')
    : 'Tidak ada task jatuh tempo di rentang ini.'

  const eventLines = events.length
    ? events.map((event, index) => `${index + 1}. ${event.title} (${formatIndonesianDateTime(event.start_at, timezone)})`).join('\n')
    : 'Tidak ada agenda di rentang ini.'

  const habits = ((habitsResult.data ?? []) as Array<Record<string, unknown>>).map((habit) => ({
    name: String(habit.name),
    cadence_mode: String(habit.cadence_mode),
    cadence_config: (habit.cadence_config ?? {}) as Record<string, unknown>,
    logs: ((habit.habit_logs as Array<{ log_date: string; is_completed: boolean }> | null) ?? []).map((log) => ({
      log_date: log.log_date,
      is_completed: log.is_completed,
    })),
  }))

  const habitLines = habits.length
    ? habits
        .map((habit, index) => {
          const snapshot = getHabitProgressSnapshot(habit as unknown as Parameters<typeof getHabitProgressSnapshot>[0], new Date())
          const status = snapshot.isExpectedToday
            ? snapshot.completed > 0
              ? 'sudah tercatat'
              : 'belum dicentang'
            : 'tidak dijadwalkan hari ini'

          return `${index + 1}. ${habit.name} (${getHabitCadenceLabel(habit as unknown as Parameters<typeof getHabitCadenceLabel>[0])} · ${status})`
        })
        .join('\n')
    : 'Tidak ada habit aktif.'

  return [
    `Ringkasan ${scope.label} untuk ${user.full_name}:`,
    '',
    'Task:',
    taskLines,
    '',
    'Agenda:',
    eventLines,
    '',
    'Habit:',
    habitLines,
  ].join('\n')
}

async function handleTaskRecall(client: TelegramRecallClient, user: TelegramRecallUser, input: string) {
  const timezone = getTimezone(user)
  const scope = buildDateScope(resolveDateScope(input), timezone)
  const urgentOnly = input.includes('urgent') || input.includes('prioritas') || input.includes('penting')
  const explicitDateScope = hasExplicitDateScope(input)
  const deadlineRecall = isDeadlineRecall(input)

  let query: TelegramQueryChain = client
    .from('tasks')
    .select('title, priority, due_date, status, contextual_role')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .neq('status', 'done')

  if (urgentOnly) {
    query = query.in('priority', ['high', 'urgent'])
  }

  if (explicitDateScope) {
    query = query.gte('due_date', scope.fromDateKey).lte('due_date', scope.toDateKey)
  }

  const keywords = extractKeywords(input)
  const dataResult = await query.order('due_date', { ascending: true, nullsFirst: false }).limit(6)
  let tasks = (dataResult.data ?? []) as Array<{ title: string; priority: string; due_date: string | null; status: string; contextual_role: string }>

  if (deadlineRecall) {
    tasks = tasks.filter((task) => task.due_date)
  }

  if (keywords.length) {
    tasks = tasks.filter((task) =>
      keywords.some((keyword) =>
        `${task.title} ${task.contextual_role} ${task.priority}`.toLowerCase().includes(keyword)
      )
    )
  }

  if (!tasks.length) {
    const emptyScope = explicitDateScope
      ? `di rentang ${scope.label}`
      : deadlineRecall
        ? 'di daftar deadline aktif'
        : 'di daftar task aktif'

    return `Saya belum menemukan task yang cocok untuk pertanyaan itu ${emptyScope}.`
  }

  const header = deadlineRecall
    ? 'Deadline task yang saya temukan:'
    : explicitDateScope
      ? `Task ${scope.label} yang saya temukan:`
      : 'Task aktif yang saya temukan:'

  return `${header}\n${tasks
    .map((task, index) => `${index + 1}. ${task.title} (${task.status} · ${task.priority}${task.due_date ? ` · due ${task.due_date}` : ''} · role ${task.contextual_role})`)
    .join('\n')}`
}

async function handleCalendarRecall(client: TelegramRecallClient, user: TelegramRecallUser, input: string) {
  const timezone = getTimezone(user)
  const scope = buildDateScope(resolveDateScope(input), timezone)

  const dataResult = await client
    .from('calendar_events')
    .select('title, start_at, end_at, contextual_role')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .gte('start_at', scope.fromIso)
    .lte('start_at', scope.toIso)
    .order('start_at', { ascending: true })
    .limit(8)

  const events = (dataResult.data ?? []) as Array<{ title: string; start_at: string; end_at: string | null; contextual_role: string }>
  const keywords = extractKeywords(input)
  const filteredEvents = keywords.length
    ? events.filter((event) =>
        keywords.some((keyword) =>
          `${event.title} ${event.contextual_role}`.toLowerCase().includes(keyword)
        )
      )
    : events

  if (!filteredEvents.length) {
    return `Belum ada agenda yang cocok untuk ${scope.label}.`
  }

  return `Agenda ${scope.label}:\n${filteredEvents
    .map((event, index) => `${index + 1}. ${event.title} (${formatIndonesianDateTime(event.start_at, timezone)} · role ${event.contextual_role})`)
    .join('\n')}`
}

async function handleNotesRecall(client: TelegramRecallClient, user: TelegramRecallUser, input: string) {
  const keywords = extractKeywords(input)
  const wantsPinned = input.includes('pinned') || input.includes('pin')

  let query: TelegramQueryChain = client
    .from('brain_notes')
    .select('title, content_body, source_url, note_type, is_pinned, updated_at')
    .eq('user_id', user.id)
    .eq('is_deleted', false)

  if (wantsPinned) {
    query = query.eq('is_pinned', true)
  }

  const noteResult = await query.order('updated_at', { ascending: false }).limit(8)
  let notes = (noteResult.data ?? []) as Array<{ title: string; content_body: string; source_url: string | null; note_type: string; is_pinned: boolean; updated_at: string }>

  if (keywords.length) {
    notes = notes.filter((note) =>
      keywords.some((keyword) =>
        `${note.title} ${note.content_body} ${note.source_url ?? ''} ${note.note_type}`.toLowerCase().includes(keyword)
      )
    )
  }

  if (!notes.length) {
    return wantsPinned
      ? 'Belum ada catatan pinned yang cocok.'
      : 'Saya belum menemukan catatan yang cocok untuk pertanyaan itu.'
  }

  return `Catatan yang saya temukan:\n${notes
    .slice(0, 5)
    .map((note, index) => {
      const excerpt = note.content_body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)
      return `${index + 1}. ${note.title}${note.is_pinned ? ' [pinned]' : ''}\n   ${excerpt || note.note_type}${note.source_url ? ` · ${note.source_url}` : ''}`
    })
    .join('\n')}`
}

async function handleVaultRecall(client: TelegramRecallClient, user: TelegramRecallUser, input: string) {
  const keywords = extractKeywords(input)
  const vaultResult = await client
    .from('academic_vault_items')
    .select('title, description, document_type, file_format, semester, mata_kuliah, updated_at')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .limit(10)

  let items = (vaultResult.data ?? []) as Array<{ title: string; description: string | null; document_type: string; file_format: string; semester: string | null; mata_kuliah: string | null; updated_at: string }>
  if (keywords.length) {
    items = items.filter((item) =>
      keywords.some((keyword) =>
        `${item.title} ${item.description ?? ''} ${item.document_type} ${item.file_format} ${item.semester ?? ''} ${item.mata_kuliah ?? ''}`.toLowerCase().includes(keyword)
      )
    )
  }

  if (!items.length) {
    return 'Saya belum menemukan dokumen vault yang cocok.'
  }

  return `Dokumen vault yang cocok:\n${items
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${item.title} (${item.document_type}${item.mata_kuliah ? ` · ${item.mata_kuliah}` : ''}${item.semester ? ` · ${item.semester}` : ''})`)
    .join('\n')}`
}

async function handleHabitsRecall(client: TelegramRecallClient, user: TelegramRecallUser) {
  const habitsResult = await client
    .from('habits')
    .select('name, cadence_mode, cadence_config, habit_logs(log_date, is_completed)')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(8)

  const habits = ((habitsResult.data ?? []) as Array<Record<string, unknown>>).map((habit) => ({
    name: String(habit.name),
    cadence_mode: String(habit.cadence_mode),
    cadence_config: (habit.cadence_config ?? {}) as Record<string, unknown>,
    logs: ((habit.habit_logs as Array<{ log_date: string; is_completed: boolean }> | null) ?? []).map((log) => ({
      log_date: log.log_date,
      is_completed: log.is_completed,
    })),
  }))

  if (!habits.length) {
    return 'Belum ada habit aktif.'
  }

  return `Habit aktif:\n${habits
    .map((habit, index) => {
      const snapshot = getHabitProgressSnapshot(habit as unknown as Parameters<typeof getHabitProgressSnapshot>[0], new Date())
      const status = snapshot.target === 0
        ? 'tidak dijadwalkan hari ini'
        : snapshot.completed > 0
          ? 'sudah tercatat'
          : 'belum dicentang'

      return `${index + 1}. ${habit.name} (${getHabitCadenceLabel(habit as unknown as Parameters<typeof getHabitCadenceLabel>[0])} · ${status})`
    })
    .join('\n')}`
}

async function handleConflictRecall(client: TelegramRecallClient, user: TelegramRecallUser) {
  const timezone = getTimezone(user)
  const scope = buildDateScope('upcoming', timezone)

  const [taskResult, eventResult] = await Promise.all([
    client
      .from('tasks')
      .select('title, due_date')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .neq('status', 'done')
      .gte('due_date', scope.fromDateKey)
      .lte('due_date', scope.toDateKey)
      .order('due_date', { ascending: true })
      .limit(20),
    client
      .from('calendar_events')
      .select('title, start_at')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .gte('start_at', scope.fromIso)
      .lte('start_at', scope.toIso)
      .order('start_at', { ascending: true })
      .limit(20),
  ])

  const tasksByDate = new Map<string, string[]>()
  for (const task of (taskResult.data ?? []) as Array<{ title: string; due_date: string | null }>) {
    if (!task.due_date) continue
    tasksByDate.set(task.due_date, [...(tasksByDate.get(task.due_date) ?? []), task.title])
  }

  const conflicts = ((eventResult.data ?? []) as Array<{ title: string; start_at: string }>)
    .map((event) => {
      const dateKey = formatDateKey(new Date(event.start_at), timezone)
      const tasks = tasksByDate.get(dateKey) ?? []
      return tasks.length
        ? {
            dateKey,
            eventTitle: event.title,
            tasks,
          }
        : null
    })
    .filter((value): value is { dateKey: string; eventTitle: string; tasks: string[] } => Boolean(value))

  if (!conflicts.length) {
    return 'Belum terlihat benturan jadwal yang menonjol dalam 7 hari ke depan.'
  }

  return `Potensi bentrok 7 hari ke depan:\n${conflicts
    .slice(0, 5)
    .map((conflict, index) => `${index + 1}. ${conflict.dateKey}: agenda "${conflict.eventTitle}" bareng task ${conflict.tasks.join(', ')}`)
    .join('\n')}`
}

export async function buildTelegramSmartRecallReply(
  client: TelegramRecallClient,
  user: TelegramRecallUser,
  rawInput: string
) {
  const input = normalizeInput(rawInput)

  if (!isLikelyRecallIntent(input) || isLikelyCreateIntent(input)) {
    return null
  }

  if (input.includes('bentrok') || input.includes('tabrakan') || input.includes('conflict')) {
    return handleConflictRecall(client, user)
  }

  if (
    input.includes('hari ini') ||
    input.includes('besok') ||
    input.includes('minggu ini') ||
    input.includes('pekan ini') ||
    input.includes('fokus') ||
    input.includes('yang harus saya')
  ) {
    return handleOverviewRecall(client, user, input)
  }

  if (containsAny(input, ['task', 'tugas', 'deadline', 'prioritas'])) {
    return handleTaskRecall(client, user, input)
  }

  if (containsAny(input, ['agenda', 'kalender', 'jadwal', 'meeting', 'kelas', 'ngajar', 'event'])) {
    return handleCalendarRecall(client, user, input)
  }

  if (containsAny(input, ['catatan', 'note', 'ide', 'pinned', 'pin'])) {
    return handleNotesRecall(client, user, input)
  }

  if (containsAny(input, ['habit', 'kebiasaan', 'rutinitas', 'gym', 'nggym'])) {
    return handleHabitsRecall(client, user)
  }

  if (containsAny(input, ['vault', 'dokumen', 'jurnal', 'materi', 'rps', 'silabus', 'arsip'])) {
    return handleVaultRecall(client, user, input)
  }

  return null
}
