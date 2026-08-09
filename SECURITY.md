# Security Policy

Session Clock runs entirely client-side — all state lives in `localStorage`
and there's no user database or authentication of its own. The only
server-side surface is two small Cloudflare Pages Functions used for OAuth
token exchange (`functions/api/oauth/token.ts` and
`functions/api/notion/[[path]].ts`, see [CONTRIBUTING.md](CONTRIBUTING.md)) —
they proxy a code exchange and never see or store your data.

## Supported Versions

Only the latest version deployed at the app's production URL and the `main`
branch are supported. There are no older maintained release branches.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security reports.

Instead, use GitHub's private vulnerability reporting for this repo:
[github.com/ADJ189/Session-clock/security/advisories/new](https://github.com/ADJ189/Session-clock/security/advisories/new).
If that's unavailable to you, open a normal issue asking for another
contact channel without describing the vulnerability itself.

Please include:
- Steps to reproduce, or a minimal PoC
- Which part of the app is affected (client-side code, or one of the two
  Pages Functions listed above)
- Impact as you understand it

You should get an initial acknowledgment within a few days. This is a
solo-maintained open-source project, so there's no formal SLA — but
security reports are treated as priority over regular feature work, and
you'll be credited in the fix's changelog entry unless you'd rather stay
anonymous.

This repo also runs CodeQL analysis on every push (see the badge in
[README.md](README.md)) as an automated first pass, not a replacement for
responsible disclosure.
