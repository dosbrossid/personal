// ============================================================
// Server Actions: Blog
// Handles: create, update, delete posts + manage tags
// ============================================================

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { callLLM } from '@/lib/ai/client'
import { sanitizeBlogHtml, stripBlogContent } from '@/lib/blog-editor'
import { generateSlug } from '@/lib/utils'
import type { ActionResult, BlogPost } from '@/core/types'

interface BlogAIContentPayload {
  mode: 'selection_edit' | 'section_generate' | 'seo_generate'
  title: string
  content: string
  prompt?: string
  selection?: string
  excerpt?: string
}

interface BlogAIContentResult {
  html?: string
  metaTitle?: string
  metaDescription?: string
  excerpt?: string
}

function cleanAIText(raw: string) {
  return raw
    .replace(/^```(?:html|json)?/i, '')
    .replace(/```$/i, '')
    .trim()
}

function clipContext(value: string, limit = 5000) {
  const compact = value.trim()
  if (compact.length <= limit) return compact
  return `${compact.slice(0, limit)}…`
}

function parseBlogSeoPayload(raw: string): BlogAIContentResult | null {
  const cleaned = cleanAIText(raw)
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const metaTitle = typeof parsed.meta_title === 'string' ? parsed.meta_title.trim() : ''
    const metaDescription = typeof parsed.meta_description === 'string' ? parsed.meta_description.trim() : ''
    const excerpt = typeof parsed.excerpt === 'string' ? parsed.excerpt.trim() : ''

    if (!metaTitle && !metaDescription && !excerpt) {
      return null
    }

    return {
      metaTitle,
      metaDescription,
      excerpt,
    }
  } catch {
    return null
  }
}

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

