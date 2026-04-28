// ============================================================
// Route Handler: /api/blog/posts
// GET  — List blog posts (SWR endpoint, dashboard)
// POST — Create blog post (draft)
// ============================================================

import { type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { generateSlug } from '@/lib/utils'

// GET /api/blog/posts?status=draft
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const supabase = await createServerClient()
    const { searchParams } = request.nextUrl

    let query = supabase
      .from('blog_posts')
      .select('*, blog_post_tags(tag_id, blog_tags(id, name, slug, color))')
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })

    const status = searchParams.get('status')
    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    // Flatten tags for frontend
    const posts = (data || []).map(post => ({
      ...post,
      tags: (post.blog_post_tags || [])
        .map((pt: { blog_tags: unknown }) => pt.blog_tags)
        .filter(Boolean),
      blog_post_tags: undefined,
    }))

    return Response.json(posts)
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/blog/posts
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const body = await request.json()

    const title = body.title?.trim() || 'Untitled'
    let slug = generateSlug(title)

    // Ensure unique slug
    const { data: existing } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      slug = `${slug}-${Date.now()}`
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        user_id: user.id,
        title,
        slug,
        status: 'draft',
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
