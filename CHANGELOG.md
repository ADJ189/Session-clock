# Changelog

All notable changes to Session Clock are documented here.

## [1.1.0] — What's new in this version

### Added
- **Music dock**: a floating widget next to the clock with real in-page Spotify playback via the official Web Playback SDK (Premium required) — play/pause/skip/scrub actually control audio in the tab, not just a remote device.
- **Pop-out dock**: click the ⧉ icon to pop the dock into a real OS-level window via Document Picture-in-Picture (same API the mini clock already uses), so it stays visible above other windows/tabs.
- **Auto-sync with focus sessions**: optional 🔁 toggle on the dock — when on, Spotify playback auto-resumes when a focus session starts and pauses on break/stop.
- **YouTube tab**: paste a YouTube video or playlist URL into the dock's YouTube tab to play it via YouTube's official IFrame Player API, docked at a small fixed size (kept visible per YouTube's own terms — no audio-only/hidden playback).
- **Focus sidebar task cards**: compact GitHub (issues/PRs), Notion (tasks), Todoist (tasks), and Calendar (upcoming events) cards next to the music dock, built on the existing integrations data layer — nothing new is fetched, just new compact UI for data you're already pulling in.

## [1.0] — 

### Added
- **33 new themes** (96 total, up from 63): Fargo, Mad Men, True Detective, Chernobyl, Andor, Twin Peaks, Grand Budapest Hotel, No Country for Old Men, Drive, Se7en, Whiplash, The Batman, John Wick, Cowboy Bebop, Ghost in the Shell, Your Name, Studio Ghibli, Vinland Saga, Jujutsu Kaisen, Gravity Falls, Adventure Time, Spider-Verse, Williams Racing, Alpine F1 Team, Racing Bulls, Deep Bioluminescence, Zen Garden, Coffee Shop Rain, Vinyl Warmth, Midnight Library, Greenhouse, Lava Lamp, Northern Cabin.
- **23 new cinematic transitions** to go with them (snowfall + blood drop for Fargo, red curtains for Twin Peaks, bat-signal sweep for The Batman, halftone comic burst for Spider-Verse, and 19 more), reusing existing transitions where one was already a perfect fit (Andor → hyperspace warp, Studio Ghibli → sakura petals, Northern Cabin → blizzard, etc.).
- **7 new ambient sound tracks**: Wind, Snowfall, Keyboard, Library, Spaceship, Campfire, Waves & Rocks — fully synthesized in-browser (no audio files), all correctly routed through the per-track volume slider.
- **Sound Mixer redesign**: live output VU meter, night mode (auto 9pm–6am or manual), glowing/pulsing active-track indicators, glass panel styling.
- **Crossfade Scenes**: save your current ambient mix as a "Focus" or "Break" scene; optionally auto-crossfades between them (2.5s) as Pomodoro switches phases, instead of a hard cut.
- **Now Playing → Theme**: matches ~30 known soundtracks/shows against the currently playing track (via the existing Spotify integration, or a manual "what's playing" box that works with any player) and switches the theme to match. Toggle in Settings → Sound.
- **Custom Pomodoro cycles**: free numeric input for work/break/long-break minutes (previously fixed presets only), plus long-break-duration presets that had no UI before.
- **Break reminders**: configurable interval (30/45/60/90/120 min), now actually shows a toast + notification.
- **Idle Nudge**: optional, off by default — a "still there?" toast after 15 minutes of no input. Never pauses or alters the timer.
- **Calm Mode**: one toggle that reduces motion, disables parallax, and lowers render quality together.
- **Focus Mode**: header and dock fade out after a few idle seconds, back on any input.
- **Always-on-top mini clock** via Document Picture-in-Picture (Chrome 116+).
- Session/focus-block completion now triggers the existing milestone confetti + motivation widget.
- **Splash screen** on load: your bunny artwork (background removed, cropped, served as a cached PNG) at a much bigger size, with a gentle float animation and a "loading" dot sequence. Held for a short minimum (~0.9s) so it reads as intentional rather than a flash, hard-capped at 1.5s no matter how long loading actually takes.
- **Weather pill** now shows a proper scalable outline cloud icon (was a plain-text `☁` glyph that rendered inconsistently across platforms) as its default/placeholder state; real condition icons still swap in once weather data loads.
- **Support card**: hovering the weather pill (after a short hover-intent delay) shows a small card with GitHub avatar, a "Star on GitHub" link, and a short message.
- **Location picker now opens automatically** the first time you open the weather page with no location set, instead of leaving you on an empty hero section — no more hunting for the "Set location" button.
- **Weather fetch retry + clear failure state**: a single transient network blip now retries once automatically instead of immediately showing "unavailable"; if it genuinely fails, the weather page shows a distinct "tap to retry" state instead of an indefinite "Fetching weather…".
- **Weather-adaptive theme effects**: sunny/clear now gets a warm drifting glow and cloudy gets soft drifting cloud-shadow patches (previously only rain/snow/thunder/fog had an ambient effect). Thunderstorms now get an actual bright double-flash "strike" instead of just an ambient purple pulse.

### Fixed
- **Weather showing "unavailable" after every location change.** `setManualLocation()` was only persisting `{ name }` to storage — the actual coordinates were silently dropped. Any reload, or even just reopening the weather page right after picking a location, read back `undefined` lat/lon, fetched `NaN, NaN` from the API, and failed every time. Now persists the coordinates too (rounded to ~11km precision, so it's still not storing an exact GPS fix in clear text).
- Weather overlay effects (rain/snow/thunder/fog, and the two new ones above) now respect `prefers-reduced-motion` — they never did before.
- **Location permission prompt firing on startup.** `initWeather()` called `navigator.geolocation.getCurrentPosition()` automatically on every page load if no location was stored yet, popping the browser's native permission dialog before the user had asked for weather at all. It now only uses a location the user explicitly set via the weather page's "Use GPS" button or city search; the pill shows a neutral "Set location" prompt instead until then.
- Deduplicated the reverse-geocoding request — `weatherpage.ts`'s GPS button had its own inline copy of the Nominatim fetch instead of reusing `weather.ts`'s `getCityName()`.
- Unreachable dead code in `getStoredLocation()` (a legacy-coordinate fallback sitting after an unconditional `return`, so it could never run).
- **Theme picker icons weren't rendering.** `DOMParser` requires an explicit `xmlns="http://www.w3.org/2000/svg"` on the root `<svg>` to assign it the SVG namespace — without it the element parses "successfully" but silently fails to render once appended to the page. Confirmed via a live namespace check; fixed by injecting the attribute if missing.
- **Rain and fireplace sounds silently failed to play.** Both are auto-started via `setTimeout` when the "Common Room" theme loads, which browsers don't treat as a user gesture — so the `AudioContext` stayed permanently suspended. Fixed by priming the context on the very first real interaction with the page.
- **"Smart Break Reminder" toggle did nothing.** The setting was saved but never actually read anywhere.
- Memory leak in the theme color-picker (window drag listeners stacked up on every swatch click, uncapped).
- Animedoro break timer drifted in backgrounded tabs (`setInterval` is throttled there); now computed from a fixed end-timestamp.
- `renderFrame` wrote to the DOM on every single frame even when the displayed value hadn't changed.
- Dangling `setTimeout` leak in the fetch-timeout helper used by weather and time-sync requests (fired even after a successful request).
- Vite now minifies with `esbuild` instead of `terser` — build time down from ~12s to ~2s.
- Google Fonts now load via `preload` + swap instead of a render-blocking stylesheet.
- Removed 3 accidental duplicate themes (Blade Runner 2049, 2001: A Space Odyssey, House of the Dragon all already existed under different IDs).

### Changed
- Service worker cache bumped to v4 (and the splash image added to its precache list) so returning visitors pick up this update instead of a stale cached build.
- Splash artwork moved from an inline base64 PNG back to a normal cached file (`/splash-bunny.png`). Base64-inlining briefly seemed like a win for first paint, but it forces the browser to re-download the image as part of the HTML on *every* visit — bad tradeoff for a PWA people reopen daily. `index.html` dropped from 116KB back to ~25KB; the image itself is now cached by the service worker like any other asset.

### Security
- **XSS via city search results.** The weather page's city-search dropdown inserted Nominatim API results (`name`, `state`, `country`) directly into `innerHTML`. That's untrusted external data — a malicious or spoofed response could have injected arbitrary HTML/script. Rebuilt with `textContent`-based DOM construction instead.
- `npm audit`: fixed a high-severity path-traversal advisory in a transitive `postcss` build dependency (`npm audit` now reports 0 vulnerabilities). Build-tool only — never shipped to users.

---

## Earlier versions [0.1 - 0.9]

- 63-theme baseline, SvelteKit fork, weather module . 
- Initial svelte config , re written to typescript . 
