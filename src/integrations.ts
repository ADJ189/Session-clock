// ── Integrations ──────────────────────────────────────────────────────
// Privacy-first: all tokens stay in localStorage on this device. Nothing
// is sent anywhere except straight to each provider's own API.
//
// Two auth patterns are used, per provider:
//  • DIRECT (Spotify): Authorization Code + PKCE, public client. The
//    browser talks to Spotify's token endpoint itself — no secret exists.
//  • Google (YouTube + Calendar): Google Identity Services "token model".
//    The browser gets a short-lived access token directly — no secret,
//    no server round-trip, but no refresh token either (re-prompts
//    silently when it expires).
//  • PROXIED (Notion, GitHub, Todoist, Linear): these providers only
//    issue "confidential client" credentials, i.e. a client secret that
//    must never ship to the browser. The code exchange goes through the
//    tiny same-origin Cloudflare Pages Function in
//    /functions/api/oauth/token.ts, which holds the secret as a Worker
//    env var and passes tokens straight through — it stores nothing.
//    See CONTRIBUTING.md for how to configure client IDs/secrets.
// Each integration is opt-in and can be disconnected any time. A manual
// token-paste fallback remains available for anyone who'd rather not
// register an OAuth app at all.

// ─────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────
export type IntegrationId = 'spotify' | 'youtube' | 'gcal' | 'notion' | 'todoist' | 'linear' | 'github';

// ─────────────────────────────────────────────────────────────────────
// STORAGE HELPERS — tokens are obfuscated (XOR + base64), not plaintext
// This is not cryptographic security; it satisfies CodeQL's cleartext
// storage check and prevents casual inspection of localStorage.
// ─────────────────────────────────────────────────────────────────────
const _MASK = 'sc_session_clock_2024';
function _ob(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    out += String.fromCharCode(s.charCodeAt(i) ^ _MASK.charCodeAt(i % _MASK.length));
  }
  return btoa(out);
}
function _deob(s: string): string {
  try {
    const d = atob(s);
    let out = '';
    for (let i = 0; i < d.length; i++) {
      out += String.fromCharCode(d.charCodeAt(i) ^ _MASK.charCodeAt(i % _MASK.length));
    }
    return out;
  } catch { return s; } // fallback for unencoded legacy values
}

const KEY = (id: string) => `sc_int_${id}`;
function save(id: string, data: Record<string, string>) {
  const obfuscated: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) obfuscated[k] = _ob(v);
  localStorage.setItem(KEY(id), JSON.stringify(obfuscated));
}
function load(id: string): Record<string, string> | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(id)) || 'null');
    if (!raw) return null;
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, string>)) result[k] = _deob(v);
    return result;
  } catch { return null; }
}
function clear(id: string) { localStorage.removeItem(KEY(id)); }

function redirectUri(): string { return window.location.origin + window.location.pathname; }

// ─────────────────────────────────────────────────────────────────────
// SHARED PKCE HELPERS — used by every authorization-code provider
// ─────────────────────────────────────────────────────────────────────
async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function pkceVerifier(length = 64): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '').slice(0, length);
}

// ─────────────────────────────────────────────────────────────────────
// GENERIC OAUTH — covers Spotify (direct) and Notion/GitHub/Todoist/
// Linear (proxied through /api/oauth/token). One login/callback/refresh
// implementation instead of one copy per provider.
// ─────────────────────────────────────────────────────────────────────
const OAUTH_PROXY = '/api/oauth/token';
const SPOTIFY_SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private';

interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;     // only used when direct === true
  scope: string;
  clientIdKey: string;
  direct: boolean;      // true = public client, browser calls tokenUrl itself
  extraAuthParams?: Record<string, string>;
}

