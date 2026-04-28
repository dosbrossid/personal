import Link from 'next/link';
import { Sparkles, Rss } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { getDashboardLoginUrl } from '@/lib/app-routing';
import { getPublicBlogBasePath, withPublicBlogBase } from '@/lib/public-blog-routing';

export const metadata = {
  title: {
    default: 'Ziaul Maula, SE, M.Si — Dosen, Digital Marketer, Vibe Coder',
    template: '%s | Ziaul Maula',
  },
  description: 'Landing page dan blog pribadi Ziaul Maula, SE, M.Si. Dosen FEB UNSAM, pengajar Pemasaran Digital dan E-Business, digital marketer, vibe coder, serta tempat menaruh isi kepala, proses belajar, dan insight bisnis digital.',
  alternates: {
    types: {
      'application/rss+xml': '/api/public/rss',
    },
  },
  openGraph: {
    title: 'Ziaul Maula, SE, M.Si — Dosen, Digital Marketer, Vibe Coder',
    description: 'Blog pribadi berisi apa yang sedang dipelajari, dipikirkan, dan dibangun Ziaul Maula di persimpangan akademik, teknologi, bisnis digital, dan web app.',
    type: 'website',
    siteName: 'Ziaul Maula',
  },
};

export default async function BlogLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const blogBasePath = await getPublicBlogBasePath();
  const dashboardLoginUrl = await getDashboardLoginUrl();
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
          
          <div className="flex items-center gap-3 text-sm font-medium md:gap-6">
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
            <a
              href={dashboardLoginUrl}
              className="inline-flex h-9 items-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 text-[13px] font-semibold text-emerald-700 transition hover:bg-emerald-500/15 dark:text-emerald-300"
            >
              Login
            </a>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {children}
      </main>

      <footer className="mt-20 border-t border-border py-12 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Ziaul Maula, SE, M.Si. All rights reserved.</p>
      </footer>
    </div>
  );
}
