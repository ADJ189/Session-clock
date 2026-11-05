# Contributing to Session Clock

Thanks for taking a look. Session Clock is a TypeScript/Vite app. Most of
the UI is hand-wired DOM, with Svelte 5 components for self-contained
surfaces (Theme Finder, Settings panels, the Quick Action Dock, and the
Integrations panel). The migration is **hybrid, not finished** — see
[Project layout](#project-layout). There's no build magic, so most changes
are a straightforward edit-and-refresh loop.

## Setup

```bash
git clone https://github.com/ADJ189/Session-clock.git
cd Session-clock
npm ci             # Node 24+; reproducible install from package-lock.json
npm run dev        # http://localhost:5173
```

Node 24 or newer is required — `package.json` declares `engines.node: ">=24"`
and CI installs Node 24. Use `npm ci` rather than `npm install` when you want
exactly the reviewed lockfile (Vite 6.4.5, Svelte 5.57, oxlint 1.89).

Before opening a PR:

```bash
npm run typecheck       # tsc --noEmit (app + unit tests)
npm run typecheck:unit  # same program, kept as an explicit CI step
npm run test:unit       # Node unit suite
npm run build           # full production build
```

All four must pass clean. See [Testing](#testing) below for the browser
suites.

## Project layout

```
src/
  main.ts           entry point + most UI wiring (large, being split up — see below)
  app/components/   Svelte 5 islands: theme-finder/; controllers live in plain modules (themelib.ts for the gallery)
  app/settings/     Settings tab bar + five panels, mounted from main.ts
  app/layout/       QuickActionDock.svelte (mounted); AppHeader.svelte is scaffold only
  app/integrations/ IntegrationsPanel.svelte (mounted from integrations.ts)
  platform.ts         OS/browser-engine detection, capability flags (vibration, Document PiP, device orientation), haptics helper
  renderer.ts        the 96 canvas theme renderers
  themes.ts           theme metadata (colours, names, categories)
  sound.ts            synthesized ambient audio engine
  integrations.ts     Spotify / YouTube / Google Calendar / Notion / Todoist / Linear / GitHub
  auth.ts             OAuth provider config, credential storage, PKCE state, login + callback — no Svelte import, so it is unit-testable
  pomodoro.ts, features.ts, intelligence.ts, i18n.ts, ...
functions/
  api/oauth/token.ts   Cloudflare Pages Function — OAuth code-exchange proxy
  api/notion/[[path]].ts  same-origin relay for the Notion API (no CORS otherwise)
public/                static assets, icons, manifest
```

`main.ts` is intentionally the "everything else" file. If you're adding a
sizeable, self-contained feature, prefer a new module over growing
`main.ts` further — that's the single biggest thing that would make this
codebase easier to work in.

### Svelte migration status

This is a **hybrid** app, not a finished Svelte migration. Mounted islands:
Theme Finder (`src/app/components/theme-finder/`), the Settings dialog
(`src/app/settings/`), the Quick Action Dock (`src/app/layout/QuickActionDock.svelte`),
and the Integrations panel (`src/app/integrations/IntegrationsPanel.svelte`).

`src/app/App.svelte`, `src/app/clock/`, `src/app/session/`, `src/app/layout/AppHeader.svelte`,
`src/app/layout/MainWorkspace.svelte`, `src/app/modals/CommandPalette.svelte`, and
`src/app/integrations/IntegrationsDialog.svelte` are unused scaffolds. Do not
delete the working imperative UI, or claim the migration is complete, just
because those files exist. Wire a component into the real entry point and test
it before calling it migrated. Several components still hard-code English copy;
route new user-visible strings through `src/i18n.ts`.

## Code style

- No new runtime dependencies without discussion first — the zero-deps
  badge in the README is a deliberate constraint, not an accident.
- `strict` TypeScript is on. Keep it that way; don't add `any` where a
  real type is easy.
- Match the existing minimal-comment, dense style in files like
  `integrations.ts` rather than introducing a different convention per file.
- Run `npx tsc --noEmit` before pushing — CI will fail the build otherwise.

## Setting up integrations for local development

Every integration is opt-in and stores tokens client-side only (see
`src/auth.ts` for the credential/storage model; `src/integrations.ts` adds the
provider-specific UI and API calls). Two patterns are used:

**Public client (no secret, works from any deployment):**

- **Spotify** — Authorization Code + PKCE. Create an app at
  [developer.spotify.com](https://developer.spotify.com/dashboard),
  add `http://localhost:5173/` (dev) and your production URL as
  Redirect URIs, and paste the Client ID into the app's Integrations
  panel. No further setup needed.

**Confidential client (needs a secret — requires the proxy function):**
Notion, GitHub, Todoist, Linear, and Google only issue OAuth apps with
a client secret. That secret can never ship to the browser, so the code
exchange goes through `functions/api/oauth/token.ts`, a small
Cloudflare Pages Function that's part of this repo and deploys
automatically alongside the static site (see `wrangler.jsonc`). To
enable one of these providers:

1. Register an OAuth app with the provider (see the in-app setup text
   for each card, which lists the exact page and required redirect URI).
   For Google specifically: [console.cloud.google.com](https://console.cloud.google.com/apis/credentials)
   → **Create Credentials → OAuth client ID → Web application**, then
   under **Authorized redirect URIs** add both:
   - `http://localhost:5173/` (dev)
   - your production URL, exactly as shown live in the app's
     Settings → Integrations → YouTube/Calendar card (same value the
     other providers' cards show — this app always uses
     `origin + pathname` as the redirect URI for every provider, so
     dev and prod need separate Client IDs registered with their own
     matching redirect URI, same as every other provider here).
     Also enable the **YouTube Data API v3** and **Google Calendar API**
     for the project under APIs & Services → Library — the OAuth consent
     screen won't let you request their scopes otherwise.
2. Set the Client ID and secret as Pages secrets:
   ```bash
   npx wrangler pages secret put NOTION_CLIENT_ID
   npx wrangler pages secret put NOTION_CLIENT_SECRET
   # same pattern for GITHUB_, TODOIST_, LINEAR_, GOOGLE_
   ```
3. Redeploy. A provider with no secret configured returns a clear
   "not configured" error and the app falls back to its manual
   token-paste option, so nothing breaks if you skip this.

Google's in-app card asks for a Client ID the same way Spotify's does,
but it is **not** a "bring your own app" option the way Spotify's is —
it only works with the Client ID this deployment already has
configured via step 2 above (that field exists for pasting/confirming
that ID, e.g. after clearing localStorage). Spotify's public PKCE
client needs no secret, so the browser can talk to Spotify's token
endpoint directly with whatever Client ID a visitor pastes; Google's
Web-application client type is confidential (it issues a secret), so a
different Client ID would need its own matching secret to complete the
exchange. An earlier version of this form collected that secret from
the visitor and stored it in localStorage to make "bring your own app"
work for Google too — CodeQL flagged that as clear-text storage of
sensitive data, correctly: unlike a leaked access/refresh token (which
only exposes one user's session, and is revocable), a leaked OAuth
client secret can impersonate the whole app. That field was removed
rather than mitigated. Notion/GitHub/Todoist/Linear were never affected
by this — their in-app forms always targeted the deployment's single
configured app already.

For local dev without Pages Functions running, use `npx wrangler pages
dev dist` instead of plain `vite preview` so `/api/*` routes resolve —
or just use the manual token-paste fallback on each integration card.

## Testing

The unit suite uses Node's built-in test runner against the TypeScript
sources, with hand-written Web Audio and DOM mocks under `tests-unit/`:

```bash
npm run test:unit
```

Browser coverage uses Playwright. The first run needs a browser download:

```bash
npm run e2e:install
npm run test:e2e:chromium   # full desktop Blink gate
npm run test:e2e            # all five projects
```

Projects are `desktop-chromium`, `desktop-firefox`, `desktop-webkit`,
`mobile-chromium-emulation`, and `mobile-webkit-emulation`. WebKit here is
Playwright's build, not real Safari, so report results per project.

Deno is optional and never required by the app, the build, or CI. If you
prefer it locally, `deno.json` mirrors the same commands (`deno task
test:unit`, `deno task test:e2e`, `deno task build`, …) and runs the same
npm-installed tooling. The npm scripts remain the canonical entry points.

The Deno tasks invoke the entry points under `node_modules/` directly, with
`"nodeModulesDir": "manual"`, so a Deno run never rewrites `node_modules/.bin`
or adds a second copy of a package. Mixing the two runners therefore cannot
break the npm scripts.

## Reporting bugs / requesting features

Open an issue with steps to reproduce (bugs) or the use case you're
trying to solve (features). For anything touching the audio engine or
theme renderers, a screen recording is worth a thousand words.

## Security

Please see [SECURITY.md](SECURITY.md) for how to report vulnerabilities
— don't open a public issue for anything sensitive.

## License

Session Clock is licensed under AGPL-3.0 (see [LICENSE](LICENSE)).
Contributions are accepted under the same license.
