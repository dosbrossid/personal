// ============================================================
// Route Handler: /api/habits
// GET  — List habits with logs (SWR endpoint)
// POST — Create habit
// ============================================================

import { type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { HABIT_CADENCE_MODES, ROLES, type HabitCadenceMode, type RoleContext } from '@/core/constants'
import type { HabitCadenceConfig } from '@/core/types'
import { normalizeHabitCadenceConfig } from '@/lib/habits'

const VALID_HABIT_CADENCE_MODES = Object.keys(HABIT_CADENCE_MODES) as HabitCadenceMode[]
const VALID_ROLE_CONTEXTS = Object.keys(ROLES) as RoleContext[]

// GET /api/habits?role=dosen
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const { searchParams } = request.nextUrl

    let query = supabase
      .from('habits')
      .select('*, habit_logs(id, log_date, is_completed, created_at)')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    const role = searchParams.get('role')
    if (role) query = query.eq('contextual_role', role)

    const { data, error } = await query

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    const habits = (data || []).map((habit) => ({
      ...habit,
      logs: habit.habit_logs || [],
      habit_logs: undefined,
    }))

    return Response.json(habits)
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/habits
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const body = await request.json()

    if (!body.name?.trim()) {
      return Response.json({ error: 'Nama habit wajib diisi' }, { status: 400 })
    }

    const cadenceMode = (body.cadence_mode || 'daily') as HabitCadenceMode
    if (!VALID_HABIT_CADENCE_MODES.includes(cadenceMode)) {
      return Response.json({ error: 'Ritme habit tidak valid' }, { status: 400 })
    }

    const contextualRole = (body.contextual_role || 'general') as RoleContext
    if (!VALID_ROLE_CONTEXTS.includes(contextualRole)) {
      return Response.json({ error: 'Peran habit tidak valid' }, { status: 400 })
    }

    const cadenceConfig = normalizeHabitCadenceConfig(
      cadenceMode,
      body.cadence_config as HabitCadenceConfig | undefined
    )

    const { data, error } = await supabase
      .from('habits')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        cadence_mode: cadenceMode,
        cadence_config: cadenceConfig,
        contextual_role: contextualRole,
      })
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json(data, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
