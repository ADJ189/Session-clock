// ── Legal content (Privacy Policy / Terms of Service) ──────────────────
// Rendered inside the Settings → Privacy → Legal modal. Kept as
// structured data (rather than raw HTML) so it can be built into
// plain DOM nodes without any innerHTML/XSS surface, matching the
// approach used elsewhere in this app (see the weather city-search fix).
//
// This content is mirrored in /PRIVACY.md and /TERMS.md at the repo
// root, and as standalone static pages at /public/privacy/index.html and
// /public/terms/index.html (served at yourdomain.com/privacy/ and
// /terms/ — needed for Google OAuth consent-screen verification, which
// requires a plain public URL rather than content gated behind app JS).
// If you edit this file, regenerate those two static pages to match —
// they are plain HTML mirrors of this same data, not auto-built from it.

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  sections: LegalSection[];
}

const UPDATED = '2026-08-28';

export const LEGAL_DOCS: Record<'privacy' | 'terms', LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    updated: UPDATED,
    sections: [
      {
        heading: 'The short version',
        paragraphs: [
          'Session Clock is a local-first app. Your session log, streaks, theme choices, sound presets, and every other setting are stored only in your browser\'s localStorage, on your own device. Nothing about how you use the app — what you time, when, or for how long — is sent to any server we run, tracked, or sold. There is no analytics script and no ad network anywhere in this app.',
        ],
      },
      {
        heading: 'What is stored, and where',
        paragraphs: [
          'Everything the app remembers about you — focus sessions, streaks and velocity scores, theme and Pomodoro preferences, sound-mixer presets, custom themes, and the Privacy/Incognito/Auto-clear flags themselves — lives entirely in your browser\'s localStorage. You can inspect exactly what is stored, its size, and delete any category (or all of it) at any time from Settings → Privacy → View & Manage My Data, or export it as a JSON file for your own records.',
        ],
        bullets: [
          'Focus Sessions — task names, durations, dates',
          'Focus Intelligence — streak, velocity, Pomodoro counts',
          'Preferences — theme, clock mode, quality, Pomodoro config',
          'Audio — saved sound presets, spatial audio setting',
          'Custom Themes — colours you\'ve created',
          'System — privacy flag, focus lock, breathing/sleep settings',
        ],
      },
      {
        heading: 'Optional third-party connections',
        paragraphs: [
          'Some features are entirely opt-in and only activate if you explicitly connect them: Spotify (Now Playing + playback), YouTube/Google (Liked videos, playlists, Calendar), Notion, GitHub, Todoist, and Linear (side-task cards), and OpenStreetMap/Nominatim (city search for the weather pill). If you never connect these, no data is exchanged with them at all.',
          'When you do connect one, authentication uses the provider\'s standard OAuth flow (PKCE where supported). For providers that require a client secret (Notion, GitHub, Todoist, Linear), the token exchange is relayed through a small, stateless Cloudflare Pages Function that we run — it passes the exchange through and does not log, store, or retain your tokens or any response data. Access tokens themselves are then kept only in your browser\'s local storage, the same as everything else.',
          'Enabling "Privacy Mode" in Settings disables weather lookups, time sync, and Google Fonts loading, so the app runs fully offline-capable with zero outbound requests beyond loading the app itself.',
        ],
      },
      {
        heading: 'Incognito sessions & auto-clear',
        paragraphs: [
          'Turning on Incognito Sessions keeps that session\'s data in memory only — it is never written to localStorage and disappears when the tab closes. Auto-Clear on Close wipes your focus log, streak, velocity, and Pomodoro-count data automatically when you close the tab, while keeping your preferences intact.',
        ],
      },
      {
        heading: 'Cookies & tracking',
        paragraphs: [
          'Session Clock does not use cookies, does not run any analytics or telemetry SDK, does not use fingerprinting, and does not share or sell data to anyone — because it does not collect any data centrally to begin with. The only network requests the app makes are: loading the app itself and its assets, the optional weather/city-search lookup, optional Google Fonts (skipped entirely in Privacy Mode), and the optional third-party integrations described above, only after you connect them.',
        ],
      },
      {
        heading: 'Children\'s privacy',
        paragraphs: [
          'Session Clock is a general-purpose productivity tool and is not directed at children. Because the app stores data only on the device it runs on and collects nothing centrally, we have no way to knowingly collect personal information from anyone, including children.',
        ],
      },
      {
        heading: 'Changes to this policy',
        paragraphs: [
          'If this policy changes, the updated version will be published here and in PRIVACY.md in the project repository, with a new "Last updated" date. Continued use of the app after a change means you accept the revised policy.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [
          'Session Clock is an independent, open-source project. Questions or concerns about privacy can be raised as an issue on the GitHub repository.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    updated: UPDATED,
    sections: [
      {
        heading: 'Acceptance of terms',
        paragraphs: [
          'By using Session Clock ("the app"), you agree to these Terms of Service. If you do not agree, please do not use the app. These terms apply to the hosted version of the app as well as any instance you build and run yourself from the source repository.',
        ],
      },
      {
        heading: 'What the app is',
        paragraphs: [
          'Session Clock is a free, open-source, client-side focus timer and clock — Pomodoro cycles, ambient sound, animated themes, and related productivity features — that runs entirely in your browser with no required account and no backend data store. It is provided "as is," for personal productivity use.',
        ],
      },
      {
        heading: 'License & source code',
        paragraphs: [
          'Session Clock is licensed under the GNU Affero General Public License v3 (AGPLv3). The full license text is included in the project repository (LICENSE). You are free to use, study, modify, and redistribute the source code under the terms of that license.',
        ],
      },
      {
        heading: 'No warranty',
        paragraphs: [
          'The app is provided without warranty of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. Focus session logs, streaks, and other locally-stored data are kept in your browser\'s storage; clearing your browser data, using a different device or browser profile, or an incognito/private window will remove or fail to persist that data. You are responsible for exporting your data (Settings → Privacy → View & Manage My Data) if you want a backup.',
        ],
      },
      {
        heading: 'Limitation of liability',
        paragraphs: [
          'To the fullest extent permitted by law, the maintainer(s) of Session Clock are not liable for any indirect, incidental, special, or consequential damages, or any loss of data, arising from your use of, or inability to use, the app.',
        ],
      },
      {
        heading: 'Third-party services',
        paragraphs: [
          'Optional integrations (Spotify, YouTube/Google, Notion, GitHub, Todoist, Linear, OpenStreetMap/Nominatim) are provided by third parties and governed by their own terms of service and privacy policies. Connecting them is entirely your choice, and Session Clock is not responsible for their availability, content, or practices.',
        ],
      },
      {
        heading: 'Acceptable use',
        paragraphs: [
          'You agree not to use the app to violate any applicable law, to attempt to disrupt or abuse the OAuth relay function or any other infrastructure the app depends on, or to circumvent the terms of service of any connected third-party provider.',
        ],
      },
      {
        heading: 'Changes to the app or these terms',
        paragraphs: [
          'Features may be added, changed, or removed at any time as this is an actively developed open-source project. These terms may be updated periodically; the current version is always available here and in TERMS.md in the repository, with the "Last updated" date reflecting the most recent revision.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [
          'Session Clock is an independent, open-source project. Questions about these terms can be raised as an issue on the GitHub repository.',
        ],
      },
    ],
  },
};
