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
