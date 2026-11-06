# AGENTS.md

Guidance for AI agents and contributors working in this repository.

## What this is

Session Clock is a local-first focus timer and clock. It is a TypeScript
app built with Vite and Svelte 5 runes components (Theme Finder, Settings,
Integrations, workspace surfaces) — with canvas/Web Audio for the animated
themes and ambient sound. All user data stays in `localStorage`; there is no
required account or backend data store.

Deployment target is Cloudflare Pages, with optional Pages Functions under
`functions/` for OAuth token exchange and a Notion API relay.

## Commands

Tooling runs on the installed Node.js/npm toolchain (Node 24+). `package.json`
declares `engines.node: ">=24"`; keep the README, CI workflow and Cloudflare
Pages build settings on the same minimum. `.npmrc` deliberately leaves
`engine-strict` off for Pages compatibility, so the declaration documents the
minimum rather than blocking installs.

```bash
npm run dev            # Vite dev server, http://localhost:5173
npm run typecheck      # tsc --noEmit
npm run typecheck:unit # typecheck the unit suite
npm run lint           # oxlint
npm run test:unit      # Node unit suite (tests-unit/)
npm run test:e2e       # Playwright, five browser projects
npm run build          # typecheck + production bundle
npm run preview        # serve dist/
```

`npm run build` runs `tsc --noEmit` first, so a type error fails the build.
Playwright suites are run with `npm run test:e2e:chromium`,
`npm run test:e2e:firefox`, `npm run test:e2e:webkit`, or
`npm run test:e2e:mobile`.

Deno is an optional local runner only. `deno.json` mirrors the same tasks
(`deno task test:unit`, `deno task build`, …); the app, build, and CI stay on
the installed Node/npm toolchain, and no npm script may require Deno. The Deno
tasks run the installed `node_modules/` entry points with
`"nodeModulesDir": "manual"`, so a Deno run never rewrites `node_modules/.bin`
or installs a second copy of a package.

## Layout

```
src/
  app/             Svelte 5 runes components (App, layout, settings, integrations, modals, shared)
  main.ts          entry point and boot orchestration
  features.ts      onboarding, status line, templates, countdown, world clock
  i18n.ts          8 locales (en, es, fr, de, ja, ko, pt, hi)
  themes.ts        theme metadata; renderer.ts holds the canvas renderers
  themelib.ts      Theme Finder controller (storage, filtering, cached card wall)
  musicdock.ts     opt-in YouTube/Spotify dock
  sound.ts         synthesized ambient audio engine
  pomodoro.ts      Pomodoro state machine
  integrations.ts  Spotify / YouTube / Google / Notion / GitHub / Todoist / Linear
  auth.ts          OAuth provider config, credentials, PKCE state, login + callback (no Svelte import)
  storage.ts       safeGet/safeSet/safeJson* wrappers for blocked storage
  platform.ts      engine/OS detection, haptics, capabilities
  privacy.ts       privacy/incognito/auto-clear + data export
  legal.ts         in-app privacy and terms content
functions/         Cloudflare Pages Functions (OAuth relay, Notion proxy)
public/            static assets, manifest, service worker, legal mirrors
tests/             Playwright specs and shared fixtures
tests-unit/        Node/Deno unit suite
style.css          single global stylesheet (large, sectioned)
index.html         static shell with #app-root
```

Prefer a new module for a self-contained feature instead of growing
`main.ts` or `style.css` further.

## Conventions

- Keep strict TypeScript. Do not add `any` when a real type is practical.
- Runtime dependencies are deliberately minimal. Discuss a new dependency
  before adding one.
- Svelte islands live under `src/app/components/` and use runes. Keep their
  controller logic in a plain module (see `themelib.ts`), preserve existing
  ids/classes/ARIA, and leave styling to `style.css` — no scoped styles.
