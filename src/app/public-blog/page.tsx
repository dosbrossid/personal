import Link from 'next/link';
import { ArrowRight, Clock, GraduationCap, MessageCircleMore, Rss } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { createServerClient } from '@/lib/supabase/server';
import type { BlogPost, BlogTag } from '@/core/types';
import { mapBlogPostWithTags, type BlogPostWithTagRows } from '@/lib/blog';
import { getDashboardLoginUrl } from '@/lib/app-routing';
import { getPublicBlogBasePath, withPublicBlogBase } from '@/lib/public-blog-routing';
import { PublicSubscribeForm } from '@/components/modules/blog/PublicSubscribeForm';

const SOCIAL_LINKS = [
  {
    label: 'Instagram',
    value: '@zmaula',
    href: 'https://instagram.com/zmaula',
  },
  {
    label: 'Threads',
    value: '@zmaula',
    href: 'https://www.threads.net/@zmaula',
  },
  {
    label: 'WhatsApp',
    value: '085156680447',
    href: 'https://wa.me/6285156680447',
  },
] as const;

export default async function PublicBlogHome() {
  const supabase = await createServerClient();
  const blogBasePath = await getPublicBlogBasePath();
  const dashboardLoginUrl = await getDashboardLoginUrl();

  const [postsResult, tagsResult] = await Promise.all([
    supabase
      .from('blog_posts')
      .select(`
        *,
        blog_post_tags(
          blog_tags(*)
        )
      `)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .order('published_at', { ascending: false }),
    supabase
      .from('blog_tags')
      .select('*')
      .eq('is_deleted', false)
      .order('post_count', { ascending: false })
      .order('name', { ascending: true })
      .limit(10),
  ]);

  const publishedPosts: BlogPost[] = (postsResult.data ?? []).map((post) =>
    mapBlogPostWithTags(post as BlogPostWithTagRows)
  );
  const blogTags = (tagsResult.data ?? []) as BlogTag[];

  const featuredPost = publishedPosts.find((post) => post.is_featured) || publishedPosts[0];
  const morePosts = publishedPosts.filter((post) => post.id !== featuredPost?.id);

  return (
    <div className="space-y-10 pb-10 md:space-y-14">
      <section className="border-b border-border/70 pb-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" />
              Blog
            </div>

            <div className="space-y-3">
              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-foreground md:text-6xl md:leading-[1.04]">
                Ziaul Maula, SE, M.Si
              </h1>
              <p className="max-w-3xl text-[16px] leading-8 text-muted-foreground md:text-[17px]">
                Dosen Fakultas Ekonomi dan Bisnis UNSAM. Menulis tentang bisnis digital, pemasaran digital,
                e-business, web app, dan hal-hal yang sedang saya pelajari.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Tentang Singkat
            </p>
            <p className="mt-3 text-[14px] leading-7 text-muted-foreground">
              Halaman ini adalah rumah untuk tulisan, catatan, dan ide yang ingin saya simpan terbuka.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={dashboardLoginUrl}
                className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3.5 py-2 text-[12px] font-semibold text-foreground transition hover:bg-muted"
              >
                Masuk Dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <a
                href="/api/public/rss"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3.5 py-2 text-[12px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Rss className="h-3.5 w-3.5" />
                RSS
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Kategori
          </h2>
          <span className="text-[12px] text-muted-foreground">{publishedPosts.length} tulisan</span>
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
        <section className="grid gap-8 border-b border-border/70 pb-10 lg:grid-cols-[minmax(0,1.2fr)_320px]">
          <Link
            href={withPublicBlogBase(blogBasePath, `/${featuredPost.slug}`)}
            className="group overflow-hidden rounded-[32px] border border-border/70 bg-card transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="aspect-[16/9] overflow-hidden bg-muted">
              {featuredPost.featured_image_url ? (
                <img
                  src={featuredPost.featured_image_url}
                  alt={featuredPost.featured_image_alt || featuredPost.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_40%),linear-gradient(135deg,_rgba(15,23,42,0.04),_rgba(15,23,42,0.12))]" />
              )}
            </div>

            <div className="space-y-4 p-6 md:p-8">
              <div className="flex flex-wrap gap-2">
                {featuredPost.tags?.slice(0, 3).map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Tulisan Pilihan
                </p>
                <h2 className="text-3xl font-black leading-tight tracking-tight text-foreground md:text-[2.55rem]">
                  {featuredPost.title}
                </h2>
                <p className="max-w-3xl text-[15px] leading-8 text-muted-foreground">
                  {featuredPost.excerpt}
                </p>
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
          </Link>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Tentang Saya
              </p>
              <p className="mt-3 text-[14px] leading-7 text-muted-foreground">
                Saya mengajar Pemasaran Digital dan E-Business di FEB UNSAM, sambil tetap aktif di
                digital marketing, sistem kerja digital, dan pengembangan web app.
              </p>
            </div>

            <div className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Temui Saya
              </p>
              <div className="mt-4 space-y-3">
                {SOCIAL_LINKS.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 px-4 py-3 text-[13px] transition hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 text-foreground">
                      <MessageCircleMore className="h-4 w-4" />
                      <span className="font-semibold">{item.label}</span>
                    </div>
                    <span className="text-muted-foreground">{item.value}</span>
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </section>
      )}

      <section id="latest-articles" className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
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
                className="group grid gap-5 py-6 md:grid-cols-[minmax(0,1fr)_220px]"
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
                    <h3 className="text-[24px] font-bold leading-tight text-foreground transition group-hover:text-foreground/80">
                      {post.title}
                    </h3>
                    <p className="line-clamp-3 text-[14px] leading-7 text-muted-foreground">
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

                <div className="overflow-hidden rounded-[24px] border border-border/70 bg-muted">
                  {post.featured_image_url ? (
                    <img
                      src={post.featured_image_url}
                      alt={post.featured_image_alt || post.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
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
          <div className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Tentang Blog
            </p>
            <p className="mt-3 text-[14px] leading-7 text-muted-foreground">
              Saya memakai halaman ini untuk menyimpan catatan belajar, ide, eksperimen, dan tulisan
              yang rasanya layak dibagikan.
            </p>
          </div>

          <div id="subscribe" className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Subscribe
            </p>
            <h3 className="mt-3 text-[22px] font-bold tracking-tight text-foreground">
              Ikuti tulisan terbaru
            </h3>
            <p className="mt-2 text-[14px] leading-7 text-muted-foreground">
              Kalau kamu ingin sesekali menerima update tulisan baru, tinggalkan emailmu di sini.
            </p>
            <div className="mt-5">
              <PublicSubscribeForm sourcePath="/" compact />
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
