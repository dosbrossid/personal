// ============================================================
// Route Handler: /api/notes
// GET  — List brain notes (SWR endpoint)
// POST — Create brain note
// ============================================================

import { type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

// GET /api/notes?type=text&role=dosen&pinned=true
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const { searchParams } = request.nextUrl

    let query = supabase
      .from('brain_notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    const type = searchParams.get('type')
    if (type) query = query.eq('note_type', type)

    const role = searchParams.get('role')
    if (role) query = query.eq('contextual_role', role)

    const pinned = searchParams.get('pinned')
    if (pinned === 'true') query = query.eq('is_pinned', true)

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

// POST /api/notes
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const body = await request.json()

    if (!body.title?.trim()) {
      return Response.json({ error: 'Title wajib diisi' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('brain_notes')
      .insert({
        user_id: user.id,
        title: body.title.trim(),
        content_body: body.content_body || '',
        note_type: body.note_type || 'text',
        contextual_role: body.contextual_role || 'general',
        source_url: body.source_url || null,
        is_pinned: body.is_pinned || false,
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
