// ============================================================
// Route Handler: /api/blog/tags
// GET  — List blog tags (SWR endpoint)
// POST — Create blog tag
// ============================================================

import { type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { generateSlug } from '@/lib/utils'

// GET /api/blog/tags
export async function GET() {
  try {
    await requireAuth()
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('blog_tags')
      .select('*')
      .eq('is_deleted', false)
      .order('name', { ascending: true })

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

// POST /api/blog/tags
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const body = await request.json()

    if (!body.name?.trim()) {
      return Response.json({ error: 'Nama tag wajib diisi' }, { status: 400 })
    }

    let slug = generateSlug(body.name.trim())

    // Ensure unique slug
    const { data: existing } = await supabase
      .from('blog_tags')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      slug = `${slug}-${Date.now()}`
    }

    const { data, error } = await supabase
      .from('blog_tags')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        slug,
        description: body.description || null,
        color: body.color || '#6366f1',
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
