// Regression coverage for the OAuth callback state machine.
//
// `src/auth.ts` is intentionally Svelte-free so the real production handler
// runs here against stubbed browser storage, history and fetch. Nothing in
// this file touches the network.

import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomStubs } from "./dom-stubs.ts";

installDomStubs();

const g = globalThis as unknown as Record<string, unknown>;

// ── Browser stubs ──────────────────────────────────────────────────────
const sessionData = new Map<string, string>();
const fakeSessionStorage = {
  getItem: (key: string) => sessionData.get(key) ?? null,
  setItem: (key: string, value: string) => sessionData.set(key, String(value)),
  removeItem: (key: string) => sessionData.delete(key),
  clear: () => sessionData.clear(),
};
Object.defineProperty(g, "sessionStorage", {
  configurable: true,
  enumerable: true,
  value: fakeSessionStorage,
});

const ORIGIN = "https://clock.example";
let currentSearch = "";
let assignedUrl: string | null = null;
let replacedUrl: string | null = null;

const fakeLocation = {
  origin: ORIGIN,
  pathname: "/",
  hash: "",
  get search(): string {
    return currentSearch;
  },
  get href(): string {
    return `${ORIGIN}/${currentSearch}`;
  },
  assign(url: string): void {
    assignedUrl = url;
  },
};
Object.defineProperty(g, "location", {
  configurable: true,
  enumerable: true,
  value: fakeLocation,
});

Object.defineProperty(g, "history", {
  configurable: true,
  enumerable: true,
  value: {
    replaceState(_state: unknown, _title: string, url: string): void {
      replacedUrl = String(url);
      const query = replacedUrl.indexOf("?");
      currentSearch = query >= 0 ? replacedUrl.slice(query) : "";
    },
  },
});

interface FetchCall {
  url: string;
  init: RequestInit;
}

let fetchCalls: FetchCall[] = [];
let fetchImpl: (url: string, init: RequestInit) => Promise<Response> = () =>
  Promise.reject(new Error("no fetch was expected in this test"));

g.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const request = init ?? {};
  fetchCalls.push({ url, init: request });
  return fetchImpl(url, request);
}) as typeof fetch;

const {
  loadCredentials,
  oauthHandleCallback,
  oauthLogin,
  OAUTH_PROVIDERS,
} = await import("../src/auth.ts");

// ── Helpers ────────────────────────────────────────────────────────────
const STATE_KEY = "sc_oauth_state";
const VERIFIER_KEY = "sc_oauth_verifier";

function resetEnv(search = ""): void {
  localStorage.clear();
  sessionData.clear();
  currentSearch = search;
  assignedUrl = null;
  replacedUrl = null;
  fetchCalls = [];
  fetchImpl = () => Promise.reject(new Error("no fetch was expected"));
}

function seedPending(
  provider = "spotify",
  nonce = "nonce123",
  verifier = "verifier-abc",
): string {
  const state = `${provider}:${nonce}`;
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  return state;
}