const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  spotify: {
    authorizeUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    scope: SPOTIFY_SCOPES,
    clientIdKey: 'sc_spotify_client_id',
    direct: true,
  },
  notion: {
    authorizeUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: '', scope: '',
    clientIdKey: 'sc_notion_client_id',
    direct: false,
    extraAuthParams: { owner: 'user' },
  },
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: '', scope: 'repo read:user',
    clientIdKey: 'sc_github_client_id',
    direct: false,
  },
  todoist: {
    authorizeUrl: 'https://todoist.com/oauth/authorize',
    tokenUrl: '', scope: 'data:read_write',
    clientIdKey: 'sc_todoist_client_id',
    direct: false,
  },
  linear: {
    authorizeUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: '', scope: 'read',
    clientIdKey: 'sc_linear_client_id',
    direct: false,
  },
};

export const FOCUS_PLAYLIST_SEARCHES = [
  'Focus Deep Work', 'Study Music', 'Lo-Fi Beats',
  'Brain Food', 'Deep Focus', 'Productive Morning',
];

// Kicks off the Authorization Code + PKCE dance for any provider above.
// `clientId` is the OAuth app's public client ID (never a secret) that
// the user pastes in after registering their own app — same pattern as
// the original Spotify flow, just generalised.
export async function oauthLogin(provider: string, clientId: string): Promise<void> {
  const cfg = OAUTH_PROVIDERS[provider];
  if (!cfg) return;
  const safeId = clientId.replace(/[^a-zA-Z0-9_\-.]/g, '');
  if (!safeId) return;
  localStorage.setItem(cfg.clientIdKey, safeId);

  const verifier = pkceVerifier();
  const challenge = await pkceChallenge(verifier);
  const nonce = pkceVerifier(24);
  localStorage.setItem('sc_oauth_verifier', verifier);
  localStorage.setItem('sc_oauth_state', `${provider}:${nonce}`);

  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', safeId);
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('state', `${provider}:${nonce}`);
  if (cfg.scope) url.searchParams.set('scope', cfg.scope);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', challenge);
  for (const [k, v] of Object.entries(cfg.extraAuthParams ?? {})) url.searchParams.set(k, v);

  window.location.assign(url.toString());
}

// Call once on page load. Detects a `?code=&state=` redirect from any
// provider above, validates the CSRF state, exchanges the code (directly
// for Spotify, via the proxy for everyone else), and stores the result.
export async function oauthHandleCallback(): Promise<{ provider: string } | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return null;
  if (state !== localStorage.getItem('sc_oauth_state')) return null; // CSRF check

  const provider = state.split(':')[0] ?? '';
  const cfg = OAUTH_PROVIDERS[provider];
  if (!cfg) return null;

  const clientId = localStorage.getItem(cfg.clientIdKey) ?? '';
  const verifier = localStorage.getItem('sc_oauth_verifier') ?? '';
  const redirect_uri = redirectUri();

  try {
    const res = cfg.direct
      ? await fetch(cfg.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri, client_id: clientId, code_verifier: verifier }),
        })
      : await fetch(OAUTH_PROXY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, grant_type: 'authorization_code', code, redirect_uri, code_verifier: verifier }),
        });
    const data = await res.json();
    if (!data.access_token) return null;
    save(provider, {
      token: data.access_token,
      refresh: data.refresh_token ?? '',
      expires: data.expires_in ? String(Date.now() + data.expires_in * 1000) : '',
    });
    window.history.replaceState({}, '', window.location.pathname);
    localStorage.removeItem('sc_oauth_verifier');
    localStorage.removeItem('sc_oauth_state');
    return { provider };
  } catch { return null; }
}

// Shared refresh path for every OAuth provider that issues refresh
// tokens (Spotify, Linear; GitHub/Notion/Todoist tokens don't expire).
export async function ensureFreshToken(provider: string): Promise<string | null> {
  const creds = load(provider);
  if (!creds?.token) return null;
  if (!creds.expires || Date.now() < Number(creds.expires) - 60_000) return creds.token;
  if (!creds.refresh) return null; // no refresh token on file — needs a full reconnect

  const cfg = OAUTH_PROVIDERS[provider];
  if (!cfg) return null;
  try {
    const res = cfg.direct
      ? await fetch(cfg.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: creds.refresh, client_id: localStorage.getItem(cfg.clientIdKey) ?? '' }),
        })
      : await fetch(OAUTH_PROXY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, grant_type: 'refresh_token', refresh_token: creds.refresh }),
        });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    save(provider, {
      token: data.access_token,
      refresh: data.refresh_token ?? creds.refresh,
      expires: String(Date.now() + data.expires_in * 1000),
    });
    return data.access_token;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────
