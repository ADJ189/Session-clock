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
if (g.window) {
  (g.window as Record<string, unknown>).location = fakeLocation;
}

const {
  isGoogleConnected,
  isYouTubeConnected,
  isGCalConnected,
  disconnectGoogle,
  disconnectAll,
  saveGCalCredentials,
} = await import("../src/integrations.ts");
const { saveCredentials } = await import("../src/auth.ts");

test("Calendar disconnect clears shared Google credential when no YouTube connection exists", () => {
  localData.clear();
  sessionData.clear();

  // Simulate Calendar-only login: Google token exists, and GCal has oauth: true
  saveCredentials("google", { token: "google-token-123" });
  saveCredentials("gcal", { oauth: "true" });

  assert.strictEqual(isGoogleConnected(), true);
  assert.strictEqual(isGCalConnected(), true);
  assert.strictEqual(isYouTubeConnected(), false);

  // Disconnect GCal
  disconnectAll("gcal");

  // Displayed connection state and stored credential must agree
  assert.strictEqual(isGCalConnected(), false);
  assert.strictEqual(isGoogleConnected(), false);
  assert.strictEqual(isYouTubeConnected(), false);
});

test("Calendar disconnect preserves shared Google credential when YouTube is independently connected", () => {
  localData.clear();
  sessionData.clear();

  // Simulate both connected
  saveCredentials("google", { token: "google-token-123" });
  saveCredentials("youtube", { connected: "true" });
  saveCredentials("gcal", { oauth: "true" });

  assert.strictEqual(isGoogleConnected(), true);
  assert.strictEqual(isYouTubeConnected(), true);
  assert.strictEqual(isGCalConnected(), true);

  // Disconnect GCal
  disconnectAll("gcal");

  // GCal is disconnected
  assert.strictEqual(isGCalConnected(), false);
  // YouTube remains connected and keeps Google credential
  assert.strictEqual(isYouTubeConnected(), true);
  assert.strictEqual(isGoogleConnected(), true);

  // Now disconnect YouTube
  disconnectAll("youtube");

  // Both are disconnected, Google credential cleared
  assert.strictEqual(isYouTubeConnected(), false);
  assert.strictEqual(isGoogleConnected(), false);
});

test("YouTube disconnect preserves shared Google credential when Calendar is independently connected", () => {
  localData.clear();
  sessionData.clear();

  saveCredentials("google", { token: "google-token-123" });
  saveCredentials("youtube", { connected: "true" });
  saveCredentials("gcal", { oauth: "true" });

  disconnectAll("youtube");

  assert.strictEqual(isYouTubeConnected(), false);
  assert.strictEqual(isGCalConnected(), true);
  assert.strictEqual(isGoogleConnected(), true);

  disconnectAll("gcal");

  assert.strictEqual(isGCalConnected(), false);
  assert.strictEqual(isGoogleConnected(), false);
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
  localData.clear();
  sessionData.clear();

  saveCredentials("google", { token: "token" });
  saveCredentials("youtube", { connected: "true" });
  saveCredentials("gcal", { oauth: "true" });

  disconnectGoogle();

  assert.strictEqual(isGoogleConnected(), false);
  assert.strictEqual(isYouTubeConnected(), false);
  assert.strictEqual(isGCalConnected(), false);
});
