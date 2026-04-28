// ============================================================
// Server Actions: Blog
// Handles: create, update, delete posts + manage tags
// ============================================================

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { generateSlug } from '@/lib/utils'
import type { ActionResult, BlogPost } from '@/core/types'

async function ensureBlogTagIds(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  tagIds: string[] = [],
  tagNames: string[] = []
) {
  const normalizedNames = Array.from(
    new Set(
      tagNames
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  )

  const resolvedTagIds = new Set(tagIds.filter(Boolean))

  for (const tagName of normalizedNames) {
    const slug = generateSlug(tagName)
    const { data: existing } = await supabase
      .from('blog_tags')
      .select('id')
      .eq('user_id', userId)
      .eq('slug', slug)
      .maybeSingle()

    if (existing?.id) {
      resolvedTagIds.add(existing.id)
      continue
    }

    const { data: created, error } = await supabase
      .from('blog_tags')
      .insert({
        user_id: userId,
        name: tagName,
        slug,
        color: '#0f766e',
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(error.message)
    }

    resolvedTagIds.add(created.id)
  }

  return Array.from(resolvedTagIds)
}

async function refreshTagPostCounts(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  tagIds: string[]
) {
  const uniqueTagIds = Array.from(new Set(tagIds.filter(Boolean)))

  for (const tagId of uniqueTagIds) {
    const { count } = await supabase
      .from('blog_post_tags')
      .select('id', { count: 'exact', head: true })
      .eq('tag_id', tagId)

    await supabase
      .from('blog_tags')
      .update({ post_count: count ?? 0 })
      .eq('id', tagId)
  }
}

async function syncBlogPostTags(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  postId: string,
  userId: string,
  tagIds: string[] = [],
  tagNames: string[] = []
) {
  const { data: existingRelations } = await supabase
    .from('blog_post_tags')
    .select('tag_id')
    .eq('post_id', postId)

  const previousTagIds = (existingRelations ?? []).map((relation) => relation.tag_id)
  const resolvedTagIds = await ensureBlogTagIds(supabase, userId, tagIds, tagNames)

  const { error: deleteError } = await supabase
    .from('blog_post_tags')
    .delete()
    .eq('post_id', postId)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  if (resolvedTagIds.length > 0) {
    const { error: insertError } = await supabase
      .from('blog_post_tags')
      .insert(
        resolvedTagIds.map((tagId, index) => ({
          post_id: postId,
          tag_id: tagId,
          sort_order: index,
        }))
      )

    if (insertError) {
      throw new Error(insertError.message)
    }
  }

  await refreshTagPostCounts(supabase, [...previousTagIds, ...resolvedTagIds])
}

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
    tag_ids: string[]
    tag_names: string[]
  }>
): Promise<ActionResult<BlogPost>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    // If publishing, set published_at
    const payload: Record<string, unknown> = { ...updates }
    const tagIds = updates.tag_ids ?? []
    const tagNames = updates.tag_names ?? []

    delete payload.tag_ids
    delete payload.tag_names

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

    await syncBlogPostTags(supabase, post.id, user.id, tagIds, tagNames)
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
