// ============================================================
// Server Actions: Blog
// Handles: create, update, delete posts + manage tags
// ============================================================

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { generateSlug } from '@/lib/utils'
import type { ActionResult, BlogPost } from '@/core/types'

/**
 * Create a new blog post (draft)
 */
export async function createBlogPost(data: {
  title?: string
}): Promise<ActionResult<BlogPost>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const title = data.title?.trim() || 'Untitled'
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

    const { data: post, error } = await supabase
      .from('blog_posts')
      .insert({
        user_id: user.id,
        title,
        slug,
        status: 'draft',
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: post as BlogPost, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Update a blog post
 */
export async function updateBlogPost(
  id: string,
  updates: Partial<{
    title: string
    content_json: unknown
    content_html: string
    content_text: string
    excerpt: string
    featured_image_url: string | null
    featured_image_alt: string | null
    status: string
    visibility: string
    slug: string
    meta_title: string
    meta_description: string
    reading_time_minutes: number
    word_count: number
  }>
): Promise<ActionResult<BlogPost>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    // If publishing, set published_at
    const payload: Record<string, unknown> = { ...updates }
    if (updates.status === 'published') {
      payload.published_at = new Date().toISOString()
    }

    const { data: post, error } = await supabase
      .from('blog_posts')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: post as BlogPost, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Soft delete a blog post
 */
export async function deleteBlogPost(id: string): Promise<ActionResult<null>> {
  try {
    await requireAuth()
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('blog_posts')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}
