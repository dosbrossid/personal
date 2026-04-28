// ============================================================
// Route Handler: /api/public/blog/[id]/view
// POST — Increment view count for a blog post (no auth required)
// ============================================================

import { type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return Response.json({ error: 'Missing post ID' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Attempt atomic increment via RPC
    const { error: rpcError } = await supabase.rpc('increment_view_count', {
      post_id: id,
    })

    // Fallback if RPC doesn't exist: manual fetch + update
    if (rpcError) {
      const { data: post } = await supabase
        .from('blog_posts')
        .select('view_count')
        .eq('id', id)
        .single()

      if (post) {
        await supabase
          .from('blog_posts')
          .update({ view_count: (post.view_count || 0) + 1 })
          .eq('id', id)
      }
    }

    return Response.json({ success: true })
  } catch {
    return Response.json({ error: 'Failed to track view' }, { status: 500 })
  }
}
