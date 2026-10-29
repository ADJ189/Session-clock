# AGENTS.md

Guidance for AI agents and contributors working in this repository.

## What this is

Session Clock is a local-first focus timer and clock. It is a vanilla
TypeScript app built with Vite — no React, Vue, or other UI framework — with
canvas/Web Audio for the animated themes and ambient sound. All user data stays
in `localStorage`; there is no required account or backend data store.

Deployment target is Cloudflare Pages, with optional Pages Functions under
`functions/` for OAuth token exchange and a Notion API relay.

## Commands

Node.js and npm are required (the repo is developed against Node 20+).

```bash
npm install
npm run dev           # Vite dev server, http://localhost:5173
npm run typecheck     # tsc --noEmit
npm run lint          # oxlint
npm run typecheck:e2e # tests/tsconfig.json
npm run build         # typecheck + production bundle
npm run test:e2e      # Playwright, five browser projects
npm run preview       # serve dist/
```

`npm run build` runs `tsc --noEmit` first, so a type error fails the build.

## Layout

```
src/
  main.ts          entry point and most UI wiring (large; split new features out)
  features.ts      onboarding, status line, templates, countdown, world clock
  i18n.ts          8 locales (en, es, fr, de, ja, ko, pt, hi)
  themes.ts        theme metadata; renderer.ts holds the canvas renderers
  themelib.ts      Theme Library (search, favourites, recents)
  musicdock.ts     opt-in YouTube/Spotify dock
  sound.ts         synthesized ambient audio engine
  pomodoro.ts      Pomodoro state machine
  integrations.ts  Spotify / YouTube / Google / Notion / GitHub / Todoist / Linear
  storage.ts       safeGet/safeSet/safeJson* wrappers for blocked storage
  platform.ts      engine/OS detection, haptics, capabilities
  privacy.ts       privacy/incognito/auto-clear + data export
  legal.ts         in-app privacy and terms content
functions/         Cloudflare Pages Functions (OAuth relay, Notion proxy)
public/            static assets, manifest, service worker, legal mirrors
tests/             Playwright specs and shared fixtures
style.css          single global stylesheet (large, sectioned)
index.html         static shell; most UI is built/wired by main.ts
```

Prefer a new module for a self-contained feature instead of growing
`main.ts` or `style.css` further.

## Conventions

- Keep strict TypeScript. Do not add `any` when a real type is practical.
- Runtime dependencies are deliberately minimal. Discuss a new dependency
  before adding one.
- Match the existing dense, comment-when-non-obvious style.
- DOM is built with `document.createElement` / `textContent`. Avoid
  `innerHTML` with untrusted data (titles, lyrics, API responses); the existing
  code builds such nodes explicitly.
- CSS is organized by feature sections in `style.css`. Put new rules next to
  the feature they belong to, and avoid late duplicate overrides.
- User-facing copy belongs in `src/i18n.ts`, not hard-coded in render code.
  Add every new key to the `Strings` interface and all eight locale objects.

## Important behavior

- **Clock time is local-device time.** Do not add network time sync or claim
  the app is UTC-trusted. The top-bar pill is contextual app state (theme,
  focus phase, countdown), not a time-sync indicator.
- **Clock defaults are calm.** New visitors see `HH:MM` (seconds and
  milliseconds hidden). Only default when a storage key is absent; a saved
  value always wins. See `hideSeconds` / `hideMs` in `src/main.ts`.
- **PWA install is native-only.** There is no in-app Install button. Keep
  `public/manifest.json` and `public/sw.js` working; browsers expose their own
  install affordance.
- **Music is opt-in.** `sc_music_deck` must be `"1"` before `mountDock()`
  renders anything. `sc_music_providers` defaults to `youtube`; Spotify UI and
  the Spotify SDK must only initialize when the user selects Spotify/Both.
- **Center mode** (`Clock Position → Centre`) uses a compact fixed right-hand
  session panel. The Pomodoro ring is decorative there and is hidden rather
  than scaled, because scaling the wrapper also shrinks the timer. Narrow
  screens move the card to the bottom-right above the dock.
- **Center-mode layout** is covered by `tests/redesign.spec.ts`; update that
  test if the panel geometry changes. On the desktop sidebar the Start action
  owns a full-width row; do not shrink it back into a 77px cell, which clips
  longer labels.
- **Narrow top bar.** Below 520px the weather control collapses to an
  icon-only button; below 380px the GitHub link and keyboard-shortcut trigger
  are hidden. Keep the contextual status tab visible — it is the mobile
  fallback for local app state. Header overlap is covered by the same redesign
  spec at nine widths.

## Testing

Playwright projects: `chromium`, `firefox`, `webkit`, `mobile-chrome`
(Pixel 7), `mobile-safari` (iPhone 13). WebKit is Playwright's build, not real
Safari — report results per project, never as "all browsers pass".

`tests/fixtures.ts`:
- aborts third-party requests so tests do not depend on network uptime
- pre-seeds `sc_onboarded_v2` unless `test.use({ firstRun: true })`
- collects page errors, same-origin failed requests, and console errors

Use `waitForBoot(page)` after `page.goto("/")`. For Settings panels, use
`closeThemePanel(page)` before interacting with controls underneath.

Add a spec for any new user-visible flow or layout constraint. Screenshots can
be attached with `testInfo.outputPath(...)`; avoid snapshot baselines unless
the team agrees to maintain them.

## Docs to keep in sync

- `PRIVACY.md`, `src/legal.ts`, and `public/privacy/index.html` mirror the
  same privacy text. Update all three together.
- `TERMS.md` and `public/terms/index.html` mirror `src/legal.ts` terms.
- `README.md` / `CHANGELOG.md` should not describe removed features (for
  example, in-app install or network time sync).

## Security notes

- Never ship a client secret. Confidential OAuth exchanges go through
  `functions/api/oauth/token.ts`.
- Tokens live in `localStorage`, protected by the existing obfuscation and
  privacy controls. Do not log tokens.
- Treat API responses (titles, artwork URLs, lyrics) as untrusted. Validate
  and use `textContent` / property assignment, not HTML interpolation.
