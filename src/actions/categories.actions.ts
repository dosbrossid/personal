// ============================================================
// Server Actions: Categories
// Handles: create, update, delete categories
// ============================================================

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import type { ActionResult, Category } from '@/core/types'

/**
 * Create a new category
 */
export async function createCategory(data: {
  name: string
  color?: string
  icon?: string
  contextual_role?: string
}): Promise<ActionResult<Category>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    if (!data.name?.trim()) {
      return { data: null, error: 'Nama kategori wajib diisi' }
    }

    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name: data.name.trim(),
        color: data.color || '#6366f1',
        icon: data.icon || '📁',
        contextual_role: data.contextual_role || 'general',
      })
      .select()
      .single()

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return { data: null, error: 'Kategori dengan nama ini sudah ada' }
      }
      return { data: null, error: error.message }
    }
    return { data: category as Category, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Update an existing category
 */
export async function updateCategory(
  id: string,
  updates: Partial<{
    name: string
    color: string
    icon: string
    contextual_role: string
  }>
): Promise<ActionResult<Category>> {
  try {
    await requireAuth()
    const supabase = await createServerClient()

    const { data: category, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: category as Category, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Soft delete a category
 */
export async function deleteCategory(id: string): Promise<ActionResult<null>> {
  try {
    await requireAuth()
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('categories')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}
