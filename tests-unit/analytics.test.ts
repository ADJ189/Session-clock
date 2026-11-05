import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomStubs } from "./dom-stubs.ts";
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

installDomStubs();
const Pom = await import("../src/pomodoro.ts");

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

  assert.strictEqual(getAnalyticsPreference(), "auto");
  assert.strictEqual(isAutoBlocked(), false);
  assert.strictEqual(isAnalyticsAllowed(false), true);
});

test("setAnalyticsPreference saves 'on' and 'off'", () => {
  setAnalyticsPreference("off");
  assert.strictEqual(getAnalyticsPreference(), "off");
  assert.strictEqual(isAnalyticsAllowed(false), false);

  setAnalyticsPreference("on");
  assert.strictEqual(getAnalyticsPreference(), "on");
  assert.strictEqual(isAnalyticsAllowed(false), true);

  resetAnalyticsToAuto();
  assert.strictEqual(getAnalyticsPreference(), "auto");
});

test("auto-blocked marker suppresses auto analytics until cleared", () => {
  resetAnalyticsToAuto();
  localStorage.setItem(ANALYTICS_AUTO_BLOCKED_KEY, "1");

  assert.strictEqual(isAutoBlocked(), true);
  assert.strictEqual(isAnalyticsAllowed(false), false);

  // Switching explicitly to 'on' clears the marker
  setAnalyticsPreference("on");
  assert.strictEqual(isAutoBlocked(), false);
  assert.strictEqual(isAnalyticsAllowed(false), true);

  // Switch back to auto mode before testing marker again
  resetAnalyticsToAuto();
  localStorage.setItem(ANALYTICS_AUTO_BLOCKED_KEY, "1");
  assert.strictEqual(isAnalyticsAllowed(false), false);

  // Resetting to auto clears the marker
  resetAnalyticsToAuto();
  assert.strictEqual(isAutoBlocked(), false);
  assert.strictEqual(isAnalyticsAllowed(false), true);
});

test("privacyMode overrides preference and suppresses analytics", () => {
  setAnalyticsPreference("on");
  assert.strictEqual(isAnalyticsAllowed(false), true);
  assert.strictEqual(isAnalyticsAllowed(true), false);

  resetAnalyticsToAuto();
  assert.strictEqual(isAnalyticsAllowed(false), true);
  assert.strictEqual(isAnalyticsAllowed(true), false);
});

test("unloadAnalytics sets disabled-by-user status without throwing", () => {
  _resetAnalyticsForTesting();
  unloadAnalytics();
  assert.strictEqual(getAnalyticsStatus(), "disabled-by-user");
});

test("status listener receives runtime status changes", () => {
  _resetAnalyticsForTesting();
  const statuses: string[] = [];
  const unsubscribe = onAnalyticsStatusChange((st) => statuses.push(st));

  unloadAnalytics();
  assert.ok(statuses.includes("disabled-by-user"));

  unsubscribe();
  const countBefore = statuses.length;
  unloadAnalytics();
  assert.strictEqual(statuses.length, countBefore);
});

test("loadAnalytics returns false immediately when privacy mode is active", async () => {
  _resetAnalyticsForTesting();
  const result = await loadAnalytics(true);
  assert.strictEqual(result, false);
  assert.strictEqual(getAnalyticsStatus(), "disabled-by-user");
});

test("CLOUDFLARE_BEACON_URL is the official beacon endpoint", () => {
  assert.strictEqual(
    CLOUDFLARE_BEACON_URL,
    "https://static.cloudflareinsights.com/beacon.min.js",
  );
});

test("syncAnalytics sets status to unavailable when auto-blocked marker is set", () => {
  _resetAnalyticsForTesting();
  resetAnalyticsToAuto();
  localStorage.setItem(ANALYTICS_AUTO_BLOCKED_KEY, "1");
  syncAnalytics(false);
  assert.strictEqual(getAnalyticsStatus(), "unavailable");
});

test("unloadAnalytics removes beacon globals and guards sendBeacon", () => {
  _resetAnalyticsForTesting();
  const prevWin = (globalThis as any).window;
  const globalWin = prevWin || {};
  (globalThis as any).window = globalWin;
  globalWin.location = {
    href: "https://sessionclock.com/",
    origin: "https://sessionclock.com",
    pathname: "/",
    reload: () => {},
  };
  globalWin.__cfBeacon = { token: "test" };

  const beaconCalls: string[] = [];
  const prevSendBeacon = (navigator as any).sendBeacon;
  (navigator as any).sendBeacon = (url: string) => {
    beaconCalls.push(url);
    return true;
  };

  try {
    unloadAnalytics();

    assert.strictEqual(globalWin.__cfBeacon, undefined);
    // sendBeacon to cloudflareinsights should be swallowed
    navigator.sendBeacon("https://cloudflareinsights.com/cdn-cgi/rum");
    assert.strictEqual(beaconCalls.length, 0);

    // sendBeacon to other URLs should pass through
    navigator.sendBeacon("https://example.com/other");
    assert.strictEqual(beaconCalls.length, 1);
  } finally {
    if (prevSendBeacon) {
      (navigator as any).sendBeacon = prevSendBeacon;
    } else {
      delete (navigator as any).sendBeacon;
    }
    (globalThis as any).window = prevWin;
  }
});

