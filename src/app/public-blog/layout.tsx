import Link from 'next/link';
import { Rss } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { getDashboardLoginUrl } from '@/lib/app-routing';
import { getPublicBlogBasePath, withPublicBlogBase } from '@/lib/public-blog-routing';

export const metadata = {
  title: {
    default: 'Ziaul Maula, SE, M.Si',
    template: '%s | Ziaul Maula',
  },
  description: 'Catatan Ziaul Maula tentang bisnis digital, pemasaran digital, e-business, web app, dan hal-hal yang sedang dipelajari.',
  alternates: {
    types: {
      'application/rss+xml': '/api/public/rss',
    },
  },
  openGraph: {
    title: 'Ziaul Maula, SE, M.Si',
    description: 'Blog pribadi berisi tulisan tentang bisnis digital, pemasaran digital, e-business, web app, dan proses belajar.',
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
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border/70 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href={homeHref} className="flex items-baseline gap-3">
            <span className="text-[17px] font-black tracking-tight text-foreground">Ziaul Maula</span>
            <span className="hidden text-[12px] text-muted-foreground md:inline">Blog</span>
          </Link>
          
          <div className="flex items-center gap-3 text-sm font-medium md:gap-5">
            <Link href={homeHref} className="text-muted-foreground transition-colors hover:text-foreground">Home</Link>
            <a href={articleListHref} className="text-muted-foreground transition-colors hover:text-foreground">Tulisan</a>
            <a
              href="/api/public/rss"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
              title="RSS Feed"
            >
              <Rss className="h-4 w-4" />
            </a>
            <a
              href={dashboardLoginUrl}
              className="inline-flex h-9 items-center rounded-xl border border-border/70 bg-background px-3.5 text-[13px] font-semibold text-foreground transition hover:bg-muted"
            >
              Login
            </a>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-10 md:py-12">
        {children}
      </main>

      <footer className="mt-20 border-t border-border/70 py-10 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <p>© {new Date().getFullYear()} Ziaul Maula, SE, M.Si.</p>
          <p>Catatan tentang bisnis digital, pemasaran digital, e-business, dan web app.</p>
        </div>
      </footer>
    </div>
  );
}