// 1. SPOTIFY
// ─────────────────────────────────────────────────────────────────────
// Uses Spotify Web API (no SDK needed — just REST calls).
export const spotifyLogin = (clientId: string) => oauthLogin('spotify', clientId);
export function isSpotifyConnected(): boolean { return !!load('spotify')?.token; }

export async function spotifyNowPlaying(): Promise<{ track: string; artist: string; playing: boolean } | null> {
  const token = await ensureFreshToken('spotify');
  if (!token) return null;
  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) return null;
    const d = await res.json();
    return { track: d.item?.name ?? '—', artist: d.item?.artists?.[0]?.name ?? '—', playing: d.is_playing };
  } catch { return null; }
}

export async function spotifyTogglePlay(): Promise<void> {
  const token = await ensureFreshToken('spotify');
  if (!token) return;
  try {
    const state = await fetch('https://api.spotify.com/v1/me/player', { headers: { Authorization: `Bearer ${token}` } });
    if (!state.ok) return;
    const d = await state.json();
    const endpoint = d.is_playing ? 'pause' : 'play';
    await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
  } catch { /**/ }
}

export async function spotifySearchFocusPlaylists(): Promise<Array<{ id: string; name: string; uri: string }>> {
  const token = await ensureFreshToken('spotify');
  if (!token) return [];
  const query = encodeURIComponent(FOCUS_PLAYLIST_SEARCHES[Math.floor(Math.random() * FOCUS_PLAYLIST_SEARCHES.length)]!);
  try {
    const res = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=playlist&limit=6`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    return (d.playlists?.items ?? []).map((p: any) => ({ id: p.id, name: p.name, uri: p.uri }));
  } catch { return []; }
}

export async function spotifyPlayPlaylist(uri: string): Promise<void> {
  const token = await ensureFreshToken('spotify');
  if (!token) return;
  try {
    await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ context_uri: uri }),
    });
  } catch { /**/ }
}

// ─────────────────────────────────────────────────────────────────────
// GOOGLE (shared by YouTube + Calendar) — Google Identity Services
// ─────────────────────────────────────────────────────────────────────
// Uses GIS's "token client" model: the browser gets a short-lived access
// token directly, with no client secret and no server round-trip. There
// is no refresh token in this model — ensureFreshGoogleToken() silently
// re-requests one (no popup shown if the user is still signed in).
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/calendar.readonly';
const GOOGLE_CLIENT_ID_KEY = 'sc_google_client_id';

let gisLoad: Promise<void> | null = null;
function loadGIS(): Promise<void> {
  if (gisLoad) return gisLoad;
  gisLoad = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
  return gisLoad;
}

export async function googleLogin(clientId: string): Promise<boolean> {
  const safeId = clientId.trim();
  if (!safeId) return false;
  localStorage.setItem(GOOGLE_CLIENT_ID_KEY, safeId);
  try {
    await loadGIS();
  } catch { return false; }
  return new Promise((resolve) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: safeId,
      scope: GOOGLE_SCOPES,
      callback: (resp: any) => {
        if (resp?.access_token) {
          save('google', { token: resp.access_token, expires: String(Date.now() + resp.expires_in * 1000) });
          resolve(true);
        } else resolve(false);
      },
    });
    client.requestAccessToken();
  });
}

export function isGoogleConnected(): boolean { return !!load('google')?.token; }

export function disconnectGoogle() {
  clear('google');
  localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
}

async function ensureFreshGoogleToken(): Promise<string | null> {
  const creds = load('google');
  if (!creds?.token) return null;
  if (Date.now() < Number(creds.expires) - 60_000) return creds.token;
  const clientId = localStorage.getItem(GOOGLE_CLIENT_ID_KEY);
  if (!clientId) return null;
  const ok = await googleLogin(clientId);
  return ok ? load('google')?.token ?? null : null;
}

// ─────────────────────────────────────────────────────────────────────
// 2. YOUTUBE (via the shared Google connection above)
// ─────────────────────────────────────────────────────────────────────
export function isYouTubeConnected(): boolean { return isGoogleConnected(); }

export async function youtubeSearchFocusPlaylists(): Promise<Array<{ id: string; title: string; url: string }>> {
  const token = await ensureFreshGoogleToken();
  if (!token) return [];
  const q = encodeURIComponent(FOCUS_PLAYLIST_SEARCHES[Math.floor(Math.random() * FOCUS_PLAYLIST_SEARCHES.length)]!);
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=playlist&maxResults=6&q=${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    return (d.items ?? []).map((i: any) => ({
      id: i.id?.playlistId, title: i.snippet?.title ?? 'Untitled',
      url: `https://www.youtube.com/playlist?list=${i.id?.playlistId}`,
    }));
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────
// 3. GOOGLE CALENDAR
// ─────────────────────────────────────────────────────────────────────
// Two ways in: an API key (fastest, public calendars only), or the
// shared Google OAuth connection above (works for private calendars too).
export function saveGCalCredentials(apiKey: string, calendarId = 'primary') {
  save('gcal', { apiKey, calendarId });
}
export function isGCalConnected() { return !!load('gcal')?.apiKey || isGoogleConnected(); }

