// ============================================================
// Route Handler: /api/public/rss
// GET — RSS 2.0 feed for blog posts (no auth required)
// ============================================================

import { createServerClient } from '@/lib/supabase/server'

const BASE_URL = 'https://zmaula.web.id'
const BLOG_TITLE = 'Ziaul Maula Blog'
const BLOG_DESCRIPTION = 'Tulisan tentang bisnis digital, pemasaran digital, e-business, web app, dan proses belajar.'
const AUTHOR = 'Ziaul Maula'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function inferImageMimeType(url: string) {
  const pathname = url.split('?')[0]?.toLowerCase() ?? ''
  if (pathname.endsWith('.webp')) return 'image/webp'
  if (pathname.endsWith('.png')) return 'image/png'
  if (pathname.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

export async function GET() {
  try {
    const supabase = await createServerClient()

    const { data: posts } = await supabase
      .from('blog_posts')
      .select('title, slug, excerpt, published_at, content_text, featured_image_url')
      .eq('status', 'published')
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .order('published_at', { ascending: false })
      .limit(50)

    const items = (posts || [])
      .map((post) => {
        const pubDate = post.published_at
          ? new Date(post.published_at).toUTCString()
          : new Date().toUTCString()

        const description = post.excerpt || post.content_text?.slice(0, 300) || ''

        return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${BASE_URL}/blog/${escapeXml(post.slug)}</link>
      <guid isPermaLink="true">${BASE_URL}/blog/${escapeXml(post.slug)}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(AUTHOR)}</author>${
        post.featured_image_url
          ? `\n      <enclosure url="${escapeXml(post.featured_image_url)}" type="${inferImageMimeType(post.featured_image_url)}" />`
          : ''
      }
    </item>`
      })
      .join('\n')

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(BLOG_TITLE)}</title>
    <link>${BASE_URL}/</link>
    <description>${escapeXml(BLOG_DESCRIPTION)}</description>
    <language>id</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/api/public/rss" rel="self" type="application/rss+xml" />
    <managingEditor>${escapeXml(AUTHOR)}</managingEditor>
    <webMaster>${escapeXml(AUTHOR)}</webMaster>
${items}
  </channel>
</rss>`

    return new Response(rss, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch {
    return new Response('RSS feed error', { status: 500 })
  }
}
