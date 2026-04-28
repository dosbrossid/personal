// ============================================================
// Server Actions: Settings
// Handles profile, preferences, Telegram linking, and test notifications.
// ============================================================

'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram'
import type { ActionResult, User, UserPreferences } from '@/core/types'
import type { RoleContext } from '@/core/constants'

const ROLE_VALUES: RoleContext[] = ['dosen', 'creator', 'affiliate', 'consultant', 'general']

const DEFAULT_NOTIFICATION_PREFS: NonNullable<UserPreferences['notifications']> = {
  task_deadline: true,
  habit_daily: true,
  calendar_event: true,
  weekly_digest_telegram: false,
  telegram_enabled: false,
  push_enabled: true,
}

const DEFAULT_PREFERENCES: UserPreferences = {
  timezone: 'Asia/Jakarta',
  theme: 'light',
  locale: 'id',
  onboarding_completed: false,
  active_roles: ['dosen', 'creator', 'affiliate', 'consultant', 'general'],
  notifications: DEFAULT_NOTIFICATION_PREFS,
}

type SettingsInput = {
  full_name?: string
  preferences?: Partial<UserPreferences>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizePreferences(current: unknown, updates?: Partial<UserPreferences>): UserPreferences {
  const currentRecord = isRecord(current) ? current : {}
  const currentNotifications = isRecord(currentRecord.notifications)
    ? currentRecord.notifications
    : {}

  const updateNotifications = isRecord(updates?.notifications)
    ? updates.notifications
    : {}

  const activeRoles = Array.isArray(updates?.active_roles)
    ? updates.active_roles.filter((role): role is RoleContext =>
        ROLE_VALUES.includes(role as RoleContext)
      )
    : Array.isArray(currentRecord.active_roles)
      ? currentRecord.active_roles.filter((role): role is RoleContext =>
          ROLE_VALUES.includes(role as RoleContext)
        )
      : DEFAULT_PREFERENCES.active_roles

  return {
    timezone: updates?.timezone || String(currentRecord.timezone || DEFAULT_PREFERENCES.timezone),
    theme: updates?.theme || (currentRecord.theme as UserPreferences['theme']) || DEFAULT_PREFERENCES.theme,
    locale: updates?.locale || String(currentRecord.locale || DEFAULT_PREFERENCES.locale),
    onboarding_completed:
      typeof updates?.onboarding_completed === 'boolean'
        ? updates.onboarding_completed
        : typeof currentRecord.onboarding_completed === 'boolean'
          ? currentRecord.onboarding_completed
          : DEFAULT_PREFERENCES.onboarding_completed,
    active_roles: activeRoles?.length ? activeRoles : DEFAULT_PREFERENCES.active_roles,
    notifications: {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...(currentNotifications as Partial<UserPreferences['notifications']>),
      ...(updateNotifications as Partial<UserPreferences['notifications']>),
    },
  }
}

function validateTelegramChatId(chatId: string) {
  const normalized = chatId.trim()

  if (!/^-?\d{5,32}$/.test(normalized)) {
    return null
  }

  return normalized
}

export async function updateProfileSettings(input: SettingsInput): Promise<ActionResult<User>> {
  try {
    const authUser = await requireAuth()
    const supabase = await createServerClient()

    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (currentUserError) {
      return { data: null, error: currentUserError.message }
    }

    const fullName = input.full_name?.trim() || currentUser.full_name
    const preferences = normalizePreferences(currentUser.preferences, input.preferences)

    const { data, error } = await supabase
      .from('users')
      .update({
        full_name: fullName,
        preferences,
      })
      .eq('id', authUser.id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }

    revalidatePath('/settings')
    return { data: data as User, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

export async function connectTelegramChat(chatId: string): Promise<ActionResult<User>> {
  try {
    const authUser = await requireAuth()
    const normalizedChatId = validateTelegramChatId(chatId)

    if (!normalizedChatId) {
      return { data: null, error: 'Chat ID Telegram tidak valid' }
    }

    const supabase = await createServerClient()
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (currentUserError) return { data: null, error: currentUserError.message }

    const preferences = normalizePreferences(currentUser.preferences, {
      notifications: {
        ...DEFAULT_NOTIFICATION_PREFS,
        ...(isRecord(currentUser.preferences) && isRecord(currentUser.preferences.notifications)
          ? currentUser.preferences.notifications
          : {}),
        telegram_enabled: true,
      },
    })

    const { data, error } = await supabase
      .from('users')
      .update({
        telegram_chat_id: normalizedChatId,
        preferences,
      })
      .eq('id', authUser.id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: data as User, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

export async function disconnectTelegram(): Promise<ActionResult<User>> {
  try {
    const authUser = await requireAuth()
    const supabase = await createServerClient()
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (currentUserError) return { data: null, error: currentUserError.message }

    const preferences = normalizePreferences(currentUser.preferences, {
      notifications: {
        ...DEFAULT_NOTIFICATION_PREFS,
        ...(isRecord(currentUser.preferences) && isRecord(currentUser.preferences.notifications)
          ? currentUser.preferences.notifications
          : {}),
        telegram_enabled: false,
        weekly_digest_telegram: false,
      },
    })

    const { data, error } = await supabase
      .from('users')
      .update({
        telegram_chat_id: null,
        preferences,
      })
      .eq('id', authUser.id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: data as User, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

export async function createTestNotification(): Promise<ActionResult<null>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { error } = await supabase.from('notifications').insert({
      user_id: user.id,
      channel: 'push',
      title: 'Test notifikasi',
      body: 'Notifikasi in-app berhasil dibuat dari Settings.',
      reference_type: 'system',
      status: 'pending',
    })

    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

export async function sendTelegramTestMessage(): Promise<ActionResult<null>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('telegram_chat_id')
      .eq('id', user.id)
      .single()

    if (profileError) return { data: null, error: profileError.message }
    if (!profile.telegram_chat_id) {
      return { data: null, error: 'Telegram belum terhubung' }
    }

    try {
      await sendTelegramMessage(
        profile.telegram_chat_id,
        'Test Telegram berhasil. Personal Dashboard sudah bisa mengirim pesan ke chat ini.'
      )

      await supabase.from('notifications').insert({
        user_id: user.id,
        channel: 'telegram',
        title: 'Test Telegram berhasil',
        body: 'Pesan test berhasil dikirim ke Telegram.',
        reference_type: 'system',
        status: 'sent',
        sent_at: new Date().toISOString(),
      })

      return { data: null, error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengirim Telegram'

      await supabase.from('notifications').insert({
        user_id: user.id,
        channel: 'telegram',
        title: 'Test Telegram gagal',
        body: 'Pesan test Telegram gagal dikirim.',
        reference_type: 'system',
        status: 'failed',
        error_message: message,
      })

      return { data: null, error: message }
    }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}
