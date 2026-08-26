// ── Default OAuth Client IDs ────────────────────────────────────────
// OAuth "Client IDs" (unlike client *secrets*) are public by design —
// Spotify's and Google's own docs say so, and every website using
// "Sign in with Spotify/Google" ships one in its client-side JS. It's
// safe to commit here.
//
// Fill these in with IDs from your own registered apps and every
// visitor to your deployed site gets a real one-click "Connect"
// button — no need for them to create a developer app just to see
// their now-playing track or a YouTube playlist. Leave a value blank
// and that integration falls back to the existing "paste your own
// Client ID" form, so the app still works with zero setup either way.
//
// Where to get them:
//  - Spotify: developer.spotify.com/dashboard → Create App
//      → Redirect URI: (see redirectUri() in integrations.ts, shown
//        live in the Settings → Integrations panel)
//      → Client ID only. No secret needed — this app uses PKCE.
//  - Google (YouTube + Calendar): console.cloud.google.com → APIs &
//    Services → Credentials → Create Credentials → OAuth client ID
//    → Application type: Web application
//      → Authorized redirect URI: same as above
//      → Authorized JavaScript origin: your deployed origin
//
// These ship in the client bundle and are visible to anyone — do not
// put a client *secret* here. Secrets belong server-side only (see
// functions/api/oauth/token.ts for providers that need one).

export const DEFAULT_SPOTIFY_CLIENT_ID = '8297269533124a99813bfa8a0ec2f146';
export const DEFAULT_GOOGLE_CLIENT_ID = '194129492690-jt58gdjd9mjcdllulacgk8dbe7tefp0r.apps.googleusercontent.com';
