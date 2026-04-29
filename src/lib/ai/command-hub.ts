// ============================================================
// AI Command Hub Helpers
// Shared helpers for prompt context and command execution.
// ============================================================

import { createServerClient } from '@/lib/supabase/server'
import { buildAssistantSystemPrompt, buildSystemPrompt } from '@/lib/ai/prompts'
import { queueCalendarReminderNotifications, queueTaskDeadlineNotifications } from '@/lib/notification-queue'
import type { AIResponseItem, UserPreferences } from '@/core/types'
import type { RoleContext } from '@/core/constants'

type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }

export interface CommandHubMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | MessageContentPart[]
}

interface AssistantConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AssistantAttachment {
  mimeType: string
  dataUrl: string
}

interface AssistantMessageOptions {
  input: string
  conversation?: AssistantConversationMessage[]
  attachment?: AssistantAttachment | null
}

interface PromptContextData {
  userCategories: { name: string; role: RoleContext }[]
  timezone: string
  activeRoles: RoleContext[]
  dashboardContext: string | null
  memoryContext: string | null
}

interface AIHubMemoryLog {
  created_at: string
  raw_input: string
  ai_response: unknown
}

export async function buildAICommandMessages(
  userId: string,
  input: string
): Promise<CommandHubMessage[]> {
  const { userCategories, timezone, activeRoles, dashboardContext, memoryContext } =
    await getPromptContext(userId)

  const systemPrompt = buildSystemPrompt({
    currentDatetimeISO: new Date().toISOString(),
    userTimezone: timezone,
    utcOffset: '+07:00',
    userCategories,
    userActiveRoles: activeRoles,
    dashboardContext,
    memoryContext,
  })

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: input.trim() },
  ]
}

export async function buildAIAssistantMessages(
  userId: string,
  options: AssistantMessageOptions
): Promise<CommandHubMessage[]> {
  const { userCategories, timezone, activeRoles, dashboardContext, memoryContext } =
    await getPromptContext(userId)

  const systemPrompt = buildAssistantSystemPrompt({
    currentDatetimeISO: new Date().toISOString(),
    userTimezone: timezone,
    utcOffset: '+07:00',
    userCategories,
    userActiveRoles: activeRoles,
    dashboardContext,
    memoryContext,
  })

  const history = (options.conversation ?? [])
    .filter((message) => typeof message.content === 'string' && message.content.trim())
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))

  const messages: CommandHubMessage[] = [{ role: 'system', content: systemPrompt }]

  for (const message of history) {
    messages.push({
      role: message.role,
      content: message.content,
    })
  }

  const trimmedInput = options.input.trim()
  if (options.attachment?.dataUrl && options.attachment.mimeType.startsWith('image/')) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: `${trimmedInput}\n\nAda gambar terlampir untuk dianalisis. Jika user hanya minta analisa atau diskusi, jawab di ai_message tanpa membuat item. Jika user minta simpan ke vault, minta link karena vault hanya menerima URL.`,
        },
        {
          type: 'image_url',
          image_url: {
            url: options.attachment.dataUrl,
            detail: 'auto',
          },
        },
      ],
    })
  } else {
    messages.push({ role: 'user', content: trimmedInput })
  }

  return messages
}

export function buildMainModelInputWithVisionAnalysis(text: string, visionAnalysis: string | null) {
  if (!visionAnalysis) return text

  return [
    text || 'Bantu saya dari gambar ini.',
    '',
    'KONTEKS GAMBAR DARI VISION MODEL:',
    visionAnalysis,
    '',
    'Gunakan konteks gambar di atas sebagai hasil OCR/observasi visual. Jangan mengarang detail yang tidak ada. Jika user meminta aksi, buat draft/action berdasarkan konteks ini dan data dashboard.',
  ].join('\n')
}

export async function executeAIResponseItems(
  userId: string,
  items: AIResponseItem[]
): Promise<{
  created: Array<{ id: string; action: AIResponseItem['action']; title: string }>
  errors: string[]
}> {
  const supabase = await createServerClient()
  return executeAIResponseItemsWithClient(supabase, userId, items)
}

