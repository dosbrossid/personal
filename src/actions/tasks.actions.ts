// ============================================================
// Server Actions: Tasks
// Handles: create, update, delete tasks
// ============================================================

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { queueTaskDeadlineNotifications } from '@/lib/notification-queue'
import type { ActionResult, Task } from '@/core/types'

/**
 * Create a new task
 */
export async function createTask(data: {
  title: string
  description?: string
  status?: string
  priority?: string
  contextual_role?: string
  due_date?: string | null
}): Promise<ActionResult<Task>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    if (!data.title?.trim()) {
      return { data: null, error: 'Title wajib diisi' }
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title: data.title.trim(),
        description: data.description || null,
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        contextual_role: data.contextual_role || 'general',
        due_date: data.due_date || null,
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    await queueTaskDeadlineNotifications(supabase, user.id, task as Task)
    return { data: task as Task, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Update an existing task
 */
export async function updateTask(
  id: string,
  updates: Partial<{
    title: string
    description: string | null
    status: string
    priority: string
    contextual_role: string
    due_date: string | null
  }>
): Promise<ActionResult<Task>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    // Auto-set completed_at when task is marked done
    const payload: Record<string, unknown> = { ...updates }
    if (updates.status === 'done') {
      payload.completed_at = new Date().toISOString()
    } else if (updates.status && updates.status !== 'done') {
      payload.completed_at = null
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    if (updates.due_date) {
      await queueTaskDeadlineNotifications(supabase, user.id, task as Task)
    }
    return { data: task as Task, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Soft delete a task
 */
export async function deleteTask(id: string): Promise<ActionResult<null>> {
  try {
    await requireAuth()
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('tasks')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}