- Match the existing dense, comment-when-non-obvious style.
- DOM is built with `document.createElement` / `textContent`. Avoid
  `innerHTML` with untrusted data (titles, lyrics, API responses); the existing
  code builds such nodes explicitly.
- CSS is organized by feature sections in `style.css`. Put new rules next to
  the feature they belong to, and avoid late duplicate overrides.
- User-facing copy belongs in `src/i18n.ts`, not hard-coded in render code.
  Add every new key to the `Strings` interface and all eight locale objects.
- **One clock per audio subsystem.** Anything scheduled on an `AudioContext`
  uses `ctx.currentTime`; never feed it a `requestAnimationFrame` timestamp.
  Spatial movement keeps a per-rig `startedAt` and one `phaseOffset`.
- **`src/auth.ts` must stay Svelte-free.** It holds the real OAuth callback
  path so `tests-unit/auth.test.ts` can import it. `integrations.ts` re-exports
  it; do not move logic back into a module that imports `.svelte` files.
- **Scheduler failures are per task.** Never count failures in a shared field
  or remove tasks from another rig. See `src/audio/scheduler.ts`.
- **Do not add configuration fields the graph never reads.** `SpatialProfile`
  used to declare `inputLayout` while nothing consumed it; it was removed in
  favour of the documented `PannerNode` channel-inheritance behaviour.

## Important behavior

- **Clock time is local-device time.** Do not add network time sync or claim
  the app is UTC-trusted. The top-bar pill is contextual app state (theme,
  focus phase, countdown), not a time-sync indicator.
- **Clock defaults are calm.** New visitors see `HH:MM` (seconds and
  milliseconds hidden). Only default when a storage key is absent; a saved
  value always wins. See `hideSeconds` / `hideMs` in `src/main.ts`.
- **Parallax has one mouse source.** `attachMouseParallax()` owns the
  `mousemove` listener and feeds `setTargetParallax()`; `attachGyroParallax()`
  adds orientation on top. Do not gate mouse movement on the presence of
  `DeviceOrientationEvent` — desktop browsers expose the API without sensor
  data, so a "gyro attached" flag alone would freeze desktop parallax.
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
- **Ambience drops missed events on purpose.** After background-tab throttling
  or a suspended context the scheduler skips stale events (bounded), then
  rebases its deadline to `now + interval`; it never replays minutes of birds
  or crackles. This is intentional — see section 5 of the pre-merge plan.
- **OAuth callbacks are terminal and self-cleaning.** A callback is only
  claimed when a pending `sc_oauth_state` exists or the returned state names a
  known provider. Every terminal path removes the one-shot query parameters
  and the stored verifier, so a refresh cannot redeem a stale code. Provider
  denials return `{ ok: false, cancelled: true }` and are shown, not swallowed.
- **The Svelte 5 UI migration is complete.** The entire UI structure is rendered via
  declarative Svelte 5 runes components (`App.svelte`, `AppHeader.svelte`,
  `MainWorkspace.svelte`, `QuickActionDock.svelte`, `CommandPalette.svelte`, and modal
  dialogs mounted into their respective overlays). `src/main.ts` is a lightweight entry point
  (< 100 lines) delegating to `src/app/bootstrap.ts` and dedicated controllers.
  Audio graphs, DSP, Pomodoro state machines, OAuth, and canvas renderers
  remain pure, framework-independent TypeScript modules with no Svelte imports.
- **Seeded randomness only covers procedural parameters.** `Rig`'s `RandomSource`
  reproduces selected generator choices (e.g. drop/wave parameters), not event
  timing (`Math.random()` in `scheduler.ts`) or noise sample data
  (`noise.ts` / `dsp.ts`). Do not claim bit-identical audio output from a seed.

## Testing

Playwright projects: `desktop-chromium`, `desktop-firefox`,
`desktop-webkit`, `mobile-chromium-emulation`, `mobile-webkit-emulation`.
WebKit is Playwright's build, not real Safari — report results per project,
never as "all browsers pass".

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