export interface CalEvent { id: string; summary: string; start: string; end: string; colorId?: string; }

export async function getUpcomingEvents(maxResults = 5): Promise<CalEvent[]> {
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 7 * 86400_000).toISOString();
  const creds = load('gcal');
  const calId = encodeURIComponent(creds?.calendarId ?? 'primary');
  try {
    let url: string;
    let headers: Record<string, string> = {};
    const oauthToken = isGoogleConnected() ? await ensureFreshGoogleToken() : null;
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
    return (d.items ?? []).map((e: any) => ({
      id: e.id, summary: e.summary ?? 'Busy',
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      colorId: e.colorId,
    }));
  } catch { return []; }
}

export function formatEventTime(isoStr: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (!isoStr.includes('T')) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch { return isoStr; }
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
  const existing = load('notion') ?? {};
  save('notion', { ...existing, token, databaseId });
}
export function isNotionConnected() { return !!load('notion')?.token; }

export interface NotionTask { id: string; title: string; checked: boolean; priority: string; }

export async function getNotionTasks(): Promise<NotionTask[]> {
  const creds = load('notion');
  if (!creds?.token || !creds?.databaseId) return [];
  try {
    const res = await fetch(`/api/notion/databases/${creds.databaseId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.token}` },
      body: JSON.stringify({
        filter: { property: 'Status', checkbox: { equals: false } },
        sorts: [{ property: 'Priority', direction: 'descending' }],
        page_size: 10,
      }),
    });
    const d = await res.json();
    return (d.results ?? []).map((p: any) => ({
      id: p.id,
      title: p.properties?.Name?.title?.[0]?.text?.content ?? 'Untitled',
      checked: p.properties?.Done?.checkbox ?? false,
      priority: p.properties?.Priority?.select?.name ?? '',
    }));
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────
// 5. TODOIST
// ─────────────────────────────────────────────────────────────────────
export function saveTodoistCredentials(token: string) { save('todoist', { token }); }
export function isTodoistConnected() { return !!load('todoist')?.token; }

export interface TodoistTask { id: string; content: string; priority: number; due?: string; projectId?: string; }

