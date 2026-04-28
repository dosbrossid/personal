import { notFound } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Clock, CalendarDays, Link as LinkIcon } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import type { BlogPost } from '@/core/types';
import type { Metadata } from 'next';
import { ViewCountTracker } from '../../[slug]/ViewCountTracker';
import { ReadingProgressBar } from '../../[slug]/ReadingProgressBar';
import { mapBlogPostWithTags, type BlogPostWithTagRows } from '@/lib/blog';
import { getPublicBlogBasePath, withPublicBlogBase } from '@/lib/public-blog-routing';

type Props = { params: Promise<{ slug: string }> };

const RELATED_POST_SELECT = `
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
  const { data: post } = await supabase
    .from('blog_posts')
    .select('title, excerpt, meta_title, meta_description, featured_image_url')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (!post) return { title: 'Not Found' };

  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt || '',
    openGraph: {
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt || '',
      images: post.featured_image_url ? [post.featured_image_url] : [],
      type: 'article',
      siteName: 'Ziaul Maula Blog',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt || '',
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const resolvedParams = await params;
  const blogBasePath = await getPublicBlogBasePath();

  const supabase = await createServerClient();

  const { data: rawPost } = await supabase
    .from('blog_posts')
    .select(`
      *,
      blog_post_tags(
        blog_tags(*)
      )
    `)
    .eq('slug', resolvedParams.slug)
    .eq('status', 'published')
    .single();

  if (!rawPost) {
    notFound();
  }

  const post: BlogPost = mapBlogPostWithTags(rawPost as BlogPostWithTagRows);

  const { data: rawAllPosts } = await supabase
    .from('blog_posts')
    .select(RELATED_POST_SELECT)
    .eq('status', 'published')
    .neq('id', post.id)
    .order('published_at', { ascending: false })
    .limit(10);

  const relatedPosts: BlogPost[] = (rawAllPosts || [])
    .map((relatedPost) => mapBlogPostWithTags(relatedPost as unknown as BlogPostWithTagRows))
    .filter((relatedPost) =>
      relatedPost.tags?.some((relatedTag) => post.tags?.some((postTag) => postTag.id === relatedTag.id))
    )
    .slice(0, 3);

  return (
    <>
      <ReadingProgressBar />
      <article className="mx-auto max-w-3xl">
        <Link
          href={withPublicBlogBase(blogBasePath, '/')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground sm:mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke beranda
        </Link>

        <header className="mb-10 lg:mb-14">
          <div className="mb-6 flex flex-wrap gap-2">
            {post.tags?.map((tag) => (
              <span
                key={tag.id}
                className="rounded-md border border-primary/15 bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary"
              >
                {tag.name}
              </span>
            ))}
          </div>
          <h1 className="mb-5 text-[2rem] font-extrabold tracking-tight text-foreground sm:mb-6 sm:text-4xl lg:text-5xl lg:leading-[1.15]">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground sm:gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-bold text-foreground">
                ZM
              </div>
              <span className="font-medium text-foreground">Ziaul Maula</span>
            </div>
            <div className="flex items-center gap-1.5" title="Published Date">
              <CalendarDays className="h-4 w-4" />
              <time dateTime={post.published_at || ''}>
                {post.published_at
                  ? format(parseISO(post.published_at), 'd MMMM yyyy', { locale: localeId })
                  : 'Draft'}
              </time>
            </div>
            <div className="flex items-center gap-1.5" title="Reading Time">
              <Clock className="h-4 w-4" />
              <span>{post.reading_time_minutes} min read</span>
            </div>
          </div>
        </header>

        {post.featured_image_url && (
          <figure className="mb-8 overflow-hidden rounded-2xl border border-border bg-muted lg:mb-14">
            <Image
              src={post.featured_image_url}
              alt={post.featured_image_alt || post.title}
              width={1440}
              height={900}
              preload
              sizes="(max-width: 1024px) 100vw, 960px"
              className="h-auto w-full"
            />
            {post.featured_image_alt && (
              <figcaption className="p-4 text-center text-xs text-muted-foreground">
                {post.featured_image_alt}
              </figcaption>
            )}
          </figure>
        )}

        <div
          className="prose prose-base mb-14 max-w-none prose-headings:font-bold prose-a:text-primary prose-p:leading-relaxed prose-pre:border prose-pre:border-border prose-pre:bg-muted dark:prose-invert sm:prose-lg sm:mb-16"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
        />

        <div className="mb-14 flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-lg shadow-slate-900/6 dark:bg-muted sm:mb-16 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          <div className="flex flex-wrap gap-2">
            {post.tags?.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full border border-border bg-muted px-4 py-1.5 text-sm font-medium text-foreground"
              >
                #{tag.slug}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 self-stretch sm:self-auto">
            <span className="text-sm text-muted-foreground">Bagikan:</span>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-[#1DA1F2] hover:text-white">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-[#0A66C2] hover:text-white">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <LinkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {relatedPosts.length > 0 && (
          <section className="mb-16">
            <h2 className="mb-8 text-2xl font-bold text-foreground">Artikel Terkait</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {relatedPosts.map((related) => (
                <Link
                  key={related.id}
                  href={withPublicBlogBase(blogBasePath, `/blog/${related.slug}`)}
                  className="group block overflow-hidden rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-slate-900/8 dark:bg-[#0a0a0f]"
                >
                  <div className="relative aspect-[16/9] bg-muted">
                    {related.featured_image_url && (
                      <Image
                        src={related.featured_image_url}
                        alt={related.featured_image_alt || related.title}
                        fill
                        sizes="(max-width: 639px) 100vw, 50vw"
                        className="object-cover opacity-80 transition-opacity group-hover:opacity-100"
                      />
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="mb-2 font-bold text-foreground group-hover:text-foreground">
                      {related.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(related.published_at!), 'MMM d, yyyy')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
      <ViewCountTracker postId={post.id} />
    </>
  );
}
