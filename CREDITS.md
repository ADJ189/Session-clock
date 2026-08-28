# Credits

Session Clock is built with a single small runtime dependency (see
`package.json`) — all 101 canvas themes, the sound engine, and the UI
are original code. The pieces below are the third-party services,
libraries, and assets it talks to or draws on at build/runtime.

## Fonts

Loaded from [Google Fonts](https://fonts.google.com), each under the
[SIL Open Font License](https://scripts.sil.org/OFL):

Inter · Cinzel · Orbitron · Comfortaa · Josefin Sans · Fraunces ·
Bebas Neue · Playfair Display · Special Elite · Nunito · IM Fell English ·
Teko · Lora · Press Start 2P

## Animation

- **[anime.js](https://animejs.com)** (MIT License) — powers a small
  set of micro-interactions (`src/motion.ts`): the elastic "pop" when
  a theme is selected, the settings-panel row stagger, and the toast
  entrance. Lazy-loaded on first use so it never sits in the
  critical-path bundle.

## Data & APIs (used only when you opt in)

- **[Open-Meteo](https://open-meteo.com)** — weather data for the
  Weather page. Free, no API key, no attribution required by their
  terms, credited here anyway.
- **[OpenStreetMap Nominatim](https://nominatim.openstreetmap.org)** —
  city search and reverse geocoding for the Weather page, under the
  [ODbL](https://www.openstreetmap.org/copyright).
- **Spotify Web API, Google (YouTube Data API v3 + Calendar API),
  Notion API, Todoist REST API, Linear API, GitHub REST API** — each
  used only after you explicitly connect that integration in Settings
  → Integrations, and each governed by its own provider's terms of
  service.

## Build tooling

- [Vite](https://vitejs.dev) — build tool and dev server
- [TypeScript](https://www.typescriptlang.org) — language / type checking
- [Cloudflare Pages](https://pages.cloudflare.com) — hosting and the
  small serverless functions under `functions/api/`

## Design

The hourglass wordmark, all 101 theme renderers, the sound synthesis
engine, and the overall visual design are original work by
[@ADJ189](https://github.com/ADJ189).

---

If you're a maintainer of something used here and would like a credit
adjusted (name, link, wording), please open an issue or PR — happy to fix it.

