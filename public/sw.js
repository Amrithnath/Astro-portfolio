// Service worker for amrithnath.dev.
// The registration URL carries a per-build version (`/sw.js?v=<build>`), so every deploy installs a
// fresh worker and old caches are dropped on activate.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_PREFIX = 'portfolio-';
const PRECACHE = `${CACHE_PREFIX}precache-${VERSION}`;
const PAGES_CACHE = `${CACHE_PREFIX}pages-${VERSION}`;
const ASSETS_CACHE = `${CACHE_PREFIX}assets-${VERSION}`;
const CURRENT_CACHES = [PRECACHE, PAGES_CACHE, ASSETS_CACHE];

const OFFLINE_URL = '/offline/';
const MAX_PAGES = 30;
const MAX_ASSETS = 120;

// Only real files that exist in dist/ (no directories, no redirecting routes).
const REQUIRED_PRECACHE = [OFFLINE_URL];
const OPTIONAL_PRECACHE = ['/', '/about/', '/projects/', '/contact/', '/favicon.ico', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await Promise.all(REQUIRED_PRECACHE.map((url) => precache(cache, url)));
      // A missing optional page must never fail the whole install.
      await Promise.allSettled(OPTIONAL_PRECACHE.map((url) => precache(cache, url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name))
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // pagead: the privacy check's blocker bait must always hit the network.
  if (/^\/(?:api|cdn-cgi|admin|pagefind|pagead)(?:\/|$)/.test(url.pathname)) return;
  if (url.pathname === '/sw.js' || url.pathname === '/version.json') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(event));
  } else if (url.pathname.startsWith('/_astro/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(event));
  }
});

async function precache(cache, url) {
  let response = await fetch(new Request(url, { cache: 'reload' }));
  if (!response.ok || response.type !== 'basic') {
    throw new Error(`Precache failed for ${url}: ${response.status}`);
  }
  // Browsers reject redirected responses for navigations, so store a clean copy.
  if (response.redirected) {
    response = new Response(await response.blob(), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
  await cache.put(url, response);
}

function isCacheable(response) {
  return Boolean(response) && response.ok && response.type === 'basic' && !response.redirected;
}

// HTML: always try the network so a deploy is visible immediately; fall back to cache/offline page.
async function networkFirstPage(event) {
  const { request } = event;
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = (await event.preloadResponse) || (await fetch(request));
    if (isCacheable(response)) {
      await cache.put(request, response.clone());
      trimCache(PAGES_CACHE, MAX_PAGES);
    }
    return response;
  } catch {
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ||
      (await caches.match(request, { ignoreSearch: true, cacheName: PRECACHE })) ||
      (await caches.match(OFFLINE_URL, { cacheName: PRECACHE }));
    return (
      cached ||
      new Response('You are offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

// Hashed build assets never change, so a cache hit is always valid.
async function cacheFirst(request) {
  const cache = await caches.open(ASSETS_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      await cache.put(request, response.clone());
      trimCache(ASSETS_CACHE, MAX_ASSETS);
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(ASSETS_CACHE);
  const cached = (await cache.match(request)) || (await caches.match(request, { cacheName: PRECACHE }));
  const network = fetch(request)
    .then(async (response) => {
      if (isCacheable(response)) {
        await cache.put(request, response.clone());
        trimCache(ASSETS_CACHE, MAX_ASSETS);
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) || Response.error();
}

async function trimCache(name, maxEntries) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
}
