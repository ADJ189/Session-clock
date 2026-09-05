# Changelog

All notable changes to Session Clock are documented here.

> **Versioning note (starting this release):** version numbers are now a
> plain two-decimal `x.xx`, bumped by **+0.05** for a larger update (new
> features, redesigns, multiple significant changes bundled together) and
> **+0.01** for a minor patch or small fix. `1.71` (previously `1.7.1`) →
> `1.76` below is the first release under this scheme, since this update
> bundles several larger changes together.

## [1.76] — Redesigned intro screen, 24-hour time, spacious/animated Themes tab, 2 new themes, cross-browser hardening

### Added
- **Redesigned splash/intro screen** — replaced the static icon + bouncing dots with a calmer, more Apple-like entrance: a soft pulsing ambient glow behind the mark, the mark itself mounted on a frosted "app card" with a spring pop-in, and a slim indeterminate progress line instead of dots. The dismissal is now animated too — `Motion.splashExit()` (`src/motion.ts`) eases the mark up and out while the whole screen softly scales and blurs away, using the app's existing lazy-loaded anime.js — with the original plain CSS opacity fade kept as the fallback if anime.js fails to load or Reduce Motion is on.
- **24-Hour Time** — new Settings → Digits toggle and command-palette entry. Applies to Digital, Minimal, Flip, and Segment clock styles (the Analogue face stays 12-hour, since that's how an analogue dial reads; Terminal already always showed 24-hour and is unaffected).
- **2 new themes** (101 → 103): **Lanterns** (HBO/DC) — a faceted power-ring symbol that pulses like an oath recharging, plus a dedicated `ringcharge` intro transition (a green ring contracting inward through a construct lattice); **YOU** — a small, restrained watching-eye motif with a slow drifting gaze, plus a quiet `whisperfade` iris-close intro transition, deliberately understated to match the show's tone.
- **Cross-browser/engine hardening** (`src/platform.ts`) — real browser detection (Safari/Chrome/Edge/Samsung Internet/Opera/Firefox) alongside the existing OS/engine detection, plus genuine feature probes (`CSS.supports` checks for `backdrop-filter` and `100dvh`, not UA-sniffing) so fallbacks are based on what a browser can actually do. Added a **Settings → Compatibility** panel showing a live OS/engine/browser/feature summary, plus a manual "Force Simplified Surfaces" override for anyone whose device technically supports blur but renders it slowly.
- Global `-webkit-tap-highlight-color: transparent` and `touch-action: manipulation` on buttons/toggles/sliders/cards — removes the grey tap-flash and the ~300ms double-tap-zoom delay some mobile browsers (Safari, Samsung Internet) still apply by default.
- A solid-background fallback (`html.no-backdrop-filter` / `html.force-no-backdrop-filter`) for the topbar, modals, theme panel, command palette, feature dock, and side cards, for the rare engine with no `backdrop-filter` support at all.

### Changed
- **Themes tab** — more spacious layout across both the natural-swatch grid and the TV/Movie/Anime/F1 media-card grids (bigger gaps, padding, and swatch/card size), springier hover and press transforms with real `:active` states for touch, a subtle logo-scale on card hover, and a staggered anime.js pop-in (`Motion.staggerIn`) when switching tabs.
- Theme-count references across `README.md`, `index.html`, `public/manifest.json`, and `CREDITS.md` updated from 101 to 103.

### Verification
`tsc --noEmit`, `oxlint .`, and `vite build` — see repo for current results. No visual/browser testing was possible in this environment — worth checking the new splash animation timing, the Lanterns/YOU theme renders, the 24-hour toggle across each clock style, and the Compatibility panel's detected values before shipping.

## [1.7.1] — anime.js star-burst for the GitHub celebration, DeepSource cleanup

### Added
- **anime.js GitHub star-celebration** (`src/motion.ts`, `githubCelebration()`) — fires alongside the existing canvas confetti when the topbar GitHub link is clicked, not replacing it: the avatar ring now draws itself in with a stroke-dashoffset sweep, and 12 small star shapes (reusing the "Star on GitHub" button's own SVG path) burst outward from the avatar and fade — themed around "starring" rather than generic confetti.
- Every `Motion` export (`popIn`, `staggerIn`, `bounceIn`, `githubCelebration`) now checks the app's own Reduce Motion setting and the OS `prefers-reduced-motion` before running — previously these new animations had no reduced-motion gate at all.
- `.deepsource.toml` — enables the JavaScript (TypeScript dialect) and Secrets analyzers explicitly, excludes `dist/`, `node_modules/`, `.wrangler/`, and documents (for future maintainers) which of DeepSource's findings are false positives vs. real.

### Fixed (DeepSource findings)
- `src/apis.ts` — replaced 4 `any` casts with real ambient types for the Battery Status, Document Picture-in-Picture, and iOS `DeviceMotionEvent.requestPermission` APIs (new `src/webapi.d.ts`); removed a non-null assertion on `canvas.getContext('2d')!` with a real null check; fixed an unused `catch (e)` binding; commented the two genuinely-empty `catch {}` blocks.
- `src/cmdpalette.ts` — removed an unused `Theme` import and an unused `modal` variable; replaced 4 non-null-assertion DOM lookups with a `must()` helper that throws a clear error instead of silently trusting `!`.
- `functions/api/oauth/token.ts` — removed the last `any`, changed a string concatenation to a template literal, and split the 14-branch handler into `parseBody`/`resolveCredentials`/`buildTokenParams`/`buildHeaders` to bring cyclomatic complexity down.
- The 2 "hardcoded credential" Secrets findings (`sc_google_client_id`, `sc_sound_presets`) are false positives — both are localStorage key *names*, not credential values. Left as-is in code; documented in `.deepsource.toml` for dismissal from the dashboard.
- The remaining ~1900 JS-0067 ("function declaration in global scope") / JS-C1002 ("variable name too small") findings are a rule/architecture mismatch, not real bugs — this project is `"type": "module"`, so top-level functions are already module-scoped. Left as-is rather than restructuring ~90 files into IIFEs for a purely cosmetic change; documented the rationale in `.deepsource.toml`.

### Verification
`tsc --noEmit` and `vite build` both pass. `oxlint .` warnings went from 147 → 144 (no new warnings introduced, some overlapped with the fixes above). No visual/browser testing was possible in this environment — worth a quick click on the GitHub topbar link to confirm the star-burst looks right before shipping.

## [1.7.0] — Privacy Policy & Terms of Service, anime.js micro-interactions, 5 new themes

### Added
- **Privacy Policy & Terms of Service** — added as a new "Legal" section in Settings → Privacy (`src/legal.ts`, new `legalOverlay` modal), and mirrored as [`PRIVACY.md`](PRIVACY.md) and [`TERMS.md`](TERMS.md) at the repo root. Content is generated from the app's actual data-handling code (`src/privacy.ts`'s `DATA_CATEGORIES`, the OAuth relay functions) rather than boilerplate, so it accurately reflects that everything is stored in `localStorage`, no analytics run anywhere, and the only server-side code is a stateless OAuth token-exchange proxy that logs nothing.
- **anime.js micro-interactions** (`src/motion.ts`, new dependency: [anime.js](https://animejs.com) v4) — dynamically imported on first use so it never sits in the critical-path bundle. Three touches: an elastic "pop" when a theme swatch/card is selected, a staggered fade+rise when a Settings pane or the new Legal modal is rebuilt, and a spring entrance for toast notifications. Layered on top of the app's existing CSS spring transitions, not replacing them.
- **5 new themes** (96 → 101): Hannibal, Slow Horses, The Boys, Ted Lasso, For All Mankind — each with its own dedicated canvas renderer (`src/renderer.ts` DRAW + SYMBOLS entries), not the generic particle fallback.

### Changed
- Theme-count references across `README.md`, `index.html`, and `public/manifest.json` updated from 96 to 101.
- `CREDITS.md` updated to reflect the new anime.js dependency and 101 themes.

### Verification
`tsc --noEmit`, `oxlint .` (147 warnings, same pre-existing baseline, 0 errors), `vite build` all pass, and anime.js confirmed to land in its own lazy-loaded chunk rather than the main bundle. No visual/browser testing was possible in this environment — worth checking the new themes render correctly, the pop/stagger/bounce animations feel right, and the Legal modal reads well before shipping.

## [1.6.1] — Spotify connect button was missing, minimizable Integrations dialog, real playlist/queue support

The Spotify pane in the music dock had static "Not connected" text but no actual button to connect with — a real gap, now fixed — plus two follow-ups: the Integrations dialog can now be minimized instead of only closed, and YouTube's Liked Videos (which has no real playlist ID) now supports next/prev through a local queue instead of silently doing nothing.

### Added
- **Connect Spotify button** — the dock's Spotify pane now shows a real "Connect Spotify" button when not connected (using the one-click default-app flow from `src/authconfig.ts`, falling back to a manual Client ID prompt), and swaps to the live player automatically once connected.
- **Minimizable Integrations dialog** — a new minimize (–) button collapses the dialog to a small pill docked bottom-right instead of only closing it; click the pill to restore. Useful since connecting Spotify/Google briefly navigates away and back.
- **Local playback queue for Liked Videos** (`ytQueue` in `musicdock.ts`) — YouTube has no shareable playlist ID for "Liked videos," so next/prev previously did nothing there. Clicking into Liked videos now starts a local queue that next/prev advance through (wrapping at either end), while real playlists keep using YouTube's own native playlist navigation, which is more robust when a real playlist ID exists.

### Fixed
- **Spotify Playback SDK never initialized after connecting** — `initSpotifyPlayback()` was only called once at page load, before the OAuth redirect's token had landed, so the SDK device silently never came up until the user manually reloaded. Now called again right after the OAuth callback resolves.
- **YouTube player rebuilt from scratch on every click** — `mountYouTubePlayer` now reuses the existing player instance (`loadVideoById`/`loadPlaylist`) when one exists instead of tearing down and recreating the iframe, so switching tracks/playlists is instant with no blank-player flash.

### Verification
`tsc --noEmit`, `oxlint .` (147 warnings, same pre-existing count, 0 errors), `vite build` all pass. No visual/browser testing was possible in this environment — worth a click-through of connect → play → next/prev on both tabs, and the minimize/restore pill, before shipping.

## [1.6.0] — Synced lyrics, OS media controls, one-click music sign-in, real README screenshot

Looked at two desktop YouTube Music clients (Limusic, Zuno — both Rust/Tauri apps) for ideas worth borrowing for the music dock. Their actual playback approach — pulling raw audio via YouTube's internal, non-public API and decoding it with mpv/ffmpeg — is deliberately **not** replicated here: this project is a static site with no server process to run mpv/ffmpeg against, and doing it "for real" means extracting streams in a way that's outside YouTube's terms, which the existing YouTube integration (official read-only Data API + required-visible IFrame player, see the comment at the top of `musicdock.ts`) was already built to avoid. Everything else genuinely useful about those two apps — synced lyrics, OS-level media key/lock-screen integration, a collapsible mini player, and low-friction sign-in — carries over below, built entirely on public web APIs.

### Added
- **Synced lyrics** (`src/lyrics.ts`) — a 🎤 button on both the Spotify and YouTube tabs looks up line-synced lyrics via [LRCLIB](https://lrclib.net), the same free public lyrics database Limusic/Zuno use, matched on title + artist + duration to avoid grabbing the wrong cut of a song. The active line highlights and auto-scrolls in time with playback (polled from the Spotify SDK's position for Spotify, from the YouTube IFrame API's `getCurrentTime()` for YouTube). Falls back to plain unsynced lyrics, or a "not found" message, with results cached per track for the session.
- **OS-level media controls** via the [MediaSession API](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession) — lock-screen/notification now-playing info (title, artist, artwork) and hardware/Bluetooth media keys (play, pause, next, previous, seek) now work for both the Spotify and YouTube tabs, the browser-native equivalent of the MPRIS/SMTC integration native apps like Limusic/Zuno get from mpv.
- **Collapsible mini-player capsule** — a new ▸ button shrinks the dock down to just album art (Zuno's "morphing capsule" mini player, redone in plain CSS); hover or focus to expand it back out. State persists across reloads.
- **One-click music sign-in** (`src/authconfig.ts`) — if you register your own Spotify app and Google OAuth client and drop their (public, non-secret) Client IDs into `src/authconfig.ts`, visitors to your deployed site get a real "Connect with Spotify" / "Connect Google" button with zero setup of their own. Leave a field blank and that integration quietly falls back to the existing "paste your own Client ID" form — a collapsed "use your own app instead ▾" link keeps that option available either way, so self-hosters aren't locked out.
- **Real UI screenshot in the README** (`public/preview.png`) — replaces the SVG mockup that sat below the banner with an actual screenshot of the app.

### Verification
`tsc --noEmit`, `oxlint .` (147 warnings, same pre-existing count, 0 errors), `vite build` all pass. LRCLIB and MediaSession calls are try/caught and degrade silently (no lyrics found / API unsupported), so neither feature can break existing playback. No visual/browser testing was possible in this environment — worth a quick look at the lyrics panel timing and the capsule hover transition before shipping.

## [1.5.0] — Minimal Centre mode, GitHub star/support celebration, removed the sync pill

### Added
- **Minimal Session Panel (Centre mode)** — when Clock Position is set to Centre, the session timer now shrinks and docks to the side (bottom-right on narrow screens) instead of stacking under the clock, and the day-progress bar + quote hide, so the clock stays the obvious focal point. New Settings → Display → **Minimal Session Panel** toggle (on by default) lets you keep the old full-stacked layout in Centre mode if you'd rather have it.
- **GitHub star/support celebration** — clicking the GitHub icon in the top bar now shows a small colourful animated card (avatar with a spinning accent ring, gradient title, confetti via the existing Easter-egg confetti function) with **Star on GitHub** and **Support the project** buttons before opening GitHub, plus a plain "Just take me to GitHub →" link for anyone who'd rather skip it. Closes on Escape, backdrop click, or the × — it's a moment, not a wall.
  - ⚠️ **Needs your input:** the Support button currently points to `https://github.com/sponsors/ADJ189` as a placeholder — swap it for wherever you actually want support to go (GitHub Sponsors once set up, Ko-fi, Buy Me a Coffee, etc.) in `index.html` (`#ghBtnDonate`).

### Removed
- **The sync status pill** ("Syncing…" / "Synced · ±Xms" / "Local clock") — removed per request. The underlying sync-trust logic it fed is untouched (the UTC pill in the top bar still reflects NTP vs local-clock trust), and the "time for a break" pulse hint that used to flash on this pill now flashes on the session status line instead, so that feature still works with the pill gone.

### Verification
`tsc --noEmit`, `oxlint .` (147 warnings, same pre-existing count, 0 errors), `vite build` all pass. No visual/browser testing was possible in this environment — worth a quick look at Centre mode and the GitHub card before shipping.

## [1.4.2] — Every theme now has its own background: 35 themes were silently falling back to generic particles

A full theme-by-theme audit, prompted by a direct ask to check every theme's rendering, intro, and settings against each other. The finding: of 96 themes, **35 had no dedicated background renderer wired up** — they compiled fine and worked, but silently fell back to the generic drifting-particle background (`drawParticles`) instead of the bespoke scene/symbol treatment every other theme gets. This was verified mechanically (cross-referencing every theme's `bgType` against the `DRAW` dispatch table in `renderer.ts`, not by eyeballing), so it's a solid finding, not a guess.

Two things were already correct and NOT part of the gap, worth calling out because they could easily have been assumed broken too:
- **Every theme already had a bespoke intro `transition`** (the animation that plays when you switch to it) — only `8bit` and `smpte` didn't, both now fixed (`glitch` and `flash` respectively, both reusing existing transition code).
- **Two of the 35 "missing" themes weren't actually missing** — `8bit` and `smpte` (SMPTE Timeline) each already had a real, unused renderer function sitting in the file (`draw8Bit`, and a genuinely sophisticated `drawSMPTE` that draws your actual focus-log clips onto a broadcast-style timeline), just never wired into the dispatch table. Found and wired those up instead of duplicating them.

### Added — background renderers for 35 themes
- **3 F1 team liveries** (Alpine, Racing Bulls, Williams) — extended the existing `drawF1Bg`/`drawF1Symbol` team-fns pattern used by the other 5 F1 themes, using each team's own accent colors.
- **20 movie/TV/anime themes** (Andor, Chernobyl, Cowboy Bebop, Drive, Fargo, Ghost in the Shell, Grand Budapest Hotel, Gravity Falls, Jujutsu Kaisen, John Wick, Mad Men, No Country for Old Men, Se7en, Spider-Verse, The Batman, True Detective, Twin Peaks, Vinland Saga, Whiplash, Your Name, Adventure Time) — each now gets `drawMediaBg` (the same subtle accent vignette every other cinematic theme uses) plus a new bespoke `SYMBOLS` entry: a small animated motif specific to that title (e.g. a sweeping bat-signal beam for The Batman, a slow spiral for True Detective, halftone comic dots for Spider-Verse, falling snow + a blood-red dot for Fargo).
- **11 atmosphere-only themes** (8-BIT — wired to the existing renderer, Deep Bioluminescence, Northern Cabin, Coffee Shop Rain, Studio Ghibli, Greenhouse, Lava Lamp, Midnight Library, SMPTE Timeline — wired to the existing renderer, Vinyl Warmth, Zen Garden) — new standalone scene functions matching their name (drifting glow motes, falling snow with a warm window glow, rain on glass, rising lava blobs, raked zen-garden sand lines, spinning vinyl grooves, etc.), following the same lightweight canvas patterns already used by Aurora/Forest/Ocean/Midnight.

### Verified while auditing (confirmed correct, no change needed)
- `THEME_CATEGORIES` (nat/tv/movie/f1/anime/animation) — all 96 themes use a valid category, none orphaned.
- The `grain`/`scanlines`/`lb` (letterbox)/`hdr` per-theme flags are all consistently read and applied in `main.ts` for every theme, regardless of category.
- No other pre-built-but-unwired functions exist elsewhere in `renderer.ts` (checked systematically, not just for the two found above).

### Verification
`tsc --noEmit`, `oxlint .` (147 warnings, same pre-existing count, 0 errors), and `vite build` all pass. Bundle grew ~2.2 kB gzip for 34 genuinely new render functions — expected, and small. **Note:** this environment can't render a browser canvas, so every new function was checked for correctness the way the rest of the file was (types, structure, reused proven helpers/gradient patterns) but not visually screenshotted — worth a quick look through the theme picker after pulling this in, in case any motif needs a color or timing tweak.

## [1.4.1] — Full codebase audit: dead-code removal, verified clean build

A maintenance pass — no user-facing feature changes. `tsc --noEmit`, `oxlint .`, and `vite build` all run clean before and after.

### Removed
- **24 confirmed-dead exported functions/values**, deleted after a repo-wide reference check (grep across every `.ts` file, `functions/`, `public/`, and `index.html` confirmed zero call sites outside the declaration): `palette.ts` (`addCommand`), `features.ts` (`buildEmptyState`), `sound.ts` (`adaptOnWorkNearEnd`, `currentId`, `setVolume`), `weather.ts` (`getCurrentLocation`), `integrations.ts` (`spotifyTogglePlay`, `spotifySearchFocusPlaylists`, `spotifyPlayPlaylist`, `youtubeSearchFocusPlaylists`, `completeTodoistTask`, `getLinearIssues`), `apis.ts` (`updateMediaSessionTrack`, `shareCard`, `copyCardToClipboard`, `getBatteryLevel`, `isOnBattery`), `renderer.ts` (`isBreathing`), `cmdpalette.ts` (`addItems`), `sidetasks.ts` (`stopSideStack`), `musicdock.ts` (`isConnected`, `getState`), `privacy.ts` (`getMemoryLog`, `pushMemoryLog`). These were superseded internal implementations left exported after earlier refactors (e.g. `spotifyTogglePlay`/`spotifyPlayPlaylist` predate the current `musicdock.ts` playback path, which calls the Web Playback SDK transport directly).

### Verified (no change needed)
- **Bundle size**: Rollup was already tree-shaking the 24 dead exports out of the production bundle (423.78 kB → 423.69 kB gzip-compressed JS, effectively a wash) — the value here is source-level, not bytes-on-the-wire.
- **iOS/Android touch handling**: the custom-theme gradient/hue color pickers use `touch-action: none` in CSS rather than a non-passive `touchmove` + `preventDefault()`, which is the more efficient pattern (avoids blocking the compositor thread on scroll) — confirmed this is intentional, not a bug.
- **PWA/mobile meta tags**: `viewport-fit=cover`, `apple-mobile-web-app-*` tags, `100dvh` with a `100vh` fallback, and per-platform capability flags (`platform.ts`) are all already in place and correct.
- **No leftover `console.log`/`console.debug`, no stray `TODO`/`FIXME` beyond one pre-existing tracked item.**

### Known backlog (flagged, not changed this pass — see below)
- `main.ts` statically imports every feature module (`cmdpalette`, `easter`, `integrations`, `musicdock`, `sidetasks`, `weatherpage`, etc.), so all ~4,200 lines of it plus its dependents ship in one 423 kB (124 kB gzip) chunk, versus `qr`/`share`/`litclock` which are already lazily `import()`-ed. Several of these (`easter`, `weatherpage`) are read from inside the boot/tick path, so splitting them safely means restructuring init order, not just adding `import()` — left as a follow-up rather than risking a blind refactor of the app's entry point without a browser to test against.
- No `Content-Security-Policy` is set (`public/_headers` has the other standard security headers — `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP — but not CSP). Given how many external origins this app legitimately talks to (Spotify Web Playback SDK, YouTube IFrame API, Google Identity Services, the Notion/GitHub/Todoist/Linear OAuth proxy, Nominatim, weather API), a CSP needs to be built against a real enumerated allow-list and tested live rather than guessed at.
- `oxlint` still reports 147 pre-existing warnings (mostly `no-unused-vars`/`no-new-array`, intentionally downgraded from error in `.oxlintrc.json` per an earlier decision — see that file's comments) — unchanged this pass, left as incremental cleanup.

## [1.4.0] — Head-tracked spatial audio, 4 new ambient sounds, sound-engine fixes

### Added
- **Head Tracking** (Settings → Sound → Head Tracking, shown only on devices with a gyroscope): turning your phone shifts the ambient soundstage the opposite way, so sources stay anchored in place as you turn toward or away from them — the same illusion behind AirPods-style spatial audio head tracking. Built on the existing ILD+ITD 3D Spatial Audio panning engine, driven by live device-orientation samples through the same shared gyroscope subscription `platform.ts` already uses for background parallax (no duplicate permission prompt, no duplicate listener).
- **4 new ambient tracks**, bringing the mixer to 17: **White Noise** (flat full-spectrum hiss), **Pink Noise** (−3dB/octave, softer and more natural than white), **Rain on Roof** (heavier, more percussive than the existing window Rain — resonant peak simulating a hard overhead surface, plus stronger gust swells), and **Airplane Cabin** (steady low engine drone + pressurization hiss — deliberately almost motionless, since real cabin noise's constancy is what makes it effective as a masking sound).
- Every track — including the 4 new ones — already had its own volume slider in the mixer; see **Fixed** below for two tracks where that slider was silently being ignored.

### Fixed
- **Forest's bird chirps and Fireplace's crackle ignored their own volume slider.** Both were wired directly to the output analyser instead of through their track's own gain node — so dragging either slider down did nothing to those specific layers (wind/rustle in Forest, and the fire's base roar, both worked correctly; only the birds and the crackle bursts were affected), and neither layer responded to 3D Spatial Audio panning either. Both now route through their track's normal mix bus like every other sound, so per-track volume and spatial panning apply correctly across the board.
- **Gyroscope-driven effects (parallax, and now head-tracked audio) share one orientation listener** instead of each attaching its own — a small correctness/perf cleanup alongside the audio work above, and the reason head tracking needed no separate iOS permission flow.

### Changed
- De-duplicated the pink-noise generation algorithm (Paul Kellett's IIR approximation), previously copy-pasted identically into both the Forest and Wind generators, into one shared helper — also now reused by the new standalone Pink Noise track.

## [1.3.0] — Platform-aware optimizations, mobile header fix, repo rename

### Added
- **Platform/browser detection engine** (`src/platform.ts`): detects OS (iOS, iPadOS, Android, macOS, Windows, Linux) and rendering engine (WebKit, Blink, Gecko) once at boot, and exposes real capability flags — Vibration API support, Document Picture-in-Picture support, and whether `DeviceOrientationEvent` needs an explicit permission prompt (iOS 13+) — instead of assuming a feature exists just because the browser is a certain brand.
- **Haptic Feedback** setting (Settings → Motion & Animations): a short vibration on Pomodoro work-start and work-complete. Only ever shown/offered on devices that actually support the Vibration API (Android Chrome/Firefox) — hidden entirely elsewhere rather than shown as a dead toggle, since no browser on iOS (all WebKit, by Apple's platform rule) implements it.
- **Document Picture-in-Picture buttons now hidden on unsupported browsers** instead of being tappable dead buttons — affects the music dock's pop-out (⧉) button on Firefox and Safari/iOS, which don't implement the Chromium-only Document PiP API. (The mini-clock's own "Always on Top" pop-out was already conditionally rendered and needed no change.)

### Fixed
- **Gyroscope-based parallax silently never worked on iPhone/iPad.** The code attached a `deviceorientation` listener directly on load, but iOS 13+ requires that permission be requested from inside a user gesture — since that never happened, the browser never granted it and the listener simply never fired. The Parallax toggle in Settings now requests motion permission at the moment it's switched on (a real tap, satisfying iOS's requirement), and only attaches the gyroscope listener once granted; mouse-based parallax is unaffected and still works everywhere.
- **Mobile header was overflowing/overlapping on phones.** The top bar (Themes button, weather pill, rotating info strip, UTC clock, clock-position toggle, GitHub/search/keyboard-shortcut icons) was laid out for a wide desktop row and had no real mobile treatment — on an iPhone-width viewport it visibly overlapped itself. A themed tagline badge (e.g. "☕ The owls are not what they seem." for Twin Peaks) is also absolutely centred over the header, which made things worse on narrow screens where the flex clusters reach much closer to centre. Below 600px width: the info strip, UTC clock, and clock-position toggle are now hidden (the last two are redundant with Settings → Display, which already has its own clock-position and hide-seconds controls); the tagline badge renders as its own slim strip just under the header instead of overlapping it; and the keyboard-shortcuts button plus the "⌘K" text label are hidden on any touch device, since both assume a physical keyboard that isn't there.

### Changed
- **Repository moved** from `ADJ189/Accurate-Time-` to [`ADJ189/Session-clock`](https://github.com/ADJ189/Session-clock) — updated every reference across `README.md`, `CONTRIBUTING.md`, and the in-app GitHub/star links.
- **README** now has an actual preview screenshot instead of a "pick an option" placeholder, and its version numbering follows this changelog (previously README/`package.json` used one number and this file used another, with neither kept in sync).
- **SECURITY.md**, previously an unfilled GitHub template, now describes the app's actual (client-side-only, two small OAuth-proxy Functions) security model and points to GitHub's private vulnerability reporting.

## [1.2.0] — Logo fix, per-style clock scaling, hide seconds/ms

### Added
- **Hide Seconds / Hide Milliseconds**: two independent toggles in Settings → Display. Hiding seconds drops the seconds digits (or the analogue second hand / the last segment-clock group / the Sec flip card) across every clock style and re-centers the remaining hour/minute display at a larger size. Hiding milliseconds just drops the fractional-second readout under the digital clock.
- **Per-clock-style center mode**: "Clock Position" (Top/Centre) is no longer one global setting — each clock style (Digital, Analogue, Flip, Word, Minimal, Segment) now remembers its own preference. Existing single-value settings are migrated automatically on first load.
- **Larger, sharper clock scaling in center mode**: Analogue and Segment clocks are canvas-based and previously had a hard-coded small size cap regardless of screen size (Analogue: 340px, Segment: 520×110) — they now scale meaningfully larger in center mode and render at devicePixelRatio for crisp digits/hands instead of a slightly blurry fixed-size canvas. Flip, Word, and Minimal clocks previously only grew in center mode via generic layout CSS; they now have their own dedicated center-mode scale-up (previously only the digital clock's font actually got bigger when centered).
- **New animated splash intro**, built the same way as the CompressF/CompressZ splash: independent icon pop-in and wordmark pop-in timings, then a 0.4s fade. Uses the new hourglass logo, with the inner sand-triangle isolated into its own layer so it spins continuously while the app's sources are still loading, then eases to a smooth stop exactly when loading finishes (rather than being cut off mid-turn or spinning on a fixed timer unrelated to actual load time).
- **New app logo/icons**: replaced `logo.png`, `icon-192.png`, and `icon-512.png` with a properly centered, evenly padded version of the mark. The previous asset had the artwork sitting off-center in a mostly-blank canvas, which is what caused it to look shifted/oddly scaled wherever it was cropped or masked (browser tab, home-screen icon, app switcher, etc).

### Changed
- **Install button moved to bottom-left.** It used to appear bottom-right and sit directly on top of the music dock / side-task cards (Spotify, YouTube, GitHub, etc.), hiding them the moment it showed up. The dock stays bottom-right as before; the install prompt no longer competes with it for the same corner.

### Removed
- **Token Shop remnants.** An early version of Session Clock had a Token Shop (earn tokens from focus sessions, spend them on cosmetic items/equipped items). The shop's actual logic was removed in a previous pass, but dead leftovers remained: the shop modal markup in `index.html`, its dedicated CSS block and unused keyframes, the "Token Shop" entry under Settings → Manage Privacy, and an unused `shop` i18n string across every supported language. All of it has been removed; a stray "check the shop!" toast on the 100-session Phoenix-theme unlock now points at Clock Style settings instead.

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
- background audio .
- Initial svelte config , re written to typescript .
- Cloudflare pages hosted.
- Deploy to github , but replaced with cloudflare pages .
- f1 , movies ,tv show themes implementations.
- integration of spotify , youtube , google notes , todolist , notion .
- 
- "Forgot to LOG everything before". ( too invested in the project ) .
  
