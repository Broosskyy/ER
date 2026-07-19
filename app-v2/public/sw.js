/* Eternal Rave — conservative online-first service worker */
const CACHE_VERSION = 'v0.2.0';
const SHELL_CACHE = `eternal-rave-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `eternal-rave-assets-${CACHE_VERSION}`;

const PRECACHE_URLS = ['/offline.html', '/manifest.webmanifest', '/pwa/icon-192.png', '/pwa/icon-512.png'];

function isSupabaseRequest(url) {
  return url.hostname.includes('supabase.co') || url.pathname.includes('/auth/');
}

function isAdminRequest(url) {
  return url.pathname.startsWith('/admin');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('eternal-rave-') && key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
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
    if (isSupabaseRequest(url)) {
      return;
    }
  }

  if (isAdminRequest(url) || isSupabaseRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname.startsWith('/_expo/') || url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          const offline = await cache.match('/offline.html');
          return offline ?? Response.error();
        }),
    );
  }
});
