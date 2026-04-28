import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Briefcase, Clock, GraduationCap, Megaphone, Monitor, Rss, Workflow } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { createServerClient } from '@/lib/supabase/server';
import type { BlogPost, BlogTag } from '@/core/types';
import { mapBlogPostWithTags, type BlogPostWithTagRows } from '@/lib/blog';
import { getDashboardLoginUrl } from '@/lib/app-routing';
import { getPublicBlogBasePath, withPublicBlogBase } from '@/lib/public-blog-routing';
import { PublicSubscribeForm } from '@/components/modules/blog/PublicSubscribeForm';

const SERVICE_OFFERS = [
  {
    title: 'System Integrator',
    description: 'Untuk bisnis yang ingin merapikan alur kerja dan menghubungkan teknologi ke proses operasionalnya.',
    icon: Workflow,
  },
  {
    title: 'Konsultan Bisnis Digital',
    description: 'Sesi diskusi untuk strategi digitalisasi, pertumbuhan bisnis, dan arah eksekusi yang lebih rapi.',
    icon: Briefcase,
  },
  {
    title: 'Web App untuk Bisnis',
    description: 'Membantu merancang dan membangun aplikasi internal atau tools kerja yang benar-benar dipakai.',
    icon: Monitor,
  },
  {
    title: 'Digital Marketing',
    description: 'Pendampingan untuk pemasaran digital yang lebih terarah, terukur, dan selaras dengan tujuan bisnis.',
    icon: Megaphone,
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
  const dashboardLoginUrl = await getDashboardLoginUrl();

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

  return (
    <div className="space-y-12 pb-12 md:space-y-16">
      <section className="border-b border-border/70 pb-10 md:pb-12">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-end">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5" />
            Blog
            </div>

            <div className="space-y-4">
              <h1 className="max-w-5xl text-4xl font-black tracking-[-0.04em] text-foreground md:text-[4.5rem] md:leading-[0.98]">
                Catatan, ide, dan proses belajar saya di dunia bisnis digital.
              </h1>
              <p className="max-w-3xl text-[17px] leading-8 text-muted-foreground md:text-[18px]">
                Saya Ziaul Maula, SE, M.Si, dosen Fakultas Ekonomi dan Bisnis UNSAM. Di sini saya menulis tentang
                pemasaran digital, e-business, web app, sistem kerja digital, dan hal-hal yang sedang saya pelajari.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={dashboardLoginUrl}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-foreground px-5 py-2.5 text-[13px] font-semibold text-background transition hover:opacity-90"
              >
                Masuk Dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <a
                href="/api/public/rss"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 px-5 py-2.5 text-[13px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Rss className="h-3.5 w-3.5" />
                RSS
              </a>
            </div>
          </div>

          <div className="border-l border-border/70 pl-0 xl:pl-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Tentang
            </p>
            <p className="mt-3 text-[15px] leading-8 text-muted-foreground">
              Blog ini adalah tempat saya menyusun tulisan yang lebih rapi dari apa yang biasanya hanya lewat
              kepala, chat, atau catatan kerja sehari-hari.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-b border-border/70 pb-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Kategori
          </h2>
          <span className="text-[12px] text-muted-foreground">{latestPosts.length} tulisan terbaru</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={withPublicBlogBase(blogBasePath, '/')}
            className="rounded-full border border-border/70 bg-foreground px-4 py-2 text-[13px] font-semibold text-background transition hover:opacity-90"
          >
            Semua
          </Link>
          {blogTags.map((tag) => (
            <Link
              key={tag.id}
              href={withPublicBlogBase(blogBasePath, `/tag/${tag.slug}`)}
              className="rounded-full border border-border/70 bg-background px-4 py-2 text-[13px] font-semibold text-foreground transition hover:border-foreground/30 hover:bg-muted"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      </section>

      {featuredPost && (
        <section className="grid gap-10 border-b border-border/70 pb-12 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <Link
            href={withPublicBlogBase(blogBasePath, `/${featuredPost.slug}`)}
            className="group grid gap-8 xl:grid-cols-[minmax(0,0.92fr)_minmax(380px,0.78fr)]"
          >
            <div className="order-2 flex flex-col justify-between space-y-6 xl:order-1">
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Tulisan Pilihan
                </p>
                <h2 className="max-w-3xl text-3xl font-black leading-tight tracking-[-0.04em] text-foreground md:text-[3.5rem]">
                  {featuredPost.title}
                </h2>
                <p className="max-w-3xl text-[16px] leading-8 text-muted-foreground">
                  {featuredPost.excerpt}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {featuredPost.tags?.slice(0, 3).map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full border border-border/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
                  <span>
                    {featuredPost.published_at
                      ? format(parseISO(featuredPost.published_at), 'd MMMM yyyy', { locale: id })
                      : ''}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {featuredPost.reading_time_minutes} menit baca
                  </span>
                </div>
              </div>
            </div>

            <div className="order-1 relative aspect-[16/10] overflow-hidden rounded-[28px] bg-muted xl:order-2">
              {featuredPost.featured_image_url ? (
                <Image
                  src={featuredPost.featured_image_url}
                  alt={featuredPost.featured_image_alt || featuredPost.title}
                  fill
                  preload
                  sizes="(max-width: 1279px) 100vw, 42vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_40%),linear-gradient(135deg,_rgba(15,23,42,0.04),_rgba(15,23,42,0.12))]" />
              )}
            </div>
          </Link>

          <aside className="border-l border-border/70 pl-0 xl:pl-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Fokus
            </p>
            <div className="mt-4 space-y-4">
              <p className="text-[15px] leading-8 text-muted-foreground">
                Saya mengajar Pemasaran Digital dan E-Business di FEB UNSAM, sambil tetap aktif di digital marketing,
                sistem kerja digital, dan pengembangan web app.
              </p>
              <p className="text-[15px] leading-8 text-muted-foreground">
                Tulisan-tulisan di sini biasanya lahir dari materi kuliah, eksperimen tools, percakapan bisnis, dan
                ide yang sedang saya uji.
              </p>
            </div>
          </aside>
        </section>
      )}

      <section id="latest-articles" className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Tulisan Terbaru
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-foreground">
                Postingan blog saya
              </h2>
            </div>
          </div>

          <div className="divide-y divide-border/70">
            {morePosts.map((post) => (
              <Link
                key={post.id}
                href={withPublicBlogBase(blogBasePath, `/${post.slug}`)}
                className="group grid gap-6 py-7 md:grid-cols-[minmax(0,1fr)_260px]"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {post.tags?.slice(0, 2).map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-foreground transition group-hover:text-foreground/80">
                      {post.title}
                    </h3>
                    <p className="line-clamp-3 max-w-3xl text-[15px] leading-8 text-muted-foreground">
                      {post.excerpt}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
                    <span>
                      {post.published_at
                        ? format(parseISO(post.published_at), 'd MMM yyyy', { locale: id })
                        : ''}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {post.reading_time_minutes} menit baca
                    </span>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[20px] bg-muted">
                  {post.featured_image_url ? (
                    <Image
                      src={post.featured_image_url}
                      alt={post.featured_image_alt || post.title}
                      fill
                      sizes="(max-width: 767px) 100vw, 260px"
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full min-h-[180px] w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_40%),linear-gradient(135deg,_rgba(15,23,42,0.04),_rgba(15,23,42,0.12))]" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="border-l border-border/70 pl-0 xl:pl-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Tentang Blog
            </p>
            <p className="mt-3 text-[15px] leading-8 text-muted-foreground">
              Saya memakai halaman ini untuk menyimpan catatan belajar, ide, eksperimen, dan tulisan
              yang rasanya layak dibagikan.
            </p>
          </div>

          <div id="subscribe" className="border-t border-border/70 pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Subscribe
            </p>
            <h3 className="mt-3 text-[24px] font-bold tracking-tight text-foreground">
              Ikuti tulisan terbaru
            </h3>
            <p className="mt-2 text-[15px] leading-8 text-muted-foreground">
              Kalau kamu ingin sesekali menerima update tulisan baru, tinggalkan emailmu di sini.
            </p>
            <div className="mt-5">
              <PublicSubscribeForm sourcePath="/" compact />
            </div>
          </div>
        </aside>
      </section>

      <section className="border-t border-border/70 pt-10">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Open Commission
            </p>
            <h2 className="max-w-3xl text-3xl font-black tracking-[-0.04em] text-foreground md:text-[2.6rem]">
              Saya juga membuka kerja kolaboratif
            </h2>
            <p className="max-w-3xl text-[15px] leading-8 text-muted-foreground">
              Kalau kamu butuh partner untuk digitalisasi bisnis, membangun web app, atau menata sistem kerja digital,
              saya membuka beberapa bentuk kerja yang relevan.
            </p>
          </div>

          <div className="divide-y divide-border/70 border-y border-border/70">
            {SERVICE_OFFERS.map((service) => (
              <div
                key={service.title}
                className="grid gap-4 py-5 md:grid-cols-[60px_minmax(0,220px)_minmax(0,1fr)] md:items-start"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-muted/30 text-foreground">
                  <service.icon className="h-5 w-5" />
                </div>
                <h3 className="text-[18px] font-bold tracking-tight text-foreground">
                  {service.title}
                </h3>
                <p className="text-[14px] leading-7 text-muted-foreground">
                  {service.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
