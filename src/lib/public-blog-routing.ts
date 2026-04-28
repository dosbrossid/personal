import 'server-only';

import { headers } from 'next/headers';

const PUBLIC_BLOG_HOSTS = new Set(['zmaula.web.id', 'www.zmaula.web.id']);

export async function getPublicBlogBasePath() {
  const requestHeaders = await headers();
  const hostHeader =
    requestHeaders.get('x-forwarded-host') ||
    requestHeaders.get('host') ||
    '';
  const hostname = hostHeader.split(':')[0].toLowerCase();

  return PUBLIC_BLOG_HOSTS.has(hostname) ? '' : '/public-blog';
}

export function withPublicBlogBase(basePath: string, pathname = '/') {
  const normalizedBase = basePath === '/' ? '' : basePath;

  if (!pathname || pathname === '/') {
    return normalizedBase || '/';
  }

  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${normalizedBase}${normalizedPath}`;
}
