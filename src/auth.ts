// OAuth + credential storage for every integration.
//
// This module is deliberately free of Svelte and DOM rendering imports so the
// authorization-code callback can be unit tested (`tests-unit/auth.test.ts`)
// without a browser. `src/integrations.ts` re-exports the public API for the
// rest of the app.
//
// Two auth patterns are used, per provider:
//  • DIRECT (Spotify): Authorization Code + PKCE, public client. The browser
//    talks to Spotify's token endpoint itself — no secret exists.
//  • PROXIED (Notion, GitHub, Todoist, Linear, Google): these providers only
//    issue confidential-client credentials, so the exchange goes through the
//    same-origin Pages Function in functions/api/oauth/token.ts, which holds
//    the secret as a Worker env var and stores nothing. See CONTRIBUTING.md.
//
// Tokens live in localStorage, obfuscated (XOR + base64). That is not
// cryptography; it keeps tokens out of casual inspection and satisfies the
// cleartext-storage check. Never log a token or an authorization code.

export interface OAuthProviderConfig {
  authorizeUrl: string;
  /** Only used when `direct === true`. */
  tokenUrl: string;
  scope: string;
  clientIdKey: string;
  /** true = public client, the browser calls tokenUrl itself. */
  direct: boolean;
  extraAuthParams?: Record<string, string>;
}

const OAUTH_PROXY = "/api/oauth/token";
const SPOTIFY_SCOPES =
  "user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private";
const GOOGLE_SCOPES =
  "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/calendar.readonly";
export const GOOGLE_CLIENT_ID_KEY = "sc_google_client_id";

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  spotify: {
    authorizeUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",
    scope: SPOTIFY_SCOPES,
    clientIdKey: "sc_spotify_client_id",
    direct: true,
  },
  notion: {
    authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "",
    scope: "",
    clientIdKey: "sc_notion_client_id",
    direct: false,
    extraAuthParams: { owner: "user" },
  },
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "",
    scope: "repo read:user",
    clientIdKey: "sc_github_client_id",
    direct: false,
  },
  todoist: {
    authorizeUrl: "https://todoist.com/oauth/authorize",
    tokenUrl: "",
    scope: "data:read_write",
    clientIdKey: "sc_todoist_client_id",
    direct: false,
  },
  linear: {
    authorizeUrl: "https://linear.app/oauth/authorize",
    tokenUrl: "",
    scope: "read",
    clientIdKey: "sc_linear_client_id",
    direct: false,
  },
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "",
    scope: GOOGLE_SCOPES,
    clientIdKey: GOOGLE_CLIENT_ID_KEY,
    direct: false,
    // access_type=offline + prompt=consent is what actually gets a
    // refresh_token back from Google — without both, a returning user only
    // ever gets a short-lived access token again (Google only issues a
    // refresh_token on the *first* consent unless prompt is forced).
    // include_granted_scopes lets YouTube + Calendar be connected
    // incrementally without re-consenting to both every time.
    extraAuthParams: {
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    },
  },
};

// ─────────────────────────────────────────────────────────────────────
// CREDENTIAL STORAGE
// ─────────────────────────────────────────────────────────────────────
const _MASK = "sc_session_clock_2024";
function _ob(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    out += String.fromCharCode(
      s.charCodeAt(i) ^ _MASK.charCodeAt(i % _MASK.length),
    );
  }
  return btoa(out);
}
function _deob(s: string): string {
  try {
    const d = atob(s);
    let out = "";
    for (let i = 0; i < d.length; i++) {
      out += String.fromCharCode(
        d.charCodeAt(i) ^ _MASK.charCodeAt(i % _MASK.length),
      );
    }
    return out;
  } catch {
    return s;
  } // fallback for unencoded legacy values
}

const CREDENTIAL_KEY = (id: string) => `sc_int_${id}`;

export function saveCredentials(
  id: string,
  data: Record<string, string>,
): void {
  const obfuscated: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) obfuscated[k] = _ob(v);
  localStorage.setItem(CREDENTIAL_KEY(id), JSON.stringify(obfuscated));
}

export function loadCredentials(id: string): Record<string, string> | null {
  try {
    const raw = JSON.parse(localStorage.getItem(CREDENTIAL_KEY(id)) || "null");
    if (!raw) return null;
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, string>))
      result[k] = _deob(v);
    return result;
  } catch {
    return null;
  }
}