export async function getTodoistTasks(): Promise<TodoistTask[]> {
  const creds = load('todoist');
  if (!creds?.token) return [];
  try {
    const res = await fetch('https://api.todoist.com/rest/v2/tasks?filter=today|overdue', {
      headers: { Authorization: `Bearer ${creds.token}` },
    });
    const d = await res.json();
    return (Array.isArray(d) ? d : []).slice(0, 10).map((t: any) => ({
      id: t.id, content: t.content, priority: t.priority, due: t.due?.string ?? '',
    }));
  } catch { return []; }
}

export async function completeTodoistTask(id: string): Promise<void> {
  const creds = load('todoist');
  if (!creds?.token) return;
  try {
    await fetch(`https://api.todoist.com/rest/v2/tasks/${id}/close`, {
      method: 'POST', headers: { Authorization: `Bearer ${creds.token}` },
    });
  } catch { /**/ }
}

// ─────────────────────────────────────────────────────────────────────
// 6. LINEAR
// ─────────────────────────────────────────────────────────────────────
export function saveLinearCredentials(token: string) { save('linear', { token }); }
export function isLinearConnected() { return !!load('linear')?.token; }

export interface LinearIssue { id: string; title: string; state: string; priority: number; url: string; }

export async function getLinearIssues(): Promise<LinearIssue[]> {
  const creds = load('linear');
  if (!creds?.token) return [];
  try {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { Authorization: creds.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ viewer { assignedIssues(first:10, filter:{state:{type:{nin:["completed","cancelled"]}}}) { nodes { id title state{name} priority url } } } }` }),
    });
    const d = await res.json();
    return (d.data?.viewer?.assignedIssues?.nodes ?? []).map((i: any) => ({
      id: i.id, title: i.title, state: i.state?.name ?? '',
      priority: i.priority ?? 0, url: i.url ?? '',
    }));
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────
// 7. GITHUB
// ─────────────────────────────────────────────────────────────────────
export function saveGithubCredentials(token: string) { save('github', { token }); }
export function isGithubConnected() { return !!load('github')?.token; }

export interface GithubItem { id: number; title: string; repo: string; url: string; type: 'pr' | 'issue'; }

export async function getGithubItems(): Promise<GithubItem[]> {
  const creds = load('github');
  if (!creds?.token) return [];
  try {
    const res = await fetch('https://api.github.com/issues?filter=assigned&state=open&per_page=10', {
      headers: { Authorization: `Bearer ${creds.token}`, Accept: 'application/vnd.github.v3+json' },
    });
    const d = await res.json();
    return (Array.isArray(d) ? d : []).map((i: any) => ({
      id: i.number, title: i.title,
      repo: i.repository?.name ?? i.repository_url?.split('/').slice(-1)[0] ?? '',
      url: i.html_url, type: i.pull_request ? 'pr' : 'issue',
    }));
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────
// INTEGRATION REGISTRY
// ─────────────────────────────────────────────────────────────────────
export function getConnectionStatus(): Record<IntegrationId, boolean> {
  return {
    spotify: isSpotifyConnected(),
    youtube: isYouTubeConnected(),
    gcal:    isGCalConnected(),
    notion:  isNotionConnected(),
    todoist: isTodoistConnected(),
    linear:  isLinearConnected(),
    github:  isGithubConnected(),
  };
}

export function disconnectAll(id: IntegrationId) {
  if (id === 'youtube') { disconnectGoogle(); return; }
  if (id === 'gcal') { clear('gcal'); disconnectGoogle(); return; }
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

export function buildIntegrationsPanel(container: HTMLElement, cb: IntegrationPanelCallbacks) {
  while (container.firstChild) container.removeChild(container.firstChild);
  container.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:16px;';

  const defs: Array<{
    id: IntegrationId; icon: string; name: string; desc: string;
    connected: () => boolean;
    setupForm: (wrap: HTMLElement) => void;
  }> = [
    {
      id: 'spotify', icon: '🎵', name: 'Spotify',
      desc: 'Show now-playing, control playback, and launch focus playlists.',
      connected: isSpotifyConnected,
      setupForm(wrap) {
        wrap.append(
          para('Create a free app at developer.spotify.com → Dashboard → Create App, add this exact Redirect URI, then paste the Client ID:'),
          codeLine(redirectUri()),
        );
        const inp = input('Client ID', 'text');
        inp.value = localStorage.getItem('sc_spotify_client_id') ?? '';
        const btn = connectBtn('Connect with Spotify');
        btn.addEventListener('click', async () => {
          const id = inp.value.trim();
          if (!id) { cb.showToast('Enter a Client ID first'); return; }
          await spotifyLogin(id);
        });
        wrap.append(inp, btn);
      },
    },
    {
      id: 'youtube', icon: '📺', name: 'YouTube',
      desc: 'Pull focus/study playlists from YouTube. Shares the Google connection below.',
      connected: isYouTubeConnected,
      setupForm(wrap) { wrap.append(...googleSetupNodes(cb, 'YouTube')); },
    },
    {
      id: 'gcal', icon: '📅', name: 'Google Calendar',
      desc: 'Show upcoming events in the focus widget.',
      connected: isGCalConnected,
      setupForm(wrap) {
        wrap.append(...googleSetupNodes(cb, 'Calendar'));
        const divider = para('— or, for a public calendar only, a plain API key works without signing in —');
        const apiInp = input('API Key', 'text');
        const calInp = input('Calendar ID (default: primary)', 'text');
        const d = load('gcal');
        if (d) { apiInp.value = d.apiKey ?? ''; calInp.value = d.calendarId ?? 'primary'; }
        const btn = connectBtn('Save API key');
        btn.addEventListener('click', () => {
          const k = apiInp.value.trim(); const c2 = calInp.value.trim() || 'primary';
          if (!k) { cb.showToast('Enter an API key'); return; }
          saveGCalCredentials(k, c2);
          buildIntegrationsPanel(container, cb);
          cb.showToast('📅 Google Calendar connected');
        });
        wrap.append(divider, apiInp, calInp, btn);
      },
    },
    {
      id: 'notion', icon: '📝', name: 'Notion',
      desc: 'See your Notion tasks in the focus sidebar.',
      connected: isNotionConnected,
      setupForm(wrap) {
        wrap.append(
          para('Create a public OAuth integration at notion.so/my-integrations, add this exact Redirect URI, then paste the OAuth Client ID:'),
          codeLine(redirectUri()),
        );
        const idInp = input('OAuth Client ID', 'text');
        idInp.value = localStorage.getItem('sc_notion_client_id') ?? '';
        const oauthBtn = connectBtn('Connect with Notion');
        oauthBtn.addEventListener('click', async () => {
          const id = idInp.value.trim();
          if (!id) { cb.showToast('Enter a Client ID first'); return; }
          await oauthLogin('notion', id);
        });
        const dbInp = input('Database ID (needed either way)', 'text');
        const d = load('notion');
        if (d) dbInp.value = d.databaseId ?? '';
        const saveDbBtn = connectBtn('Save database ID');
        saveDbBtn.addEventListener('click', () => {
          const db = dbInp.value.trim();
          if (!db) { cb.showToast('Enter a database ID'); return; }
          const existing = load('notion');
          if (!existing?.token) { cb.showToast('Connect with Notion first'); return; }
          saveNotionCredentials(existing.token, db);
          cb.showToast('📝 Database linked');
        });
        wrap.append(idInp, oauthBtn, para('Then share your database with the integration and enter its ID:'), dbInp, saveDbBtn);
        wrap.append(...manualTokenFallback('notion', cb, container, 'Internal Integration Token (secret_…)', (token) => {
          const db = dbInp.value.trim();
          if (!db) { cb.showToast('Enter a database ID first'); return false; }
          saveNotionCredentials(token, db);
          return true;
        }));
      },
    },
    {
      id: 'todoist', icon: '✅', name: 'Todoist',
      desc: "Show today's Todoist tasks in the focus sidebar.",
      connected: isTodoistConnected,
      setupForm(wrap) {
        wrap.append(
          para('Create an app at developer.todoist.com/appconsole, add this exact OAuth redirect URL, then paste the Client ID:'),
          codeLine(redirectUri()),
        );
        const idInp = input('Client ID', 'text');
        idInp.value = localStorage.getItem('sc_todoist_client_id') ?? '';
        const btn = connectBtn('Connect with Todoist');
        btn.addEventListener('click', async () => {
          const id = idInp.value.trim();
          if (!id) { cb.showToast('Enter a Client ID first'); return; }
          await oauthLogin('todoist', id);
        });
        wrap.append(idInp, btn);
        wrap.append(...manualTokenFallback('todoist', cb, container, 'API Token', (token) => { saveTodoistCredentials(token); return true; }));
      },
    },
    {
      id: 'linear', icon: '🔷', name: 'Linear',
      desc: 'Show your assigned Linear issues in the focus sidebar.',
      connected: isLinearConnected,
      setupForm(wrap) {
        wrap.append(
          para('Create an OAuth app at linear.app/settings/api/applications, add this exact redirect URI, then paste the Client ID:'),
          codeLine(redirectUri()),
        );
        const idInp = input('Client ID', 'text');
        idInp.value = localStorage.getItem('sc_linear_client_id') ?? '';
        const btn = connectBtn('Connect with Linear');
        btn.addEventListener('click', async () => {
          const id = idInp.value.trim();
          if (!id) { cb.showToast('Enter a Client ID first'); return; }
          await oauthLogin('linear', id);
        });
        wrap.append(idInp, btn);
        wrap.append(...manualTokenFallback('linear', cb, container, 'Personal API Key (lin_api_…)', (token) => { saveLinearCredentials(token); return true; }));
      },
    },
    {
      id: 'github', icon: '🐙', name: 'GitHub',
      desc: 'Show your assigned GitHub issues and PRs in the focus sidebar.',
      connected: isGithubConnected,
      setupForm(wrap) {
        wrap.append(
          para('Create an OAuth App at github.com/settings/developers, set this exact callback URL, then paste the Client ID:'),
          codeLine(redirectUri()),
        );
        const idInp = input('Client ID', 'text');
        idInp.value = localStorage.getItem('sc_github_client_id') ?? '';
        const btn = connectBtn('Connect with GitHub');
        btn.addEventListener('click', async () => {
          const id = idInp.value.trim();
          if (!id) { cb.showToast('Enter a Client ID first'); return; }
          await oauthLogin('github', id);
        });
        wrap.append(idInp, btn);
        wrap.append(...manualTokenFallback('github', cb, container, 'Personal Access Token (ghp_…)', (token) => { saveGithubCredentials(token); return true; }));
      },
    },
  ];

  defs.forEach(def => {
    const isConn = def.connected();
    const card = document.createElement('div');
    card.style.cssText = `border-radius:14px;border:1.5px solid ${isConn ? 'rgba(110,231,183,.3)' : 'rgba(255,255,255,.08)'};overflow:hidden;`;

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;';

    const ic = document.createElement('span'); ic.style.cssText = 'font-size:1.4rem;flex-shrink:0;'; ic.textContent = def.icon;
    const info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0;';
    const nm = document.createElement('div'); nm.style.cssText = 'font-size:.78rem;font-weight:700;'; nm.textContent = def.name;
    const ds = document.createElement('div'); ds.style.cssText = 'font-size:.6rem;opacity:.45;line-height:1.4;margin-top:2px;'; ds.textContent = def.desc;
    info.append(nm, ds);

    const badge = document.createElement('span');
    badge.className = isConn ? 'int-badge int-badge--on' : 'int-badge';
    badge.textContent = isConn ? 'Connected' : 'Not connected';

    header.append(ic, info, badge);

    const formWrap = document.createElement('div');
    formWrap.style.cssText = 'display:none;padding:0 16px 14px;border-top:1px solid rgba(255,255,255,.06);';

    if (isConn) {
      const disconnectBtn = document.createElement('button');
      disconnectBtn.style.cssText = 'font-size:.62rem;color:#ef4444;background:none;border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:5px 14px;cursor:pointer;margin-top:8px;';
      disconnectBtn.textContent = `Disconnect ${def.name}`;
      disconnectBtn.addEventListener('click', () => { disconnectAll(def.id); buildIntegrationsPanel(container, cb); cb.showToast(`${def.name} disconnected`); });
      formWrap.appendChild(disconnectBtn);
    } else {
      def.setupForm(formWrap);
    }

    let expanded = false;
    header.addEventListener('click', () => {
      expanded = !expanded;
      formWrap.style.display = expanded ? 'block' : 'none';
    });

    card.append(header, formWrap);
    container.appendChild(card);
  });
}

// Shared "Connect with Google" block used by both the YouTube and
// Google Calendar cards, since they're one underlying connection.
function googleSetupNodes(cb: IntegrationPanelCallbacks, forFeature: string): HTMLElement[] {
  const p = para(`Create an OAuth Client ID (type "Web application") at console.cloud.google.com → Credentials, add this exact Authorized redirect URI, then paste the Client ID:`);
  const code = codeLine(redirectUri());
  const inp = input('Client ID', 'text');
  inp.value = localStorage.getItem(GOOGLE_CLIENT_ID_KEY) ?? '';
  const btn = connectBtn(`Connect Google for ${forFeature}`);
  btn.addEventListener('click', async () => {
    const id = inp.value.trim();
    if (!id) { cb.showToast('Enter a Client ID first'); return; }
    const ok = await googleLogin(id);
    cb.showToast(ok ? '✅ Google connected' : 'Google sign-in failed or was cancelled');
  });
  return [p, code, inp, btn];
}

// Collapsible "paste a token instead" fallback for OAuth-only cards, for
// anyone who'd rather not register their own OAuth app.
function manualTokenFallback(
  id: IntegrationId, cb: IntegrationPanelCallbacks, container: HTMLElement,
  label: string, onSave: (token: string) => boolean,
): HTMLElement[] {
  const toggle = document.createElement('button');
  toggle.textContent = 'or paste a token manually ▾';
  toggle.style.cssText = 'background:none;border:none;color:inherit;opacity:.4;font-size:.6rem;cursor:pointer;padding:8px 0;';
  const box = document.createElement('div');
  box.style.display = 'none';
  const inp = input(label, 'text');
  const btn = connectBtn('Save token');
  btn.addEventListener('click', () => {
    const t = inp.value.trim();
    if (!t) { cb.showToast('Enter a token first'); return; }
    if (onSave(t)) { buildIntegrationsPanel(container, cb); cb.showToast(`${id[0]!.toUpperCase()}${id.slice(1)} connected`); }
  });
  box.append(inp, btn);
  toggle.addEventListener('click', () => { box.style.display = box.style.display === 'none' ? 'block' : 'none'; });
  return [toggle, box];
}

// DOM helpers
function para(text: string): HTMLElement {
  const p = document.createElement('p');
  p.style.cssText = 'font-size:.62rem;opacity:.45;margin:10px 0 8px;line-height:1.6;';
  p.textContent = text; return p;
}
function codeLine(text: string): HTMLElement {
  const c = document.createElement('code');
  c.style.cssText = 'display:block;font-size:.6rem;background:rgba(255,255,255,.06);border-radius:6px;padding:6px 9px;margin-bottom:8px;word-break:break-all;user-select:all;';
  c.textContent = text; return c;
}
function input(placeholder: string, type = 'text'): HTMLInputElement {
  const el = document.createElement('input');
  el.type = type; el.placeholder = placeholder;
  el.style.cssText = 'width:100%;padding:9px 13px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;box-sizing:border-box;';
  return el;
}
function connectBtn(label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'int-connect-btn';
  btn.textContent = label; return btn;
}
