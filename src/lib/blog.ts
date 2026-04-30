import type { BlogPost, BlogTag } from '@/core/types';

export type BlogPostWithTagRows = Omit<BlogPost, 'tags'> & {
  blog_post_tags?: Array<{
    blog_tags: BlogTag | null;
  }> | null;
};

export type BlogPostTagRelationRow = {
  blog_posts: BlogPostWithTagRows | BlogPostWithTagRows[] | null;
};

export function mapBlogPostWithTags(post: BlogPostWithTagRows): BlogPost {
  return {
    ...post,
    tags: (post.blog_post_tags ?? [])
      .map((relation) => relation.blog_tags)
      .filter((tag): tag is BlogTag => tag !== null),
  };
}

export function getPublicBlogPostUrl(slug: string) {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `/public-blog/blog/${slug}`;
    }
  }

  return `https://zmaula.web.id/blog/${slug}`;
}

export function getPublicBlogOgImageUrl(slug: string, version?: string | null) {
  const url = `https://zmaula.web.id/api/public/og/blog/${encodeURIComponent(slug)}`;

  if (!version) {
    return url;
  }

  return `${url}?v=${encodeURIComponent(version)}`;
}
