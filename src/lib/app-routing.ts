import 'server-only';

import { headers } from 'next/headers';

const PUBLIC_BLOG_HOSTS = new Set(['zmaula.web.id', 'www.zmaula.web.id']);
const DASHBOARD_APP_URL = 'https://app.zmaula.web.id';

export async function getDashboardAppUrl() {
  const requestHeaders = await headers();
  const hostHeader =
    requestHeaders.get('x-forwarded-host') ||
    requestHeaders.get('host') ||
    '';
  const hostname = hostHeader.split(':')[0].toLowerCase();

  if (!PUBLIC_BLOG_HOSTS.has(hostname) && hostHeader) {
    return `https://${hostname}`;
  }

  return DASHBOARD_APP_URL;
}

export async function getDashboardLoginUrl() {
  return `${await getDashboardAppUrl()}/login`;
}
