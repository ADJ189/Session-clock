import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomStubs } from "./dom-stubs.ts";

installDomStubs();

const g = globalThis as unknown as Record<string, unknown>;

const localData = new Map<string, string>();
const fakeLocalStorage = {
  getItem: (key: string) => localData.get(key) ?? null,
  setItem: (key: string, value: string) => localData.set(key, String(value)),
  removeItem: (key: string) => localData.delete(key),
  clear: () => localData.clear(),
};
Object.defineProperty(g, "localStorage", {
  configurable: true,
  enumerable: true,
  value: fakeLocalStorage,
});

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

const fakeLocation = {
  origin: "https://clock.example",
  pathname: "/",
  hash: "",
  search: "",
  href: "https://clock.example/",
  assign() {},
};
Object.defineProperty(g, "location", {
  configurable: true,
  enumerable: true,
  value: fakeLocation,
});
if (g.window && g.window !== g) {
  Object.defineProperty(g.window as object, "location", {
    configurable: true,
    enumerable: true,
    value: fakeLocation,
  });
}

const {
  isGoogleConnected,
  isYouTubeConnected,
  isGCalConnected,
  disconnectGoogle,
  disconnectAll,
  saveGCalCredentials,
  LEGACY_GOOGLE_MIGRATION_KEY,
} = await import("../src/integrations.ts");
const { saveCredentials, loadCredentials } = await import("../src/auth.ts");

function setupConnected(options: {
  googleToken?: string;
  youtube?: boolean;
  gcalOAuth?: boolean;
}) {
  localData.clear();
  sessionData.clear();
  if (options.googleToken) {
    saveCredentials("google", { token: options.googleToken });
  }
  if (options.youtube) {
    saveCredentials("youtube", { connected: "true" });
  }
  if (options.gcalOAuth) {
    saveCredentials("gcal", { oauth: "true" });
  }
}

function assertConnectionState(expected: {
  google: boolean;
  youtube: boolean;
  gcal: boolean;
}) {
  assert.strictEqual(isGoogleConnected(), expected.google);
  assert.strictEqual(isYouTubeConnected(), expected.youtube);
  assert.strictEqual(isGCalConnected(), expected.gcal);
}

test("Calendar disconnect clears shared Google credential when no YouTube connection exists", () => {
  setupConnected({ googleToken: "google-token-123", gcalOAuth: true });
  assertConnectionState({ google: true, youtube: false, gcal: true });

  disconnectAll("gcal");
  assertConnectionState({ google: false, youtube: false, gcal: false });
});

test("Calendar disconnect preserves shared Google credential when YouTube is independently connected", () => {
  setupConnected({
    googleToken: "google-token-123",
    youtube: true,
    gcalOAuth: true,
  });
  assertConnectionState({ google: true, youtube: true, gcal: true });

  disconnectAll("gcal");
  assertConnectionState({ google: true, youtube: true, gcal: false });

  disconnectAll("youtube");
  assertConnectionState({ google: false, youtube: false, gcal: false });
});

test("YouTube disconnect preserves shared Google credential when Calendar is independently connected", () => {
  setupConnected({
    googleToken: "google-token-123",
    youtube: true,
    gcalOAuth: true,
  });
  assertConnectionState({ google: true, youtube: true, gcal: true });

  disconnectAll("youtube");
  assertConnectionState({ google: true, youtube: false, gcal: true });

  disconnectAll("gcal");
  assertConnectionState({ google: false, youtube: false, gcal: false });
});

test("GCal API key disconnect works and does not affect Google or YouTube", () => {
  localData.clear();
  sessionData.clear();

  saveGCalCredentials("test-api-key", "primary");
  assert.strictEqual(isGCalConnected(), true);
  assert.strictEqual(isGoogleConnected(), false);
  assert.strictEqual(isYouTubeConnected(), false);

  disconnectAll("gcal");
  assert.strictEqual(isGCalConnected(), false);
});

test("googleLogin sets auth target for gcal and youtube", async () => {
  sessionData.clear();
  const { googleLogin, GOOGLE_AUTH_TARGET_KEY } = await import(
    "../src/integrations.ts"
  );

  // Calling googleLogin with gcal sets target to gcal
  await googleLogin("test-client-id", "gcal");
  assert.strictEqual(sessionData.get(GOOGLE_AUTH_TARGET_KEY), "gcal");

  // Calling googleLogin with youtube (or default) sets target to youtube
  await googleLogin("test-client-id", "youtube");
  assert.strictEqual(sessionData.get(GOOGLE_AUTH_TARGET_KEY), "youtube");
});

test("disconnectGoogle cleans up google, youtube, and gcal oauth credentials", () => {
  setupConnected({ googleToken: "token", youtube: true, gcalOAuth: true });
  disconnectGoogle();
  assertConnectionState({ google: false, youtube: false, gcal: false });
});

test("legacy Google token backfills YouTube and Calendar markers once", () => {
  setupConnected({ googleToken: "legacy-google-token" });
  assertConnectionState({ google: true, youtube: true, gcal: true });
  assert.strictEqual(loadCredentials("youtube")?.connected, "true");
  assert.strictEqual(loadCredentials("gcal")?.oauth, "true");
  assert.strictEqual(localData.get(LEGACY_GOOGLE_MIGRATION_KEY), "1");

  // The one-time marker prevents a later explicit disconnect being undone.
  disconnectAll("youtube");
  assertConnectionState({ google: true, youtube: false, gcal: true });

  disconnectAll("gcal");
  assertConnectionState({ google: false, youtube: false, gcal: false });
});

test("legacy migration preserves existing Calendar API-key data", () => {
  localData.clear();
  sessionData.clear();

  saveCredentials("google", { token: "legacy-google-token" });
  saveGCalCredentials("legacy-api-key", "team-calendar");

  assert.strictEqual(isGCalConnected(), true);
  const gcal = loadCredentials("gcal");
  assert.strictEqual(gcal?.apiKey, "legacy-api-key");
  assert.strictEqual(gcal?.calendarId, "team-calendar");
  assert.strictEqual(gcal?.oauth, "true");
});

test("YouTube disconnect with API-key-only Calendar clears Google but keeps the key", () => {
  localData.clear();
  sessionData.clear();

  saveCredentials("google", { token: "google-token-123" });
  saveCredentials("youtube", { connected: "true" });
  saveGCalCredentials("calendar-api-key", "primary");

  assert.strictEqual(isYouTubeConnected(), true);
  assert.strictEqual(isGCalConnected(), true);
  assert.strictEqual(isGoogleConnected(), true);

  // Calendar is API-key-only, so it does not need the shared OAuth token.
  disconnectAll("youtube");

  assert.strictEqual(isYouTubeConnected(), false);
  assert.strictEqual(isGoogleConnected(), false);
  assert.strictEqual(isGCalConnected(), true);
  const gcal = loadCredentials("gcal");
  assert.strictEqual(gcal?.apiKey, "calendar-api-key");
  assert.strictEqual(gcal?.calendarId, "primary");
  assert.strictEqual(gcal?.oauth, undefined);
});
