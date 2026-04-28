// ============================================================
// Route Handler: /api/habits/[id]
// PATCH  — Update habit
// DELETE — Soft delete habit
// ============================================================

import { type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { HABIT_CADENCE_MODES, ROLES, type HabitCadenceMode, type RoleContext } from '@/core/constants'
import type { HabitCadenceConfig } from '@/core/types'
import { normalizeHabitCadenceConfig } from '@/lib/habits'

const VALID_HABIT_CADENCE_MODES = Object.keys(HABIT_CADENCE_MODES) as HabitCadenceMode[]
const VALID_ROLE_CONTEXTS = Object.keys(ROLES) as RoleContext[]

// PATCH /api/habits/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = await createServerClient()
    const body = await request.json()

    if (body.cadence_mode && !VALID_HABIT_CADENCE_MODES.includes(body.cadence_mode as HabitCadenceMode)) {
      return Response.json({ error: 'Ritme habit tidak valid' }, { status: 400 })
    }

    if (body.contextual_role && !VALID_ROLE_CONTEXTS.includes(body.contextual_role as RoleContext)) {
      return Response.json({ error: 'Peran habit tidak valid' }, { status: 400 })
    }

    const updates = { ...body } as Record<string, unknown>
    if (updates.cadence_mode) {
      updates.cadence_config = normalizeHabitCadenceConfig(
        updates.cadence_mode as HabitCadenceMode,
        updates.cadence_config as HabitCadenceConfig | undefined
      )
    }

    const { data, error } = await supabase
      .from('habits')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json(data)
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/habits/:id (soft delete)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('habits')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json({ success: true })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
