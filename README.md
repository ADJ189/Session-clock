<div align="center">

<img src="public/readme-banner.svg" width="900" alt="Session Clock — A cinematic focus timer. Every theme is a world." />

[![CI/CD](https://img.shields.io/github/actions/workflow/status/ADJ189/Accurate-Time-/deploy.yml?label=CI%2FCD&style=flat-square&logo=github)](https://github.com/ADJ189/Accurate-Time-/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero deps](https://img.shields.io/badge/runtime_deps-0-22c55e?style=flat-square)](package.json)
[![PWA](https://img.shields.io/badge/PWA-ready-8b5cf6?style=flat-square)](public/manifest.json)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue?style=flat-square)](LICENSE)
[![CodeQL](https://img.shields.io/badge/CodeQL-clean-16a34a?style=flat-square)](https://github.com/ADJ189/Accurate-Time-/security)

[**Open App →**](https://accurate-time.pages.dev/)&nbsp;&nbsp;·&nbsp;&nbsp;[**Wiki →**](https://github.com/ADJ189/Accurate-Time-/wiki)&nbsp;&nbsp;·&nbsp;&nbsp;[Issues](https://github.com/ADJ189/Accurate-Time-/issues)

</div>

---

Session Clock is a precision focus timer built on one idea: **the environment you work in shapes the quality of your work**. 96 animated canvas themes (each with its own bespoke intro transition), a synthesized ambient sound mixer with crossfade scenes, binaural audio, session intelligence, voice control, and Zen Mode — running entirely locally with zero backend.

| | |
|---|---|
| **Themes** | 96 animated, each with a custom intro — TV, film, animation, anime, F1, natural |
| **Sound Mixer** | 13 synthesized ambient tracks · crossfade scenes · night mode · live VU meter |
| **Now Playing** | Matches ~30 soundtracks against Spotify (or any player, manually) and switches theme |
| **Modes** | Pomodoro (fully custom cycles) · **Zen** · **Calm** · **Focus** · Kiosk · PiP · Voice |
| **Intelligence** | Streaks · Velocity · **Flow Intensity** · Configurable break reminders |
| **Always on Top** | Document PiP — mini clock floats over other apps |
| **Languages** | EN ES FR DE JA KO PT HI |
| **Privacy** | Zero backend · localStorage only · No tracking |

**[→ Full documentation on the Wiki](https://github.com/ADJ189/Accurate-Time-/wiki)** &nbsp;·&nbsp; **[→ Changelog](CHANGELOG.md)**

---

## Preview

> **Want to add a screenshot here?** Pick one of these options:

<!-- ── OPTION A: OG banner (SVG, already in repo, renders on GitHub) ── -->
<!-- Uncomment to use: -->
<!-- <img src="public/og-preview.svg" width="100%" alt="Session Clock preview" /> -->

<!-- ── OPTION B: Screenshot of the running app ──────────────────────── -->
<!-- 1. Run `npm run dev`                                                -->
<!-- 2. Open http://localhost:5173 in your browser                      -->
<!-- 3. Press `T` to pick your favourite theme                          -->
<!-- 4. Take a full-window screenshot (1280×800 recommended)            -->
<!-- 5. Save to docs/screenshot.png (create the docs/ folder first)     -->
<!-- 6. Replace the line below and uncomment it:                        -->
<!-- <img src="docs/screenshot.png" width="100%" alt="Session Clock — Forest theme" /> -->

<!-- ── OPTION C: Animated GIF / WebP (most impressive on GitHub) ────── -->
<!-- Tools: Kap (macOS), ScreenToGif (Windows), Peek (Linux)            -->
<!-- 1. Record 5–8 s: theme switching, timer running, Zen Mode          -->
<!-- 2. Export at 1280×800, ≤5 MB, 20 fps                              -->
<!-- 3. Save to docs/demo.gif                                            -->
<!-- 4. Uncomment the line below:                                        -->
<!-- <img src="docs/demo.gif" width="100%" alt="Session Clock demo" />  -->

<!-- ── OPTION D: Cloudflare / CDN hosted image ───────────────────────── -->
<!-- Upload your screenshot to Cloudflare Images, Imgur, or similar     -->
<!-- then replace the URL below:                                         -->
<!-- <img src="https://your-cdn.com/session-clock-preview.png" width="100%" alt="Session Clock" /> -->

*Choose one option above, uncomment it, and delete this block + the others.*

---

## What's New in 1.1 : 

- **33 new themes** across TV, film, anime, animation, F1, and ambient categories — Fargo, Twin Peaks, The Batman, Your Name, Studio Ghibli, Spider-Verse, Zen Garden, and more. Each has its own bespoke canvas intro transition, not a generic fade.
- **7 new ambient sounds** (Wind, Snowfall, Keyboard, Library, Spaceship, Campfire, Waves & Rocks) — synthesized entirely in-browser, no audio files.
- **Sound Mixer redesign**: live output meter, night mode, crossfade Scenes that blend your ambient mix as Pomodoro moves between focus and break.
- **Now Playing → Theme**: recognizes soundtracks from what's currently playing (Spotify, or type it in manually for any player) and switches the theme to match.
- **Custom Pomodoro cycles**, configurable break reminders, an opt-in idle nudge, Calm Mode, Focus Mode, and an always-on-top mini clock.
- Fixed theme picker icons not rendering, rain/fireplace sounds silently failing to autoplay, a dead "Smart Break Reminder" toggle, and a handful of memory leaks.

See [CHANGELOG.md](CHANGELOG.md) for the full list.

---

## Quick Start

```bash
git clone https://github.com/ADJ189/Accurate-Time-
cd Accurate-Time-
npm install && npm run dev       # localhost:5173
npm run typecheck                # strict TypeScript check
npm run build                    # production → dist/
```

Push to `main` → **Settings → Pages → GitHub Actions** to deploy. The included workflow handles `typecheck → build → deploy` automatically.

---

## Key Shortcuts

`Space` start/pause &nbsp;·&nbsp; `Z` Zen Mode &nbsp;·&nbsp; `T` next theme &nbsp;·&nbsp; `Ctrl+K` command palette &nbsp;·&nbsp; `Esc` exit

**[→ All shortcuts on the Wiki](https://github.com/ADJ189/Accurate-Time-/wiki/Keyboard-Shortcuts)**

---

## Secret Themes

🎮 **8-BIT** — `↑↑↓↓←→←→BA` &nbsp;·&nbsp; 🔥 **Phoenix** — 100 sessions &nbsp;·&nbsp; 🍳 **The Bear** — type `thebear`

**[→ All easter eggs on the Wiki](https://github.com/ADJ189/Accurate-Time-/wiki/Easter-Eggs)**

---

## Contributing

Bug reports and PRs are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md)
for setup, project layout, and how to configure OAuth for local dev.
Third-party fonts, APIs, and tooling are listed in [CREDITS.md](CREDITS.md).

## License

[AGPL-3.0](LICENSE) — free to use and fork; modifications must be open-sourced.

---

<div align="center">
<sub>25 modules · 0 runtime deps · 96 themes · 13 ambient sounds · 20+ easter eggs · 8 languages · Flow Intensity</sub>

---

Made with ❤️ by **ADJ189**

*"Focus is the art of knowing what to ignore."*
</div>
