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

export async function buildAICommandMessages(
  userId: string,
  input: string
): Promise<CommandHubMessage[]> {
  const { userCategories, timezone } = await getPromptContext(userId)

  const activeRoles: RoleContext[] = ['dosen', 'creator', 'affiliate', 'consultant', 'general']

  const systemPrompt = buildSystemPrompt({
    currentDatetimeISO: new Date().toISOString(),
    userTimezone: timezone,
    utcOffset: '+07:00',
    userCategories,
    userActiveRoles: activeRoles,
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
  const { userCategories, timezone } = await getPromptContext(userId)

  const activeRoles: RoleContext[] = ['dosen', 'creator', 'affiliate', 'consultant', 'general']

  const systemPrompt = buildAssistantSystemPrompt({
    currentDatetimeISO: new Date().toISOString(),
    userTimezone: timezone,
    utcOffset: '+07:00',
    userCategories,
    userActiveRoles: activeRoles,
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

async function getPromptContext(userId: string) {
  const supabase = await createServerClient()

  const [categoriesResult, userDataResult] = await Promise.allSettled([
    supabase
      .from('categories')
      .select('name, contextual_role')
      .eq('user_id', userId)
      .eq('is_deleted', false),
    supabase.from('users').select('preferences').eq('id', userId).single(),
  ])

  const userCategories =
    categoriesResult.status === 'fulfilled' && !categoriesResult.value.error
      ? (categoriesResult.value.data ?? []).map((category) => ({
          name: category.name,
          role: category.contextual_role as RoleContext,
        }))
      : []

  let timezone = 'Asia/Jakarta'

  if (userDataResult.status === 'fulfilled' && !userDataResult.value.error) {
    const preferences = userDataResult.value.data?.preferences
    if (preferences && typeof preferences === 'object') {
      const userPreferences = preferences as Partial<UserPreferences>
      if (typeof userPreferences.timezone === 'string' && userPreferences.timezone.trim()) {
        timezone = userPreferences.timezone
      }
    }
  }

  return { userCategories, timezone }
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
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          user_id: userId,
          title: item.data.title,
          description: item.data.description,
          start_at: item.data.start_at ?? new Date().toISOString(),
          end_at: item.data.end_at,
          is_all_day: !item.data.start_at,
          reminder_minutes: item.data.reminder_minutes ?? 15,
          contextual_role: item.data.contextual_role,
          recurrence: 'none',
        })
        .select('id')
        .single()

      if (error) return null
      recordId = data.id
      if (item.data.reminder_minutes && item.data.start_at) {
        await queueCalendarReminderNotifications(supabase, userId, {
          id: recordId!,
          title: item.data.title,
          start_at: item.data.start_at ?? new Date().toISOString(),
          reminder_minutes: item.data.reminder_minutes,
        })
      }
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
