// ============================================================
// Route Handler: /api/webhook/telegram
// POST — Trusted Telegram webhook, guarded by Telegram secret token.
// ============================================================

import { type NextRequest } from 'next/server'
import { addDays } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { sendTelegramMessage } from '@/lib/telegram'
import { callLLM } from '@/lib/ai/client'
import { buildAIExecutionMessage, executeAIResponseItemsWithClient } from '@/lib/ai/command-hub'
import { buildAssistantSystemPrompt } from '@/lib/ai/prompts'
import { buildTelegramSmartRecallReply } from '@/lib/telegram-recall'
import { queueCalendarReminderNotifications } from '@/lib/notification-queue'
import type { AIResponse, AIResponseItem } from '@/core/types'
import type { RoleContext } from '@/core/constants'
import { getHabitCadenceLabel } from '@/lib/habits'

interface TelegramUpdate {
  message?: {
    message_id: number
    text?: string
    chat: {
      id: number
      first_name?: string
      username?: string
    }
  }
}

interface LinkedUser {
  id: string
  full_name: string
  telegram_chat_id: string | null
  preferences: {
    timezone?: string
    active_roles?: RoleContext[]
  } | null
}

function validateTelegramSecret(request: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expectedSecret) return false

  const headerSecret = request.headers.get('x-telegram-bot-api-secret-token')
  const querySecret = request.nextUrl.searchParams.get('secret')

  return headerSecret === expectedSecret || querySecret === expectedSecret
}

function getTodayDateInJakarta() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatDraft(items: AIResponseItem[], message: string, timezone = 'Asia/Jakarta') {
  if (items.length === 0) return message

  const itemLines = items
    .map((item, index) => `${index + 1}. ${item.action}: ${item.data.title}\n   ${mapTelegramDraftDetail(item, timezone)}`)
    .join('\n')

  return `${message}\n\nDraft:\n${itemLines}\n\nBalas /confirm untuk menyimpan lewat Telegram atau buka aplikasi untuk review penuh.`
}

function mapTelegramDraftDetail(item: AIResponseItem, timezone: string) {
  switch (item.action) {
    case 'TASK':
      return item.data.due_date ? `Due: ${item.data.due_date.split('T')[0]}` : 'No due date'
    case 'CALENDAR':
      return item.data.start_at
        ? formatInTimeZone(new Date(item.data.start_at), timezone, 'd MMM HH.mm')
        : 'Event baru'
    case 'NOTE':
      return item.data.description?.slice(0, 60) || 'Catatan baru'
    case 'ACADEMIC': {
      const mk = item.data.mata_kuliah ? ` · ${item.data.mata_kuliah}` : ''
      return `${item.data.file_format ?? 'Dokumen'}${mk}`
    }
  }
}

function parseStoredAIResponse(value: unknown): AIResponse | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<AIResponse>
  if (!Array.isArray(candidate.items)) return null
  if (typeof candidate.ai_message !== 'string') return null

  return candidate as AIResponse
}

async function buildTelegramAIContext(user: LinkedUser, input: string) {
  const supabase = createServiceRoleClient()

  const [
    categoriesResult,
    tasksResult,
    eventsResult,
    habitsResult,
    notesResult,
    vaultResult,
  ] = await Promise.all([
    supabase
      .from('categories')
      .select('name, contextual_role')
      .eq('user_id', user.id)
      .eq('is_deleted', false),
    supabase
      .from('tasks')
      .select('title, status, priority, due_date, contextual_role, description')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from('calendar_events')
      .select('title, start_at, end_at, contextual_role, description')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .gte('start_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('start_at', { ascending: true })
      .limit(15),
    supabase
      .from('habits')
      .select('name, cadence_mode, cadence_config')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('brain_notes')
      .select('title, content_body, note_type, contextual_role, updated_at')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .limit(8),
    supabase
      .from('academic_vault_items')
      .select('title, description, document_type, mata_kuliah, semester, updated_at')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .limit(8),
  ])

  const timezone = user.preferences?.timezone || 'Asia/Jakarta'
  const activeRoles = user.preferences?.active_roles?.length
    ? user.preferences.active_roles
    : ['dosen', 'creator', 'affiliate', 'consultant', 'general']

  const systemPrompt = buildAssistantSystemPrompt({
    currentDatetimeISO: new Date().toISOString(),
    userTimezone: timezone,
    utcOffset: timezone === 'Asia/Jakarta' ? '+07:00' : '+00:00',
    userCategories: (categoriesResult.data ?? []).map((category) => ({
      name: String(category.name),
      role: category.contextual_role as RoleContext,
    })),
    userActiveRoles: activeRoles as RoleContext[],
    dashboardContext: buildTelegramDashboardSnapshot({
      tasks: tasksResult.data ?? [],
      events: eventsResult.data ?? [],
      habits: habitsResult.data ?? [],
      notes: notesResult.data ?? [],
      vault: vaultResult.data ?? [],
      timezone,
    }),
  })

  return [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: input.trim() },
  ]
}

