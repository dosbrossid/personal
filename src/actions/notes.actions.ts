// ============================================================
// Server Actions: Notes (Brain Notes)
// Handles: create, update, delete, toggle pin
// ============================================================

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import type { ActionResult, BrainNote } from '@/core/types'

/**
 * Create a new brain note
 */
export async function createNote(data: {
  title: string
  content_body?: string
  note_type?: string
  contextual_role?: string
  source_url?: string | null
  is_pinned?: boolean
}): Promise<ActionResult<BrainNote>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    if (!data.title?.trim()) {
      return { data: null, error: 'Title wajib diisi' }
    }

    const { data: note, error } = await supabase
      .from('brain_notes')
      .insert({
        user_id: user.id,
        title: data.title.trim(),
        content_body: data.content_body || '',
        note_type: data.note_type || 'text',
        contextual_role: data.contextual_role || 'general',
        source_url: data.source_url || null,
        is_pinned: data.is_pinned || false,
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: note as BrainNote, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Update an existing brain note
 */
export async function updateNote(
  id: string,
  updates: Partial<{
    title: string
    content_body: string
    note_type: string
    contextual_role: string
    source_url: string | null
    is_pinned: boolean
  }>
): Promise<ActionResult<BrainNote>> {
  try {
    await requireAuth()
    const supabase = await createServerClient()

    const { data: note, error } = await supabase
      .from('brain_notes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: note as BrainNote, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Toggle pin status of a brain note
 */
export async function togglePinNote(id: string, isPinned: boolean): Promise<ActionResult<BrainNote>> {
  try {
    await requireAuth()
    const supabase = await createServerClient()

    const { data: note, error } = await supabase
      .from('brain_notes')
      .update({ is_pinned: !isPinned })
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: note as BrainNote, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Soft delete a brain note
 */
export async function deleteNote(id: string): Promise<ActionResult<null>> {
  try {
    await requireAuth()
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('brain_notes')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}
