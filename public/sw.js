// Session Clock Service Worker — offline cache strategy
//
// v7 rewrites the fetch strategy after an audit found two real problems
// with v6:
//  - HTML/navigation requests were served cache-first (Finding SW1) —
//    `_headers` sets `/index.html` to no-store, but that only governs the
//    browser's own HTTP cache; this Cache Storage layer sat in front of
//    it and could keep serving a stale cached shell indefinitely after a
//    new deploy, the classic "why am I still on the old version" PWA bug.
//  - The cross-origin branch cached *any* successful response, including
//    authenticated API calls to Spotify/Notion/GitHub/Todoist/Google
//    (Finding SW2 — could persist per-user/session data into a cache any
//    origin-scoped code can read) and non-GET requests, which the Cache
//    API isn't meant to hold at all (Finding SW3).
//
// Cache name and precache list are both now build-derived (Finding SW4 —
// the old hand-written PRECACHE only ever covered the app shell, never
// the actual hashed JS/CSS output) via dist/precache-manifest.json,
// written by the precacheManifestPlugin in vite.config.ts. FALLBACK_CACHE
// is used only if that fetch fails (e.g. `vite dev`, or a fresh checkout
// that's never been built) so the worker still installs something usable
// rather than failing outright.
const FALLBACK_CACHE = "session-clock-fallback";
const PRECACHE = [
  "/",
  "/index.html",
  "/splash-base.png",
  "/splash-triangle.png",
];

// Public, unauthenticated, safe-to-persist-offline origins only. Every
// other cross-origin request (Spotify/Google/Notion/GitHub/Todoist auth
// and API endpoints, accounts.*, etc.) is deliberately left off this list
// — those respond with per-user, often token-bearing data and are always
// network-only from this Service Worker's point of view (see the fetch
// handler below); a page's own JS is still free to cache/store their
// results itself if it wants to, that's a separate concern from this
// origin-level Cache Storage layer.
const CACHEABLE_EXTERNAL_ORIGINS = new Set([
  "fonts.googleapis.com", // stylesheet listing font URLs
  "fonts.gstatic.com", // the actual font files
  "sdk.scdn.co", // Spotify Web Playback SDK script
  "i.ytimg.com", // YouTube video thumbnails
  "cdn.jsdelivr.net", // self-hosted CC0 ambient sound files (ADJ189/Ambient-Sounds)
  "lrclib.net", // public, no-auth lyrics lookup
  "api.open-meteo.com", // public, no-auth weather data
  "nominatim.openstreetmap.org", // public, no-auth geocoding
  "worldtimeapi.org", // public, no-auth time data
]);

// App asset cache lookups ignore `Vary`. Precaching fetches each file with a bare
// request, but the browser's own requests carry extra headers (module
// scripts are CORS-mode and send `Origin`). Any server that answers with
// `Vary: Origin` (vite preview, many CDNs) would otherwise make every
// cached JS/CSS file miss, so a cached app failed to boot offline. The
// asset URLs are content-hashed, so ignoring Vary can't serve a wrong file.
const MATCH = { ignoreVary: true };

// respondWith() must always be given a usable Response:
//  - caches.match() resolves to `undefined` on a miss, and passing that on
//    throws "TypeError: Returned response is null" (a page error);
//  - Response.error() is logged by the browser as "Response served by
//    service worker is an error" (also a page error).
// So a miss becomes an ordinary 504. fetch() callers see !res.ok and fall
// back as they would for any failed request; <script>/<link> still fire
// their `error` events, which the boot guard already handles.
const offlineResponse = () =>
  new Response("", { status: 504, statusText: "Offline (service worker)" });
const orOffline = (cached) => cached || offlineResponse();

// Resolved once at install time: the manifest's `version` if the fetch
// succeeds, else FALLBACK_CACHE. Every other handler below reads this
// rather than a hardcoded string.
let CACHE = FALLBACK_CACHE;

async function buildPrecacheList() {
  try {
    const res = await fetch("/precache-manifest.json", { cache: "no-store" });
    if (!res.ok) throw new Error("no manifest");
    const manifest = await res.json();
    if (!manifest?.version || !Array.isArray(manifest.files))
      throw new Error("bad manifest");
    return {
      cacheName: `session-clock-${manifest.version}`,
      files: [...PRECACHE, ...manifest.files],
    };
  } catch {
    return { cacheName: FALLBACK_CACHE, files: PRECACHE };
  }
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    buildPrecacheList()
      .then(({ cacheName, files }) => {
        CACHE = cacheName;
        return caches.open(CACHE).then((c) => c.addAll(files));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    buildPrecacheList()
      .then(({ cacheName }) => {
        CACHE = cacheName;
        return caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
            ),
          );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Cache Storage entries are meant for GET/HEAD; never attempt to write
  // (or read stale writes for) anything else — POST/PUT OAuth token
  // exchanges and the like just go straight to network.
  if (req.method !== "GET") return; // not intercepted: browser handles it

  // Never cache a request carrying credentials — an Authorization header
  // (every one of this app's authenticated API calls) or a same-origin
  // request explicitly sent with cookies. Straight network passthrough.
  if (req.headers.has("Authorization")) return;

  if (url.origin !== location.origin) {
    if (!CACHEABLE_EXTERNAL_ORIGINS.has(url.hostname)) {
      // Not on the public-origin allowlist (Spotify/Google/Notion/GitHub/
      // Todoist API + accounts.* endpoints, etc.) — network-only, no
      // Cache Storage involvement at all.
      return; // not intercepted: plain network, errors stay the page's own
    }
    // Allowlisted public origin — network with cache fallback (offline
    // support for fonts/thumbnails/ambient audio/lyrics/weather), and
    // only cache genuinely successful, basic/cors (non-opaque) responses.
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok && (r.type === "basic" || r.type === "cors")) {
            const clone = r.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return r;
        })
        .catch(() => caches.match(req).then(orOffline)),
    );
    return;
  }

  // Same-origin navigation (the HTML shell itself) — network-first, cache
  // only as an offline fallback. This is what actually fixes SW1: a new
  // deploy is now visible on the very next reload instead of however long
  // it takes for something else to evict the old cached copy.
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const clone = r.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
          return r;
        })
        .catch(() =>
          caches
            .match(req, MATCH)
            .then((cached) => cached || caches.match("/index.html", MATCH))
            .then((cached) => cached || Response.error()),
        ),
    );
    return;
  }

  // Same-origin built assets (hashed JS/CSS/images, per Vite's
  // assetFileNames/chunkFileNames config) — safe to serve cache-first:
  // the hash in the filename means a stale cache entry and a "new
  // version" are never the same URL, so this can't reproduce SW1's
  // problem the way caching the unhashed HTML shell could.
  e.respondWith(
    caches.match(req, MATCH).then((cached) => {
      if (cached) {
        // Cache-first: refresh in the background, never let a failed
        // revalidation surface as an unhandled rejection.
        e.waitUntil(
          fetch(req)
            .then((r) => {
              if (r.ok)
                return caches.open(CACHE).then((c) => c.put(req, r.clone()));
            })
            .catch(() => {}),
        );
        return cached;
      }
      return fetch(req)
        .then((r) => {
          if (r.ok) caches.open(CACHE).then((c) => c.put(req, r.clone()));
          return r;
        })
        .catch(offlineResponse);
    }),
  );
});
