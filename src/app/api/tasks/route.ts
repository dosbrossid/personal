// ============================================================
// Route Handler: /api/tasks
// GET  — List tasks (SWR endpoint)
// POST — Create task
// ============================================================

import { type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

// GET /api/tasks?status=todo&role=dosen&priority=high
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const { searchParams } = request.nextUrl

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    const status = searchParams.get('status')
    if (status) query = query.eq('status', status)

    const role = searchParams.get('role')
    if (role) query = query.eq('contextual_role', role)

    const priority = searchParams.get('priority')
    if (priority) query = query.eq('priority', priority)

    const { data, error } = await query

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json(data)
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tasks
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const body = await request.json()

    // Validation
    if (!body.title?.trim()) {
      return Response.json({ error: 'Title wajib diisi' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title: body.title.trim(),
        description: body.description || null,
        status: body.status || 'todo',
        priority: body.priority || 'medium',
        contextual_role: body.contextual_role || 'general',
        due_date: body.due_date || null,
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
