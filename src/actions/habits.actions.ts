// ============================================================
// Server Actions: Habits
// Handles: create, update, delete, toggle log
// ============================================================

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import type { ActionResult, Habit, HabitCadenceConfig } from '@/core/types'
import { HABIT_CADENCE_MODES, type HabitCadenceMode, ROLES, type RoleContext } from '@/core/constants'
import { normalizeHabitCadenceConfig } from '@/lib/habits'

const VALID_HABIT_CADENCE_MODES = Object.keys(HABIT_CADENCE_MODES) as HabitCadenceMode[]
const VALID_ROLE_CONTEXTS = Object.keys(ROLES) as RoleContext[]

/**
 * Create a new habit
 */
export async function createHabit(data: {
  name: string
  cadence_mode?: HabitCadenceMode
  cadence_config?: HabitCadenceConfig
  contextual_role?: RoleContext
}): Promise<ActionResult<Habit>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    if (!data.name?.trim()) {
      return { data: null, error: 'Nama habit wajib diisi' }
    }

    const cadenceMode = data.cadence_mode || 'daily'
    if (!VALID_HABIT_CADENCE_MODES.includes(cadenceMode)) {
      return { data: null, error: 'Ritme habit tidak valid' }
    }

    const contextualRole = data.contextual_role || 'general'
    if (!VALID_ROLE_CONTEXTS.includes(contextualRole)) {
      return { data: null, error: 'Peran habit tidak valid' }
    }

    const { data: habit, error } = await supabase
      .from('habits')
      .insert({
        user_id: user.id,
        name: data.name.trim(),
        cadence_mode: cadenceMode,
        cadence_config: normalizeHabitCadenceConfig(cadenceMode, data.cadence_config),
        contextual_role: contextualRole,
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: habit as Habit, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Update an existing habit
 */
export async function updateHabit(
  id: string,
  updates: Partial<{
    name: string
    cadence_mode: HabitCadenceMode
    cadence_config: HabitCadenceConfig
    contextual_role: RoleContext
    is_active: boolean
  }>
): Promise<ActionResult<Habit>> {
  try {
    await requireAuth()
    const supabase = await createServerClient()

    if (updates.cadence_mode && !VALID_HABIT_CADENCE_MODES.includes(updates.cadence_mode)) {
      return { data: null, error: 'Ritme habit tidak valid' }
    }

    if (updates.contextual_role && !VALID_ROLE_CONTEXTS.includes(updates.contextual_role)) {
      return { data: null, error: 'Peran habit tidak valid' }
    }

    let normalizedUpdates = { ...updates }

    if (updates.cadence_mode) {
      normalizedUpdates = {
        ...normalizedUpdates,
        cadence_config: normalizeHabitCadenceConfig(updates.cadence_mode, updates.cadence_config),
      }
    }

    const { data: habit, error } = await supabase
      .from('habits')
      .update(normalizedUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: habit as Habit, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Toggle habit log for a specific date
 * If log exists and completed → remove it
 * If log doesn't exist → create it as completed
 */
export async function toggleHabitLog(
  habitId: string,
  logDate: string
): Promise<ActionResult<{ toggled: boolean }>> {
  try {
    await requireAuth()
    const supabase = await createServerClient()

    const { data: existing } = await supabase
      .from('habit_logs')
      .select('id, is_completed')
      .eq('habit_id', habitId)
      .eq('log_date', logDate)
      .single()

    if (existing?.is_completed) {
      const { error } = await supabase
        .from('habit_logs')
        .delete()
        .eq('id', existing.id)

      if (error) return { data: null, error: error.message }
      return { data: { toggled: false }, error: null }
    }

    if (existing) {
      const { error } = await supabase
        .from('habit_logs')
        .update({ is_completed: true })
        .eq('id', existing.id)

      if (error) return { data: null, error: error.message }
    } else {
      const { error } = await supabase
        .from('habit_logs')
        .insert({
          habit_id: habitId,
          log_date: logDate,
          is_completed: true,
        })

      if (error) return { data: null, error: error.message }
    }

    return { data: { toggled: true }, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Soft delete a habit
 */
export async function deleteHabit(id: string): Promise<ActionResult<null>> {
  try {
    await requireAuth()
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('habits')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}
