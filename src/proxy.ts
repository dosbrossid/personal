// ============================================================
// Proxy — Auth Guard + Domain Routing + Session Refresh
// Runs on every request (except static assets)
// ============================================================

import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { buildLoginRedirectTarget } from '@/lib/auth-redirect';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/public-blog', '/api/public'];
const PUBLIC_BLOG_HOSTS = new Set(['zmaula.web.id', 'www.zmaula.web.id']);

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  const { pathname } = url;

  // ─── Domain-based routing (Production) ───
  // zmaula.web.id → rewrite to /public-blog
  if (PUBLIC_BLOG_HOSTS.has(hostname) && !pathname.startsWith('/api')) {
    if (pathname === '/public-blog' || pathname.startsWith('/public-blog/')) {
      url.pathname = pathname.replace(/^\/public-blog/, '') || '/';
      return NextResponse.redirect(url);
    }

    url.pathname = pathname === '/' ? '/public-blog' : `/public-blog${pathname}`;
    return NextResponse.rewrite(url);
  }

  // ─── Public blog routes — no auth needed ───
  if (pathname.startsWith('/public-blog')) {
    return NextResponse.next();
  }

  // ─── Trusted machine routes — skip cookie auth, validate secrets in handlers ───
  if (pathname.startsWith('/api/webhook') || pathname.startsWith('/api/cron')) {
    return NextResponse.next();
  }

  // ─── Supabase Session Refresh ───
  // This refreshes the auth token on every request to prevent
  // unexpected logouts. MUST happen before auth checks.
  const { user, supabaseResponse } = await updateSession(request);

  // ─── Auth Guard ───
  // Dashboard routes require authentication
  if (!user && !isPublicRoute(pathname)) {
    // Not logged in, trying to access protected route → redirect to login
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    // Preserve the original URL so we can redirect back after login
    loginUrl.searchParams.set('redirect', buildLoginRedirectTarget(pathname, request.nextUrl.search));
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in, trying to access login page → redirect to dashboard
  if (user && pathname === '/login') {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/';
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
