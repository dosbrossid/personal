// ============================================================
// Route Handler: /api/webhook/telegram
// POST — Trusted Telegram webhook, guarded by Telegram secret token.
// ============================================================

import { type NextRequest } from 'next/server'
import { addDays } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getTelegramFileAsDataUrl, sendTelegramChatAction, sendTelegramMessage, sendTelegramPhoto } from '@/lib/telegram'
import {
  analyzeImageWithVision,
  callLLM,
  fetchWebWithAgent,
  generateImageWithAgent,
  searchWithAgent,
} from '@/lib/ai/client'
import {
  buildAIExecutionMessage,
  buildMainModelInputWithVisionAnalysis,
  executeAIResponseItemsWithClient,
  normalizeAIResponseForCommand,
} from '@/lib/ai/command-hub'
import { buildAssistantSystemPrompt } from '@/lib/ai/prompts'
import { buildTelegramSmartRecallReply } from '@/lib/telegram-recall'
import { queueCalendarReminderNotifications } from '@/lib/notification-queue'
import type { AIResponse, AIResponseItem, CalendarReminderRule, UserPreferences } from '@/core/types'
import type { RoleContext } from '@/core/constants'
import { getHabitCadenceLabel } from '@/lib/habits'

interface TelegramUpdate {
  message?: {
    message_id: number
    text?: string
    caption?: string
    photo?: Array<{
      file_id: string
      file_unique_id: string
      width: number
      height: number
      file_size?: number
    }>
    document?: {
      file_id: string
      file_unique_id: string
      file_name?: string
      mime_type?: string
      file_size?: number
    }
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
  preferences: Partial<UserPreferences> | null
}

interface TelegramMemoryLog {
  created_at: string
  raw_input: string
  ai_response: unknown
}

interface TelegramImageAttachment {
  dataUrl: string
  mimeType: string
  name?: string
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

function md(value: string | number | null | undefined) {
  return String(value ?? '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&')
}

function mdRich(value: string | number | null | undefined) {
  const placeholders = new Map<string, string>()
  let index = 0
  const token = (content: string) => {
    const key = `@@MD${index++}@@`
    placeholders.set(key, content)
    return key
  }

  const prepared = String(value ?? '')
    .replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, (_, content: string) => token(`*${md(content)}*`))
    .replace(/__([^_\n][\s\S]*?[^_\n])__/g, (_, content: string) => token(`*${md(content)}*`))
    .replace(/(?<!\*)\*([^*\n][^*\n]*?[^*\n])\*(?!\*)/g, (_, content: string) => token(`_${md(content)}_`))
    .replace(/_([^_\n][^_\n]*?[^_\n])_/g, (_, content: string) => token(`_${md(content)}_`))

  let escaped = md(prepared)
    .replace(/^\\-\s/gm, '• ')
    .replace(/^(\d+)\\\.\s/gm, '$1\\. ')
    .replace(/^\\>\s/gm, '> ')

  for (const [key, content] of placeholders) {
    escaped = escaped.replaceAll(md(key), content)
  }

  return escaped
}

function extractFirstUrl(input: string) {
  const match = input.match(/https?:\/\/[^\s)>\]]+/i)
  return match?.[0] ?? null
}

function stripCommandPrefix(input: string, prefixes: RegExp[]) {
  let output = input.trim()
  for (const pattern of prefixes) {
    output = output.replace(pattern, '').trim()
  }
  return output
}

function getImageGenerationPrompt(input: string) {
  const normalized = normalizeText(input)
  const isCommand = normalized.startsWith('/gambar') || normalized.startsWith('/image') || normalized.startsWith('/generateimage')
  const hasIntent = /\b(buat|bikin|generate|gambar|ilustrasi|poster|cover|avatar|thumbnail)\b/i.test(input)
  const hasImageCue = /\b(gambar|image|ilustrasi|poster|cover|avatar|thumbnail|visual)\b/i.test(input)
  if (!isCommand && !(hasIntent && hasImageCue)) return null

  const prompt = stripCommandPrefix(input, [
    /^\/gambar\s*/i,
    /^\/image\s*/i,
    /^\/generateimage\s*/i,
    /^(?:tolong\s+)?(?:buatkan|buat|bikin|generate)\s+(?:gambar|image|ilustrasi|poster|cover|avatar|thumbnail|visual)?\s*/i,
  ])

  return prompt.length >= 8 ? prompt : null
}

function getWebSearchQuery(input: string) {
  const normalized = normalizeText(input)
  const isCommand = normalized.startsWith('/search') || normalized.startsWith('/cariweb') || normalized.startsWith('/websearch')
  const hasIntent = /\b(search|cari|googling|riset|telusuri)\b/i.test(input)
  const hasWebCue = /\b(web|internet|online|berita|artikel|sumber)\b/i.test(input)
  if (!isCommand && !(hasIntent && hasWebCue)) return null

  const query = stripCommandPrefix(input, [
    /^\/search\s*/i,
    /^\/cariweb\s*/i,
    /^\/websearch\s*/i,
    /^(?:tolong\s+)?(?:search|cari|googling|riset|telusuri)\s+(?:di\s+)?(?:web|internet|online)?\s*/i,
  ])

  return query.length >= 3 ? query : null
}

function getWebFetchUrl(input: string) {
  const url = extractFirstUrl(input)
  if (!url) return null

  const normalized = normalizeText(input)
  const wantsFetch = normalized.startsWith('/fetch') ||
    normalized.startsWith('/ringkaslink') ||
    /\b(fetch|baca|ringkas|rangkum|analisa|cek)\b/i.test(input)

  return wantsFetch ? url : null
}

