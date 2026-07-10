# Changelog

All notable changes to Session Clock are documented here.

## [8.1.0] — Current Stbale

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

### Fixed
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
- Service worker cache bumped so returning visitors pick up this update instead of a stale cached build.

---

## Earlier versions

Prior history (63-theme baseline, SvelteKit fork, weather module, CompressZ, 2xSpeed Studios site, etc.) predates this changelog.
