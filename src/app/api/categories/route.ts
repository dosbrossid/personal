// ============================================================
// Route Handler: /api/categories
// GET  — List categories (SWR endpoint)
// POST — Create category
// ============================================================

import { type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

// GET /api/categories?role=dosen
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const supabase = await createServerClient()
    const { searchParams } = request.nextUrl

    let query = supabase
      .from('categories')
      .select('*')
      .eq('is_deleted', false)
      .order('name', { ascending: true })

    const role = searchParams.get('role')
    if (role) query = query.eq('contextual_role', role)

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

// POST /api/categories
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const body = await request.json()

    if (!body.name?.trim()) {
      return Response.json({ error: 'Nama kategori wajib diisi' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        color: body.color || '#6366f1',
        icon: body.icon || '📁',
        contextual_role: body.contextual_role || 'general',
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