async function sendTelegramRichMessage(chatId: string, text: string) {
  try {
    await sendTelegramMessage(chatId, text, { parseMode: 'MarkdownV2' })
  } catch {
    await sendTelegramMessage(chatId, text.replace(/[\\*_`[\]()~>#+\-=|{}.!]/g, ''))
  }
}

async function summarizeToolResultForTelegram(params: {
  instruction: string
  toolLabel: string
  toolResult: string
}) {
  const { raw } = await callLLM([
    {
      role: 'system',
      content: [
        'Kamu adalah assistant Telegram Indonesia yang terasa hidup, rapi, dan enak dibaca.',
        'Ringkas hasil tool secara praktis, jujur, dan mudah discan.',
        'Jangan mengarang di luar TOOL RESULT.',
        'Gunakan gaya Markdown Telegram: emoji seperlunya, bullet/numbering, bold untuk poin penting, italic untuk penekanan ringan, dan quote pendek jika cocok.',
        'Jangan terlalu kaku. Variasikan struktur respons sesuai isi.',
        'Maksimal 1100 karakter.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `INSTRUKSI USER: ${params.instruction}`,
        `TOOL: ${params.toolLabel}`,
        'TOOL RESULT:',
        params.toolResult.slice(0, 9000),
      ].join('\n'),
    },
  ], { temperature: 0.2 })

  return raw.trim().slice(0, 1200)
}

async function handleTelegramImageGeneration(chatId: string, user: LinkedUser, messageId: number, input: string) {
  const prompt = getImageGenerationPrompt(input)
  if (!prompt) return false

  const supabase = createServiceRoleClient()
  const startTime = Date.now()
  const image = await withTelegramTyping(chatId, () => generateImageWithAgent({ prompt }), 'upload_photo')
  const photo = image.url ?? `data:${image.mimeType ?? 'image/png'};base64,${image.b64Json}`
  const caption = `🖼️ *Gambar dibuat*\n${md(prompt.slice(0, 220))}`

  await sendTelegramPhoto(chatId, photo, { caption, parseMode: 'MarkdownV2' })
  await supabase.from('ai_hub_logs').insert({
    user_id: user.id,
    source: 'telegram',
    telegram_message_id: messageId,
    raw_input: input,
    ai_response: {
      items: [],
      ai_message: `Gambar dibuat: ${prompt}`,
    },
    status: 'confirmed',
    error_message: null,
    tokens_used: null,
    latency_ms: Date.now() - startTime,
  })

  return true
}

async function handleTelegramWebSearch(chatId: string, user: LinkedUser, messageId: number, input: string) {
  const query = getWebSearchQuery(input)
  if (!query) return false

  const supabase = createServiceRoleClient()
  const startTime = Date.now()
  const results = await withTelegramTyping(chatId, () => searchWithAgent({ query, limit: 5 }))
  const rawResult = results
    .map((item, index) => `${index + 1}. ${item.title}\n${item.url ?? ''}\n${item.snippet ?? ''}`)
    .join('\n\n')
  const summary = await withTelegramTyping(
    chatId,
    () => summarizeToolResultForTelegram({
      instruction: input,
      toolLabel: 'web search',
      toolResult: rawResult || 'No search results.',
    })
  )

  const links = results
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${item.title}${item.url ? `\n${item.url}` : ''}`)
    .join('\n')
  const reply = `🔎 *Hasil web search*\n${mdRich(summary)}${links ? `\n\n${md(links)}` : ''}`

  await sendTelegramRichMessage(chatId, reply)
  await supabase.from('ai_hub_logs').insert({
    user_id: user.id,
    source: 'telegram',
    telegram_message_id: messageId,
    raw_input: input,
    ai_response: {
      items: [],
      ai_message: summary,
    },
    status: 'confirmed',
    error_message: null,
    tokens_used: null,
    latency_ms: Date.now() - startTime,
  })

  return true
}

async function handleTelegramWebFetch(chatId: string, user: LinkedUser, messageId: number, input: string) {
  const url = getWebFetchUrl(input)
  if (!url) return false

  const supabase = createServiceRoleClient()
  const startTime = Date.now()
  const page = await withTelegramTyping(chatId, () => fetchWebWithAgent({ url }))
  const summary = await withTelegramTyping(
    chatId,
    () => summarizeToolResultForTelegram({
      instruction: input,
      toolLabel: 'web fetch',
      toolResult: [
        page.title ? `TITLE: ${page.title}` : '',
        page.url ? `URL: ${page.url}` : `URL: ${url}`,
        '',
        page.content,
      ].join('\n'),
    })
  )

  await sendTelegramRichMessage(chatId, `🌐 *Ringkasan web*\n${mdRich(summary)}\n\n${md(page.url ?? url)}`)
  await supabase.from('ai_hub_logs').insert({
    user_id: user.id,
    source: 'telegram',
    telegram_message_id: messageId,
    raw_input: input,
    ai_response: {
      items: [],
      ai_message: summary,
    },
    status: 'confirmed',
    error_message: null,
    tokens_used: null,
    latency_ms: Date.now() - startTime,
  })

  return true
}

async function withTelegramTyping<T>(chatId: string, work: () => Promise<T>, action: 'typing' | 'upload_photo' = 'typing') {
  let stopped = false
  let pulseTimer: ReturnType<typeof setTimeout> | null = null

  const pulse = async () => {
    if (stopped) return
    await sendTelegramChatAction(chatId, action).catch(() => undefined)
    if (!stopped) {
      pulseTimer = setTimeout(() => {
        pulse().catch(() => undefined)
      }, 4000)
    }
  }

  await pulse()

  try {
    return await work()
  } finally {
    stopped = true
    if (pulseTimer) {
      clearTimeout(pulseTimer)
    }
  }
}

function formatDraft(items: AIResponseItem[], message: string, timezone = 'Asia/Jakarta') {
  if (items.length === 0) return `💬 *Jawaban*\n${mdRich(message)}`

  const itemLines = items
    .map((item, index) => `${index + 1}\\. *${md(item.action)}* — ${md(item.data.title)}\n   ${md(mapTelegramDraftDetail(item, timezone))}`)
    .join('\n')

  return [
    `🧠 *Draft siap direview*`,
    mdRich(message),
    '',
    itemLines,
    '',
    `✅ Balas /confirm untuk menyimpan`,
    `❌ Balas /cancel untuk membatalkan`,
  ].join('\n')
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
    case 'CLASS': {
      const meetings = item.data.meeting_target ? `${item.data.meeting_target} pertemuan` : 'kelas baru'
      const startAt = item.data.start_at
        ? ` · mulai ${formatInTimeZone(new Date(item.data.start_at), timezone, 'd MMM HH.mm')}`
        : ''
      return `${meetings}${startAt}`
    }
  }
}

function formatTelegramReminderRules(rules: CalendarReminderRule[]) {
  return rules
    .map((rule) => {
      if (rule.type === 'same_day_at') {
        return `Hari H ${String(rule.hour).padStart(2, '0')}:${String(rule.minute).padStart(2, '0')}`
      }

      if (rule.minutes === 0) return 'saat mulai'
      if (rule.minutes === 15) return '15 menit sebelumnya'
      if (rule.minutes === 30) return '30 menit sebelumnya'
      if (rule.minutes === 60) return '1 jam sebelumnya'
      if (rule.minutes === 1440) return 'H-1'
      return `${rule.minutes} menit sebelumnya`
    })
    .join(', ')
}

function parseStoredAIResponse(value: unknown): AIResponse | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<AIResponse>
  if (!Array.isArray(candidate.items)) return null
  if (typeof candidate.ai_message !== 'string') return null

  return candidate as AIResponse
}

async function buildTelegramAIContext(
  user: LinkedUser,
  input: string,
  attachment?: TelegramImageAttachment | null
) {
  const supabase = createServiceRoleClient()

  const [
    categoriesResult,
    tasksResult,
    eventsResult,
    habitsResult,
    notesResult,
    vaultResult,
    historyResult,
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
    supabase
      .from('ai_hub_logs')
      .select('created_at, raw_input, ai_response')
      .eq('user_id', user.id)
      .eq('source', 'telegram')
      .in('status', ['confirmed', 'draft'])
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const timezone = user.preferences?.timezone || 'Asia/Jakarta'
  const activeRoles = user.preferences?.active_roles?.length
    ? user.preferences.active_roles
    : ['dosen', 'creator', 'affiliate', 'consultant', 'general']
  const agentPreferences = user.preferences?.ai_agent

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
    memoryContext: buildTelegramMemoryContext(
      user.preferences?.ai_memory,
      (historyResult.data ?? []) as TelegramMemoryLog[],
      timezone
    ),
    agentMode: agentPreferences?.mode === 'assistant' ? 'assistant' : 'agent',
    agentPromptNotes: agentPreferences?.system_prompt_notes?.trim() || null,
    responseStyle: agentPreferences?.response_style?.trim() || null,
    telegramResponseStyle: agentPreferences?.telegram_response_style?.trim() || null,
    channel: 'telegram',
  })

  const userText = input.trim() || 'Analisis gambar ini dan bantu saya memahami atau mengolahnya.'

  return [
    { role: 'system' as const, content: systemPrompt },
    attachment
      ? {
          role: 'user' as const,
          content: [
            {
              type: 'text' as const,
              text: `${userText}\n\nAda gambar dari Telegram untuk dianalisis. Jika user hanya minta analisa, jawab di ai_message tanpa membuat item. Jika user minta simpan ke vault, minta link karena vault hanya menerima URL.`,
            },
            {
              type: 'image_url' as const,
              image_url: {
                url: attachment.dataUrl,
                detail: 'auto' as const,
              },
            },
          ],
        }
      : { role: 'user' as const, content: userText },
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

function extractAIMessage(value: unknown) {
  if (!value || typeof value !== 'object') return null

  const candidate = value as { ai_message?: unknown }
  return typeof candidate.ai_message === 'string' ? candidate.ai_message : null
}

function getMemoryPreferences(user: LinkedUser) {
  return user.preferences ?? {}
}

function buildTelegramMemoryContext(
  memory: Partial<UserPreferences>['ai_memory'] | null | undefined,
  history: TelegramMemoryLog[],
  timezone: string
) {
  const sections: string[] = []
  const pinned = memory?.pinned?.filter((item) => item.trim()).slice(-12) ?? []

  if (memory?.summary?.trim()) {
    sections.push(`Long-term summary:\n${memory.summary.trim()}`)
  }

  if (pinned.length) {
    sections.push(`Pinned memory:\n${pinned.map((item, index) => `${index + 1}. ${item}`).join('\n')}`)
  }

  const recentLines = history
    .slice()
    .reverse()
    .map((log) => {
      const when = formatInTimeZone(new Date(log.created_at), timezone, 'd MMM HH.mm')
      const userText = cleanSnippet(log.raw_input, 180)
      const aiText = cleanSnippet(extractAIMessage(log.ai_response), 220)
      return `[${when}] User: ${userText}${aiText ? `\nAssistant: ${aiText}` : ''}`
    })
    .join('\n')

  if (recentLines) {
    sections.push(`Recent Telegram chat:\n${recentLines}`)
  }

  return sections.join('\n\n') || null
}

function isMemoryClearCommand(input: string) {
  const normalized = normalizeText(input)
  return (
    normalized === '/forgetmemory' ||
    normalized === '/clearmemory' ||
    normalized === '/resetmemory' ||
    normalized.includes('kosongkan memory') ||
    normalized.includes('kosongkan memori') ||
    normalized.includes('hapus memory') ||
    normalized.includes('hapus memori') ||
    normalized.includes('reset memory') ||
    normalized.includes('reset memori')
  )
}

function isMemoryStatusCommand(input: string) {
  const normalized = normalizeText(input)
  return (
    normalized === '/memory' ||
    normalized.includes('memory status') ||
    normalized.includes('status memory') ||
    normalized.includes('memori status') ||
    normalized.includes('status memori') ||
    normalized.includes('apa yang kamu ingat')
  )
}

function isMemoryCompactCommand(input: string) {
  const normalized = normalizeText(input)
  return (
    normalized === '/compact' ||
    normalized === '/compactmemory' ||
    normalized.includes('compact memory') ||
    normalized.includes('compact memori') ||
    normalized.includes('ringkas memory') ||
    normalized.includes('ringkas memori')
  )
}

function extractAgentPreferenceUpdate(input: string):
  | { key: 'system_prompt_notes' | 'response_style' | 'telegram_response_style'; value: string }
  | null {
  const trimmed = input.trim()
  const patterns: Array<{
    key: 'system_prompt_notes' | 'response_style' | 'telegram_response_style'
    pattern: RegExp
  }> = [
    { key: 'system_prompt_notes', pattern: /^\/agentprompt\s+(.+)/i },
    { key: 'response_style', pattern: /^\/agentstyle\s+(.+)/i },
    { key: 'telegram_response_style', pattern: /^\/telegramstyle\s+(.+)/i },
    { key: 'telegram_response_style', pattern: /^(?:ubah|ganti|atur)\s+(?:gaya\s+)?(?:respon|response|jawaban)\s+telegram\s+(?:jadi|ke|:)?\s*(.+)/i },
    { key: 'response_style', pattern: /^(?:ubah|ganti|atur)\s+(?:gaya\s+)?(?:respon|response|jawaban)\s+(?:ai|assistant|kamu)\s+(?:jadi|ke|:)?\s*(.+)/i },
    { key: 'system_prompt_notes', pattern: /^(?:ubah|ganti|atur)\s+(?:struktur\s+)?prompt\s+(?:kamu|ai|assistant)?\s*(?:jadi|ke|:)?\s*(.+)/i },
  ]

  for (const item of patterns) {
    const match = trimmed.match(item.pattern)
    if (match?.[1]?.trim()) {
      return { key: item.key, value: match[1].trim() }
    }
  }

  return null
}

function isAgentPreferenceStatusCommand(input: string) {
  const normalized = normalizeText(input)
  return normalized === '/agent' || normalized === '/agentmode' || normalized.includes('setting agent')
}

function extractManualMemoryNote(input: string) {
  const normalized = normalizeText(input)
  const patterns = [
    /^\/remember\s+(.+)/i,
    /^ingat\s+(.+)/i,
    /^ingatkan\s+bahwa\s+(.+)/i,
    /^catat\s+memory\s+(.+)/i,
    /^catat\s+memori\s+(.+)/i,
    /^simpan\s+memory\s+(.+)/i,
    /^simpan\s+memori\s+(.+)/i,
  ]

  for (const pattern of patterns) {
    const match = input.trim().match(pattern)
    if (match?.[1]?.trim()) return match[1].trim()
  }

  if (normalized.startsWith('ingat bahwa ')) return input.trim().slice('ingat bahwa '.length).trim()
  return null
}

async function updateTelegramMemory(user: LinkedUser, memory: NonNullable<UserPreferences['ai_memory']>) {
  const supabase = createServiceRoleClient()
  const preferences = {
    ...getMemoryPreferences(user),
    ai_memory: {
      ...memory,
      updated_at: new Date().toISOString(),
    },
  }

  const { error } = await supabase
    .from('users')
    .update({ preferences })
    .eq('id', user.id)

  if (error) throw error
  user.preferences = preferences
}

async function updateTelegramAgentPreferences(
  user: LinkedUser,
  patch: NonNullable<UserPreferences['ai_agent']>
) {
  const supabase = createServiceRoleClient()
  const currentPreferences = getMemoryPreferences(user)
  const preferences = {
    ...currentPreferences,
    ai_agent: {
      mode: 'agent' as const,
      ...(currentPreferences.ai_agent ?? {}),
      ...patch,
      updated_at: new Date().toISOString(),
    },
  }

  const { error } = await supabase
    .from('users')
    .update({ preferences })
    .eq('id', user.id)

  if (error) throw error
  user.preferences = preferences
}

async function logMemoryCommand(user: LinkedUser, telegramMessageId: number, rawInput: string, reply: string) {
  const supabase = createServiceRoleClient()
  await supabase.from('ai_hub_logs').insert({
    user_id: user.id,
    source: 'telegram',
    telegram_message_id: telegramMessageId,
    raw_input: rawInput,
    ai_response: {
      items: [],
      ai_message: reply,
    },
    status: 'confirmed',
    error_message: null,
    tokens_used: 0,
    latency_ms: null,
  })
}

async function handleTelegramMemoryCommand(user: LinkedUser, telegramMessageId: number, input: string) {
  const currentMemory = user.preferences?.ai_memory ?? {}
  const agentUpdate = extractAgentPreferenceUpdate(input)

  if (agentUpdate) {
    await updateTelegramAgentPreferences(user, { [agentUpdate.key]: agentUpdate.value })
    const label =
      agentUpdate.key === 'telegram_response_style'
        ? 'gaya respon Telegram'
        : agentUpdate.key === 'response_style'
          ? 'gaya respon AI'
          : 'catatan prompt agent'
    const reply = `Siap. Saya simpan ${label}: ${agentUpdate.value}`
    await logMemoryCommand(user, telegramMessageId, input, reply)
    return reply
  }

  if (isAgentPreferenceStatusCommand(input)) {
    const agent = user.preferences?.ai_agent
    const reply = [
      'Agent mode aktif.',
      `Prompt notes: ${agent?.system_prompt_notes?.trim() || 'belum ada'}`,
      `Response style: ${agent?.response_style?.trim() || 'default natural Indonesia'}`,
      `Telegram style: ${agent?.telegram_response_style?.trim() || 'default rapi singkat'}`,
      'Gunakan /agentprompt, /agentstyle, atau /telegramstyle untuk mengubahnya.',
    ].join('\n')
    await logMemoryCommand(user, telegramMessageId, input, reply)
    return reply
  }

  if (isMemoryClearCommand(input)) {
    const reply = 'Memory Telegram sudah saya kosongkan. Chat log lama tetap ada untuk audit, tapi tidak saya pakai sebagai long-term memory.'
    await updateTelegramMemory(user, { summary: null, pinned: [] })
    await logMemoryCommand(user, telegramMessageId, input, reply)
    return reply
  }

  const manualNote = extractManualMemoryNote(input)
  if (manualNote) {
    const pinned = [...(currentMemory.pinned ?? []), manualNote].slice(-20)
    const reply = `Saya ingat: ${manualNote}`
    await updateTelegramMemory(user, { ...currentMemory, pinned })
    await logMemoryCommand(user, telegramMessageId, input, reply)
    return reply
  }

  if (isMemoryCompactCommand(input)) {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from('ai_hub_logs')
      .select('created_at, raw_input, ai_response')
      .eq('user_id', user.id)
      .eq('source', 'telegram')
      .in('status', ['confirmed', 'draft'])
      .order('created_at', { ascending: false })
      .limit(30)

    const compacted = buildCompactMemorySummary((data ?? []) as TelegramMemoryLog[], user.preferences?.timezone ?? 'Asia/Jakarta')
    await updateTelegramMemory(user, {
      ...currentMemory,
      summary: compacted,
      pinned: currentMemory.pinned ?? [],
    })

    const reply = compacted
      ? `Memory sudah saya compact. Ringkasannya:\n${compacted}`
      : 'Belum ada chat Telegram yang cukup untuk di-compact.'
    await logMemoryCommand(user, telegramMessageId, input, reply)
    return reply
  }

  if (isMemoryStatusCommand(input)) {
    const pinned = currentMemory.pinned?.length
      ? currentMemory.pinned.map((item, index) => `${index + 1}. ${item}`).join('\n')
      : 'Belum ada pinned memory.'
    const summary = currentMemory.summary?.trim() || 'Belum ada compact summary.'
    const reply = `Memory aktif:\nSummary: ${summary}\n\nPinned:\n${pinned}`
    await logMemoryCommand(user, telegramMessageId, input, reply)
    return reply
  }

  return null
}

function buildCompactMemorySummary(history: TelegramMemoryLog[], timezone: string) {
  const lines = history
    .slice()
    .reverse()
    .map((log) => {
      const when = formatInTimeZone(new Date(log.created_at), timezone, 'd MMM HH.mm')
      const userText = cleanSnippet(log.raw_input, 160)
      const aiText = cleanSnippet(extractAIMessage(log.ai_response), 180)
      return `${when}: User "${userText}"${aiText ? `; Assistant "${aiText}"` : ''}`
    })
    .filter(Boolean)

  if (!lines.length) return null

  return lines.slice(-18).join('\n').slice(0, 3500)
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

function parseTelegramReminderRules(input: string): CalendarReminderRule[] {
  const normalized = normalizeText(input)
  const rules: CalendarReminderRule[] = []

  if (/\b(h\s*-?\s*1|h-1|sehari|1 hari|satu hari|besoknya|day before)\b/.test(normalized)) {
    rules.push({ type: 'before_minutes', minutes: 1440 })
  }

  if (/\b(15 menit|seperempat jam)\b/.test(normalized)) {
    rules.push({ type: 'before_minutes', minutes: 15 })
  }

  if (/\b(30 menit|setengah jam)\b/.test(normalized)) {
    rules.push({ type: 'before_minutes', minutes: 30 })
  }

  if (/\b(1 jam|satu jam|60 menit)\b/.test(normalized)) {
    rules.push({ type: 'before_minutes', minutes: 60 })
  }

  const sameDayAtMatch = normalized.match(/\b(?:hari h|hari ini|pagi)\s*(?:jam|pukul)?\s*(\d{1,2})(?::|\.| lewat )?(\d{2})?\b/)
    ?? normalized.match(/\b(?:reminder|ingatkan)\s*(?:jam|pukul)\s*(\d{1,2})(?::|\.| lewat )?(\d{2})?\b/)

  if (sameDayAtMatch) {
    const hour = Math.max(0, Math.min(23, Number(sameDayAtMatch[1])))
    const minute = sameDayAtMatch[2] ? Math.max(0, Math.min(59, Number(sameDayAtMatch[2]))) : 0
    rules.push({ type: 'same_day_at', hour, minute })
  }

  return rules.filter((rule, index, allRules) =>
    allRules.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(rule)) === index
  )
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
    'reminder',
    'pengingat',
    'ingatkan',
    'tambah',
    'tambahkan',
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

function hasCalendarUpdateIntent(input: string) {
  const normalized = normalizeText(input)
  const hasUpdateIntent = ['ubah', 'diubah', 'ganti', 'edit', 'update', 'reschedule'].some((word) =>
    normalized.includes(word)
  )
  const hasCalendarCue = ['jadwal', 'calendar', 'kalender', 'agenda', 'event', 'acara', 'bimbingan', 'reminder', 'pengingat'].some((word) =>
    normalized.includes(word)
  )

  return hasUpdateIntent && hasCalendarCue
}

async function handleTelegramCalendarUpdate(user: LinkedUser, input: string) {
  if (!hasCalendarUpdateIntent(input)) return null

  const timezone = user.preferences?.timezone || 'Asia/Jakarta'
  const time = parseTelegramTime(input)
  const reminderRules = parseTelegramReminderRules(input)

  if (!time && reminderRules.length === 0) {
    return '🕒 *Mau ubah apa?*\nSaya menangkap ini sebagai edit agenda, tapi belum ada jam atau reminder baru\\. Contoh: `ubah bimbingan skripsi besok ke jam 11 siang` atau `ubah reminder bimbingan skripsi jadi H-1 dan 15 menit sebelumnya`\\.'
  }

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
    return `⚠️ *Kalender belum bisa dibaca*\n${md(error.message)}`
  }

  const candidates = (events ?? []).filter((event) => {
    if (!titleKeywords.length) return true
    const title = normalizeText(String(event.title))
    return titleKeywords.every((keyword) => title.includes(keyword)) ||
      titleKeywords.some((keyword) => title.includes(keyword))
  })

  if (!candidates.length) {
    return targetDateKey
      ? `🔎 *Agenda belum ketemu*\nSaya belum menemukan agenda yang cocok pada *${md(targetDateKey)}*\\. Coba sebutkan judul acaranya persis\\.`
      : '🔎 *Agenda belum ketemu*\nSaya belum menemukan agenda yang cocok untuk diubah\\. Coba sebutkan judul dan tanggalnya\\.'
  }

  if (candidates.length > 1) {
    const options = candidates
      .slice(0, 5)
      .map((event, index) => `${index + 1}. ${event.title} (${formatTelegramLocalDateTime(event.start_at, timezone)})`)
      .join('\n')

    return `🔎 *Saya menemukan beberapa agenda:*\n${md(options)}\n\nTolong sebutkan yang mana yang mau diubah\\.`
  }

  const event = candidates[0]
  const currentStart = new Date(event.start_at)
  const currentEnd = event.end_at ? new Date(event.end_at) : null
  const durationMs = currentEnd && currentEnd.getTime() > currentStart.getTime()
    ? currentEnd.getTime() - currentStart.getTime()
    : null
  const eventDateKey = targetDateKey ?? formatInTimeZone(currentStart, timezone, 'yyyy-MM-dd')
  const newStart = time
    ? fromZonedTime(
        `${eventDateKey}T${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}:00`,
        timezone
      )
    : currentStart
  const newEnd = time && durationMs ? new Date(newStart.getTime() + durationMs) : currentEnd
  const nextReminderConfig = reminderRules.length > 0
    ? reminderRules
    : ((event.reminder_config as CalendarReminderRule[] | null) ?? [])
  const nextReminderMinutes = nextReminderConfig.find((rule) => rule.type === 'before_minutes')?.minutes
    ?? event.reminder_minutes
    ?? null

  const { data: updatedEvent, error: updateError } = await supabase
    .from('calendar_events')
    .update({
      start_at: newStart.toISOString(),
      end_at: newEnd?.toISOString() ?? null,
      is_all_day: false,
      reminder_minutes: nextReminderMinutes,
      reminder_config: nextReminderConfig,
    })
    .eq('id', event.id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (updateError || !updatedEvent) {
    return `⚠️ *Gagal mengubah agenda*\n${md(updateError?.message ?? 'event tidak ditemukan')}`
  }

  await queueCalendarReminderNotifications(
    supabase as unknown as Parameters<typeof queueCalendarReminderNotifications>[0],
    user.id,
    updatedEvent
  )

  const reminderText = reminderRules.length > 0
    ? `\n🔔 Reminder: ${md(formatTelegramReminderRules(reminderRules))}`
    : ''
  return `✅ *Agenda diperbarui*\n📌 ${md(updatedEvent.title)}\n🕒 ${md(formatTelegramLocalDateTime(updatedEvent.start_at, timezone))} WIB${reminderText}`
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
    return '✅ *Task aktif kosong*\nTidak ada task aktif\\. Napas dulu, dashboard juga butuh hari tenang\\.'
  }

  return `📌 *5 task aktif terdekat:*\n${data
    .map((task, index) => `${index + 1}\\. ${md(task.title)} \\(${md(task.priority)}${task.due_date ? `, ${md(task.due_date)}` : ''}\\)`)
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

  if (!data?.length) return '🌱 *Habit kosong*\nBelum ada habit aktif\\.'

  return `🌱 *Habit aktif:*\n${data
    .map((habit, index) => `${index + 1}\\. ${md(habit.name)} \\(${md(getHabitCadenceLabel(habit))}\\)`)
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
    `🗓️ *Ringkasan hari ini* \\(${md(today)}\\)`,
    `📌 *Task:* ${tasks.length ? md(tasks.map((task) => task.title).join(', ')) : 'kosong'}`,
    `🕒 *Agenda:* ${events.length ? md(events.map((event) => event.title).join(', ')) : 'kosong'}`,
    `🌱 *Habit:* ${habits.length ? md(habits.map((habit) => habit.name).join(', ')) : 'kosong'}`,
  ].join('\n')
}

function buildTelegramHelpMessage() {
  return [
    'Command yang tersedia:',
    '/tasks - lihat task aktif terdekat',
    '/today - ringkasan hari ini',
    '/habits - lihat habit aktif',
    '/memory - lihat memory aktif',
    '/remember teks - simpan hal penting ke memory',
    '/compact atau /compactmemory - ringkas chat terakhir ke memory',
    '/forgetmemory - kosongkan long-term memory',
    '/agent - lihat setting agent mode',
    '/agentstyle teks - ubah gaya respon AI',
    '/telegramstyle teks - ubah gaya respon Telegram',
    '/agentprompt teks - tambah aturan prompt agent',
    '/gambar prompt - generate gambar lalu kirim ke Telegram',
    '/search query - cari web lalu ringkas hasilnya',
    '/fetch url - baca/ringkas halaman web',
    '/confirm - simpan draft terakhir',
    '/cancel - batalkan draft terakhir',
    '',
    'Kamu juga bisa kirim gambar/screenshot dengan caption, misalnya: ini jadwal, masukin kalender.',
    'Selain command, kamu tetap bisa ngomong natural seperti: bimbingan skripsi besok ubah ke jam 11 siang.',
  ].join('\n')
}

function buildLoggedTelegramInput(text: string, attachment: TelegramImageAttachment | null) {
  if (!attachment) return text
  const label = attachment.name ? `${attachment.mimeType}: ${attachment.name}` : attachment.mimeType
  return `${text || '[Image message]'}\n[Telegram image attached: ${label}]`
}

function getLargestTelegramPhoto(message: NonNullable<TelegramUpdate['message']>) {
  if (!message.photo?.length) return null
  return message.photo.reduce((largest, photo) => {
    const largestSize = largest.file_size ?? largest.width * largest.height
    const photoSize = photo.file_size ?? photo.width * photo.height
    return photoSize > largestSize ? photo : largest
  })
}

async function extractTelegramImageAttachment(message: NonNullable<TelegramUpdate['message']>) {
  const photo = getLargestTelegramPhoto(message)
  if (photo) {
    return {
      dataUrl: await getTelegramFileAsDataUrl(photo.file_id, 'image/jpeg'),
      mimeType: 'image/jpeg',
      name: 'telegram-photo.jpg',
    }
  }

  const document = message.document
  if (document?.mime_type?.startsWith('image/')) {
    return {
      dataUrl: await getTelegramFileAsDataUrl(document.file_id, document.mime_type),
      mimeType: document.mime_type,
      name: document.file_name,
    }
  }

  return null
}

export async function POST(request: NextRequest) {
  if (!validateTelegramSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const update = (await request.json().catch(() => ({}))) as TelegramUpdate
  const message = update.message

  if (!message?.chat?.id) {
    return Response.json({ ok: true, skipped: true })
  }

  const chatId = String(message.chat.id)
  const text = (message.text ?? message.caption ?? '').trim()
  const supabase = createServiceRoleClient()
  let imageAttachment: TelegramImageAttachment | null = null

  try {
    imageAttachment = message.photo?.length || message.document?.mime_type?.startsWith('image/')
      ? await withTelegramTyping(chatId, () => extractTelegramImageAttachment(message), 'upload_photo')
      : await extractTelegramImageAttachment(message)
  } catch (error) {
    await sendTelegramMessage(
      chatId,
      `Saya belum bisa membaca gambar itu: ${error instanceof Error ? error.message : 'file Telegram gagal diambil'}`
    )
    return Response.json({ ok: true, image_failed: true })
  }

  if (!text && !imageAttachment) {
    return Response.json({ ok: true, skipped: true })
  }

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
    await sendTelegramRichMessage(chatId, await withTelegramTyping(chatId, () => handleTasks(linkedUser)))
    return Response.json({ ok: true })
  }

  if (text.startsWith('/habits')) {
    await sendTelegramRichMessage(chatId, await withTelegramTyping(chatId, () => handleHabits(linkedUser)))
    return Response.json({ ok: true })
  }

  if (text.startsWith('/today')) {
    await sendTelegramRichMessage(chatId, await withTelegramTyping(chatId, () => handleToday(linkedUser)))
    return Response.json({ ok: true })
  }

  if (text.startsWith('/help')) {
    await sendTelegramMessage(chatId, buildTelegramHelpMessage())
    return Response.json({ ok: true })
  }

  if (await handleTelegramImageGeneration(chatId, linkedUser, message.message_id, text)) {
    return Response.json({ ok: true, image_generated: true })
  }

  if (await handleTelegramWebFetch(chatId, linkedUser, message.message_id, text)) {
    return Response.json({ ok: true, web_fetched: true })
  }

  if (await handleTelegramWebSearch(chatId, linkedUser, message.message_id, text)) {
    return Response.json({ ok: true, web_searched: true })
  }

  const memoryCommandReply = await withTelegramTyping(chatId, () => handleTelegramMemoryCommand(linkedUser, message.message_id, text))
  if (memoryCommandReply) {
    await sendTelegramMessage(chatId, memoryCommandReply)
    return Response.json({ ok: true, memory_command: true })
  }

  const calendarUpdateReply = await withTelegramTyping(chatId, () => handleTelegramCalendarUpdate(linkedUser, text))
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

    await sendTelegramRichMessage(chatId, calendarUpdateReply)
    return Response.json({ ok: true, calendar_updated: true })
  }

  if (text.startsWith('/cancel')) {
    await supabase
      .from('ai_hub_logs')
      .update({ status: 'cancelled' })
      .eq('user_id', linkedUser.id)
      .eq('source', 'telegram')
      .eq('status', 'draft')

    await sendTelegramRichMessage(chatId, '❌ *Draft dibatalkan*\nDraft Telegram terakhir sudah dibatalkan\\.')
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
      await sendTelegramRichMessage(chatId, `⚠️ *Gagal membaca draft*\n${md(latestDraftError.message)}`)
      return Response.json({ ok: true, confirmed: false })
    }

    const aiResponse = parseStoredAIResponse(latestDraft?.ai_response)

    if (!latestDraft || !aiResponse) {
      await sendTelegramRichMessage(chatId, 'ℹ️ *Tidak ada draft*\nBelum ada draft Telegram yang siap dikonfirmasi\\.')
      return Response.json({ ok: true, confirmed: false })
    }

    const execution = await withTelegramTyping(
      chatId,
      () => executeAIResponseItemsWithClient(
        supabase as unknown as Parameters<typeof executeAIResponseItemsWithClient>[0],
        linkedUser.id,
        aiResponse.items
      )
    )

    await supabase
      .from('ai_hub_logs')
      .update({
        status: execution.created.length > 0 ? 'confirmed' : 'failed',
        error_message: execution.errors.length ? execution.errors.join('; ') : null,
      })
      .eq('id', latestDraft.id)

    await sendTelegramRichMessage(chatId, `✅ *Eksekusi selesai*\n${md(buildAIExecutionMessage(execution))}`)
    return Response.json({ ok: true })
  }

  const {
    visionResult,
    response,
    raw,
    tokensUsed,
    latencyMs,
  } = await withTelegramTyping(chatId, async () => {
    const vision = imageAttachment
      ? await analyzeImageWithVision({
          userPrompt: text,
          imageDataUrl: imageAttachment.dataUrl,
          mimeType: imageAttachment.mimeType,
        })
      : null
    const mainModelInput = buildMainModelInputWithVisionAnalysis(text, vision?.analysis ?? null)
    const llmResult = await callLLM(await buildTelegramAIContext(linkedUser, mainModelInput))

    return {
      visionResult: vision,
      ...llmResult,
    }
  })
  const totalTokensUsed = (tokensUsed ?? 0) + (visionResult?.tokensUsed ?? 0) || null
  const totalLatencyMs = latencyMs + (visionResult?.latencyMs ?? 0)
  const aiResponse = response
    ? normalizeAIResponseForCommand(text, response as AIResponse)
    : null

  if (!aiResponse) {
    const smartRecallReply = await withTelegramTyping(
      chatId,
      () => buildTelegramSmartRecallReply(
        supabase as unknown as Parameters<typeof buildTelegramSmartRecallReply>[0],
        linkedUser,
        text
      )
    )

    if (smartRecallReply) {
      await supabase.from('ai_hub_logs').insert({
        user_id: linkedUser.id,
        source: 'telegram',
        telegram_message_id: message.message_id,
        raw_input: buildLoggedTelegramInput(text, imageAttachment),
        ai_response: {
          items: [],
          ai_message: smartRecallReply,
        },
        status: 'confirmed',
        error_message: `AI response could not be parsed, used smart recall fallback: ${raw.slice(0, 200)}`,
        tokens_used: totalTokensUsed,
        latency_ms: totalLatencyMs,
      })

      await sendTelegramRichMessage(chatId, `💬 *Jawaban*\n${md(smartRecallReply)}`)
      return Response.json({ ok: true, recalled: true, fallback: true })
    }
  }

  await supabase.from('ai_hub_logs').insert({
    user_id: linkedUser.id,
    source: 'telegram',
    telegram_message_id: message.message_id,
    raw_input: buildLoggedTelegramInput(text, imageAttachment),
    ai_response: aiResponse,
    status: aiResponse ? (aiResponse.items.length > 0 ? 'draft' : 'confirmed') : 'failed',
    error_message: aiResponse ? null : `AI response could not be parsed: ${raw.slice(0, 200)}`,
    tokens_used: totalTokensUsed,
    latency_ms: totalLatencyMs,
  })

  if (!aiResponse) {
    await sendTelegramRichMessage(chatId, '⚠️ *Belum bisa diproses*\nCoba tulis lebih spesifik ya\\.')
    return Response.json({ ok: true, parsed: false })
  }

  await sendTelegramRichMessage(chatId, formatDraft(aiResponse.items, aiResponse.ai_message, linkedUser.preferences?.timezone))
  return Response.json({ ok: true, parsed: true })
}
