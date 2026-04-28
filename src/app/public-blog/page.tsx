import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { createServerClient } from '@/lib/supabase/server';
import type { BlogPost } from '@/core/types';
import { mapBlogPostWithTags, type BlogPostWithTagRows } from '@/lib/blog';
import { getPublicBlogBasePath, withPublicBlogBase } from '@/lib/public-blog-routing';

export default async function PublicBlogHome() {
  const supabase = await createServerClient();
  const blogBasePath = await getPublicBlogBasePath();
  const latestArticlesHref = `${withPublicBlogBase(blogBasePath, '/')}#latest-articles`;
  
  const { data: rawPosts } = await supabase
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
    .order('published_at', { ascending: false });

  const publishedPosts: BlogPost[] = (rawPosts ?? []).map((post) =>
    mapBlogPostWithTags(post as BlogPostWithTagRows)
  );

  const featuredPost = publishedPosts.find(p => p.is_featured) || publishedPosts[0];
  const stringPosts = publishedPosts.filter(p => p.id !== featuredPost?.id);

  return (
    <div className="space-y-20">
      
      {/* Hero Section - Featured Post */}
      {featuredPost && (
        <section>
          <Link href={withPublicBlogBase(blogBasePath, `/${featuredPost.slug}`)} className="group block">
            <div className="relative aspect-[21/9] w-full overflow-hidden rounded-3xl border border-border/80 bg-card shadow-lg shadow-slate-900/8 dark:shadow-black/20">
              {featuredPost.featured_image_url ? (
                <img 
                  src={featuredPost.featured_image_url} 
                  alt={featuredPost.featured_image_alt || featuredPost.title} 
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-500/20 to-violet-500/20" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/88 to-white/18 dark:from-[#07070e] dark:via-[#07070e]/80 dark:to-transparent" />
              <div className="absolute bottom-0 left-0 p-8 md:p-12">
                <div className="mb-4 flex flex-wrap gap-2">
                  {featuredPost.tags?.map(tag => (
                    <span key={tag.id} className="rounded-full border border-border/70 bg-background/90 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur-md">
                      {tag.name}
                    </span>
                  ))}
                </div>
                <h1 className="mb-4 max-w-3xl text-3xl font-bold tracking-tight text-foreground md:text-5xl lg:leading-[1.1] group-hover:underline decoration-primary-400">
                  {featuredPost.title}
                </h1>
                <p className="mb-6 max-w-2xl text-lg text-slate-700 dark:text-muted-foreground line-clamp-2">
                  {featuredPost.excerpt}
                </p>
                <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-muted-foreground">
                  <span>{featuredPost.published_at ? format(parseISO(featuredPost.published_at), 'd MMMM yyyy', { locale: id }) : ''}</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {featuredPost.reading_time_minutes} min read</span>
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Recent Posts Section */}
      <section id="latest-articles">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Artikel Terbaru</h2>
          <a href={latestArticlesHref} className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80">
            Jelajahi daftar <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {stringPosts.map(post => (
            <Link key={post.id} href={withPublicBlogBase(blogBasePath, `/${post.slug}`)} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-slate-900/8 dark:bg-[#0a0a0f] dark:hover:shadow-primary-500/10">
              <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                {post.featured_image_url ? (
                  <img src={post.featured_image_url} alt={post.title} className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105 group-hover:opacity-100" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-[#11111a] dark:to-[#1a1a24]" />
                )}
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="mb-3 flex flex-wrap gap-2">
                  {post.tags?.slice(0, 2).map(tag => (
                    <span key={tag.id} className="text-xs font-semibold uppercase tracking-widest text-primary">
                      {tag.name}
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
                  <span>{post.published_at ? format(parseISO(post.published_at), 'MMM d, yyyy') : ''}</span>
                  <span>{post.reading_time_minutes} min read</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Newsletter Placeholder */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/12 to-cyan-500/12 px-6 py-16 text-center shadow-lg shadow-slate-900/6 md:px-12">
        <div className="relative z-10 mx-auto max-w-2xl">
          <h2 className="mb-4 text-3xl font-bold text-foreground">Ikuti perjalanan ide saya.</h2>
          <p className="mb-8 text-muted-foreground">
            Dapatkan tulisan terbaru seputar teknologi, AI, bisnis, dan produktivitas langsung ke kotak masuk Anda. Tidak ada spam.
          </p>
          <div className="mx-auto flex max-w-md gap-2">
            <input 
              type="email" 
              placeholder="rendy@example.com" 
              className="h-12 flex-1 rounded-xl border border-border bg-background/50 px-4 text-foreground placeholder:text-muted-foreground focus:border-primary-500 focus:outline-none"
            />
            <button type="button" className="h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              Subscribe
            </button>
          </div>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-500/20 blur-[100px]" />
      </section>

    </div>
  );
}
