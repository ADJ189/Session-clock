// ── Third-party API response shapes (only the fields read below) ────────
interface YtPlaylistItemApi {
  snippet?: {
    resourceId?: { videoId?: string };
    title?: string;
    thumbnails?: { default?: { url: string } };
  };
}
interface YtPlaylistApi {
  id: string;
  snippet?: { title?: string; thumbnails?: { default?: { url: string } } };
}
interface GCalEventApi {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  colorId?: string;
}
interface NotionPageApi {
  id: string;
  properties?: {
    Name?: { title?: { text?: { content: string } }[] };
    Done?: { checkbox?: boolean };
    Priority?: { select?: { name?: string } };
  };
}
interface TodoistTaskApi {
  id: string;
  content: string;
  priority: number;
  due?: { string: string };
}
interface GitHubIssueApi {
  number: number;
  title: string;
  repository?: { name?: string };
  repository_url?: string;
  html_url: string;
  pull_request?: unknown;
}
// ── Integrations ──────────────────────────────────────────────────────
// Privacy-first: all tokens stay in localStorage on this device. Nothing
// is sent anywhere except straight to each provider's own API.
//
// Two auth patterns are used, per provider:
//  • DIRECT (Spotify): Authorization Code + PKCE, public client. The
//    browser talks to Spotify's token endpoint itself — no secret exists.
//  • PROXIED (Notion, GitHub, Todoist, Linear, Google): these providers
//    only issue "confidential client" credentials, i.e. a client secret
//    that must never ship to the browser. The code exchange goes
//    through the tiny same-origin Cloudflare Pages Function in
//    /functions/api/oauth/token.ts, which holds the secret as a Worker
//    env var and passes tokens straight through — it stores nothing.
//    See CONTRIBUTING.md for how to configure client IDs/secrets.
//    Google (YouTube + Calendar) used to run on Google Identity
//    Services' "token model" popup instead — no redirect URI, no
//    secret, but also no refresh token (silent re-prompt on expiry).
//    It's now the real Authorization Code flow like the others above,
//    so it needs an Authorized redirect URI registered in Google Cloud
//    Console (see googleSelfHostNodes() below) and yields a real
//    refresh_token.
// Each integration is opt-in and can be disconnected any time. A manual
// token-paste fallback remains available for anyone who'd rather not
// register an OAuth app at all.

import {
  DEFAULT_SPOTIFY_CLIENT_ID,
  DEFAULT_GOOGLE_CLIENT_ID,
} from "./authconfig";
import { mount, unmount } from "svelte";
import IntegrationsPanel from "./app/integrations/IntegrationsPanel.svelte";
import type { IntegrationsService } from "./app/integrations/types";
import {
  clearCredentials as clear,
  ensureFreshToken,
  GOOGLE_CLIENT_ID_KEY,
  loadCredentials as load,
  OAUTH_PROVIDERS,
  oauthLogin,
  redirectUri,
  saveCredentials as save,
} from "./auth";

// The OAuth surface lives in ./auth so it can be unit tested without Svelte.
// Re-export it so existing `Integrations.*` call sites keep working.
export {
  ensureFreshToken,
  oauthHandleCallback,
  oauthLogin,
  type OAuthCallbackResult,
} from "./auth";

// ─────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────
export type IntegrationId =
  | "spotify"
  | "youtube"
  | "gcal"
  | "notion"
  | "todoist"
  | "linear"
  | "github";

// ─────────────────────────────────────────────────────────────────────
// LEGACY CREDENTIAL SWEEP
// ─────────────────────────────────────────────────────────────────────
// Legacy key from a since-removed feature (a self-host form that
// collected a visitor's own Client Secret — see CONTRIBUTING.md for
// why that was reverted). Nothing writes this anymore, but it needs an
// explicit cleanup path: silently dropping all references to a
// localStorage key is not the same as clearing it from devices that
// already wrote one, and leaving a client secret sitting in storage
// indefinitely is exactly the risk that feature was removed to avoid.
const LEGACY_GOOGLE_CLIENT_SECRET_KEY = "sc_google_client_secret";
// Best-effort sweep for anyone who visits without ever hitting
// disconnectGoogle() below (which also clears it) — e.g. someone who
// used the old self-host form once, on the site's default app since,
// and never explicitly disconnected.
localStorage.removeItem(LEGACY_GOOGLE_CLIENT_SECRET_KEY);