test("enabling analytics restores sendBeacon or allows beacon measurements", () => {
  _resetAnalyticsForTesting();
  const prevWin = (globalThis as any).window;
  const globalWin = prevWin || {};
  (globalThis as any).window = globalWin;
  globalWin.location = {
    href: "https://sessionclock.com/",
    origin: "https://sessionclock.com",
    pathname: "/",
    reload: () => {},
  };

  const beaconCalls: string[] = [];
  const prevSendBeacon = (navigator as any).sendBeacon;
  (navigator as any).sendBeacon = (url: string) => {
    beaconCalls.push(url);
    return true;
  };

  try {
    // 1. Unload analytics -> guard is installed, CF beacon dropped
    unloadAnalytics();
    navigator.sendBeacon("https://cloudflareinsights.com/cdn-cgi/rum");
    assert.strictEqual(beaconCalls.length, 0);

    // 2. Enable analytics -> preference is 'on'
    setAnalyticsPreference("on");
    navigator.sendBeacon("https://cloudflareinsights.com/cdn-cgi/rum");
    assert.strictEqual(beaconCalls.length, 1);
  } finally {
    if (prevSendBeacon) {
      (navigator as any).sendBeacon = prevSendBeacon;
    } else {
      delete (navigator as any).sendBeacon;
    }
    (globalThis as any).window = prevWin;
  }
});

test("pomodoro session snapshot preserves progress across reload", () => {
  Pom.setActive(true);
  Pom.restoreSessionSnapshot({
    active: true,
    phase: "work",
    phaseElapsed: 45000,
    pomCount: 3,
  });
  const snap = Pom.getSessionSnapshot();
  assert.strictEqual(snap.active, true);
  assert.strictEqual(snap.phase, "work");
  assert.strictEqual(snap.pomCount, 3);
  assert.ok(snap.phaseElapsed >= 45000);
  Pom.setActive(false);
});

test("DATA_CATEGORIES includes sc_analytics_mode and sc_analytics_auto_blocked", () => {
  const prefsCat = DATA_CATEGORIES.find((c) => c.id === "preferences");
  assert.ok(prefsCat);
  assert.ok(prefsCat.keys.includes(ANALYTICS_STORAGE_KEY));

  const sysCat = DATA_CATEGORIES.find((c) => c.id === "system");
  assert.ok(sysCat);
  assert.ok(sysCat.keys.includes(ANALYTICS_AUTO_BLOCKED_KEY));
});

test("unloadAnalytics settles pending load promise and allows new load", async () => {
  _resetAnalyticsForTesting();
  setAnalyticsPreference("on");

  // Start loading (will be pending waiting for script onload or timeout)
  const pending = loadAnalytics(false);
  assert.strictEqual(getAnalyticsStatus(), "loading");

  // Unload while in flight
  unloadAnalytics();
  const res = await pending;
  assert.strictEqual(res, false);
  assert.strictEqual(getAnalyticsStatus(), "disabled-by-user");

  // Starting a new load should succeed in creating a new attempt without being stuck on old promise
  setAnalyticsPreference("on");
  const secondAttempt = loadAnalytics(false);
  assert.strictEqual(getAnalyticsStatus(), "loading");
  unloadAnalytics();
  await secondAttempt;
});

test("sendBeacon guard accurately filters cloudflareinsights without incomplete substring matching", () => {
  _resetAnalyticsForTesting();
  const prevWin = (globalThis as any).window;
  const globalWin = prevWin || {};
  (globalThis as any).window = globalWin;
  globalWin.location = {
    href: "https://sessionclock.com/",
    origin: "https://sessionclock.com",
    pathname: "/",
    reload: () => {},
  };

  const beaconCalls: string[] = [];
  const prevSendBeacon = (navigator as any).sendBeacon;
  (navigator as any).sendBeacon = (url: string) => {
    beaconCalls.push(url);
    return true;
  };

  try {
    setAnalyticsPreference("off");
    unloadAnalytics();

    // 1. Exact match and official subdomain should be blocked (dropped)
    navigator.sendBeacon("https://cloudflareinsights.com/cdn-cgi/rum");
    navigator.sendBeacon("https://static.cloudflareinsights.com/beacon.min.js");
    assert.strictEqual(beaconCalls.length, 0);

    // 2. Lookalike domain with cloudflareinsights as suffix must NOT be dropped
    navigator.sendBeacon("https://evilcloudflareinsights.com/cdn-cgi/rum");
    assert.strictEqual(beaconCalls.length, 1);

    // 3. Unrelated domain with cloudflareinsights in query string must NOT be dropped
    navigator.sendBeacon("https://example.com/track?ref=cloudflareinsights.com");
    assert.strictEqual(beaconCalls.length, 2);
  } finally {
    if (prevSendBeacon) {
      (navigator as any).sendBeacon = prevSendBeacon;
    } else {
      delete (navigator as any).sendBeacon;
    }
    (globalThis as any).window = prevWin;
  }
});