function cleanSnippet(value: string | null | undefined, maxLength = 110) {
  return (value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function formatTelegramLocalDateTime(value: string | Date, timezone: string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function buildTelegramDashboardSnapshot(params: {
  tasks: Array<{
    title: string
    status: string
    priority: string
    due_date: string | null
    contextual_role: string
    description: string | null
  }>
  events: Array<{
    title: string
    start_at: string
    end_at: string | null
    contextual_role: string
    description: string | null
  }>
  habits: Array<{
    name: string
    cadence_mode: string
    cadence_config: unknown
  }>
  notes: Array<{
    title: string
    content_body: string
    note_type: string
    contextual_role: string
    updated_at: string
  }>
  vault: Array<{
    title: string
    description: string | null
    document_type: string
    mata_kuliah: string | null
    semester: string | null
    updated_at: string
  }>
  timezone: string
}) {
  const taskLines = params.tasks.length
    ? params.tasks
        .map((task, index) => {
          const due = task.due_date ? `due ${task.due_date}` : 'no due date'
          const desc = cleanSnippet(task.description)
          return `${index + 1}. ${task.title} | status ${task.status} | ${task.priority} | ${due} | role ${task.contextual_role}${desc ? ` | note ${desc}` : ''}`
        })
        .join('\n')
    : 'No active tasks.'

  const eventLines = params.events.length
    ? params.events
        .map((event, index) => {
          const startAt = new Intl.DateTimeFormat('id-ID', {
            timeZone: params.timezone,
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(event.start_at))
          const desc = cleanSnippet(event.description)
          return `${index + 1}. ${event.title} | ${startAt} | role ${event.contextual_role}${desc ? ` | note ${desc}` : ''}`
        })
        .join('\n')
    : 'No upcoming calendar events.'

  const habitLines = params.habits.length
    ? params.habits
        .map((habit, index) => `${index + 1}. ${habit.name} | cadence ${habit.cadence_mode}`)
        .join('\n')
    : 'No active habits.'

  const noteLines = params.notes.length
    ? params.notes
        .map((note, index) => {
          const excerpt = cleanSnippet(note.content_body)
          return `${index + 1}. ${note.title} | ${note.note_type} | role ${note.contextual_role}${excerpt ? ` | ${excerpt}` : ''}`
        })
        .join('\n')
    : 'No recent notes.'

  const vaultLines = params.vault.length
    ? params.vault
        .map((item, index) => {
          const parts = [item.document_type, item.mata_kuliah, item.semester].filter(Boolean).join(' | ')
          const desc = cleanSnippet(item.description)
          return `${index + 1}. ${item.title} | ${parts || 'vault item'}${desc ? ` | ${desc}` : ''}`
        })
        .join('\n')
    : 'No recent vault items.'

  return [
    'ACTIVE TASKS / DEADLINES:',
    taskLines,
    '',
    'UPCOMING / RECENT CALENDAR EVENTS:',
    eventLines,
    '',
    'ACTIVE HABITS:',
    habitLines,
    '',
    'RECENT NOTES:',
    noteLines,
    '',
    'RECENT VAULT ITEMS:',
    vaultLines,
  ].join('\n')
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function getLocalDateKey(offsetDays: number, timezone: string) {
  return formatInTimeZone(addDays(new Date(), offsetDays), timezone, 'yyyy-MM-dd')
}

function resolveTelegramDateKey(input: string, timezone: string) {
  const normalized = normalizeText(input)

  if (normalized.includes('lusa')) return getLocalDateKey(2, timezone)
  if (normalized.includes('besok')) return getLocalDateKey(1, timezone)
  if (normalized.includes('hari ini') || normalized.includes('today')) return getLocalDateKey(0, timezone)

  const monthMap: Record<string, string> = {
    januari: '01',
    jan: '01',
    februari: '02',
    feb: '02',
    maret: '03',
    mar: '03',
    april: '04',
    apr: '04',
    mei: '05',
    juni: '06',
    jun: '06',
    juli: '07',
    jul: '07',
    agustus: '08',
    agu: '08',
    ags: '08',
    september: '09',
    sep: '09',
    oktober: '10',
    okt: '10',
    november: '11',
    nov: '11',
    desember: '12',
    des: '12',
  }
  const dateMatch = normalized.match(/\b(\d{1,2})\s+(jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|agu(?:stus)?|ags|sep(?:tember)?|okt(?:ober)?|nov(?:ember)?|des(?:ember)?)(?:\s+(\d{4}))?\b/)

  if (!dateMatch) return null

  const nowYear = formatInTimeZone(new Date(), timezone, 'yyyy')
  const day = dateMatch[1].padStart(2, '0')
  const month = monthMap[dateMatch[2]]
  const year = dateMatch[3] ?? nowYear

  return `${year}-${month}-${day}`
}

function parseTelegramTime(input: string) {
  const normalized = normalizeText(input)
  const timeMatch = normalized.match(/\bjam\s*(\d{1,2})(?::|\.| lewat )?(\d{2})?\s*(pagi|siang|sore|malam)?\b/)
    ?? normalized.match(/\bpukul\s*(\d{1,2})(?::|\.| lewat )?(\d{2})?\s*(pagi|siang|sore|malam)?\b/)
    ?? normalized.match(/\b(\d{1,2})(?::|\.)(\d{2})\s*(pagi|siang|sore|malam)?\b/)

  if (!timeMatch) return null

  let hour = Number(timeMatch[1])
  const minute = timeMatch[2] ? Number(timeMatch[2]) : 0
  const period = timeMatch[3]

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }

  if (period === 'pagi') {
    if (hour === 12) hour = 0
  } else if (period === 'siang') {
    if (hour < 10) hour += 12
  } else if (period === 'sore' || period === 'malam') {
    if (hour < 12) hour += 12
  }

  return { hour, minute }
}

function extractCalendarTitleKeywords(input: string) {
  const stopwords = new Set([
    'ubah',
    'diubah',
    'ganti',
    'edit',
    'update',
    'reschedule',
    'jadwal',
    'calendar',
    'kalender',
    'agenda',
    'event',
    'acara',
    'waktu',
    'jam',
    'pukul',
    'ke',
    'jadi',
    'besok',
    'lusa',
    'hari',
    'ini',
    'pagi',
    'siang',
    'sore',
    'malam',
    'nya',
    'yang',
    'mau',
    'tolong',
    'dong',
  ])

  return normalizeText(input)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !stopwords.has(word) && !/^\d+$/.test(word))
}

function shouldTryCalendarUpdate(input: string) {
  const normalized = normalizeText(input)
  const hasUpdateIntent = ['ubah', 'diubah', 'ganti', 'edit', 'update', 'reschedule'].some((word) =>
    normalized.includes(word)
  )
  const hasCalendarCue = ['jadwal', 'calendar', 'kalender', 'agenda', 'event', 'acara', 'bimbingan'].some((word) =>
    normalized.includes(word)
  )

  return hasUpdateIntent && hasCalendarCue && Boolean(parseTelegramTime(input))
}

async function handleTelegramCalendarUpdate(user: LinkedUser, input: string) {
  if (!shouldTryCalendarUpdate(input)) return null

  const timezone = user.preferences?.timezone || 'Asia/Jakarta'
  const time = parseTelegramTime(input)
  if (!time) return null

  const targetDateKey = resolveTelegramDateKey(input, timezone)
  const startDateKey = targetDateKey ?? getLocalDateKey(-1, timezone)
  const endDateKey = targetDateKey ?? getLocalDateKey(30, timezone)
  const rangeStart = fromZonedTime(`${startDateKey}T00:00:00`, timezone).toISOString()
  const rangeEnd = fromZonedTime(`${endDateKey}T23:59:59`, timezone).toISOString()
  const titleKeywords = extractCalendarTitleKeywords(input)
  const supabase = createServiceRoleClient()

  const { data: events, error } = await supabase
    .from('calendar_events')
    .select('id, title, start_at, end_at, reminder_minutes, reminder_config, contextual_role')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .gte('start_at', rangeStart)
    .lte('start_at', rangeEnd)
    .order('start_at', { ascending: true })
    .limit(20)

  if (error) {
    return `Saya belum bisa membaca kalender untuk update itu: ${error.message}`
  }

  const candidates = (events ?? []).filter((event) => {
    if (!titleKeywords.length) return true
    const title = normalizeText(String(event.title))
    return titleKeywords.every((keyword) => title.includes(keyword))
  })

  if (!candidates.length) {
    return targetDateKey
      ? `Saya belum menemukan agenda yang cocok pada ${targetDateKey}. Coba sebutkan judul acaranya persis.`
      : 'Saya belum menemukan agenda yang cocok untuk diubah. Coba sebutkan judul dan tanggalnya.'
  }

  if (candidates.length > 1) {
    const options = candidates
      .slice(0, 5)
      .map((event, index) => `${index + 1}. ${event.title} (${formatTelegramLocalDateTime(event.start_at, timezone)})`)
      .join('\n')

    return `Saya menemukan beberapa agenda yang mungkin cocok:\n${options}\n\nTolong sebutkan yang mana yang mau diubah.`
  }

  const event = candidates[0]
  const currentStart = new Date(event.start_at)
  const currentEnd = event.end_at ? new Date(event.end_at) : null
  const durationMs = currentEnd && currentEnd.getTime() > currentStart.getTime()
    ? currentEnd.getTime() - currentStart.getTime()
    : null
  const eventDateKey = targetDateKey ?? formatInTimeZone(currentStart, timezone, 'yyyy-MM-dd')
  const newStart = fromZonedTime(
    `${eventDateKey}T${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}:00`,
    timezone
  )
  const newEnd = durationMs ? new Date(newStart.getTime() + durationMs) : null

  const { data: updatedEvent, error: updateError } = await supabase
    .from('calendar_events')
    .update({
      start_at: newStart.toISOString(),
      end_at: newEnd?.toISOString() ?? null,
      is_all_day: false,
    })
    .eq('id', event.id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (updateError || !updatedEvent) {
    return `Saya gagal mengubah jadwal itu: ${updateError?.message ?? 'event tidak ditemukan'}`
  }

  await queueCalendarReminderNotifications(
    supabase as unknown as Parameters<typeof queueCalendarReminderNotifications>[0],
    user.id,
    updatedEvent
  )

  return `Sudah saya ubah "${updatedEvent.title}" ke ${formatTelegramLocalDateTime(updatedEvent.start_at, timezone)} WIB.`
}

async function findLinkedUser(chatId: string) {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, telegram_chat_id, preferences')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (error) throw error
  return data as LinkedUser | null
}

async function handleTasks(user: LinkedUser) {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('tasks')
    .select('title, priority, due_date')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .neq('status', 'done')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(5)

  if (!data?.length) {
    return 'Tidak ada task aktif. Napas dulu, dashboard juga butuh hari tenang.'
  }

  return `5 task aktif terdekat:\n${data
    .map((task, index) => `${index + 1}. ${task.title} (${task.priority}${task.due_date ? `, ${task.due_date}` : ''})`)
    .join('\n')}`
}

async function handleHabits(user: LinkedUser) {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('habits')
    .select('name, cadence_mode, cadence_config')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(10)

  if (!data?.length) return 'Belum ada habit aktif.'

  return `Habit aktif:\n${data
    .map((habit, index) => `${index + 1}. ${habit.name} (${getHabitCadenceLabel(habit)})`)
    .join('\n')}`
}

async function handleToday(user: LinkedUser) {
  const supabase = createServiceRoleClient()
  const today = getTodayDateInJakarta()
  const startAt = `${today}T00:00:00+07:00`
  const endAt = `${today}T23:59:59+07:00`

  const [tasksResult, eventsResult, habitsResult] = await Promise.all([
    supabase
      .from('tasks')
      .select('title, priority')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .neq('status', 'done')
      .or(`due_date.is.null,due_date.lte.${today}`)
      .limit(5),
    supabase
      .from('calendar_events')
      .select('title, start_at')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .gte('start_at', startAt)
      .lte('start_at', endAt)
      .order('start_at', { ascending: true })
      .limit(5),
    supabase
      .from('habits')
      .select('name')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .limit(5),
  ])

  const tasks = tasksResult.data ?? []
  const events = eventsResult.data ?? []
  const habits = habitsResult.data ?? []

  return [
    `Ringkasan hari ini (${today})`,
    `Task: ${tasks.length ? tasks.map((task) => task.title).join(', ') : 'kosong'}`,
    `Agenda: ${events.length ? events.map((event) => event.title).join(', ') : 'kosong'}`,
    `Habit: ${habits.length ? habits.map((habit) => habit.name).join(', ') : 'kosong'}`,
  ].join('\n')
}

export async function POST(request: NextRequest) {
  if (!validateTelegramSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const update = (await request.json().catch(() => ({}))) as TelegramUpdate
  const message = update.message

  if (!message?.chat?.id || !message.text) {
    return Response.json({ ok: true, skipped: true })
  }

  const chatId = String(message.chat.id)
  const text = message.text.trim()
  const supabase = createServiceRoleClient()

  const linkedUser = await findLinkedUser(chatId)

  if (text.startsWith('/start')) {
    await sendTelegramMessage(
      chatId,
      linkedUser
        ? `Telegram sudah terhubung ke ${linkedUser.full_name}.`
        : `Chat ID kamu: ${chatId}\n\nMasukkan Chat ID ini di Settings > Telegram Bot untuk menghubungkan akun.`
    )
    return Response.json({ ok: true })
  }

  if (!linkedUser) {
    await sendTelegramMessage(chatId, `Chat ini belum terhubung.\n\nKetik /start lalu salin Chat ID ke Settings aplikasi.`)
    return Response.json({ ok: true, linked: false })
  }

  const { data: existing } = await supabase
    .from('ai_hub_logs')
    .select('id')
    .eq('telegram_message_id', message.message_id)
    .maybeSingle()

  if (existing) {
    return Response.json({ ok: true, skipped: true })
  }

  if (text.startsWith('/tasks')) {
    await sendTelegramMessage(chatId, await handleTasks(linkedUser))
    return Response.json({ ok: true })
  }

  if (text.startsWith('/habits')) {
    await sendTelegramMessage(chatId, await handleHabits(linkedUser))
    return Response.json({ ok: true })
  }

  if (text.startsWith('/today')) {
    await sendTelegramMessage(chatId, await handleToday(linkedUser))
    return Response.json({ ok: true })
  }

  const calendarUpdateReply = await handleTelegramCalendarUpdate(linkedUser, text)
  if (calendarUpdateReply) {
    await supabase.from('ai_hub_logs').insert({
      user_id: linkedUser.id,
      source: 'telegram',
      telegram_message_id: message.message_id,
      raw_input: text,
      ai_response: {
        items: [],
        ai_message: calendarUpdateReply,
      },
      status: 'confirmed',
      error_message: null,
      tokens_used: 0,
      latency_ms: null,
    })

    await sendTelegramMessage(chatId, calendarUpdateReply)
    return Response.json({ ok: true, calendar_updated: true })
  }

  if (text.startsWith('/cancel')) {
    await supabase
      .from('ai_hub_logs')
      .update({ status: 'cancelled' })
      .eq('user_id', linkedUser.id)
      .eq('source', 'telegram')
      .eq('status', 'draft')

    await sendTelegramMessage(chatId, 'Draft Telegram terakhir sudah dibatalkan.')
    return Response.json({ ok: true })
  }

  if (text.startsWith('/confirm')) {
    const { data: latestDraft, error: latestDraftError } = await supabase
      .from('ai_hub_logs')
      .select('id, ai_response')
      .eq('user_id', linkedUser.id)
      .eq('source', 'telegram')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestDraftError) {
      await sendTelegramMessage(chatId, `Gagal membaca draft terakhir: ${latestDraftError.message}`)
      return Response.json({ ok: true, confirmed: false })
    }

    const aiResponse = parseStoredAIResponse(latestDraft?.ai_response)

    if (!latestDraft || !aiResponse) {
      await sendTelegramMessage(chatId, 'Tidak ada draft Telegram yang siap dikonfirmasi.')
      return Response.json({ ok: true, confirmed: false })
    }

    const execution = await executeAIResponseItemsWithClient(
      supabase as unknown as Parameters<typeof executeAIResponseItemsWithClient>[0],
      linkedUser.id,
      aiResponse.items
    )

    await supabase
      .from('ai_hub_logs')
      .update({
        status: execution.created.length > 0 ? 'confirmed' : 'failed',
        error_message: execution.errors.length ? execution.errors.join('; ') : null,
      })
      .eq('id', latestDraft.id)

    await sendTelegramMessage(chatId, buildAIExecutionMessage(execution))
    return Response.json({ ok: true })
  }

  const { response, raw, tokensUsed, latencyMs } = await callLLM(
    await buildTelegramAIContext(linkedUser, text)
  )
  const aiResponse = response as AIResponse | null

  if (!aiResponse) {
    const smartRecallReply = await buildTelegramSmartRecallReply(
      supabase as unknown as Parameters<typeof buildTelegramSmartRecallReply>[0],
      linkedUser,
      text
    )

    if (smartRecallReply) {
      await supabase.from('ai_hub_logs').insert({
        user_id: linkedUser.id,
        source: 'telegram',
        telegram_message_id: message.message_id,
        raw_input: text,
        ai_response: {
          items: [],
          ai_message: smartRecallReply,
        },
        status: 'confirmed',
        error_message: `AI response could not be parsed, used smart recall fallback: ${raw.slice(0, 200)}`,
        tokens_used: tokensUsed,
        latency_ms: latencyMs,
      })

      await sendTelegramMessage(chatId, smartRecallReply)
      return Response.json({ ok: true, recalled: true, fallback: true })
    }
  }

  await supabase.from('ai_hub_logs').insert({
    user_id: linkedUser.id,
    source: 'telegram',
    telegram_message_id: message.message_id,
    raw_input: text,
    ai_response: aiResponse,
    status: aiResponse ? (aiResponse.items.length > 0 ? 'draft' : 'confirmed') : 'failed',
    error_message: aiResponse ? null : `AI response could not be parsed: ${raw.slice(0, 200)}`,
    tokens_used: tokensUsed,
    latency_ms: latencyMs,
  })

  if (!aiResponse) {
    await sendTelegramMessage(chatId, 'AI belum bisa memproses pesan itu. Coba tulis lebih spesifik ya.')
    return Response.json({ ok: true, parsed: false })
  }

  await sendTelegramMessage(chatId, formatDraft(aiResponse.items, aiResponse.ai_message, linkedUser.preferences?.timezone))
  return Response.json({ ok: true, parsed: true })
}
