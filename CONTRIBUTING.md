# Contributing to Session Clock

Thanks for taking a look. Session Clock is a small, dependency-free
TypeScript/Vite app — there's no framework and no build magic, so most
changes are a straightforward edit-and-refresh loop.

## Setup

```bash
git clone https://github.com/ADJ189/Session-clock.git
cd Session-clock
npm install
npm run dev        # http://localhost:5173
```

Before opening a PR:

```bash
npm run typecheck  # tsc --noEmit
npm run build      # full production build
```

Both must pass clean. There's no test suite yet — see [Testing](#testing)
below if you'd like to help with that.

## Project layout

```
src/
  main.ts           entry point + most UI wiring (large, being split up — see below)
  platform.ts         OS/browser-engine detection, capability flags (vibration, Document PiP, device orientation), haptics helper
  renderer.ts        the 96 canvas theme renderers
  themes.ts           theme metadata (colours, names, categories)
  sound.ts            synthesized ambient audio engine
  integrations.ts     Spotify / YouTube / Google Calendar / Notion / Todoist / Linear / GitHub
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
`src/integrations.ts` for the storage model). Two patterns are used:

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

Google's in-app card is the one exception to "one app per deployment,
configured by whoever runs it": since it genuinely lets a visitor
register and use _their own_ Google Cloud project instead of the
site's, its "use your own app" form asks for both a Client ID **and**
Client Secret (Google's Web-application client type issues a secret —
there's no PKCE-only public-client option that still allows an
arbitrary HTTPS redirect URI). That secret is sent once, straight
through the same stateless proxy function, and otherwise lives only in
that visitor's own browser. Notion/GitHub/Todoist/Linear don't offer
this per-visitor option at all — their in-app forms always target
whatever single app this deployment has configured via step 2 above.

For local dev without Pages Functions running, use `npx wrangler pages
dev dist` instead of plain `vite preview` so `/api/*` routes resolve —
or just use the manual token-paste fallback on each integration card.

## Testing

There's currently no automated test suite. If you're interested in
adding one, a good first slice would be unit tests around
`src/integrations.ts` (the storage/obfuscation helpers and the PKCE
challenge/verifier functions are pure and easy to test in isolation)
before tackling anything DOM- or canvas-heavy.

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
