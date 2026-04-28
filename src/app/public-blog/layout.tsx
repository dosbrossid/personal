import Link from 'next/link';
import { Mail, MapPin, Phone, Rss } from 'lucide-react';
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

function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ThreadsGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.2 9.2c.7-1.6 2.2-2.7 4.3-2.7 2.6 0 4.4 1.6 4.4 4.1 0 3.6-2.8 6.7-6.4 6.7-3.5 0-5.8-2.6-5.8-5.8 0-3.4 2.5-5.8 6.1-5.8 2.9 0 5 1.2 6.2 3.6" />
      <path d="M13.3 10.4c2.8.2 4.5 1.2 4.5 3.2 0 1.8-1.6 3-4 3-2.3 0-3.9-1.1-3.9-2.9 0-1.7 1.5-2.9 3.9-2.9 1.4 0 2.6.3 3.5.9" />
    </svg>
  );
}

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top gradient accent line ── */}
      <div className="gradient-accent-line h-[3px]" />

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-2xl">
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
      <footer className="border-t border-border/60 bg-card/50">
        <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 sm:py-12">
          <div className="grid gap-10 md:grid-cols-3">
            {/* Column 1 — Branding */}
            <div className="space-y-3">
              <p className="text-[17px] font-black tracking-tight text-foreground">
                Ziaul Maula
              </p>
              <p className="text-[14px] leading-relaxed text-muted-foreground">
                Dosen FEB UNSAM · Digital Business Consultant · System Integrator.
                Menulis tentang bisnis digital, pemasaran digital, e-business, dan web app.
              </p>
            </div>

            {/* Column 2 — Contact Details */}
            <div className="space-y-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Kontak
              </p>
              <div className="space-y-3 text-[14px]">
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
              <div className="space-y-3 text-[14px]">
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
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-[13px] text-muted-foreground md:flex-row">
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
