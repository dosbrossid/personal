import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Briefcase,
  Clock,
  Megaphone,
  Monitor,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { createServerClient } from '@/lib/supabase/server';
import type { BlogPost, BlogTag } from '@/core/types';
import { mapBlogPostWithTags, type BlogPostWithTagRows } from '@/lib/blog';
import { getPublicBlogBasePath, withPublicBlogBase } from '@/lib/public-blog-routing';
import { PublicSubscribeForm } from '@/components/modules/blog/PublicSubscribeForm';

const SERVICE_OFFERS = [
  {
    title: 'System Integrator',
    description:
      'Untuk bisnis yang ingin merapikan alur kerja dan menghubungkan teknologi ke proses operasionalnya.',
    icon: Workflow,
    gradient: 'from-emerald-500/20 to-cyan-500/20',
    iconColor: 'text-emerald-500',
  },
  {
    title: 'Konsultan Bisnis Digital',
    description:
      'Sesi diskusi untuk strategi digitalisasi, pertumbuhan bisnis, dan arah eksekusi yang lebih rapi.',
    icon: Briefcase,
    gradient: 'from-violet-500/20 to-indigo-500/20',
    iconColor: 'text-violet-500',
  },
  {
    title: 'Web App untuk Bisnis',
    description:
      'Membantu merancang dan membangun aplikasi internal atau tools kerja yang benar-benar dipakai.',
    icon: Monitor,
    gradient: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-blue-500',
  },
  {
    title: 'Digital Marketing',
    description:
      'Pendampingan untuk pemasaran digital yang lebih terarah, terukur, dan selaras dengan tujuan bisnis.',
    icon: Megaphone,
    gradient: 'from-amber-500/20 to-orange-500/20',
    iconColor: 'text-amber-500',
  },
] as const;

const PUBLIC_POST_LIST_SELECT = `
  id,
  title,
  slug,
  excerpt,
  featured_image_url,
  featured_image_alt,
  reading_time_minutes,
  published_at,
  is_featured,
  blog_post_tags(
    blog_tags(
      id,
      name,
      slug,
      color
    )
  )
`;

