// ============================================================
// Route Handler: /api/public/blog/[id]/view
// POST — Increment view count for a blog post (no auth required)
// ============================================================

import { type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return Response.json({ error: 'Missing post ID' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: post, error: selectError } = await supabase
      .from('blog_posts')
      .select('view_count')
      .eq('id', id)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .single()

    if (selectError || !post) {
      return Response.json({ error: 'Post not found' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('blog_posts')
      .update({ view_count: (post.view_count || 0) + 1 })
      .eq('id', id)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .eq('is_deleted', false)

    if (updateError) {
      return Response.json({ error: 'Failed to track view' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Failed to track view' }, { status: 500 })
  }
}