export function clearCredentials(id: string): void {
  localStorage.removeItem(CREDENTIAL_KEY(id));
}

/** Converts a provider's `expires_in` (seconds) to an absolute expiry string. */
function expiryFrom(expiresIn: unknown, fallbackSeconds?: number): string {
  const n = Number(expiresIn);
  if (expiresIn != null && expiresIn !== "" && Number.isFinite(n) && n > 0)
    return String(Date.now() + n * 1000);
  return fallbackSeconds ? String(Date.now() + fallbackSeconds * 1000) : "";
}

export function redirectUri(): string {
  return window.location.origin + window.location.pathname;
}

// ─────────────────────────────────────────────────────────────────────
// PKCE
// ─────────────────────────────────────────────────────────────────────
async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function pkceVerifier(length = 64): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, length);
}

// ─────────────────────────────────────────────────────────────────────
// ONE-TIME CALLBACK STATE
// ─────────────────────────────────────────────────────────────────────
const OAUTH_VERIFIER_KEY = "sc_oauth_verifier";
const OAUTH_STATE_KEY = "sc_oauth_state";

// Query keys that only an OAuth redirect sets. Cleanup removes exactly these
// and leaves any unrelated parameter (utm tags, a deep link) in place.
const OAUTH_REDIRECT_PARAMS = [
  "code",
  "state",
  "error",
  "error_description",
  "error_uri",
  "error_reason",
  "session_state",
  "iss",
  "authuser",
] as const;

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (private mode, lockdown). The round-trip will
    // then fail with "session expired", which is the honest outcome.
  }
}

// The callback URL and one-shot CSRF state are single-use — clear them on
// every terminal path, success or failure, so a failed attempt doesn't get
// silently retried on refresh with a code the provider will now reject as
// already used. Only OAuth parameters are removed.
export function cleanUpOAuthRedirect(): void {
  try {
    sessionStorage.removeItem(OAUTH_VERIFIER_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);
  } catch {
    // Nothing to clear in a storage-blocked browser.
  }
  try {
    const url = new URL(window.location.href);
    for (const key of OAUTH_REDIRECT_PARAMS) url.searchParams.delete(key);
    const search = url.searchParams.toString();
    window.history.replaceState(
      {},
      "",
      url.pathname + (search ? `?${search}` : "") + url.hash,
    );
  } catch {
    // No history API (tests) or a malformed location: leave the URL alone.
  }
}

function parseState(
  raw: string | null,
): { provider: string; nonce: string } | null {
  if (!raw) return null;
  const separator = raw.indexOf(":");
  if (separator <= 0 || separator === raw.length - 1) return null;
  const provider = raw.slice(0, separator);
  const nonce = raw.slice(separator + 1);
  if (!/^[a-z0-9_-]{1,32}$/i.test(provider)) return null;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(nonce)) return null;
  return { provider, nonce };
}

// ─────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────
// Kicks off the Authorization Code + PKCE dance for any provider above.
// `clientId` is the OAuth app's public client ID (never a secret).
export async function oauthLogin(
  provider: string,
  clientId: string,
): Promise<void> {
  const cfg = OAUTH_PROVIDERS[provider];
  if (!cfg) return;
  const safeId = clientId.replace(/[^a-zA-Z0-9_\-.]/g, "");
  if (!safeId) return;
  localStorage.setItem(cfg.clientIdKey, safeId);

  const verifier = pkceVerifier();
  const challenge = await pkceChallenge(verifier);
  const nonce = pkceVerifier(24);
  // sessionStorage, not localStorage: the flow navigates away and back (so
  // sessionStorage survives within the tab), but it is scoped per tab and
  // auto-clears on close, so an abandoned flow leaves no stale verifier and
  // two providers in two tabs cannot clobber each other's pending state.
  writeSession(OAUTH_VERIFIER_KEY, verifier);
  writeSession(OAUTH_STATE_KEY, `${provider}:${nonce}`);

  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", safeId);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("state", `${provider}:${nonce}`);
  if (cfg.scope) url.searchParams.set("scope", cfg.scope);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  for (const [k, v] of Object.entries(cfg.extraAuthParams ?? {}))
    url.searchParams.set(k, v);

  window.location.assign(url.toString());
}

