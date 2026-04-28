// ============================================================
// Route Handler: /api/notifications
// GET/POST/PATCH — Notifications SWR endpoint + mutations
// ============================================================

import { type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

// GET /api/notifications
export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

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

// POST /api/notifications
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const body = (await request.json().catch(() => ({}))) as {
      channel?: 'push' | 'telegram'
      title?: string
      body?: string
      reference_type?: string | null
      reference_id?: string | null
      scheduled_at?: string | null
    }

    if (!body.title?.trim()) {
      return Response.json({ error: 'Judul notifikasi wajib diisi' }, { status: 400 })
    }

    if (!body.body?.trim()) {
      return Response.json({ error: 'Isi notifikasi wajib diisi' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        channel: body.channel ?? 'push',
        title: body.title.trim(),
        body: body.body.trim(),
        reference_type: body.reference_type ?? null,
        reference_id: body.reference_id ?? null,
        scheduled_at: body.scheduled_at ?? null,
        status: 'pending',
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

// PATCH /api/notifications
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const body = (await request.json().catch(() => ({}))) as {
      id?: string
      mark_all?: boolean
    }

    const payload = {
      status: 'sent',
      sent_at: new Date().toISOString(),
      error_message: null,
    }

    if (body.mark_all) {
      const { data, error } = await supabase
        .from('notifications')
        .update(payload)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .select('id')

      if (error) {
        return Response.json({ error: error.message }, { status: 400 })
      }

      return Response.json({ updated: data?.length ?? 0 })
    }

    if (!body.id) {
      return Response.json({ error: 'ID notifikasi wajib diisi' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('notifications')
      .update(payload)
      .eq('id', body.id)
      .eq('user_id', user.id)
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
