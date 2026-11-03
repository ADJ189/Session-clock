import { test } from "node:test";
import { assert, assertEquals } from "./assert.ts";
import {
  getAnalyticsPreference,
  setAnalyticsPreference,
  resetAnalyticsToAuto,
  isAnalyticsAllowed,
  isAutoBlocked,
  getAnalyticsStatus,
  unloadAnalytics,
  loadAnalytics,
  syncAnalytics,
  onAnalyticsStatusChange,
  _resetAnalyticsForTesting,
  ANALYTICS_STORAGE_KEY,
  ANALYTICS_AUTO_BLOCKED_KEY,
  CLOUDFLARE_BEACON_URL,
} from "../src/analytics.ts";
import { DATA_CATEGORIES } from "../src/privacy.ts";

// Setup in-memory localStorage stub if needed
const memStore = new Map<string, string>();
const storageStub = {
  getItem: (k: string) => memStore.get(k) ?? null,
  setItem: (k: string, v: string) => memStore.set(k, String(v)),
  removeItem: (k: string) => memStore.delete(k),
  clear: () => memStore.clear(),
};

if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = storageStub;
}

test("analytics defaults to 'auto' when storage is empty", () => {
  localStorage.removeItem(ANALYTICS_STORAGE_KEY);
  localStorage.removeItem(ANALYTICS_AUTO_BLOCKED_KEY);

  assertEquals(getAnalyticsPreference(), "auto");
  assertEquals(isAutoBlocked(), false);
  assertEquals(isAnalyticsAllowed(false), true);
});

test("setAnalyticsPreference saves 'on' and 'off'", () => {
  setAnalyticsPreference("off");
  assertEquals(getAnalyticsPreference(), "off");
  assertEquals(isAnalyticsAllowed(false), false);

  setAnalyticsPreference("on");
  assertEquals(getAnalyticsPreference(), "on");
  assertEquals(isAnalyticsAllowed(false), true);

  resetAnalyticsToAuto();
  assertEquals(getAnalyticsPreference(), "auto");
});

test("auto-blocked marker suppresses auto analytics until cleared", () => {
  resetAnalyticsToAuto();
  localStorage.setItem(ANALYTICS_AUTO_BLOCKED_KEY, "1");

  assertEquals(isAutoBlocked(), true);
  assertEquals(isAnalyticsAllowed(false), false);

  // Switching explicitly to 'on' clears the marker
  setAnalyticsPreference("on");
  assertEquals(isAutoBlocked(), false);
  assertEquals(isAnalyticsAllowed(false), true);

  // Switch back to auto mode before testing marker again
  resetAnalyticsToAuto();
  localStorage.setItem(ANALYTICS_AUTO_BLOCKED_KEY, "1");
  assertEquals(isAnalyticsAllowed(false), false);

  // Resetting to auto clears the marker
  resetAnalyticsToAuto();
  assertEquals(isAutoBlocked(), false);
  assertEquals(isAnalyticsAllowed(false), true);
});

test("privacyMode overrides preference and suppresses analytics", () => {
  setAnalyticsPreference("on");
  assertEquals(isAnalyticsAllowed(false), true);
  assertEquals(isAnalyticsAllowed(true), false);

  resetAnalyticsToAuto();
  assertEquals(isAnalyticsAllowed(false), true);
  assertEquals(isAnalyticsAllowed(true), false);
});

test("unloadAnalytics sets disabled-by-user status without throwing", () => {
  _resetAnalyticsForTesting();
  unloadAnalytics();
  assertEquals(getAnalyticsStatus(), "disabled-by-user");
});

test("status listener receives runtime status changes", () => {
  _resetAnalyticsForTesting();
  const statuses: string[] = [];
  const unsubscribe = onAnalyticsStatusChange((st) => statuses.push(st));

  unloadAnalytics();
  assert(statuses.includes("disabled-by-user"));

  unsubscribe();
  const countBefore = statuses.length;
  unloadAnalytics();
  assertEquals(statuses.length, countBefore);
});

test("loadAnalytics returns false immediately when privacy mode is active", async () => {
  _resetAnalyticsForTesting();
  const result = await loadAnalytics(true);
  assertEquals(result, false);
  assertEquals(getAnalyticsStatus(), "disabled-by-user");
});

test("CLOUDFLARE_BEACON_URL is the official beacon endpoint", () => {
  assertEquals(
    CLOUDFLARE_BEACON_URL,
    "https://static.cloudflareinsights.com/beacon.min.js",
  );
});

test("syncAnalytics sets status to unavailable when auto-blocked marker is set", () => {
  _resetAnalyticsForTesting();
  resetAnalyticsToAuto();
  localStorage.setItem(ANALYTICS_AUTO_BLOCKED_KEY, "1");
  syncAnalytics(false);
  assertEquals(getAnalyticsStatus(), "unavailable");
});

test("unloadAnalytics removes beacon globals and guards sendBeacon", () => {
  _resetAnalyticsForTesting();
  const globalWin = (globalThis as any).window || {};
  (globalThis as any).window = globalWin;
  globalWin.__cfBeacon = { token: "test" };

  const beaconCalls: string[] = [];
  (navigator as any).sendBeacon = (url: string) => {
    beaconCalls.push(url);
    return true;
  };

  unloadAnalytics();

  assertEquals(globalWin.__cfBeacon, undefined);
  // sendBeacon to cloudflareinsights should be swallowed
  navigator.sendBeacon("https://cloudflareinsights.com/cdn-cgi/rum");
  assertEquals(beaconCalls.length, 0);

  // sendBeacon to other URLs should pass through
  navigator.sendBeacon("https://example.com/other");
  assertEquals(beaconCalls.length, 1);
});

test("DATA_CATEGORIES includes sc_analytics_mode and sc_analytics_auto_blocked", () => {
  const prefsCat = DATA_CATEGORIES.find((c) => c.id === "preferences");
  assert(prefsCat);
  assert(prefsCat.keys.includes(ANALYTICS_STORAGE_KEY));

  const sysCat = DATA_CATEGORIES.find((c) => c.id === "system");
  assert(sysCat);
  assert(sysCat.keys.includes(ANALYTICS_AUTO_BLOCKED_KEY));
});
