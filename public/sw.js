const CACHE_NAME = 'idarat-ratbi-v2';
const BASE = self.location.pathname.replace(/\/sw\.js$/, '/');
const APP_SHELL = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (response.ok && url.pathname.startsWith(BASE)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match(BASE + 'index.html');
        }
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