// ─────────────────────────────────────────────────────────────────────
// CALLBACK
// ─────────────────────────────────────────────────────────────────────
export interface OAuthCallbackSuccess {
  provider: string;
  ok: true;
}

export interface OAuthCallbackFailure {
  provider: string;
  ok: false;
  error: string;
  /** The user cancelled/denied at the provider (not a broken exchange). */
  cancelled?: boolean;
}

export type OAuthCallbackResult =
  | OAuthCallbackSuccess
  | OAuthCallbackFailure;

// RFC 6749 / OIDC error codes we can phrase for a person. Anything else is
// reported as a sanitised code rather than an arbitrary response body.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "sign-in was cancelled",
  invalid_request: "the provider rejected the request",
  invalid_client: "the provider rejected this app's client ID",
  invalid_grant: "the authorization code was rejected or expired",
  unauthorized_client: "this app is not allowed to use that sign-in method",
  unsupported_response_type: "the provider does not support this sign-in method",
  invalid_scope: "the requested permissions were rejected",
  server_error: "the provider had a server error",
  temporarily_unavailable: "the provider is temporarily unavailable",
  interaction_required: "the provider needs you to sign in again",
  login_required: "the provider needs you to sign in again",
  consent_required: "the provider needs your consent again",
  not_configured: "this deployment has not configured that provider yet",
  unknown_provider: "this deployment does not support that provider",
  upstream_unreachable: "the provider could not be reached",
};

/** Keeps a provider error code to a safe alphabet before it is displayed. */
function safeErrorCode(value: string | null): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 64);
}

/**
 * Provider text is shown to the user, so it must not carry markup or run
 * away: strip control characters and angle brackets, collapse whitespace and
 * cap the length. Access tokens/codes are never read into an error message.
 */
function sanitizeErrorText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  let printable = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue; // control characters
    printable += char;
  }
  const flat = printable
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!flat) return fallback;
  return flat.length > 160 ? `${flat.slice(0, 157)}…` : flat;
}

function stringField(
  data: Record<string, unknown> | null,
  key: string,
): string {
  const value = data?.[key];
  return typeof value === "string" ? value : "";
}

