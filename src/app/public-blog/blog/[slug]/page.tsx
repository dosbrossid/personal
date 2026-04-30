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
import { getPublicBlogPostUrl, mapBlogPostWithTags, type BlogPostWithTagRows } from '@/lib/blog';
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

  const latestPosts: BlogPost[] = (rawAllPosts || [])
    .map((relatedPost) => mapBlogPostWithTags(relatedPost as unknown as BlogPostWithTagRows));
  const tagMatchedPosts = latestPosts.filter((relatedPost) =>
    relatedPost.tags?.some((relatedTag) => post.tags?.some((postTag) => postTag.id === relatedTag.id))
  );
  const suggestedPosts = [
    ...tagMatchedPosts,
    ...latestPosts.filter((latestPost) => !tagMatchedPosts.some((tagPost) => tagPost.id === latestPost.id)),
  ].slice(0, 3);
  const shareUrl = getPublicBlogPostUrl(post.slug);
  const shareText = `${post.title} - ${shareUrl}`;
  const encodedShareUrl = encodeURIComponent(shareUrl);
  const encodedShareText = encodeURIComponent(shareText);
  const encodedShareTitle = encodeURIComponent(post.title);

  return (
    <>
      <ReadingProgressBar />
      <article className="mx-auto max-w-[720px] bg-white px-3 dark:bg-[#0f0f0f] sm:px-5 lg:px-0">
        <Link
          href={withPublicBlogBase(blogBasePath, '/')}
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#6b6b6b] transition hover:text-[#242424] dark:text-muted-foreground dark:hover:text-foreground sm:mb-10"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke beranda
        </Link>

        <header className="mb-8 border-b border-[#f2f2f2] pb-7 dark:border-border/60 sm:mb-10 sm:pb-8">
          <div className="mb-5 flex flex-wrap gap-2">
            {post.tags?.map((tag) => (
              <span
                key={tag.id}
                className="text-xs font-medium text-[#6b6b6b] dark:text-muted-foreground"
              >
                {tag.name}
              </span>
            ))}
          </div>
          <h1 className="mb-5 text-[2.25rem] font-bold leading-[1.1] tracking-[-0.04em] text-[#242424] dark:text-foreground sm:mb-6 sm:text-5xl lg:text-[3.55rem]">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mb-6 max-w-2xl text-[18px] font-normal leading-6 text-[#6b6b6b] dark:text-muted-foreground">
              {post.excerpt}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#6b6b6b] dark:text-muted-foreground sm:gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#242424] text-[12px] font-bold text-white shadow-sm dark:bg-foreground dark:text-background">
                ZM
              </div>
              <div className="leading-tight">
                <p className="font-semibold text-[#242424] dark:text-foreground">Ziaul Maula</p>
                <p className="text-xs text-muted-foreground">Dosen FEB UNSAM · Digital Marketer</p>
              </div>
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
          <figure className="mb-8 overflow-hidden lg:mb-14">
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
              <figcaption className="pt-3 text-center text-xs text-[#6b6b6b] dark:text-muted-foreground">
                {post.featured_image_alt}
              </figcaption>
            )}
          </figure>
        )}

        <div
          className="prose mb-12 max-w-none prose-headings:font-sans prose-headings:font-bold prose-headings:tracking-tight prose-a:text-[#1a8917] prose-p:my-[1.05em] prose-p:font-serif prose-p:text-[18px] prose-p:font-normal prose-p:leading-[28px] prose-p:text-[#242424] prose-li:font-serif prose-li:text-[18px] prose-li:font-normal prose-li:leading-[28px] prose-li:text-[#242424] prose-blockquote:border-l-[#242424] prose-blockquote:font-serif prose-blockquote:text-[#6b6b6b] prose-pre:border prose-pre:border-[#f2f2f2] prose-pre:bg-[#f7f7f7] dark:prose-invert dark:prose-p:text-foreground dark:prose-li:text-foreground dark:prose-pre:border-border dark:prose-pre:bg-muted sm:mb-14 sm:prose-p:my-[1.12em] [&_p:has(br:only-child)]:my-1"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
        />

        <div className="mb-12 border-y border-[#f2f2f2] py-6 dark:border-border/60">
          <div className="mb-5 flex flex-wrap gap-2">
            {post.tags?.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-[#f7f7f7] px-4 py-1.5 text-sm font-medium text-[#6b6b6b] dark:bg-muted dark:text-muted-foreground"
              >
                #{tag.slug}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#242424] dark:text-foreground">Bagikan artikel ini</p>
              <p className="text-xs text-[#6b6b6b] dark:text-muted-foreground">Pilih kanal yang paling nyaman buat pembaca.</p>
            </div>
            <div className="grid grid-cols-5 gap-2 sm:flex sm:items-center sm:gap-2">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodedShareTitle}&url=${encodedShareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Bagikan ke X"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#242424] ring-1 ring-[#e6e6e6] transition hover:bg-[#242424] hover:text-white dark:bg-[#0f0f0f] dark:ring-border dark:text-foreground"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedShareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Bagikan ke LinkedIn"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0A66C2] ring-1 ring-[#e6e6e6] transition hover:bg-[#0A66C2] hover:text-white dark:bg-[#0f0f0f] dark:ring-border"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <a
              href={`https://t.me/share/url?url=${encodedShareUrl}&text=${encodedShareTitle}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Bagikan ke Telegram"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#229ED9] ring-1 ring-[#e6e6e6] transition hover:bg-[#229ED9] hover:text-white dark:bg-[#0f0f0f] dark:ring-border"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9.78 15.5 9.4 20.8c.54 0 .78-.23 1.06-.51l2.55-2.44 5.29 3.87c.97.53 1.65.25 1.91-.9l3.46-16.22h.01c.31-1.43-.52-1.99-1.46-1.64L1.89 10.76C.5 11.3.52 12.08 1.66 12.43l5.2 1.62L18.94 6.5c.57-.38 1.09-.17.66.21L9.78 15.5z"/></svg>
            </a>
            <a
              href={`https://wa.me/?text=${encodedShareText}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Bagikan ke WhatsApp"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#25D366] ring-1 ring-[#e6e6e6] transition hover:bg-[#25D366] hover:text-white dark:bg-[#0f0f0f] dark:ring-border"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.52 3.48A11.86 11.86 0 0 0 12.08 0C5.5 0 .15 5.35.15 11.93c0 2.1.55 4.16 1.6 5.97L0 24l6.25-1.64a11.93 11.93 0 0 0 5.83 1.49h.01c6.58 0 11.93-5.35 11.93-11.93 0-3.19-1.24-6.18-3.5-8.44zM12.09 21.84h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.7.97.99-3.61-.23-.37a9.89 9.89 0 0 1-1.52-5.3c0-5.47 4.45-9.92 9.93-9.92a9.86 9.86 0 0 1 7.02 2.91 9.86 9.86 0 0 1 2.91 7.02c0 5.47-4.46 9.91-9.99 9.91zm5.44-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z"/></svg>
            </a>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Buka link artikel"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6b6b6b] ring-1 ring-[#e6e6e6] transition hover:bg-[#1a8917] hover:text-white dark:bg-[#0f0f0f] dark:ring-border"
            >
              <LinkIcon className="h-4 w-4" />
            </a>
            </div>
          </div>
        </div>

        {suggestedPosts.length > 0 && (
          <section className="mb-16 border-t border-[#f2f2f2] pt-10 dark:border-border/60">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#6b6b6b] dark:text-muted-foreground">Suggested posts</p>
                <h2 className="text-2xl font-bold tracking-tight text-[#242424] dark:text-foreground">Lanjut baca</h2>
              </div>
              <Link href={withPublicBlogBase(blogBasePath, '/')} className="hidden text-sm font-semibold text-[#1a8917] hover:underline sm:inline">
                Semua tulisan
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-4">
              {suggestedPosts.map((related) => (
                <Link
                  key={related.id}
                  href={withPublicBlogBase(blogBasePath, `/blog/${related.slug}`)}
                  className="group block overflow-hidden border-t border-[#f2f2f2] pt-4 transition dark:border-border/60"
                >
                  <div className="relative mb-3 aspect-[4/3] bg-[#f7f7f7] dark:bg-muted">
                    {related.featured_image_url && (
                      <Image
                        src={related.featured_image_url}
                        alt={related.featured_image_alt || related.title}
                        fill
                        sizes="(max-width: 639px) 100vw, 50vw"
                        className="object-cover opacity-85 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="line-clamp-2 text-[18px] font-bold leading-snug text-[#242424] group-hover:text-[#1a8917] dark:text-foreground sm:text-[16px]">
                      {related.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-[#6b6b6b] dark:text-muted-foreground sm:line-clamp-2 sm:text-[13px]">
                      {related.excerpt || 'Baca catatan lain dari Ziaul Maula.'}
                    </p>
                    <p className="mt-3 text-[13px] text-[#6b6b6b] dark:text-muted-foreground sm:text-xs">
                      {related.published_at ? format(parseISO(related.published_at), 'MMM d, yyyy') : 'Artikel'}
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