/** Clears storage/URL state, then starts a callback for `provider`. */
function beginCallback(provider = "spotify"): string {
  resetEnv();
  const state = seedPending(provider);
  currentSearch = `?code=auth-code&state=${encodeURIComponent(state)}`;
  return state;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Success ────────────────────────────────────────────────────────────
test("a valid code and matching state store credentials and clean up", async () => {
  beginCallback();
  fetchImpl = () =>
    Promise.resolve(
      jsonResponse({
        access_token: "spotify-access-token",
        refresh_token: "spotify-refresh-token",
        expires_in: 3600,
      }),
    );

  const result = await oauthHandleCallback();

  assert.deepStrictEqual(result, { provider: "spotify", ok: true });
  assert.strictEqual(fetchCalls.length, 1);
  assert.strictEqual(
    fetchCalls[0]!.url,
    OAUTH_PROVIDERS.spotify!.tokenUrl,
    "Spotify exchanges directly, never through the proxy",
  );
  const body = new URLSearchParams(String(fetchCalls[0]!.init.body));
  assert.strictEqual(body.get("grant_type"), "authorization_code");
  assert.strictEqual(body.get("code"), "auth-code");
  assert.strictEqual(body.get("code_verifier"), "verifier-abc");

  const stored = loadCredentials("spotify");
  assert.strictEqual(stored?.token, "spotify-access-token");
  assert.strictEqual(stored?.refresh, "spotify-refresh-token");
  assert.ok(Number(stored?.expires) > Date.now());

  const raw = localStorage.getItem("sc_int_spotify") ?? "";
  assert.ok(
    !raw.includes("spotify-access-token"),
    "the token is obfuscated at rest, not stored in clear text",
  );

  assert.strictEqual(sessionStorage.getItem(STATE_KEY), null);
  assert.strictEqual(sessionStorage.getItem(VERIFIER_KEY), null);
  assert.strictEqual(replacedUrl, "/", "the callback query is removed");
});

test("a proxied provider posts JSON to the token function without a secret", async () => {
  beginCallback("github");
  fetchImpl = () => Promise.resolve(jsonResponse({ access_token: "gh-token" }));

  const result = await oauthHandleCallback();

  assert.deepStrictEqual(result, { provider: "github", ok: true });
  assert.strictEqual(fetchCalls[0]!.url, "/api/oauth/token");
  const payload = JSON.parse(String(fetchCalls[0]!.init.body)) as Record<
    string,
    string
  >;
  assert.strictEqual(payload.provider, "github");
  assert.strictEqual(payload.code, "auth-code");
  assert.strictEqual(payload.code_verifier, "verifier-abc");
  assert.strictEqual(
    "client_secret" in payload,
    false,
    "the browser never sends a client secret",
  );
  assert.strictEqual(loadCredentials("github")?.token, "gh-token");
});

// ── Provider denial ────────────────────────────────────────────────────
test("error=access_denied is reported as cancelled with no token exchange", async () => {
  resetEnv();
  const state = seedPending();
  currentSearch = `?error=access_denied&state=${encodeURIComponent(state)}`;

  const result = await oauthHandleCallback();

  assert.ok(result);
  assert.strictEqual(result.ok, false);
  if (result.ok) return;
  assert.strictEqual(result.cancelled, true);
  assert.match(result.error, /cancelled/i);
  assert.strictEqual(fetchCalls.length, 0, "no token exchange is attempted");
  assert.strictEqual(sessionStorage.getItem(STATE_KEY), null);
  assert.strictEqual(replacedUrl, "/");
});

test("a provider error with an unknown code is sanitised", async () => {
  resetEnv();
  const state = seedPending();
  currentSearch = `?error=${encodeURIComponent("<script>alert(1)</script>")}&state=${encodeURIComponent(state)}`;

  const result = await oauthHandleCallback();

  assert.ok(result && !result.ok);
  if (!result) return;
  assert.strictEqual(result.cancelled, undefined);
  assert.ok(!result.error.includes("<"), "markup never reaches the toast");
  assert.ok(!result.error.includes("script>"));
});

// ── Invalid state / provider ───────────────────────────────────────────
test("a mismatched state fails, cleans up, and never exchanges", async () => {
  resetEnv();
  seedPending();
  currentSearch = "?code=auth-code&state=spotify%3Aother-nonce";

  const result = await oauthHandleCallback();

  assert.ok(result && !result.ok);
  if (result.ok) return;
  assert.match(result.error, /verif|state/i);
  assert.strictEqual(fetchCalls.length, 0);
  assert.strictEqual(sessionStorage.getItem(STATE_KEY), null);
  assert.strictEqual(replacedUrl, "/");
});

test("a missing state is a terminal, cleaned-up failure", async () => {
  resetEnv();
  seedPending();
  currentSearch = "?code=auth-code";

  const result = await oauthHandleCallback();

  assert.ok(result && !result.ok);
  if (result.ok) return;
  assert.match(result.error, /security state/i);
  assert.strictEqual(result.provider, "spotify");
  assert.strictEqual(fetchCalls.length, 0);
  assert.strictEqual(sessionStorage.getItem(STATE_KEY), null);
  assert.strictEqual(replacedUrl, "/");
});

test("a malformed state is rejected before any exchange", async () => {
  resetEnv();
  seedPending();
  currentSearch = "?code=auth-code&state=spotify";

  const result = await oauthHandleCallback();

  assert.ok(result && !result.ok);
  if (result.ok) return;
  assert.match(result.error, /malformed/i);
  assert.strictEqual(fetchCalls.length, 0);
  assert.strictEqual(sessionStorage.getItem(STATE_KEY), null);
});

test("an unknown provider is rejected and cleaned up", async () => {
  beginCallback("gitlab");

  const result = await oauthHandleCallback();

  assert.ok(result && !result.ok);
  if (result.ok) return;
  assert.match(result.error, /not recognised/i);
  assert.strictEqual(result.provider, "gitlab");
  assert.strictEqual(fetchCalls.length, 0);
  assert.strictEqual(replacedUrl, "/");
});

test("a code without a PKCE verifier cannot be exchanged", async () => {
  resetEnv();
  const state = seedPending();
  sessionData.delete(VERIFIER_KEY);
  currentSearch = `?code=auth-code&state=${encodeURIComponent(state)}`;

  const result = await oauthHandleCallback();

  assert.ok(result && !result.ok);
  if (result.ok) return;
  assert.match(result.error, /session expired/i);
  assert.strictEqual(fetchCalls.length, 0);
  assert.strictEqual(sessionStorage.getItem(STATE_KEY), null);
});

// ── Token endpoint failures ────────────────────────────────────────────
function arrangeExchange(): void {
  beginCallback();
}

test("a non-2xx response reports a mapped provider error", async () => {
  arrangeExchange();
  fetchImpl = () => Promise.resolve(jsonResponse({ error: "invalid_grant" }, 400));

  const result = await oauthHandleCallback();

  assert.ok(result && !result.ok);
  if (result.ok) return;
  assert.match(result.error, /authorization code was rejected/i);
  assert.strictEqual(loadCredentials("spotify"), null);
  assert.strictEqual(replacedUrl, "/");
});

test("the proxy's not_configured message reaches the user", async () => {
  beginCallback("github");
  fetchImpl = () =>
    Promise.resolve(
      jsonResponse(
        {
          error: "not_configured",
          message: "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET as Pages secrets.",
        },
        501,
      ),
    );

  const result = await oauthHandleCallback();

  assert.ok(result && !result.ok);
  if (result.ok) return;
  assert.match(result.error, /GITHUB_CLIENT_ID/);
});

test("an unreadable response body fails without throwing", async () => {
  arrangeExchange();
  fetchImpl = () =>
    Promise.resolve(
      new Response("<html>gateway error</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );

  const result = await oauthHandleCallback();

  assert.ok(result && !result.ok);
  if (result.ok) return;
  assert.match(result.error, /unreadable/i);
  assert.strictEqual(loadCredentials("spotify"), null);
});

test("a 2xx without an access_token is a failure, not a connection", async () => {
  arrangeExchange();
  fetchImpl = () => Promise.resolve(jsonResponse({ token_type: "Bearer" }));

  const result = await oauthHandleCallback();

  assert.ok(result && !result.ok);
  if (result.ok) return;
  assert.match(result.error, /access token/i);
  assert.strictEqual(loadCredentials("spotify"), null);
  assert.strictEqual(replacedUrl, "/");
});

test("a rejected fetch is reported as a network error", async () => {
  arrangeExchange();
  fetchImpl = () => Promise.reject(new TypeError("Failed to fetch"));

  const result = await oauthHandleCallback();

  assert.ok(result && !result.ok);
  if (result.ok) return;
  assert.match(result.error, /network error/i);
  assert.strictEqual(replacedUrl, "/");
});

test("error text is sanitised and never carries the token", async () => {
  arrangeExchange();
  fetchImpl = () =>
    Promise.resolve(
      jsonResponse(
        {
          access_token: "super-secret-token",
          error: "invalid_grant",
          error_description: "<img src=x onerror=alert(1)>",
        },
        400,
      ),
    );

  const result = await oauthHandleCallback();

  assert.ok(result && !result.ok);
  if (result.ok) return;
  assert.ok(!result.error.includes("<"));
  assert.ok(!result.error.includes("super-secret-token"));
  assert.ok(!result.error.toLowerCase().includes("access_token"));
});

// ── Non-callbacks ──────────────────────────────────────────────────────
test("an ordinary page load is left completely untouched", async () => {
  resetEnv("?utm_source=newsletter&theme=aurora");
  seedPending();

  const result = await oauthHandleCallback();

  assert.strictEqual(result, null);
  assert.strictEqual(replacedUrl, null, "the URL is not rewritten");
  assert.strictEqual(
    sessionStorage.getItem(STATE_KEY),
    "spotify:nonce123",
    "pending state survives a non-OAuth load",
  );
});

test("an unrelated ?code= without callback context is ignored", async () => {
  resetEnv("?code=not-ours&ref=docs");

  const result = await oauthHandleCallback();

  assert.strictEqual(result, null);
  assert.strictEqual(replacedUrl, null);
  assert.strictEqual(fetchCalls.length, 0);
});

// ── Login ──────────────────────────────────────────────────────────────
test("oauthLogin stores one-time PKCE state and redirects", async () => {
  resetEnv();

  await oauthLogin("github", "my-client-id");

  assert.ok(assignedUrl, "the browser was redirected to the provider");
  const url = new URL(assignedUrl!);
  assert.strictEqual(url.origin + url.pathname, OAUTH_PROVIDERS.github!.authorizeUrl);
  assert.strictEqual(url.searchParams.get("response_type"), "code");
  assert.strictEqual(url.searchParams.get("client_id"), "my-client-id");
  assert.strictEqual(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok((url.searchParams.get("code_challenge") ?? "").length > 0);
  assert.strictEqual(
    url.searchParams.get("state"),
    sessionStorage.getItem(STATE_KEY),
  );
  assert.ok(sessionStorage.getItem(VERIFIER_KEY));
  assert.strictEqual(localStorage.getItem("sc_github_client_id"), "my-client-id");
});

test("oauthLogin ignores an unknown provider and an empty client ID", async () => {
  resetEnv();

  await oauthLogin("gitlab", "my-client-id");
  await oauthLogin("github", "  !!  ");

  assert.strictEqual(assignedUrl, null);
  assert.strictEqual(sessionStorage.getItem(STATE_KEY), null);
});
