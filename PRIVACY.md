# Privacy Policy

**Last updated: 2026-08-28**

> This document is mirrored inside the app itself — Settings → Privacy → Legal → Privacy Policy (`src/legal.ts`). If you edit one, please update the other.

## The short version

Session Clock is a local-first app. Your session log, streaks, theme choices, sound presets, and every other setting are stored only in your browser's `localStorage`, on your own device. Nothing about how you use the app — what you time, when, or for how long — is sent to any server we run, tracked, or sold. There is no analytics script and no ad network anywhere in this app.

## What is stored, and where

Everything the app remembers about you lives entirely in your browser's `localStorage`. You can inspect exactly what is stored, its size, and delete any category (or all of it) at any time from **Settings → Privacy → View & Manage My Data**, or export it as a JSON file for your own records.

| Category | Contents |
|---|---|
| Focus Sessions | task names, durations, dates |
| Focus Intelligence | streak, velocity, Pomodoro counts |
| Preferences | theme, clock mode, quality, Pomodoro config |
| Audio | saved sound presets, spatial audio setting |
| Custom Themes | colours you've created |
| System | privacy flag, focus lock, breathing/sleep settings |

## Optional third-party connections

Some features are entirely opt-in and only activate if you explicitly connect them: Spotify (Now Playing + playback), YouTube/Google (Liked videos, playlists, Calendar), Notion, GitHub, Todoist, and Linear (side-task cards), and OpenStreetMap/Nominatim (city search for the weather pill). If you never connect these, no data is exchanged with them at all.

When you do connect one, authentication uses the provider's standard OAuth flow (PKCE where supported). For providers that require a client secret (Notion, GitHub, Todoist, Linear), the token exchange is relayed through a small, stateless Cloudflare Pages Function (`functions/api/oauth/token.ts`, `functions/api/notion/[[path]].ts`) that we run — it passes the exchange through and does not log, store, or retain your tokens or any response data. Access tokens themselves are then kept only in your browser's local storage, the same as everything else.

Enabling **Privacy Mode** in Settings disables weather lookups, time sync, and Google Fonts loading, so the app runs fully offline-capable with zero outbound requests beyond loading the app itself.

## Incognito sessions & auto-clear

Turning on **Incognito Sessions** keeps that session's data in memory only — it is never written to `localStorage` and disappears when the tab closes. **Auto-Clear on Close** wipes your focus log, streak, velocity, and Pomodoro-count data automatically when you close the tab, while keeping your preferences intact.

## Cookies & tracking

Session Clock does not use cookies, does not run any analytics or telemetry SDK, does not use fingerprinting, and does not share or sell data to anyone — because it does not collect any data centrally to begin with. The only network requests the app makes are:

- Loading the app itself and its assets
- The optional weather/city-search lookup
- Optional Google Fonts (skipped entirely in Privacy Mode)
- The optional third-party integrations described above, only after you connect them

## Children's privacy

Session Clock is a general-purpose productivity tool and is not directed at children. Because the app stores data only on the device it runs on and collects nothing centrally, we have no way to knowingly collect personal information from anyone, including children.

## Changes to this policy

If this policy changes, the updated version will be published here and in the in-app Legal panel, with a new "Last updated" date. Continued use of the app after a change means you accept the revised policy.

## Contact

Session Clock is an independent, open-source project. Questions or concerns about privacy can be raised as an [issue on the GitHub repository](https://github.com/ADJ189/Session-clock/issues).
