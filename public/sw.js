const VERSION = '2026-04-30-v3';
const APP_SHELL_CACHE = `zmaula-app-shell-${VERSION}`;
const RUNTIME_CACHE = `zmaula-runtime-${VERSION}`;
const OFFLINE_URL = '/offline';
const APP_SHELL_ASSETS = ['/manifest.webmanifest', '/icon-192', '/icon', '/apple-icon', OFFLINE_URL];
const PUBLIC_NAVIGATION_PREFIXES = ['/public-blog', '/blog', '/tag'];
const STATIC_ASSET_PREFIXES = ['/_next/static/', '/_next/image'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (![APP_SHELL_CACHE, RUNTIME_CACHE].includes(key)) {
              return caches.delete(key);
            }

            return Promise.resolve(false);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname === '/sw.js') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  if (shouldCacheAsset(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function handleNavigation(request, url) {
  try {
    const response = await fetch(request);

    if (isCacheablePublicNavigation(url, response)) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedPage = await caches.match(request);

    if (cachedPage) {
      return cachedPage;
    }

    const offlinePage = await caches.match(OFFLINE_URL);

    return (
      offlinePage ||
      new Response('Koneksi offline dan halaman fallback belum tersedia.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

function shouldCacheAsset(request, url) {
  return (
    STATIC_ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
    ['style', 'script', 'font', 'image'].includes(request.destination)
  );
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const networkFetch = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => cached || Response.error());

  return cached || networkFetch;
}

function isCacheablePublicNavigation(url, response) {
  return (
    PUBLIC_NAVIGATION_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) &&
    isCacheableResponse(response)
  );
}

function isCacheableResponse(response) {
  return response && response.status === 200 && response.type === 'basic';
}
