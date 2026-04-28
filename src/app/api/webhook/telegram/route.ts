// ============================================================
// Route Handler: /api/webhook/telegram
// POST — Trusted Telegram webhook, guarded by Telegram secret token.
// ============================================================

import { type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { sendTelegramMessage } from '@/lib/telegram'
import { callLLM } from '@/lib/ai/client'
import { buildAIExecutionMessage, executeAIResponseItemsWithClient } from '@/lib/ai/command-hub'
import { buildSystemPrompt } from '@/lib/ai/prompts'
import { mapDraftDetail } from '@/lib/ai/parser'
import { buildTelegramSmartRecallReply } from '@/lib/telegram-recall'
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

function formatDraft(items: AIResponseItem[], message: string) {
  if (items.length === 0) return message

  const itemLines = items
    .map((item, index) => `${index + 1}. ${item.action}: ${item.data.title}\n   ${mapDraftDetail(item)}`)
    .join('\n')

  return `${message}\n\nDraft:\n${itemLines}\n\nBalas /confirm untuk menyimpan lewat Telegram atau buka aplikasi untuk review penuh.`
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

  const { data: categories } = await supabase
    .from('categories')
    .select('name, contextual_role')
    .eq('user_id', user.id)
    .eq('is_deleted', false)

  const timezone = user.preferences?.timezone || 'Asia/Jakarta'
  const activeRoles = user.preferences?.active_roles?.length
    ? user.preferences.active_roles
    : ['dosen', 'creator', 'affiliate', 'consultant', 'general']

  const systemPrompt = buildSystemPrompt({
    currentDatetimeISO: new Date().toISOString(),
    userTimezone: timezone,
    utcOffset: timezone === 'Asia/Jakarta' ? '+07:00' : '+00:00',
    userCategories: (categories ?? []).map((category) => ({
      name: String(category.name),
      role: category.contextual_role as RoleContext,
    })),
    userActiveRoles: activeRoles as RoleContext[],
  })

  return [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: input.trim() },
  ]
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
      error_message: null,
      tokens_used: 0,
      latency_ms: null,
    })

    await sendTelegramMessage(chatId, smartRecallReply)
    return Response.json({ ok: true, recalled: true })
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

  await supabase.from('ai_hub_logs').insert({
    user_id: linkedUser.id,
    source: 'telegram',
    telegram_message_id: message.message_id,
    raw_input: text,
    ai_response: aiResponse,
    status: aiResponse ? 'draft' : 'failed',
    error_message: aiResponse ? null : `AI response could not be parsed: ${raw.slice(0, 200)}`,
    tokens_used: tokensUsed,
    latency_ms: latencyMs,
  })

  if (!aiResponse) {
    await sendTelegramMessage(chatId, 'AI belum bisa memproses pesan itu. Coba tulis lebih spesifik ya.')
    return Response.json({ ok: true, parsed: false })
  }

  await sendTelegramMessage(chatId, formatDraft(aiResponse.items, aiResponse.ai_message))
  return Response.json({ ok: true, parsed: true })
}