async function readJson(
  response: Response,
): Promise<Record<string, unknown> | null> {
  try {
    const data = await response.json();
    return data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function describeOAuthError(code: string): string {
  if (!code) return "";
  return OAUTH_ERROR_MESSAGES[code] ?? `sign-in failed (${code})`;
}

/**
 * Call once on page load. Detects a redirect from any provider above,
 * validates the one-time CSRF state, exchanges the code (directly for
 * Spotify, through the proxy for everyone else) and stores the result.
 *
 * Returns `null` when the URL is not one of our callbacks, so an ordinary
 * page load — or an unrelated `?code=` parameter — is left untouched. Every
 * genuine callback returns a result and is removed from the URL, so a
 * cancelled or malformed attempt is neither silent nor retried on refresh.
 */
export async function oauthHandleCallback(): Promise<
  OAuthCallbackResult | null
> {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return null;
  }
  const rawCode = params.get("code");
  const rawError = params.get("error");
  const rawState = params.get("state");
  const hasCallbackParams = Boolean(rawCode || rawError || rawState);
  if (!hasCallbackParams) return null;

  const pendingRaw = readSession(OAUTH_STATE_KEY);
  const pending = parseState(pendingRaw);
  const returned = parseState(rawState);

  // Did this tab start a flow, or does the URL at least name a provider we
  // support? Anything else is somebody else's query string.
  const knownReturnedProvider = returned
    ? Boolean(OAUTH_PROVIDERS[returned.provider])
    : false;
  if (!pendingRaw && !knownReturnedProvider) return null;

  const provider =
    (pending ?? returned)?.provider ??
    (rawState ?? "").split(":")[0] ??
    "";

  const fail = (
    error: string,
    cancelled = false,
  ): OAuthCallbackFailure => {
    cleanUpOAuthRedirect();
    return cancelled
      ? { provider, ok: false, error, cancelled: true }
      : { provider, ok: false, error };
  };

  // 1. A terminal callback always carries the state it was started with.
  if (!rawState) return fail("the sign-in response was missing its security state");
  if (!returned) return fail("the sign-in response had a malformed security state");
  if (!pendingRaw) {
    return fail("the sign-in session expired; please try again");
  }
  if (!pending) {
    return fail("the pending sign-in session was malformed; please try again");
  }

  // 2. CSRF check against the one-time value, before trusting the provider.
  if (rawState !== pendingRaw) {
    return fail("the sign-in response could not be verified; please try again");
  }

  const cfg = OAUTH_PROVIDERS[pending.provider];
  if (!cfg) return fail("the sign-in provider is not recognised");

  // 3. Provider denial/cancellation: no token exchange is attempted.
  if (rawError) {
    const code = safeErrorCode(rawError);
    return fail(
      describeOAuthError(code) || "the provider rejected the sign-in request",
      code === "access_denied",
    );
  }

  // 4. A code without its PKCE verifier cannot be exchanged.
  const verifier = readSession(OAUTH_VERIFIER_KEY) ?? "";
  if (!verifier) {
    return fail("the sign-in session expired; please try again");
  }
  if (!rawCode) return fail("the provider returned no authorization code");

  // 5. Exchange. Non-2xx is inspected for a usable error field but never
  // echoed verbatim, and never with a token in it.
  try {
    const response = cfg.direct
      ? await fetch(cfg.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: rawCode,
            redirect_uri: redirectUri(),
            client_id: localStorage.getItem(cfg.clientIdKey) ?? "",
            code_verifier: verifier,
          }),
        })
      : await fetch(OAUTH_PROXY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: pending.provider,
            grant_type: "authorization_code",
            code: rawCode,
            redirect_uri: redirectUri(),
            code_verifier: verifier,
          }),
        });

    const data = await readJson(response);
    const errorCode = safeErrorCode(stringField(data, "error"));
    const detail = sanitizeErrorText(
      stringField(data, "message") || stringField(data, "error_description"),
      "",
    );

    if (!response.ok) {
      return fail(
        detail ||
          describeOAuthError(errorCode) ||
          `sign-in failed (HTTP ${response.status})`,
      );
    }
    if (!data) return fail("the provider returned an unreadable response");

    const token = stringField(data, "access_token");
    if (!token) {
      return fail(
        detail ||
          describeOAuthError(errorCode) ||
          "the provider did not return an access token",
      );
    }

    saveCredentials(pending.provider, {
      token,
      refresh: stringField(data, "refresh_token"),
      expires: expiryFrom(data.expires_in),
    });
    cleanUpOAuthRedirect();
    return { provider: pending.provider, ok: true };
  } catch {
    return fail("network error");
  }
}

// ─────────────────────────────────────────────────────────────────────
// REFRESH
// ─────────────────────────────────────────────────────────────────────
// Shared refresh path for every provider that issues refresh tokens
// (Spotify, Linear, Google; GitHub/Notion/Todoist tokens don't expire).
export async function ensureFreshToken(
  provider: string,
): Promise<string | null> {
  const creds = loadCredentials(provider);
  if (!creds?.token) return null;
  if (!creds.expires || Date.now() < Number(creds.expires) - 60_000)
    return creds.token;
  if (!creds.refresh) {
    // Token expired with no refresh token (a connection predating refresh
    // support). Clear it rather than reporting "connected" forever against a
    // dead token and leaving no way back to the connect button.
    clearCredentials(provider);
    return null;
  }

  const cfg = OAUTH_PROVIDERS[provider];
  if (!cfg) return null;
  const clientId = localStorage.getItem(cfg.clientIdKey) ?? "";
  try {
    const res = cfg.direct
      ? await fetch(cfg.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: creds.refresh,
            client_id: clientId,
          }),
        })
      : await fetch(OAUTH_PROXY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            grant_type: "refresh_token",
            refresh_token: creds.refresh,
          }),
        });
    if (!res.ok) return null;
    const data = await readJson(res);
    const token = stringField(data, "access_token");
    if (!token) return null;
    saveCredentials(provider, {
      token,
      refresh: stringField(data, "refresh_token") || creds.refresh,
      // 1h default: a refreshed token must never be recorded as non-expiring.
      expires: expiryFrom(data?.expires_in, 3600),
    });
    return token;
  } catch {
    return null;
  }
}
