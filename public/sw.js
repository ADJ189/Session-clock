// App-shell caching only, per the plan's own caching strategy (see
// README): the shell/CSS/JS get cached aggressively, but this worker
// never touches audio, YouTube API responses, or the IFrame player --
// those go straight to the network every time, on purpose. Caching a
// "playable audio" response would be the wrong kind of persistence for
// content this app doesn't have redistribution rights to.

const CACHE_NAME = 'session-clock-music-shell-v1';
const SHELL_ASSETS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept anything cross-origin (YouTube API, thumbnails,
  // the IFrame player, Google auth) -- only cache same-origin shell assets.
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/')) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
