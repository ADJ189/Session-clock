# Session Clock · Music — Phase 1 scaffold

UI shell + player core + storage layer, buildable and typechecked
(`npm run typecheck`, `npm run build`). Not wired to a live audio source
yet — see "What's stubbed" below.

## What was borrowed, and from where

**LiMusic (`limusic-master`)** — the animatable-artwork-tint technique:
registering `--art-h` etc. as typed CSS `@property` values so the browser's
own compositor interpolates a color crossfade, instead of a JS
`requestAnimationFrame` loop rewriting root variables 60x/second. Reused
here as `--accent-h/-s/-l` in `style.css`, feeding the now-playing bar's
background wash. Also borrowed the general shell shape (persistent
now-playing bar, slide-in queue drawer, marquee for overflowing titles).

**Monochrome (`monochrome-main`)** — the restraint: near-black neutral
surfaces, a single `--duration-fast`/`--duration-normal` + one
`cubic-bezier(0.2, 0, 0, 1)` easing curve reused on every transition rather
than one-off durations per component, and letting color be the only
un-restrained element. `modern.css` was the reference for that token
discipline.

Neither repo's YouTube-stream-handling code (LiMusic's `innertube` crate)
was used — see "What's intentionally not here."

## Where the animation and worker actually earn their place

- `visual/colorbridge.ts` + `workers/artwork.worker.ts`: artwork decode and
  pixel sampling run entirely off the main thread (`OffscreenCanvas` +
  `createImageBitmap` inside the worker). The result is written to three
  registered custom properties, so the color crossfade itself costs nothing
  on the main thread — no per-frame JS. A stale/slow worker response from a
  track you've since skipped past is discarded (`latestRequestId` guard).
- `player/engine.ts`: queue-state writes to IndexedDB are debounced
  (400ms) rather than firing on every shuffle/repeat/skip — a skip-happy
  user doesn't spam the DB.
- `storage/db.ts`: play history is trimmed in batches once it crosses
  2000 rows, not checked/deleted on every single write.
- `ui/shell.ts`: search is debounced (300ms) and cancels the in-flight
  request via `AbortController` on every new keystroke, so a slow older
  response can never overwrite a newer one.

## What's intentionally not here

`music/provider.ts` and `music/providers/youtube.ts` document this
directly: there's no code path that fetches or deciphers a raw/adaptive
YouTube stream URL. Search and metadata go through the official YouTube
Data API v3; playback resolves to an `'iframe'` source that mounts
YouTube's own official IFrame Player (video stays attached, per YouTube's
terms) — same approach already used in Session Clock's `musicdock.ts`.

## What's stubbed / next steps

- `getStoredYouTubeToken()` in `main.ts` reads a placeholder settings key.
  Wire it to Session Clock's existing `ensureFreshToken()` /
  `integrations.ts` OAuth flow.
- `YouTubeProvider.search()` doesn't yet do the follow-up `videos.list`
  call needed to fill in real durations.
- No PWA/manifest/service-worker layer yet — this phase is UI shell +
  player core + storage only, per the earlier scoping.

## Structure

```
src/
  core/types.ts            domain types (Track, Album, Playlist, ...)
  music/provider.ts         MusicProvider interface
  music/providers/youtube.ts  the only provider implementation
  player/queue.ts            shuffle/repeat, provider-agnostic
  player/backends.ts         AudioBackend + YouTubeIframeBackend
  player/engine.ts           orchestrates provider + queue + backend
  storage/db.ts               Dexie/IndexedDB schema
  visual/colorbridge.ts       drives the animated accent color
  workers/artwork.worker.ts   off-thread dominant-color extraction
  ui/shell.ts                 DOM + wiring
```