export default async function PublicBlogHome() {
  const supabase = await createServerClient();
  const blogBasePath = await getPublicBlogBasePath();

  const [featuredResult, latestPostsResult, tagsResult] = await Promise.all([
    supabase
      .from('blog_posts')
      .select(PUBLIC_POST_LIST_SELECT)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .eq('is_featured', true)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('blog_posts')
      .select(PUBLIC_POST_LIST_SELECT)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .order('published_at', { ascending: false })
      .limit(9),
    supabase
      .from('blog_tags')
      .select('id, name, slug, color')
      .eq('is_deleted', false)
      .order('post_count', { ascending: false })
      .order('name', { ascending: true })
      .limit(8),
  ]);

  const latestPosts: BlogPost[] = (latestPostsResult.data ?? []).map((post) =>
    mapBlogPostWithTags(post as unknown as BlogPostWithTagRows)
  );
  const blogTags = (tagsResult.data ?? []) as BlogTag[];

  const featuredPost = featuredResult.data
    ? mapBlogPostWithTags(featuredResult.data as unknown as BlogPostWithTagRows)
    : latestPosts[0];
  const morePosts = latestPosts.filter((post) => post.id !== featuredPost?.id);
  const latestGridPosts = morePosts.length > 0 ? morePosts : featuredPost ? [featuredPost] : [];

  return (
    <div className="relative overflow-hidden">
      {/* ── Decorative gradient orbs ── */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-[var(--accent-cyan)] opacity-[0.08] blur-[120px]" />
        <div className="absolute -left-48 top-[700px] h-[420px] w-[420px] rounded-full bg-primary opacity-[0.07] blur-[110px]" />
        <div className="absolute right-0 top-[1500px] h-[380px] w-[380px] rounded-full bg-[var(--accent-violet)] opacity-[0.06] blur-[100px]" />
      </div>

      <div className="relative space-y-16 pb-16 md:space-y-24">
        {/* ═══════════════════════════════════════════
            HERO SECTION
        ═══════════════════════════════════════════ */}
        <section className="pt-8 md:pt-20">
          <div className="mx-auto max-w-4xl text-center">
            {/* Headline */}
            <h1 className="text-[2.2rem] font-black leading-[1.08] tracking-[-0.04em] sm:text-[2.75rem] md:text-[4.5rem] lg:text-[5.5rem]">
              <span className="gradient-text-hero">Catatan, ide,</span>
              <br />
              <span className="text-foreground">dan proses belajar saya.</span>
            </h1>

            {/* Subheading */}
            <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-[1.8] text-muted-foreground sm:text-[17px] md:mt-7 md:text-[18px]">
              Saya{' '}
              <span className="font-semibold text-foreground">
                Ziaul Maula, SE, M.Si
              </span>{' '}
              — seorang dosen di Fakultas Ekonomi dan Bisnis UNSAM. Di sini
              saya menulis tentang digital marketing, dunia teknologi, AI, web
              app, dan hal-hal yang sedang saya pelajari.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <a
                href="#latest-articles"
                className="cta-glow group inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-primary to-[var(--accent-cyan)] px-8 py-4 text-[14px] font-bold text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/35"
              >
                Jelajahi Tulisan
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
              <a
                href="https://wa.me/6285156680447"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 rounded-2xl border border-border bg-card px-8 py-4 text-[14px] font-bold text-foreground shadow-sm transition-all duration-300 hover:border-primary/30 hover:bg-muted hover:shadow-md"
              >
                Hubungi Saya
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            CATEGORY TAGS
        ═══════════════════════════════════════════ */}
        <section>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Kategori
            </h2>
            <span className="text-[12px] text-muted-foreground/70">
              {latestPosts.length} tulisan terbaru
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href={withPublicBlogBase(blogBasePath, '/')}
              className="rounded-full bg-gradient-to-r from-primary to-[var(--accent-cyan)] px-5 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-primary/20 transition hover:shadow-lg hover:shadow-primary/30"
            >
              Semua
            </Link>
            {blogTags.map((tag) => (
              <Link
                key={tag.id}
                href={withPublicBlogBase(blogBasePath, `/tag/${tag.slug}`)}
                className="rounded-full border border-border/70 bg-card px-5 py-2.5 text-[13px] font-semibold text-foreground shadow-sm transition-all duration-200 hover:border-primary/40 hover:bg-primary/[0.06] hover:text-primary"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            FEATURED POST
        ═══════════════════════════════════════════ */}
        {featuredPost && (
          <section>
            <p className="mb-6 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.24em] text-primary">
              <Sparkles className="h-4 w-4" />
              Tulisan Pilihan
            </p>

            <Link
              href={withPublicBlogBase(blogBasePath, `/blog/${featuredPost.slug}`)}
              className="blog-card group block overflow-hidden rounded-3xl border border-border/70 bg-card shadow-lg shadow-black/[0.04] dark:shadow-black/[0.15]"
            >
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                {/* Image */}
                <div className="relative aspect-[16/10] overflow-hidden bg-muted lg:aspect-auto lg:min-h-[380px]">
                  {featuredPost.featured_image_url ? (
                    <Image
                      src={featuredPost.featured_image_url}
                      alt={featuredPost.featured_image_alt || featuredPost.title}
                      fill
                      preload
                      sizes="(max-width: 1023px) 100vw, 55vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-[var(--accent-cyan)]/10 to-[var(--accent-violet)]/10">
                      <Sparkles className="h-16 w-16 text-primary/30" />
                    </div>
                  )}
                  {/* Subtle gradient overlay on image edge */}
                  <div className="absolute inset-y-0 right-0 hidden w-24 bg-gradient-to-l from-card to-transparent lg:block" />
                </div>

                {/* Content */}
                <div className="flex flex-col justify-center gap-6 p-8 lg:p-10">
                  <div className="space-y-5">
                    <h2 className="text-[1.75rem] font-black leading-[1.15] tracking-[-0.03em] text-foreground transition-colors duration-300 group-hover:text-primary md:text-[2.5rem]">
                      {featuredPost.title}
                    </h2>
                    <p className="line-clamp-3 text-[16px] leading-[1.85] text-muted-foreground">
                      {featuredPost.excerpt}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                      {featuredPost.tags?.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-full bg-primary/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
                      <span>
                        {featuredPost.published_at
                          ? format(
                              parseISO(featuredPost.published_at),
                              'd MMMM yyyy',
                              { locale: id }
                            )
                          : ''}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {featuredPost.reading_time_minutes} menit baca
                      </span>
                    </div>

                    {/* Read CTA */}
                    <span className="inline-flex items-center gap-2 text-[14px] font-bold text-primary transition-all duration-300 group-hover:gap-3">
                      Baca Selengkapnya
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* ═══════════════════════════════════════════
            LATEST POSTS GRID
        ═══════════════════════════════════════════ */}
        <section id="latest-articles">
          <div className="mb-8 flex flex-col items-start gap-3 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Tulisan Terbaru
              </p>
              <h2 className="mt-2 text-[2rem] font-black tracking-tight text-foreground md:text-[2.5rem]">
                Postingan blog saya
              </h2>
            </div>
          </div>

          {latestGridPosts.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {latestGridPosts.map((post) => (
                <Link
                  key={post.id}
                  href={withPublicBlogBase(blogBasePath, `/blog/${post.slug}`)}
                  className="blog-card group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card"
                >
                {/* Card Image */}
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  {post.featured_image_url ? (
                    <Image
                      src={post.featured_image_url}
                      alt={post.featured_image_alt || post.title}
                      fill
                      sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                      className="object-cover transition-transform duration-600 ease-out group-hover:scale-[1.06]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/[0.06] via-[var(--accent-cyan)]/[0.06] to-[var(--accent-violet)]/[0.06]">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-primary/40" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="flex flex-1 flex-col gap-3 p-5 pb-6">
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {post.tags?.slice(0, 2).map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-full bg-primary/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>

                  {/* Title */}
                  <h3 className="text-[18px] font-bold leading-snug tracking-[-0.02em] text-foreground transition-colors duration-200 group-hover:text-primary">
                    {post.title}
                  </h3>

                  {/* Excerpt */}
                  <p className="line-clamp-2 flex-1 text-[14px] leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>

                  {/* Meta */}
                  <div className="mt-auto flex items-center gap-3 border-t border-border/50 pt-4 text-[12px] text-muted-foreground">
                    <span>
                      {post.published_at
                        ? format(parseISO(post.published_at), 'd MMM yyyy', {
                            locale: id,
                          })
                        : ''}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {post.reading_time_minutes} min
                    </span>
                  </div>
                </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/70 bg-card/50 px-6 py-14 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.08] text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-[20px] font-bold tracking-tight text-foreground">
                Belum ada tulisan publik
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-[15px] leading-[1.8] text-muted-foreground">
                Halaman depan blog akan terisi otomatis setelah kamu publish artikel pertama. Untuk sekarang, section ini saya tampilkan jujur supaya tidak terasa seperti halaman yang rusak.
              </p>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════
            SERVICES / OPEN COMMISSION
        ═══════════════════════════════════════════ */}
        <section>
          <div className="mb-10">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-primary">
              Open Commission
            </p>
            <h2 className="mt-2 max-w-3xl text-[2rem] font-black tracking-[-0.04em] text-foreground md:text-[2.5rem]">
              Saya juga membuka kerja kolaboratif
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-[1.8] text-muted-foreground sm:text-[16px] sm:leading-[1.85]">
              Kalau kamu butuh partner untuk digitalisasi bisnis, membangun web
              app, atau menata sistem kerja digital — saya membuka beberapa
              bentuk kerja yang relevan.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {SERVICE_OFFERS.map((service) => (
              <div
                key={service.title}
                className="service-card group flex gap-5 rounded-2xl border border-border/70 bg-card p-6"
              >
                {/* Icon */}
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${service.gradient}`}
                >
                  <service.icon className={`h-6 w-6 ${service.iconColor}`} />
                </div>

                {/* Text */}
                <div className="space-y-2">
                  <h3 className="text-[17px] font-bold tracking-tight text-foreground">
                    {service.title}
                  </h3>
                  <p className="text-[14px] leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            SUBSCRIBE
        ═══════════════════════════════════════════ */}
        <section
          id="subscribe"
          className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] via-[var(--accent-cyan)]/[0.03] to-[var(--accent-violet)]/[0.03] p-6 sm:p-8 md:p-12"
        >
          {/* Decorative orb inside */}
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary opacity-[0.06] blur-[80px]"
            aria-hidden="true"
          />

          <div className="relative">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <p className="text-[12px] font-semibold uppercase tracking-[0.24em]">
                Subscribe
              </p>
            </div>

            <h2 className="mt-3 text-[1.6rem] font-black tracking-tight text-foreground sm:text-[1.75rem] md:text-[2rem]">
              Ikuti tulisan terbaru
            </h2>
            <p className="mt-2 max-w-xl text-[14px] leading-[1.8] text-muted-foreground sm:text-[15px] sm:leading-[1.85]">
              Kalau kamu ingin sesekali menerima update tulisan baru, tinggalkan
              emailmu di sini. Tidak ada spam — hanya notifikasi posting terbaru.
            </p>

            <div className="mt-8 max-w-3xl">
              <PublicSubscribeForm sourcePath="/" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
