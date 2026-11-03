// Session Clock Service Worker — offline cache strategy
//
// v8 closes the worker-lifetime cache-name assumption (Finding E). A service
// worker can be terminated and restarted between any two events, so the cache
// name is no longer held only in a module global: it is derived from a build
// version stamped into this script by vite.config.ts on every event. That is
// deterministic across restarts and across worker updates.
//
// Lifecycle rules:
//  - install writes the new generation's cache and marks it ready only when
//    the shell files were cached;
//  - activate deletes older session-clock caches only after the new cache is
//    present and marked ready;
//  - every asynchronous cache write is paired with event.waitUntil();
//  - a failed precache never deletes the previous working cache, and the app
//    remains usable online because install failure leaves the old worker in
//    control.
//
// The recording-first CDN configuration and all sound URLs live in app code;
// this worker only preserves the existing public-origin allowlist.

importScripts("/sw-core.js");

const CORE = self.ScSWCore;
const CACHE_VERSION = "__SC_BUILD_VERSION__";
// Resolved from the constant above, not from a mutable worker global.
const cacheName = () => CORE.cacheNameFor(CACHE_VERSION);

// Used only when the build manifest cannot be fetched (vite dev / fresh
// checkout). It is still a deterministic cache generation.
const FALLBACK_CACHE = "session-clock-dev";
const SHELL_FILES = [
  "/",
  "/index.html",
  "/splash-base.png",
  "/splash-triangle.png",
];
const META_URL = "/.session-clock-cache-meta";

// Public, unauthenticated, safe-to-persist-offline origins only.
const CACHEABLE_EXTERNAL_ORIGINS = new Set([
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "sdk.scdn.co",
  "i.ytimg.com",
  "cdn.jsdelivr.net",
  "lrclib.net",
  "api.open-meteo.com",
  "nominatim.openstreetmap.org",
]);

const MATCH = { ignoreVary: true };

const offlineResponse = () =>
  new Response("", { status: 504, statusText: "Offline (service worker)" });
const orOffline = (cached) => cached || offlineResponse();

async function buildPrecacheList() {
  try {
    const res = await fetch("/precache-manifest.json", { cache: "no-store" });
    if (!res.ok) throw new Error("no manifest");
    const manifest = await res.json();
    if (!manifest || !Array.isArray(manifest.files)) {
      throw new Error("bad manifest");
    }
    return [...SHELL_FILES, ...manifest.files];
  } catch {
    return SHELL_FILES.slice();
  }
}

async function cacheShell(cache, files) {
  const unique = Array.from(new Set(files));
  const results = await Promise.allSettled(
    unique.map((file) => cache.add(file)),
  );
  const shellOk =
    results.length > 0 && results.every((r) => r.status === "fulfilled");
  await cache.put(
    META_URL,
    new Response(
      JSON.stringify({
        version: CACHE_VERSION,
        shellOk,
        cached: results.filter((r) => r.status === "fulfilled").length,
        total: unique.length,
        at: Date.now(),
      }),
      { headers: { "content-type": "application/json" } },
    ),
  );
  return shellOk;
}

async function cacheIsReady(name) {
  try {
    const cache = await caches.open(name);
    const res = await cache.match(META_URL);
    if (!res) return false;
    const meta = await res.json();
    return !!(meta && meta.shellOk);
  } catch {
    return false;
  }
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const name = cacheName();
      const cache = await caches.open(name);
      const files = await buildPrecacheList();
      const ready = await cacheShell(cache, files);
      if (!ready) {
        // Keep the previous worker/cache in control. The site is still usable
        // online; this only means a full offline shell is not guaranteed yet.
        throw new Error("shell precache incomplete");
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const name = cacheName();
      // Delete older generations only after the incoming cache is verified.
      if (await cacheIsReady(name)) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => CORE.shouldDeleteCache(key, name))
            .map((key) => caches.delete(key)),
        );
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (!CORE.isCacheableRequest(req)) return;

  const url = new URL(req.url);
  const name = cacheName();

  if (url.origin !== location.origin) {
    if (!CORE.isCacheableExternal(url.hostname, CACHEABLE_EXTERNAL_ORIGINS)) {
      return; // network-only; errors stay the page's own
    }
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (CORE.isCacheableResponse(r)) {
            const clone = r.clone();
            e.waitUntil(
              caches
                .open(name)
                .then((c) => c.put(req, clone))
                .catch(() => {
                  // A cache write failure must not fail the network response.
                }),
            );
          }
          return r;
        })
        .catch(() => caches.match(req).then(orOffline)),
    );
    return;
  }

  // Same-origin navigation: network-first, cache only as an offline fallback.
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const clone = r.clone();
          e.waitUntil(
            caches
              .open(name)
              .then((c) => c.put(req, clone))
              .catch(() => {
                // Navigation still succeeds if the cache is unavailable.
              }),
          );
          return r;
        })
        .catch(() =>
          caches
            .match(req, MATCH)
            .then((cached) => cached || caches.match("/index.html", MATCH))
            .then((cached) => cached || offlineResponse()),
        ),
    );
    return;
  }

  // Same-origin hashed assets: cache-first with a background refresh.
  e.respondWith(
    caches.match(req, MATCH).then((cached) => {
      if (cached) {
        e.waitUntil(
          fetch(req)
            .then((r) => {
              if (r.ok) {
                return caches.open(name).then((c) => c.put(req, r.clone()));
              }
            })
            .catch(() => {
              // Offline revalidation is best-effort.
            }),
        );
        return cached;
      }
      return fetch(req)
        .then((r) => {
          if (r.ok) {
            const clone = r.clone();
            e.waitUntil(
              caches
                .open(name)
                .then((c) => c.put(req, clone))
                .catch(() => {
                  // The fetched response is still returned.
                }),
            );
          }
          return r;
        })
        .catch(() => offlineResponse());
    }),
  );
});

// Exposed only for debugging in the worker console; handlers never read it.
self.SC_CACHE_INFO = {
  version: CACHE_VERSION,
  fallback: FALLBACK_CACHE,
};
