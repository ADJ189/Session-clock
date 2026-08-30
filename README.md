# Session Clock · Music

Full player, not just a shell: playback, library, playlists, lyrics,
visualizer, PWA. Typechecked (`npm run typecheck`) and buildable
(`npm run build`) end to end. Not wired to a live audio source yet — see
"What's stubbed."

## What was borrowed, and from where

**LiMusic (`limusic-master`)** — the animatable-artwork-tint technique:
registering `--accent-h/-s/-l` as typed CSS `@property` values so the
browser's own compositor interpolates the color crossfade, instead of a
JS `requestAnimationFrame` loop rewriting root variables every frame.
Also borrowed the general shell shape (persistent now-playing bar,
slide-in side drawer, marquee for overflowing titles).

**Monochrome (`monochrome-main`)** — the restraint: near-black neutral
surfaces, one `cubic-bezier(0.2, 0, 0, 1)` easing curve and two duration
tokens reused on every transition instead of one-off values per
component, letting the sampled accent color be the one un-restrained
element.

Neither repo's YouTube-stream-handling code was used — see "What's
intentionally not here."

## Feature coverage

- **Playback**: play/pause, prev/next, seek (click-to-seek progress bar),
  ±10s skip, mute, playback speed (0.75×–2×), volume, shuffle
  (Fisher–Yates, anchors the currently-playing track), repeat
  (off/all/one), persistent queue (debounced writes to IndexedDB).
- **Discovery**: debounced, `AbortController`-cancelled search against the
  official YouTube Data API v3, with a follow-up batched `videos.list`
  call to fill in real durations. Recent searches are stored and shown as
  chips.
- **Library**: liked songs, playlists (create/rename/delete, add/remove
  track, via a lightweight prompt-based picker), listening history,
  "continue listening" (deduped, most-recent-first).
- **Lyrics**: paste-your-own LRC text, synced via Liricle, active-line
  highlighting, auto-scroll, click-to-seek. No third-party lyrics API is
  wired in — see `lyrics/provider.ts` for why.
- **Player experience**: mini-player mode, a queue/lyrics side drawer,
  keyboard shortcuts (space, ←/→ seek, N/P, M mute, S shuffle, R repeat,
  L like, Q queue, / search), Media Session integration (lock-screen/OS
  media controls, progressive enhancement -- no-ops where unsupported),
  a cinematic ambient canvas background behind the whole shell.
- **PWA**: manifest + service worker caching the app shell (HTML/CSS/JS)
  cache-first; explicitly never intercepts cross-origin requests
  (YouTube API, thumbnails, the IFrame player), so nothing about the music
  source itself is cached.

## Where the animation and workers actually earn their place

- `visual/colorbridge.ts` + `workers/artwork.worker.ts`: artwork decode
  and pixel sampling run entirely off the main thread. The registered
  custom properties mean the resulting color crossfade costs nothing on
  the main thread. Stale worker responses (from a track you've since
  skipped past) are discarded.
- `library/history.ts` + `workers/data.worker.ts`: the "continue
  listening" dedup only goes to a worker once history has enough rows
  (300+) that the postMessage round-trip is actually cheaper than a
  direct main-thread loop -- see the file's header comment for why that
  threshold exists instead of always using the worker.
- `player/analyser.ts`: a real Web Audio `AnalyserNode` reads actual
  frequency data for `audio-url` playback. For the YouTube IFrame
  backend, there's a hard browser boundary -- the iframe's audio lives in
  a separate, cross-origin browsing context that Web Audio has no access
  to. Rather than fake reactive data, that path uses a clearly-labeled
  ambient pulse (`isRealAudioData: false`) instead of pretending to
  analyze audio it can't see.
- `player/engine.ts`: queue-state writes are debounced (400ms); history
  is trimmed in batches past 2000 rows, not checked on every write.
- `ui/shell.ts`: search is debounced (300ms) with in-flight cancellation.
- `visual/canvas.ts`: the ambient canvas stops entirely when the tab is
  hidden and respects `prefers-reduced-motion` (bars go flat, particles
  stop, rather than quietly ignoring the setting).

## What's intentionally not here

`music/provider.ts` and `music/providers/youtube.ts` document this
directly: there's no code path that fetches or deciphers a raw/adaptive
YouTube stream URL. Search and metadata go through the official YouTube
Data API v3; playback resolves to an `'iframe'` source that mounts
YouTube's own official IFrame Player (video stays attached, per YouTube's
terms) -- same approach already used in Session Clock's `musicdock.ts`.

Lyrics are user-supplied rather than pulled from a third-party lyrics API
for the same underlying reason most "free" lyrics endpoints are
themselves unofficial/scraped services -- see `lyrics/provider.ts`.

## What's stubbed / next steps

- `getStoredYouTubeToken()` in `main.ts` reads a placeholder settings key.
  Wire it to Session Clock's existing `ensureFreshToken()` /
  `integrations.ts` OAuth flow.
- Search suggestions are local (your own recent searches), not a live
  YouTube suggest API -- that's a separate, undocumented endpoint with
  its own quota/ToS questions, kept out for the same reason as the
  stream-extraction layer.
- No album/artist pages yet -- search results and playlists are
  track-level only.
- `public/manifest.json` has no icons yet.

## Structure

```
src/
  core/types.ts                domain types
  music/provider.ts             MusicProvider interface
  music/providers/youtube.ts    the only provider implementation
  player/queue.ts                shuffle/repeat/remove, provider-agnostic
  player/backends.ts             AudioBackend + YouTubeIframeBackend
  player/engine.ts               orchestrates provider + queue + backend
  player/analyser.ts             real FFT (audio) / ambient fallback (iframe)
  player/media-session.ts        OS/lock-screen media controls
  library/likes.ts, playlists.ts, history.ts
  lyrics/provider.ts, sync.ts    user-supplied LRC + Liricle sync
  storage/db.ts                   Dexie/IndexedDB schema
  visual/colorbridge.ts           drives the animated accent color
  visual/canvas.ts                ambient cinematic background
  workers/artwork.worker.ts       off-thread dominant-color extraction
  workers/data.worker.ts          off-thread history dedup (large lists only)
  ui/shell.ts, keyboard.ts        DOM, views, wiring, shortcuts
public/
  manifest.json, sw.js            PWA shell caching
```