export async function executeAIResponseItemsWithClient(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  items: AIResponseItem[]
): Promise<{
  created: Array<{ id: string; action: AIResponseItem['action']; title: string }>
  errors: string[]
}> {
  const created: Array<{ id: string; action: AIResponseItem['action']; title: string }> = []
  const errors: string[] = []

  for (const item of items) {
    try {
      const result = await insertDraftItem(supabase, userId, item)

      if (!result) {
        errors.push(`Gagal menyimpan ${item.action}: ${item.data.title}`)
        continue
      }

      created.push({
        id: result.id,
        action: item.action,
        title: item.data.title,
      })
    } catch (error) {
      errors.push(
        `Error ${item.action}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  return { created, errors }
}

export function buildAIExecutionMessage(result: {
  created: Array<{ id: string; action: AIResponseItem['action']; title: string }>
  errors: string[]
}): string {
  if (result.created.length === 0 && result.errors.length > 0) {
    return 'Saya belum berhasil menjalankan perintah itu. Coba cek detail inputnya lalu ulangi lagi.'
  }

  const actionLabels: Record<AIResponseItem['action'], string> = {
    TASK: 'tugas',
    NOTE: 'catatan',
    CALENDAR: 'agenda kalender',
    ACADEMIC: 'item vault',
  }

  const createdSummary = result.created
    .map((item) => `${actionLabels[item.action]} "${item.title}"`)
    .join(', ')

  if (result.errors.length > 0) {
    return `Saya sudah membuat ${createdSummary}, tapi masih ada ${result.errors.length} item yang gagal disimpan.`
  }

  return `Saya sudah membuat ${createdSummary}.`
}

async function getPromptContext(userId: string): Promise<PromptContextData> {
  const supabase = await createServerClient()

  const oneDayAgoISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    categoriesResult,
    userDataResult,
    tasksResult,
    eventsResult,
    habitsResult,
    notesResult,
    vaultResult,
    historyResult,
  ] = await Promise.allSettled([
    supabase
      .from('categories')
      .select('name, contextual_role')
      .eq('user_id', userId)
      .eq('is_deleted', false),
    supabase.from('users').select('preferences').eq('id', userId).single(),
    supabase
      .from('tasks')
      .select('title, status, priority, due_date, contextual_role, description')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from('calendar_events')
      .select('title, start_at, end_at, contextual_role, description')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('start_at', oneDayAgoISO)
      .order('start_at', { ascending: true })
      .limit(20),
    supabase
      .from('habits')
      .select('name, cadence_mode, cadence_config')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('brain_notes')
      .select('title, content_body, note_type, contextual_role, updated_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .limit(8),
    supabase
      .from('academic_vault_items')
      .select('title, description, document_type, mata_kuliah, semester, updated_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .limit(8),
    supabase
      .from('ai_hub_logs')
      .select('created_at, raw_input, ai_response')
      .eq('user_id', userId)
      .eq('source', 'in_app')
      .in('status', ['confirmed', 'draft'])
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const userCategories =
    categoriesResult.status === 'fulfilled' && !categoriesResult.value.error
      ? (categoriesResult.value.data ?? []).map((category) => ({
          name: category.name,
          role: category.contextual_role as RoleContext,
        }))
      : []

  let timezone = 'Asia/Jakarta'
  let activeRoles: RoleContext[] = ['dosen', 'creator', 'affiliate', 'consultant', 'general']

  if (userDataResult.status === 'fulfilled' && !userDataResult.value.error) {
    const preferences = userDataResult.value.data?.preferences
    if (preferences && typeof preferences === 'object') {
      const userPreferences = preferences as Partial<UserPreferences>
      if (typeof userPreferences.timezone === 'string' && userPreferences.timezone.trim()) {
        timezone = userPreferences.timezone
      }
      if (Array.isArray(userPreferences.active_roles) && userPreferences.active_roles.length > 0) {
        activeRoles = userPreferences.active_roles as RoleContext[]
      }
    }
  }

  const dashboardContext = buildDashboardSnapshot({
    tasks: tasksResult.status === 'fulfilled' && !tasksResult.value.error ? tasksResult.value.data ?? [] : [],
    events: eventsResult.status === 'fulfilled' && !eventsResult.value.error ? eventsResult.value.data ?? [] : [],
    habits: habitsResult.status === 'fulfilled' && !habitsResult.value.error ? habitsResult.value.data ?? [] : [],
    notes: notesResult.status === 'fulfilled' && !notesResult.value.error ? notesResult.value.data ?? [] : [],
    vault: vaultResult.status === 'fulfilled' && !vaultResult.value.error ? vaultResult.value.data ?? [] : [],
    timezone,
  })

  const memoryContext = buildMemoryContext(
    historyResult.status === 'fulfilled' && !historyResult.value.error
      ? ((historyResult.value.data ?? []) as AIHubMemoryLog[])
      : [],
    timezone
  )

  return { userCategories, timezone, activeRoles, dashboardContext, memoryContext }
}

function cleanSnippet(value: string | null | undefined, maxLength = 110) {
  return (value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function extractAIMessage(value: unknown) {
  if (!value || typeof value !== 'object') return ''
  const candidate = value as { ai_message?: unknown }
  return typeof candidate.ai_message === 'string' ? candidate.ai_message : ''
}

function buildMemoryContext(logs: AIHubMemoryLog[], timezone: string) {
  const lines = logs
    .slice()
    .reverse()
    .map((log) => {
      const when = new Intl.DateTimeFormat('id-ID', {
        timeZone: timezone,
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(log.created_at))
      const userText = cleanSnippet(log.raw_input, 160)
      const aiText = cleanSnippet(extractAIMessage(log.ai_response), 180)
      return `${when}: User "${userText}"${aiText ? `; Assistant "${aiText}"` : ''}`
    })
    .filter(Boolean)

  if (!lines.length) return null
  return lines.join('\n').slice(0, 3000)
}

function buildDashboardSnapshot(params: {
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

async function insertDraftItem(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  item: AIResponseItem
): Promise<{ id: string } | null> {
  const categoryIds = await resolveCategoryIds(supabase, userId, item)
  let recordId: string | null = null

  switch (item.action) {
    case 'TASK': {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title: item.data.title,
          description: item.data.description,
          status: 'todo',
          priority: item.data.priority,
          contextual_role: item.data.contextual_role,
          due_date: item.data.due_date,
        })
        .select('id')
        .single()

      if (error) return null
      recordId = data.id
      if (item.data.due_date) {
        await queueTaskDeadlineNotifications(supabase, userId, {
          id: recordId!,
          title: item.data.title,
          due_date: item.data.due_date ?? null,
        })
      }
      break
    }

    case 'NOTE': {
      const { data, error } = await supabase
        .from('brain_notes')
        .insert({
          user_id: userId,
          title: item.data.title,
          content_body: item.data.description ?? '',
          note_type: detectNoteType(item),
          contextual_role: item.data.contextual_role,
          source_url: item.data.source_url,
        })
        .select('id')
        .single()

      if (error) return null
      recordId = data.id
      break
    }

    case 'CALENDAR': {
      const startAt = item.data.start_at ?? new Date().toISOString()
      const reminderConfig = item.data.reminder_config ?? (
        typeof item.data.reminder_minutes === 'number'
          ? [{ type: 'before_minutes' as const, minutes: item.data.reminder_minutes }]
          : []
      )
      const primaryReminderMinutes = reminderConfig.find((rule) => rule.type === 'before_minutes')?.minutes ?? item.data.reminder_minutes ?? null
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          user_id: userId,
          title: item.data.title,
          description: item.data.description,
          start_at: startAt,
          end_at: item.data.end_at,
          is_all_day: !item.data.start_at,
          reminder_minutes: primaryReminderMinutes,
          reminder_config: reminderConfig,
          contextual_role: item.data.contextual_role,
          recurrence: 'none',
        })
        .select('*')
        .single()

      if (error) return null
      recordId = data.id
      await queueCalendarReminderNotifications(supabase, userId, data)
      break
    }

    case 'ACADEMIC': {
      if (!item.data.source_url?.trim()) return null

      const { data, error } = await supabase
        .from('academic_vault_items')
        .insert({
          user_id: userId,
          title: item.data.title,
          description: item.data.description ?? '',
          document_type: detectDocType(item),
          file_format: item.data.file_format ?? 'link',
          file_url: item.data.source_url,
          semester: item.data.semester,
          mata_kuliah: item.data.mata_kuliah,
        })
        .select('id')
        .single()

      if (error) return null
      recordId = data.id
      break
    }
  }

  if (recordId && categoryIds.length > 0) {
    const itemTypeMap: Record<AIResponseItem['action'], string> = {
      TASK: 'task',
      NOTE: 'brain_note',
      CALENDAR: 'calendar_event',
      ACADEMIC: 'academic_vault',
    }

    const junctionRows = categoryIds.map((categoryId) => ({
      item_id: recordId!,
      item_type: itemTypeMap[item.action],
      category_id: categoryId,
    }))

    await supabase.from('item_categories').insert(junctionRows)
  }

  return recordId ? { id: recordId } : null
}

async function resolveCategoryIds(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  item: AIResponseItem
) {
  const candidateNames = new Set<string>()

  for (const categoryName of item.data.category_names ?? []) {
    const normalized = categoryName.trim()
    if (normalized) {
      candidateNames.add(normalized)
    }
  }

  if (item.data.suggested_new_category?.trim()) {
    candidateNames.add(item.data.suggested_new_category.trim())
  }

  const categoryIds: string[] = []

  for (const categoryName of candidateNames) {
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .eq('name', categoryName)
      .eq('is_deleted', false)
      .maybeSingle()

    if (existing) {
      categoryIds.push(existing.id)
      continue
    }

    const { data: createdCategory } = await supabase
      .from('categories')
      .insert({
        user_id: userId,
        name: categoryName,
        color: '#6366f1',
        icon: '📁',
        contextual_role: item.data.contextual_role,
      })
      .select('id')
      .single()

    if (createdCategory) {
      categoryIds.push(createdCategory.id)
    }
  }

  return categoryIds
}

function detectNoteType(item: AIResponseItem): string {
  if (item.data.source_url) return 'link'
  if (item.data.description?.toLowerCase().includes('ide')) return 'idea'
  return 'text'
}

function detectDocType(item: AIResponseItem): string {
  const title = item.data.title?.toLowerCase() ?? ''
  if (title.includes('rps')) return 'rps'
  if (title.includes('silabus')) return 'silabus'
  if (title.includes('jurnal')) return 'jurnal'
  if (title.includes('sk')) return 'sk'
  if (title.includes('materi')) return 'materi_ajar'
  if (title.includes('sertifikat')) return 'sertifikat'
  if (title.includes('admin')) return 'administratif'
  return 'lainnya'
}
