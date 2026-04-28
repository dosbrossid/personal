import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, Clock, Globe2, GraduationCap, MessageCircleMore, Sparkles, Target, Wrench } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { createServerClient } from '@/lib/supabase/server';
import type { BlogPost, BlogTag } from '@/core/types';
import { mapBlogPostWithTags, type BlogPostWithTagRows } from '@/lib/blog';
import { getDashboardLoginUrl } from '@/lib/app-routing';
import { getPublicBlogBasePath, withPublicBlogBase } from '@/lib/public-blog-routing';
import { PublicSubscribeForm } from '@/components/modules/blog/PublicSubscribeForm';

const CONTACTS = [
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

const SERVICES = [
  {
    title: 'System Integrator',
    description: 'Untuk bisnis yang butuh integrasi teknologi agar proses kerja, data, dan operasional lebih nyambung.',
    icon: Wrench,
  },
  {
    title: 'Digital Business Consultant',
    description: 'Open konsultasi untuk digitalisasi bisnis, merapikan alur kerja, dan menyiapkan pertumbuhan digital yang realistis.',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Web App Development',
    description: 'Bangun web app yang benar-benar dipakai bisnis, bukan sekadar tampilan yang cantik tapi tidak operasional.',
    icon: Globe2,
  },
  {
    title: 'Digital Marketing',
    description: 'Bantu strategi, eksperimen, dan eksekusi digital marketing yang nyambung ke target bisnis.',
    icon: Target,
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
      .limit(8),
  ]);

  const publishedPosts: BlogPost[] = (postsResult.data ?? []).map((post) =>
    mapBlogPostWithTags(post as BlogPostWithTagRows)
  );

  const blogTags = (tagsResult.data ?? []) as BlogTag[];
  const featuredPost = publishedPosts.find((post) => post.is_featured) || publishedPosts[0];
  const latestPosts = publishedPosts.filter((post) => post.id !== featuredPost?.id).slice(0, 6);

  return (
    <div className="space-y-16 pb-8 md:space-y-24">
      <section className="relative overflow-hidden rounded-[36px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(240,253,250,0.88))] p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(135deg,_rgba(10,14,19,0.95),_rgba(9,25,22,0.94))] md:p-10">
        <div className="absolute inset-y-0 right-0 hidden w-[38%] bg-[linear-gradient(180deg,rgba(20,184,166,0.18),rgba(20,184,166,0.02))] blur-2xl md:block" />
        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Dosen • Digital Marketer • Vibe Coder
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-foreground md:text-6xl md:leading-[1.04]">
                Ziaul Maula, SE, M.Si
              </h1>
              <p className="max-w-3xl text-[17px] leading-8 text-slate-700 dark:text-slate-300">
                Saya dosen Fakultas Ekonomi dan Bisnis UNSAM yang mengajar <span className="font-semibold text-foreground">Pemasaran Digital</span> dan <span className="font-semibold text-foreground">E-Business</span>, sambil tetap hidup di dunia digital marketing, web app, dan eksperimen teknologi yang saya pakai sendiri.
              </p>
              <p className="max-w-3xl text-[15px] leading-7 text-muted-foreground">
                Blog ini adalah ruang untuk apa yang ada di kepala saya: hal yang sedang saya pelajari, yang sedang saya uji, yang sedang saya pikirkan, dan apa yang saya rasa layak dibagikan ke orang lain.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={dashboardLoginUrl}
                className="inline-flex items-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-[14px] font-semibold text-background shadow-lg shadow-foreground/10 transition hover:opacity-90"
              >
                Login Dashboard
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#services"
                className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-5 py-3 text-[14px] font-semibold text-foreground transition hover:bg-background"
              >
                Lihat Service
              </a>
              <a
                href="#subscribe"
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-[14px] font-semibold text-emerald-700 transition hover:bg-emerald-500/15 dark:text-emerald-300"
              >
                Ikuti Tulisan
              </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {CONTACTS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-border/70 bg-background/75 p-4 transition hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-[14px] font-semibold text-foreground">{item.value}</p>
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[28px] border border-border/70 bg-background/80 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <GraduationCap className="h-4 w-4 text-emerald-500" />
                Fokus Akademik
              </div>
              <p className="mt-4 text-[17px] font-semibold leading-7 text-foreground">
                Mengajar topik yang dekat dengan transformasi digital bisnis, terutama <span className="text-emerald-600 dark:text-emerald-300">Pemasaran Digital</span> dan <span className="text-emerald-600 dark:text-emerald-300">E-Business</span>.
              </p>
            </div>

            <div className="rounded-[28px] border border-border/70 bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/20">
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.22em] text-white/60">
                <MessageCircleMore className="h-4 w-4 text-emerald-300" />
                Cara Kerja
              </div>
              <p className="mt-4 text-[16px] leading-7 text-white/90">
                Saya senang membangun sistem yang terasa berguna di dunia nyata: dashboard personal, web app untuk bisnis, alur kerja internal, sampai cara pemasaran yang bisa dieksekusi tanpa drama.
              </p>
            </div>

            {featuredPost && (
              <Link
                href={withPublicBlogBase(blogBasePath, `/${featuredPost.slug}`)}
                className="group rounded-[28px] border border-border/70 bg-background/80 p-5 shadow-lg shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tulisan Unggulan</p>
                    <h2 className="mt-3 text-[24px] font-bold leading-tight text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
                      {featuredPost.title}
                    </h2>
                  </div>
                  <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-300">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 line-clamp-3 text-[14px] leading-7 text-muted-foreground">
                  {featuredPost.excerpt}
                </p>
                <div className="mt-4 flex items-center gap-4 text-[12px] text-muted-foreground">
                  <span>{featuredPost.published_at ? format(parseISO(featuredPost.published_at), 'd MMMM yyyy', { locale: id }) : ''}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {featuredPost.reading_time_minutes} min read
                  </span>
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div className="rounded-[32px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Tentang Blog Ini</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
            Tempat saya menaruh proses berpikir, belajar, dan membangun.
          </h2>
          <div className="mt-5 space-y-4 text-[15px] leading-8 text-muted-foreground">
            <p>
              Isinya bisa berupa catatan belajar, eksperimen digital marketing, insight bisnis, desain sistem kerja, sampai hal-hal random yang sedang saya uji di dunia akademik dan praktis.
            </p>
            <p>
              Jadi ini bukan blog yang terlalu kaku. Ini lebih seperti notebook publik dari seorang dosen FEB yang juga hidup di dunia bisnis digital dan web app.
            </p>
          </div>
        </div>

        <div className="rounded-[32px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Kategori Utama</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">Arah tulisan yang akan sering muncul</h2>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {blogTags.length > 0 ? (
              blogTags.map((tag) => (
                <Link
                  key={tag.id}
                  href={withPublicBlogBase(blogBasePath, `/tag/${tag.slug}`)}
                  className="rounded-full border border-border/70 bg-background/80 px-4 py-2 text-[13px] font-semibold text-foreground transition hover:border-emerald-500/30 hover:text-emerald-600 dark:hover:text-emerald-300"
                >
                  {tag.name}
                </Link>
              ))
            ) : (
              ['Bisnis', 'Digital Marketing', 'Web App', 'Produktivitas', 'Belajar', 'Eksperimen'].map((tag) => (
                <span key={tag} className="rounded-full border border-border/70 bg-background/80 px-4 py-2 text-[13px] font-semibold text-foreground">
                  {tag}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      <section id="services" className="space-y-6">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Open Commission Work</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
            Kalau bisnismu butuh teknologi yang benar-benar nyambung ke operasional, saya terbuka untuk kerja bareng.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <div key={service.title} className="rounded-[28px] border border-border/70 bg-card p-5 shadow-lg shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-xl">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-[20px] font-bold text-foreground">{service.title}</h3>
                <p className="mt-3 text-[14px] leading-7 text-muted-foreground">{service.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {latestPosts.length > 0 && (
        <section id="latest-articles" className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Artikel Terbaru</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Tulisan terbaru dari isi kepala saya</h2>
            </div>
            <a href="#subscribe" className="text-[13px] font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-300">
              Mau ikut update? Simpan emailmu
            </a>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {latestPosts.map((post) => (
              <Link
                key={post.id}
                href={withPublicBlogBase(blogBasePath, `/${post.slug}`)}
                className="group overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-lg shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  {post.featured_image_url ? (
                    <img
                      src={post.featured_image_url}
                      alt={post.featured_image_alt || post.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10" />
                  )}
                </div>
                <div className="space-y-3 p-5">
                  <div className="flex flex-wrap gap-2">
                    {post.tags?.slice(0, 2).map((tag) => (
                      <span key={tag.id} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        {tag.name}
                      </span>
                    ))}
                  </div>
                  <h3 className="text-[22px] font-bold leading-tight text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
                    {post.title}
                  </h3>
                  <p className="line-clamp-3 text-[14px] leading-7 text-muted-foreground">{post.excerpt}</p>
                  <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                    <span>{post.published_at ? format(parseISO(post.published_at), 'd MMM yyyy', { locale: id }) : ''}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {post.reading_time_minutes} min
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section id="subscribe" className="rounded-[36px] border border-border/70 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(6,182,212,0.1))] p-6 shadow-xl shadow-slate-900/5 md:p-8">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Subscribe</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
            Kalau kamu mau ikut perkembangan isi kepala saya, tinggalkan emailmu di sini.
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
            Nanti saya bisa pakai daftar ini untuk newsletter, autoresponder, atau update tulisan terbaru tanpa perlu membangun ulang datanya dari nol.
          </p>
        </div>

        <div className="mt-6">
          <PublicSubscribeForm sourcePath="/" />
        </div>
      </section>
    </div>
  );
}