export const FOCUS_PLAYLIST_SEARCHES = [
  "Focus Deep Work",
  "Study Music",
  "Lo-Fi Beats",
  "Brain Food",
  "Deep Focus",
  "Productive Morning",
];

// ─────────────────────────────────────────────────────────────────────
// 1. SPOTIFY
// ─────────────────────────────────────────────────────────────────────
// Uses Spotify Web API (no SDK needed — just REST calls).
export const spotifyLogin = (clientId: string) =>
  oauthLogin("spotify", clientId);
export function isSpotifyConnected(): boolean {
  return !!load("spotify")?.token;
}

export async function spotifyNowPlaying(): Promise<{
  track: string;
  artist: string;
  playing: boolean;
} | null> {
  const token = await ensureFreshToken("spotify");
  if (!token) return null;
  try {
    const res = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status === 204) return null;
    const d = await res.json();
    return {
      track: d.item?.name ?? "—",
      artist: d.item?.artists?.[0]?.name ?? "—",
      playing: d.is_playing,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// GOOGLE (shared by YouTube + Calendar) — Authorization Code + PKCE,
// proxied through /api/oauth/token, exactly like Notion/GitHub/Todoist/
// Linear above (see OAUTH_PROVIDERS['google'] for the auth-URL config).
// This is a full-page redirect, not a popup: calling googleLogin()
// navigates the browser away immediately, so nothing after that call
// runs on this page load — the round-trip is picked up by
// oauthHandleCallback() on the next load, same as every other proxied
// provider. Callers that need to resume something afterward (the
// YouTube library panel, the calendar side-card) do it in main.ts's
// oauthHandleCallback().then() handler, not inline after the call.
export const googleLogin = (clientId: string) => oauthLogin("google", clientId);
export function isGoogleConnected(): boolean {
  return !!load("google")?.token;
}

export function disconnectGoogle() {
  clear("google");
  localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
  localStorage.removeItem(LEGACY_GOOGLE_CLIENT_SECRET_KEY); // see comment on the const above
}

// Thin alias so the YouTube/Calendar call sites below don't need to
// know the provider is generically handled — uses the shared
// refresh-token path (ensureFreshToken) since Google now issues real
// refresh tokens (see access_type/prompt in OAUTH_PROVIDERS above).
function ensureFreshGoogleToken(): Promise<string | null> {
  return ensureFreshToken("google");
}

// ─────────────────────────────────────────────────────────────────────
// 2. YOUTUBE (via the shared Google connection above)
// ─────────────────────────────────────────────────────────────────────
export function isYouTubeConnected(): boolean {
  return isGoogleConnected();
}

// Signed-in user's own YouTube library, via the official YouTube Data
// API v3 — same Google OAuth connection as above, read-only scope.
// Deliberately NOT youtubei.js/InnerTube: that's YouTube's private,
// undocumented client API, and using it to sign a user's account in
// through an unofficial client and pull raw stream URLs (so audio can
// play with the real player hidden) is exactly the kind of ToS
// circumvention this project has turned down twice already — it risks
// the user's own account being flagged, and it's not something this
// app should ship as a feature.
//
// The real constraint underneath the request: YouTube Music itself has
// no official public API at all — everything ytmusicapi/youtubei.js-style
// tools do for "Music" specifically is unofficial. What IS official and
// documented is the plain YouTube Data API v3, which can read a user's
// regular "Liked videos" playlist (id "LL") and their own playlists —
// close enough to a personal library for most people's ambient/focus
// music, and it plays back through the same compliant IFrame pane
// already in musicdock.ts instead of a hidden/extracted stream.
export interface YtLibraryItem {
  videoId: string;
  title: string;
  thumbnail: string;
}
export interface YtLibraryPlaylist {
  id: string;
  title: string;
  thumbnail: string;
}

export async function youtubeGetLikedVideos(
  maxResults = 25,
): Promise<YtLibraryItem[]> {
  const token = await ensureFreshGoogleToken();
  if (!token) return [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=LL&maxResults=${maxResults}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const d = await res.json();
    return (d.items ?? [])
      .filter((i: YtPlaylistItemApi) => i.snippet?.resourceId?.videoId)
      .map((i: YtPlaylistItemApi) => ({
        videoId: i.snippet?.resourceId?.videoId ?? "",
        title: i.snippet?.title ?? "Untitled",
        thumbnail: i.snippet?.thumbnails?.default?.url ?? "",
      }));
  } catch {
    return [];
  }
}

export async function youtubeGetMyPlaylists(
  maxResults = 25,
): Promise<YtLibraryPlaylist[]> {
  const token = await ensureFreshGoogleToken();
  if (!token) return [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=${maxResults}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const d = await res.json();
    return (d.items ?? []).map((i: YtPlaylistApi) => ({
      id: i.id,
      title: i.snippet?.title ?? "Untitled",
      thumbnail: i.snippet?.thumbnails?.default?.url ?? "",
    }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// 3. GOOGLE CALENDAR
// ─────────────────────────────────────────────────────────────────────
// Two ways in: an API key (fastest, public calendars only), or the
// shared Google OAuth connection above (works for private calendars too).
export function saveGCalCredentials(apiKey: string, calendarId = "primary") {
  save("gcal", { apiKey, calendarId });
}
export function isGCalConnected() {
  return !!load("gcal")?.apiKey || isGoogleConnected();
}

export interface CalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  colorId?: string;
}

export async function getUpcomingEvents(maxResults = 5): Promise<CalEvent[]> {
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 7 * 86400_000).toISOString();
  const creds = load("gcal");
  const calId = encodeURIComponent(creds?.calendarId ?? "primary");
  try {
    let url: string;
    let headers: Record<string, string> = {};
    const oauthToken = isGoogleConnected()
      ? await ensureFreshGoogleToken()
      : null;
    if (oauthToken) {
      url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?timeMin=${now}&timeMax=${future}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;
      headers = { Authorization: `Bearer ${oauthToken}` };
    } else if (creds?.apiKey) {
      url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?key=${creds.apiKey}&timeMin=${now}&timeMax=${future}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;
    } else {
      return [];
    }
    const res = await fetch(url, { headers });
    const d = await res.json();
    return (d.items ?? []).map((e: GCalEventApi) => ({
      id: e.id,
      summary: e.summary ?? "Busy",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      colorId: e.colorId,
    }));
  } catch {
    return [];
  }
}

export function formatEventTime(isoStr: string): string {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (!isoStr.includes("T"))
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 4. NOTION
// ─────────────────────────────────────────────────────────────────────
// OAuth via /api/oauth/token, then data reads via /api/notion/* — a
// same-origin relay is required because Notion's API sends no CORS
// headers at all, so the browser can't call api.notion.com directly.
// (A manual internal-integration token still works too — the relay just
// forwards whatever Authorization header it's given.)
export function saveNotionCredentials(token: string, databaseId: string) {
  const existing = load("notion") ?? {};
  save("notion", { ...existing, token, databaseId });
}
export function isNotionConnected() {
  return !!load("notion")?.token;
}

export interface NotionTask {
  id: string;
  title: string;
  checked: boolean;
  priority: string;
}

export async function getNotionTasks(): Promise<NotionTask[]> {
  const creds = load("notion");
  if (!creds?.token || !creds?.databaseId) return [];
  try {
    const res = await fetch(`/api/notion/databases/${creds.databaseId}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.token}`,
      },
      body: JSON.stringify({
        filter: { property: "Status", checkbox: { equals: false } },
        sorts: [{ property: "Priority", direction: "descending" }],
        page_size: 10,
      }),
    });
    const d = await res.json();
    return (d.results ?? []).map((p: NotionPageApi) => ({
      id: p.id,
      title: p.properties?.Name?.title?.[0]?.text?.content ?? "Untitled",
      checked: p.properties?.Done?.checkbox ?? false,
      priority: p.properties?.Priority?.select?.name ?? "",
    }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// 5. TODOIST
// ─────────────────────────────────────────────────────────────────────
export function saveTodoistCredentials(token: string) {
  save("todoist", { token });
}
export function isTodoistConnected() {
  return !!load("todoist")?.token;
}

export interface TodoistTask {
  id: string;
  content: string;
  priority: number;
  due?: string;
  projectId?: string;
}

export async function getTodoistTasks(): Promise<TodoistTask[]> {
  const creds = load("todoist");
  if (!creds?.token) return [];
  try {
    const res = await fetch(
      "https://api.todoist.com/rest/v2/tasks?filter=today|overdue",
      {
        headers: { Authorization: `Bearer ${creds.token}` },
      },
    );
    const d = await res.json();
    return (Array.isArray(d) ? d : [])
      .slice(0, 10)
      .map((t: TodoistTaskApi) => ({
        id: t.id,
        content: t.content,
        priority: t.priority,
        due: t.due?.string ?? "",
      }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// 6. LINEAR
// ─────────────────────────────────────────────────────────────────────
export function saveLinearCredentials(token: string) {
  save("linear", { token });
}
export function isLinearConnected() {
  return !!load("linear")?.token;
}

export interface LinearIssue {
  id: string;
  title: string;
  state: string;
  priority: number;
  url: string;
}

// ─────────────────────────────────────────────────────────────────────
// 7. GITHUB
// ─────────────────────────────────────────────────────────────────────
export function saveGithubCredentials(token: string) {
  save("github", { token });
}
export function isGithubConnected() {
  return !!load("github")?.token;
}

export interface GithubItem {
  id: number;
  title: string;
  repo: string;
  url: string;
  type: "pr" | "issue";
}

export async function getGithubItems(): Promise<GithubItem[]> {
  const creds = load("github");
  if (!creds?.token) return [];
  try {
    const res = await fetch(
      "https://api.github.com/issues?filter=assigned&state=open&per_page=10",
      {
        headers: {
          Authorization: `Bearer ${creds.token}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );
    const d = await res.json();
    return (Array.isArray(d) ? d : []).map((i: GitHubIssueApi) => ({
      id: i.number,
      title: i.title,
      repo:
        i.repository?.name ?? i.repository_url?.split("/").slice(-1)[0] ?? "",
      url: i.html_url,
      type: i.pull_request ? "pr" : "issue",
    }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// INTEGRATION REGISTRY
// ─────────────────────────────────────────────────────────────────────
export function getConnectionStatus(): Record<IntegrationId, boolean> {
  return {
    spotify: isSpotifyConnected(),
    youtube: isYouTubeConnected(),
    gcal: isGCalConnected(),
    notion: isNotionConnected(),
    todoist: isTodoistConnected(),
    linear: isLinearConnected(),
    github: isGithubConnected(),
  };
}

export function disconnectAll(id: IntegrationId) {
  if (id === "youtube") {
    disconnectGoogle();
    return;
  }
  if (id === "gcal") {
    clear("gcal");
    disconnectGoogle();
    return;
  }
  clear(id);
  const cfg = OAUTH_PROVIDERS[id];
  if (cfg) localStorage.removeItem(cfg.clientIdKey);
}

// ─────────────────────────────────────────────────────────────────────
// INTEGRATIONS PANEL BUILDER — renders the full integrations UI
// ─────────────────────────────────────────────────────────────────────
export interface IntegrationPanelCallbacks {
  showToast: (msg: string, dur?: number) => void;
}

let activeIntMount: ReturnType<typeof mount> | null = null;

export function buildIntegrationsPanel(
  container: HTMLElement,
  cb: IntegrationPanelCallbacks,
) {
  if (activeIntMount) {
    try {
      unmount(activeIntMount);
    } catch {}
    activeIntMount = null;
  }
  container.className = "int-grid";
  while (container.firstChild) container.removeChild(container.firstChild);

  const service: IntegrationsService = {
    cb,
    isSpotifyConnected,
    isYouTubeConnected,
    isGCalConnected,
    isNotionConnected,
    isTodoistConnected,
    isLinearConnected,
    isGithubConnected,
    disconnectAll,
    spotifyLogin,
    googleLogin,
    oauthLogin,
    saveGCalCredentials,
    saveNotionCredentials,
    saveTodoistCredentials,
    saveLinearCredentials,
    saveGithubCredentials,
    loadData: load,
    getRedirectUri: redirectUri,
    defaultSpotifyClientId: DEFAULT_SPOTIFY_CLIENT_ID,
    defaultGoogleClientId: DEFAULT_GOOGLE_CLIENT_ID,
    googleClientIdKey: GOOGLE_CLIENT_ID_KEY,
  };

  activeIntMount = mount(IntegrationsPanel, {
    target: container,
    props: { service },
  });
}
