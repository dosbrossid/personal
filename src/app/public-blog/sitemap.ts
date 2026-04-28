// ============================================================
// Sitemap: Auto-generated from published blog posts
// Available at /public-blog/sitemap.xml
// ============================================================

import type { MetadataRoute } from 'next'
import { createServerClient } from '@/lib/supabase/server'

const BASE_URL = 'https://zmaula.web.id'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createServerClient()

  // Fetch all published blog posts
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, updated_at, published_at')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('is_deleted', false)
    .order('published_at', { ascending: false })

  // Fetch all active tags
  const { data: tags } = await supabase
    .from('blog_tags')
    .select('slug, updated_at')
    .eq('is_deleted', false)

  const sitemapEntries: MetadataRoute.Sitemap = [
    // Homepage
    {
      url: `${BASE_URL}/public-blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]

  // Blog posts
  if (posts) {
    for (const post of posts) {
      sitemapEntries.push({
        url: `${BASE_URL}/public-blog/${post.slug}`,
        lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    }
  }

  // Tag pages
  if (tags) {
    for (const tag of tags) {
      sitemapEntries.push({
        url: `${BASE_URL}/public-blog/tag/${tag.slug}`,
        lastModified: tag.updated_at ? new Date(tag.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    }
  }

  return sitemapEntries
}
