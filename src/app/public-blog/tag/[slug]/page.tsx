import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import type { BlogPost } from '@/core/types';
import type { Metadata } from 'next';
import { mapBlogPostWithTags, type BlogPostTagRelationRow, type BlogPostWithTagRows } from '@/lib/blog';
import { getPublicBlogBasePath, withPublicBlogBase } from '@/lib/public-blog-routing';

type Props = { params: Promise<{ slug: string }> };

const TAG_POST_SELECT = `
  id,
  title,
  slug,
  excerpt,
  featured_image_url,
  featured_image_alt,
  published_at,
  reading_time_minutes,
  status,
  is_deleted,
  blog_post_tags(
    blog_tags(
      id,
      name,
      slug,
      color
    )
  )
`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServerClient();
  const { data: tag } = await supabase
    .from('blog_tags')
    .select('name, description')
    .eq('slug', slug)
    .eq('is_deleted', false)
    .single();

  if (!tag) return { title: 'Tag Not Found' };

  return {
    title: `${tag.name} — Blog Ziaul Maula`,
    description: tag.description || `Artikel dengan tag ${tag.name}`,
  };
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const blogBasePath = await getPublicBlogBasePath();
  const supabase = await createServerClient();

  // Fetch the tag
  const { data: tag } = await supabase
    .from('blog_tags')
    .select('*')
    .eq('slug', slug)
    .eq('is_deleted', false)
    .single();

  if (!tag) notFound();

  // Fetch posts for this tag via junction table
  const { data: postTags } = await supabase
    .from('blog_post_tags')
    .select(`
      blog_posts(
        ${TAG_POST_SELECT}
      )
    `)
    .eq('tag_id', tag.id);

  const posts: BlogPost[] = (postTags ?? [])
    .flatMap((postTag) => {
      const blogPosts = (postTag as unknown as BlogPostTagRelationRow).blog_posts;
      if (!blogPosts) {
        return [] as BlogPostWithTagRows[];
      }

      return Array.isArray(blogPosts) ? blogPosts : [blogPosts];
    })
    .filter((post) => post.status === 'published' && !post.is_deleted)
    .map((post) => mapBlogPostWithTags(post))
    .sort((a: BlogPost, b: BlogPost) => {
      const aDate = a.published_at ? new Date(a.published_at).getTime() : 0;
      const bDate = b.published_at ? new Date(b.published_at).getTime() : 0;
      return bDate - aDate;
    });

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <Link
          href={withPublicBlogBase(blogBasePath, '/')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke beranda
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <div
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: tag.color || '#6366f1' }}
          />
          <h1 className="text-[2rem] font-bold tracking-tight text-foreground sm:text-3xl">
            {tag.name}
          </h1>
        </div>
        {tag.description && (
          <p className="mt-3 max-w-2xl text-[16px] text-muted-foreground sm:text-lg">
            {tag.description}
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {posts.length} artikel
        </p>
      </div>

      {/* Posts Grid */}
      {posts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-lg text-muted-foreground">
            Belum ada artikel dengan tag ini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={withPublicBlogBase(blogBasePath, `/blog/${post.slug}`)}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-slate-900/8 dark:bg-[#0a0a0f] dark:hover:shadow-primary/10"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                {post.featured_image_url ? (
                  <Image
                    src={post.featured_image_url}
                    alt={post.featured_image_alt || post.title}
                    fill
                    sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
                    className="object-cover opacity-80 transition-transform duration-500 group-hover:scale-105 group-hover:opacity-100"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#11111a] dark:to-[#1a1a24]" />
                )}
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="mb-3 flex flex-wrap gap-2">
                  {post.tags?.slice(0, 2).map((t) => (
                    <span
                      key={t.id}
                      className="text-xs font-semibold uppercase tracking-widest text-primary"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
                <h3 className="mb-3 text-xl font-bold text-foreground group-hover:text-foreground line-clamp-2">
                  {post.title}
                </h3>
                <p className="mb-6 flex-1 text-sm text-muted-foreground line-clamp-3">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {post.published_at
                      ? format(parseISO(post.published_at), 'd MMM yyyy', { locale: id })
                      : ''}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {post.reading_time_minutes} min read
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
