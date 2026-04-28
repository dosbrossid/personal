import Link from 'next/link';
import { Sparkles, Rss } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { getPublicBlogBasePath, withPublicBlogBase } from '@/lib/public-blog-routing';

export const metadata = {
  title: {
    default: 'Blog — Z A Maula',
    template: '%s | Z A Maula Blog',
  },
  description: 'Tulisan tentang teknologi, produktivitas, AI, dan bisnis digital.',
  alternates: {
    types: {
      'application/rss+xml': '/api/public/rss',
    },
  },
  openGraph: {
    title: 'Blog — Z A Maula',
    description: 'Tulisan tentang teknologi, produktivitas, AI, dan bisnis digital.',
    type: 'website',
    siteName: 'Z A Maula Blog',
  },
};

export default async function BlogLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const blogBasePath = await getPublicBlogBasePath();
  const homeHref = withPublicBlogBase(blogBasePath, '/');
  const articleListHref = `${homeHref}#latest-articles`;

  return (
    <div className="font-display min-h-screen bg-background text-foreground">
      {/* Blog Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href={homeHref} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight text-foreground">zmaula.web.id</span>
          </Link>
          
          <div className="flex items-center gap-6 text-sm font-medium">
            <Link href={homeHref} className="text-muted-foreground transition-colors hover:text-foreground">Blog</Link>
            <a href={articleListHref} className="text-muted-foreground transition-colors hover:text-foreground">Artikel</a>
            <a
              href="/api/public/rss"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-orange-400"
              title="RSS Feed"
            >
              <Rss className="h-4 w-4" />
            </a>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {children}
      </main>

      <footer className="mt-20 border-t border-border py-12 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Z A Maula. All rights reserved.</p>
      </footer>
    </div>
  );
}
