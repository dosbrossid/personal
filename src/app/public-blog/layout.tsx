import Link from 'next/link';
import type { Metadata } from 'next';
import { Mail, MapPin, Phone, Rss } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { getDashboardLoginUrl } from '@/lib/app-routing';
import { getPublicBlogBasePath, withPublicBlogBase } from '@/lib/public-blog-routing';

export const metadata: Metadata = {
  metadataBase: new URL('https://zmaula.web.id'),
  title: {
    default: 'Ziaul Maula, SE, M.Si',
    template: '%s | Ziaul Maula',
  },
  description: 'Catatan Ziaul Maula tentang bisnis digital, pemasaran digital, e-business, web app, dan hal-hal yang sedang dipelajari.',
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon', sizes: '64x64' },
      { url: '/icon', type: 'image/png', sizes: '512x512' },
      { url: '/icon-192', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/apple-icon', type: 'image/png', sizes: '180x180' }],
  },
  alternates: {
    canonical: 'https://zmaula.web.id',
    types: {
      'application/rss+xml': '/api/public/rss',
    },
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Ziaul Maula, SE, M.Si',
    description: 'Blog pribadi berisi tulisan tentang bisnis digital, pemasaran digital, e-business, web app, dan proses belajar.',
    url: 'https://zmaula.web.id',
    type: 'website',
    locale: 'id_ID',
    siteName: 'Ziaul Maula',
    images: [
      {
        url: '/icon',
        width: 512,
        height: 512,
        alt: 'Ziaul Maula',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ziaul Maula, SE, M.Si',
    description: 'Blog pribadi berisi tulisan tentang bisnis digital, pemasaran digital, e-business, web app, dan proses belajar.',
    images: ['/icon'],
  },
};

function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ThreadsGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M17.38 11.37c-.18-.08-.36-.15-.55-.21-.33-3.09-2.01-4.85-4.66-4.87-1.6-.01-2.91.66-3.69 1.89l1.31.9c.59-.9 1.52-1.09 2.35-1.09h.02c1.77.01 2.82 1.11 3.1 3.22-.95-.13-1.98-.12-3.04.04-2.98.43-4.9 2.14-4.77 4.25.07 1.07.67 1.99 1.69 2.59.87.51 1.97.76 3.11.7 1.52-.08 2.71-.66 3.53-1.73.62-.81 1.01-1.87 1.18-3.22.77.46 1.34 1.11 1.66 1.89.55 1.33.58 3.51-1.18 5.27-1.55 1.55-3.42 2.22-6.23 2.24-3.12-.02-5.48-1.03-7.02-3.01-1.44-1.86-2.19-4.53-2.21-7.93.02-3.4.77-6.07 2.21-7.93 1.54-1.98 3.9-2.99 7.02-3.01 3.14.02 5.54 1.04 7.13 3.04.78.98 1.37 2.21 1.76 3.65l1.62-.43c-.47-1.7-1.18-3.16-2.13-4.36C19.66 1.08 16.84.03 13.2 0h-.01C9.56.03 6.76 1.08 4.84 3.22 3.13 5.12 2.25 8.11 2.22 12.29v.01c.03 4.18.91 7.17 2.62 9.07 1.92 2.14 4.72 3.19 8.35 3.22h.01c3.25-.02 5.52-.85 7.37-2.69 2.41-2.4 2.34-5.41 1.55-7.31-.57-1.37-1.62-2.48-3.04-3.22h.01ZM12.17 17.1c-1.26.07-2.58-.49-2.65-1.69-.05-.89.63-1.88 2.91-2.21.44-.06.86-.1 1.27-.1.57 0 1.11.06 1.61.17-.23 2.86-1.57 3.75-3.14 3.83Z" />
    </svg>
  );
}

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20a8 8 0 1 0-4.2-1.2L5 21l2.4-2.5A8 8 0 0 0 12 20Z" />
      <path d="M9.4 8.8c.2-.5.4-.5.8-.5h.6c.2 0 .5.1.6.5l.5 1.4c.1.3 0 .5-.1.7l-.4.5c-.1.1-.2.3-.1.5.3.7 1 1.4 1.7 1.9.2.1.4.1.5 0l.6-.4c.2-.1.4-.2.7-.1l1.3.6c.3.1.5.3.5.6v.6c0 .3 0 .6-.5.8-.5.2-1.1.3-1.8.1-1.1-.3-2.4-1.1-3.5-2.2-1.1-1.1-1.9-2.4-2.2-3.5-.2-.7-.1-1.3.1-1.8Z" />
    </svg>
  );
}

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
    <div className="min-h-screen bg-white text-[#242424] dark:bg-[#0f0f0f] dark:text-foreground">
      {/* ── Top gradient accent line ── */}
      <div className="gradient-accent-line h-[3px]" />

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-[#f2f2f2] bg-white/95 backdrop-blur-2xl dark:border-border/60 dark:bg-[#0f0f0f]/90">
        <div className="mx-auto flex min-h-16 max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href={homeHref} className="flex items-baseline gap-3 transition-opacity hover:opacity-80">
            <span className="text-[16px] font-black tracking-tight text-foreground sm:text-[17px]">Ziaul Maula</span>
            <span className="hidden text-[12px] font-medium text-muted-foreground md:inline">Blog</span>
          </Link>
          
          <div className="flex items-center gap-1 text-sm font-medium sm:gap-2 md:gap-4">
            <a
              href={articleListHref}
              className="rounded-lg px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-3"
            >
              Tulisan
            </a>
            <a
              href="/api/public/rss"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="RSS Feed"
            >
              <Rss className="h-4 w-4" />
            </a>

            {/* Separator */}
            <div className="mx-1 hidden h-5 w-px bg-border/70 md:block" />

            <a
              href={dashboardLoginUrl}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[var(--accent-cyan)] px-3 text-[12px] font-semibold text-white shadow-sm shadow-primary/20 transition-all duration-300 hover:shadow-md hover:shadow-primary/30 sm:px-4 sm:text-[13px]"
            >
              <span className="sm:hidden">Masuk</span>
              <span className="hidden sm:inline">Login</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 md:py-14">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#eee9df] bg-[#faf8f2] dark:border-border/60 dark:bg-[#12110f]">
        <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 sm:py-12">
          <div className="grid gap-10 md:grid-cols-3">
            {/* Column 1 — Branding */}
            <div className="space-y-3">
              <p className="text-[17px] font-black tracking-tight text-foreground">
                Ziaul Maula
              </p>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Dosen FEB UNSAM · Digital Business Consultant · Senang menulis
                tentang bisnis digital, pemasaran digital, e-business, dan web app.
              </p>
            </div>

            {/* Column 2 — Contact Details */}
            <div className="space-y-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Kontak
              </p>
              <div className="space-y-3 text-[15px]">
                <a
                  href="mailto:zmaula@unsam.ac.id"
                  className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-primary"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  zmaula@unsam.ac.id
                </a>
                <a
                  href="https://wa.me/6285156680447"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-primary"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  +62 851-5668-0447
                </a>
                <div className="flex items-start gap-3 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Fakultas Ekonomi dan Bisnis<br />
                    Universitas Samudra, Langsa, Aceh
                  </span>
                </div>
              </div>
            </div>

            {/* Column 3 — Social Media */}
            <div className="space-y-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Sosial Media
              </p>
              <div className="space-y-3 text-[15px]">
                <a
                  href="https://instagram.com/zmaula"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-primary"
                >
                  <InstagramGlyph />
                  @zmaula
                </a>
                <a
                  href="https://www.threads.net/@zmaula"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-primary"
                >
                  <ThreadsGlyph />
                  @zmaula
                </a>
                <a
                  href="https://wa.me/6285156680447"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-primary"
                >
                  <WhatsAppGlyph />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-[14px] text-muted-foreground md:flex-row">
            <p>© {new Date().getFullYear()} Ziaul Maula, SE, M.Si. Hak cipta dilindungi.</p>
            <a
              href="/api/public/rss"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 transition-colors hover:text-primary"
            >
              <Rss className="h-3.5 w-3.5" />
              RSS Feed
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