async function resolveUniqueBlogTagSlug(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  baseName: string,
  excludeId?: string
) {
  const baseSlug = generateSlug(baseName) || 'kategori';
  let slug = baseSlug;
  let attempt = 1;

  while (true) {
    let query = supabase
      .from('blog_tags')
      .select('id')
      .eq('user_id', userId)
      .eq('slug', slug)
      .eq('is_deleted', false);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data: existing } = await query.maybeSingle();

    if (!existing?.id) {
      return slug;
    }

    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
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
    scheduled_at: string | null
    tag_ids: string[]
    tag_names: string[]
  }>
): Promise<ActionResult<BlogPost>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { data: existingPost, error: existingPostError } = await supabase
      .from('blog_posts')
      .select('status, published_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (existingPostError) {
      return { data: null, error: existingPostError.message }
    }

    // If publishing, set published_at
    const payload: Record<string, unknown> = { ...updates }
    const tagIds = updates.tag_ids ?? []
    const tagNames = updates.tag_names ?? []

    delete payload.tag_ids
    delete payload.tag_names

    if (updates.status === 'published') {
      payload.published_at = existingPost?.published_at || new Date().toISOString()
      payload.scheduled_at = null
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

export async function createBlogTag(data: {
  name: string
  description?: string
  color?: string
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const name = data.name.trim()

    if (!name) {
      return { data: null, error: 'Nama kategori wajib diisi' }
    }

    const slug = await resolveUniqueBlogTagSlug(supabase, user.id, name)
    const { data: tag, error } = await supabase
      .from('blog_tags')
      .insert({
        user_id: user.id,
        name,
        slug,
        description: data.description?.trim() || null,
        color: data.color || '#0f766e',
      })
      .select('id')
      .single()

    if (error) return { data: null, error: error.message }
    return { data: tag, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

export async function updateBlogTag(
  id: string,
  updates: {
    name: string
    description?: string
    color?: string
  }
): Promise<ActionResult<null>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const name = updates.name.trim()

    if (!name) {
      return { data: null, error: 'Nama kategori wajib diisi' }
    }

    const slug = await resolveUniqueBlogTagSlug(supabase, user.id, name, id)
    const { error } = await supabase
      .from('blog_tags')
      .update({
        name,
        slug,
        description: updates.description?.trim() || null,
        color: updates.color || '#0f766e',
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

export async function deleteBlogTag(id: string): Promise<ActionResult<null>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { error: relationError } = await supabase
      .from('blog_post_tags')
      .delete()
      .eq('tag_id', id)

    if (relationError) {
      return { data: null, error: relationError.message }
    }

    const { error } = await supabase
      .from('blog_tags')
      .update({
        is_deleted: true,
        post_count: 0,
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

export async function generateBlogAIContent(
  payload: BlogAIContentPayload
): Promise<ActionResult<BlogAIContentResult>> {
  try {
    await requireAuth()

    const title = payload.title.trim()
    const contentContext = clipContext(stripBlogContent(payload.content || ''))
    const prompt = payload.prompt?.trim() || ''
    const selection = payload.selection?.trim() || ''

    if (payload.mode === 'selection_edit') {
      if (!selection) {
        return { data: null, error: 'Blok teks yang ingin diedit dulu.' }
      }
      if (!prompt) {
        return { data: null, error: 'Tulis instruksi edit untuk AI dulu.' }
      }

      const { raw } = await callLLM(
        [
          {
            role: 'system',
            content:
              'Kamu adalah editor blog profesional berbahasa Indonesia. Tugasmu memperbaiki atau menulis ulang potongan teks artikel. Balas HANYA dengan HTML fragment yang bersih tanpa penjelasan, tanpa markdown fence, tanpa tag html/body. Gunakan hanya tag aman seperti <p>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>, <h2>, <br />.',
          },
          {
            role: 'user',
            content: [
              `Judul artikel: ${title || 'Tanpa judul'}`,
              prompt ? `Instruksi edit: ${prompt}` : null,
              contentContext ? `Konteks artikel:\n${contentContext}` : null,
              `Teks terpilih:\n${selection}`,
            ]
              .filter(Boolean)
              .join('\n\n'),
          },
        ],
        { temperature: 0.4 }
      )

      const sanitizedHtml = sanitizeBlogHtml(cleanAIText(raw))
      if (!sanitizedHtml) {
        return { data: null, error: 'AI belum menghasilkan revisi yang valid.' }
      }

      return { data: { html: sanitizedHtml }, error: null }
    }

    if (payload.mode === 'section_generate') {
      if (!prompt && !title) {
        return { data: null, error: 'Tulis arahan section atau isi judul artikel dulu.' }
      }

      const { raw } = await callLLM(
        [
          {
            role: 'system',
            content:
              'Kamu adalah co-writer blog profesional berbahasa Indonesia. Tulis section artikel yang matang dan langsung siap tempel ke editor. Balas HANYA dengan HTML fragment yang bersih tanpa penjelasan, tanpa markdown fence, tanpa tag html/body. Gunakan hanya tag aman seperti <p>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>, <h2>, <br />.',
          },
          {
            role: 'user',
            content: [
              `Judul artikel: ${title || 'Tanpa judul'}`,
              prompt ? `Arahan section: ${prompt}` : 'Tulis section pembuka yang relevan dengan judul.',
              contentContext ? `Konteks artikel saat ini:\n${contentContext}` : null,
            ]
              .filter(Boolean)
              .join('\n\n'),
          },
        ],
        { temperature: 0.55 }
      )

      const sanitizedHtml = sanitizeBlogHtml(cleanAIText(raw))
      if (!sanitizedHtml) {
        return { data: null, error: 'AI belum menghasilkan section yang valid.' }
      }

      return { data: { html: sanitizedHtml }, error: null }
    }

    const { raw } = await callLLM(
      [
        {
          role: 'system',
          content:
            'Kamu adalah editor SEO blog berbahasa Indonesia. Balas HANYA JSON valid dengan key: meta_title, meta_description, excerpt. meta_title maksimal 60 karakter, meta_description maksimal 160 karakter, excerpt maksimal 160 karakter.',
        },
        {
          role: 'user',
          content: [
            `Judul artikel: ${title || 'Tanpa judul'}`,
            payload.excerpt?.trim() ? `Excerpt saat ini: ${payload.excerpt.trim()}` : null,
            contentContext ? `Isi artikel:\n${contentContext}` : null,
            prompt ? `Catatan tambahan: ${prompt}` : null,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      { temperature: 0.35 }
    )

    const seoPayload = parseBlogSeoPayload(raw)
    if (!seoPayload) {
      return { data: null, error: 'AI belum menghasilkan SEO draft yang valid.' }
    }

    return { data: seoPayload, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan saat memproses AI blog' }
  }
}
