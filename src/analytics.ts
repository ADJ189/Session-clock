// ── Optional Usage Analytics ──────────────────────────────────────────
// Privacy-first, optional Cloudflare Web Analytics integration.
//
// Behavior & Guarantees:
// 1. Never blocks startup: loaded only after the first paint / core ready mark.
// 2. Fault-tolerant: script failures or timeouts are non-fatal and never trigger
//    boot error screens.
// 3. User controlled: persisted preference (`auto` | `on` | `off`).
// 4. In Auto mode, if blocked or unavailable once, the failure is marked so
//    we don't retry repeatedly until the user enables it or resets to Auto.
// 5. Privacy Mode takes precedence: when active, analytics is strictly unloaded
//    and prevented from making outbound requests.
// 6. Diagnostics are sanitized: no token, secrets, or visitor PII are recorded.

import { safeGet, safeSet, safeRemove } from "./storage";

export type AnalyticsPreference = "auto" | "on" | "off";

export type AnalyticsRuntimeStatus =
  | "not-attempted"
  | "loading"
  | "active"
  | "unavailable"
  | "disabled-by-user";

export const ANALYTICS_STORAGE_KEY = "sc_analytics_mode";
export const ANALYTICS_AUTO_BLOCKED_KEY = "sc_analytics_auto_blocked";

export const CLOUDFLARE_BEACON_URL =
  "https://static.cloudflareinsights.com/beacon.min.js";

const SCRIPT_ID = "sc-cf-beacon";
const LOAD_TIMEOUT_MS = 5000;

let currentStatus: AnalyticsRuntimeStatus = "not-attempted";
const statusListeners = new Set<(status: AnalyticsRuntimeStatus) => void>();

function notifyStatusChange(): void {
  for (const listener of statusListeners) {
    try {
      listener(currentStatus);
    } catch {
      // Ignore listener errors
    }
  }
}

function setStatus(next: AnalyticsRuntimeStatus): void {
  if (currentStatus === next) return;
  currentStatus = next;
  notifyStatusChange();
}

/** Subscribe to analytics runtime status updates. */
export function onAnalyticsStatusChange(
  listener: (status: AnalyticsRuntimeStatus) => void,
): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/** Get current runtime status. */
export function getAnalyticsStatus(): AnalyticsRuntimeStatus {
  return currentStatus;
}

/** Read persisted preference: defaults to "auto" if unconfigured. */
export function getAnalyticsPreference(): AnalyticsPreference {
  const val = safeGet(ANALYTICS_STORAGE_KEY);
  if (val === "on" || val === "off" || val === "auto") {
    return val;
  }
  return "auto";
}

/** Check if the auto-mode failure marker is present. */
export function isAutoBlocked(): boolean {
  return safeGet(ANALYTICS_AUTO_BLOCKED_KEY) === "1";
}

/** Determine whether analytics should attempt to run given current settings and privacy mode. */
export function isAnalyticsAllowed(privacyModeActive = false): boolean {
  if (privacyModeActive) return false;
  const pref = getAnalyticsPreference();
  if (pref === "off") return false;
  if (pref === "on") return true;
  // "auto": allowed only if not previously blocked
  return !isAutoBlocked();
}

/** Safely record diagnostics without leaking any token. */
function recordAnalyticsDiagnostic(
  status: string,
  details?: Record<string, string | number | boolean | null>,
): void {
  try {
    const scWin = typeof window !== "undefined" ? (window as any) : null;
    const diag = scWin?.__scDiagnostics;
    if (diag && typeof diag.record === "function") {
      diag.record({
        subsystem: "analytics",
        kind: "event",
        message: `status=${status}`,
        details: {
          source: "cloudflare-web-analytics",
          status,
          ...details,
        },
      });
    }
  } catch {
    // Non-fatal
  }
}

let beforeReloadHook: (() => void) | null = null;
let originalSendBeacon: typeof navigator.sendBeacon | null = null;

export function setBeforeAnalyticsReload(fn: (() => void) | null): void {
  beforeReloadHook = fn;
}

function installSendBeaconGuard(): void {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.sendBeacon !== "function"
  ) {
    return;
  }
  if (!originalSendBeacon) {
    originalSendBeacon = navigator.sendBeacon.bind(navigator);
  }
  navigator.sendBeacon = (
    url: string | URL,
    data?: BodyInit | null,
  ): boolean => {
    const isPriv = safeGet("sc_privacy") === "1";
    if (isAnalyticsAllowed(isPriv)) {
      return originalSendBeacon ? originalSendBeacon(url, data) : true;
    }

    let isCf = false;
    try {
      const urlStr = typeof url === "string" ? url : (url?.href || String(url));
      const base =
        typeof window !== "undefined" && window.location?.href
          ? window.location.href
          : "https://sessionclock.com/";
      const parsed = new URL(urlStr, base);
      isCf =
        (parsed.protocol === "https:" || parsed.protocol === "http:") &&
        (parsed.hostname === "cloudflareinsights.com" ||
          parsed.hostname.endsWith(".cloudflareinsights.com"));
    } catch {
      isCf = false;
    }

    if (isCf) {
      return true; // silently drop while disabled
    }
    return originalSendBeacon ? originalSendBeacon(url, data) : true;
  };
}

export function restoreSendBeacon(): void {
  if (originalSendBeacon && typeof navigator !== "undefined") {
    navigator.sendBeacon = originalSendBeacon;
    originalSendBeacon = null;
  }
}

/** Remove any injected beacon script tag and guard against further measurements. */
export function unloadAnalytics(): void {
  const wasRunning = currentStatus === "active";

  if (cancelActiveLoad) {
    cancelActiveLoad();
  }
  activeLoadPromise = null;

  if (typeof document !== "undefined" && typeof document.getElementById === "function") {
    const el = document.getElementById(SCRIPT_ID);
    if (el) {
      el.remove();
    }
  }

  // Teardown / guard against running beacon sending any further outbound requests
  if (typeof window !== "undefined") {
    try {
      delete (window as any).__cfBeacon;
    } catch {
      (window as any).__cfBeacon = undefined;
    }
  }

  installSendBeaconGuard();

  // If the beacon has already run, it cannot be safely stopped in the running
  // JavaScript runtime (its PerformanceObserver and event listeners cannot be
  // unregistered externally). Persist the opt-out choice and reload into a page
  // that never loads it, before reporting it disabled.
  if (
    wasRunning &&
    typeof window !== "undefined" &&
    typeof window.location?.reload === "function"
  ) {
    if (
      safeGet(ANALYTICS_STORAGE_KEY) !== "off" &&
      safeGet("sc_privacy") !== "1"
    ) {
      safeSet(ANALYTICS_STORAGE_KEY, "off");
    }
    try {
      beforeReloadHook?.();
    } catch {
      // Non-fatal
    }
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("sc-before-analytics-reload"));
      } catch {
        // Non-fatal
      }
    }
    setStatus("disabled-by-user");
    recordAnalyticsDiagnostic("disabled-by-user");
    window.location.reload();
    return;
  }

  setStatus("disabled-by-user");
  recordAnalyticsDiagnostic("disabled-by-user");
}

let activeLoadPromise: Promise<boolean> | null = null;
let cancelActiveLoad: (() => void) | null = null;

/**
 * Attempt to load the Cloudflare Web Analytics beacon script.
 * Never throws, never rejects, and respects privacy mode & user preference.
 */
export async function loadAnalytics(privacyModeActive = false): Promise<boolean> {
  // 1. Check Privacy Mode
  if (privacyModeActive) {
    unloadAnalytics();
    return false;
  }

  // 2. Check User Preference
  const pref = getAnalyticsPreference();
  if (pref === "off") {
    unloadAnalytics();
    return false;
  }

  if (pref === "auto" && isAutoBlocked()) {
    setStatus("unavailable");
    recordAnalyticsDiagnostic("unavailable", { reason: "auto-blocked-persisted" });
    return false;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    setStatus("unavailable");
    return false;
  }

  restoreSendBeacon();

  // 3. Prevent duplicate in-flight loads or duplicate script tags
  if (document.getElementById(SCRIPT_ID)) {
    setStatus("active");
    return true;
  }

  if (activeLoadPromise) {
    return activeLoadPromise;
  }

  setStatus("loading");

  activeLoadPromise = new Promise<boolean>((resolve) => {
    let settled = false;
    let timer: number | null = null;

    const cleanup = () => {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      activeLoadPromise = null;
      cancelActiveLoad = null;
    };

    const cancel = () => {
      if (settled) return;
      settled = true;
      cleanup();
      document.getElementById(SCRIPT_ID)?.remove();
      resolve(false);
    };
    cancelActiveLoad = cancel;

    const handleSuccess = () => {
      if (settled) return;
      settled = true;
      cleanup();
      setStatus("active");
      recordAnalyticsDiagnostic("active");
      resolve(true);
    };

    const handleFailure = (reason: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      // Remove failed or timed out script tag
      document.getElementById(SCRIPT_ID)?.remove();
      // In auto mode, record failure marker so we don't spam attempts on every reload
      if (getAnalyticsPreference() === "auto") {
        safeSet(ANALYTICS_AUTO_BLOCKED_KEY, "1");
      }
      setStatus("unavailable");
      recordAnalyticsDiagnostic("unavailable", { reason });
      resolve(false);
    };

    try {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = CLOUDFLARE_BEACON_URL;
      script.defer = true;
      script.setAttribute("data-sc-optional", "true");

      // Optional token configuration if provided via environment or window
      const token =
        (window as any).__SC_CF_BEACON_TOKEN ||
        (typeof import.meta !== "undefined" &&
          (import.meta as any).env?.VITE_CF_BEACON_TOKEN) ||
        "";
      if (token) {
        script.setAttribute(
          "data-cf-beacon",
          JSON.stringify({ token: String(token) }),
        );
      }

      script.addEventListener("load", () => handleSuccess());
      script.addEventListener("error", () => handleFailure("script-load-failed"));

      timer = window.setTimeout(() => {
        handleFailure("load-timeout");
      }, LOAD_TIMEOUT_MS);

      (document.head || document.body).appendChild(script);
    } catch (err) {
      handleFailure(err instanceof Error ? err.message : "script-insertion-threw");
    }
  });

  return activeLoadPromise;
}

/** Set user analytics preference and sync runtime state. */
export function setAnalyticsPreference(
  mode: AnalyticsPreference,
  privacyModeActive = false,
): void {
  safeSet(ANALYTICS_STORAGE_KEY, mode);

  if (mode === "off") {
    unloadAnalytics();
  } else {
    // When explicitly setting to "auto" or "on", clear the previous failure marker
    safeRemove(ANALYTICS_AUTO_BLOCKED_KEY);
    restoreSendBeacon();
    void loadAnalytics(privacyModeActive);
  }
}

/** Reset to automatic mode. */
export function resetAnalyticsToAuto(privacyModeActive = false): void {
  setAnalyticsPreference("auto", privacyModeActive);
}

/** Synchronize runtime state with current preference and privacy mode. */
export function syncAnalytics(privacyModeActive = false): void {
  if (privacyModeActive) {
    unloadAnalytics();
    return;
  }
  const pref = getAnalyticsPreference();
  if (pref === "off") {
    unloadAnalytics();
    return;
  }
  if (pref === "auto" && isAutoBlocked()) {
    setStatus("unavailable");
    recordAnalyticsDiagnostic("unavailable", {
      reason: "auto-blocked-persisted",
    });
    return;
  }
  void loadAnalytics(privacyModeActive);
}

/** Initial startup hook: runs after first paint / core boot completion. */
export function initAnalytics(privacyModeActive = false): void {
  syncAnalytics(privacyModeActive);
}

/** Internal helper to reset module state for tests. */
export function _resetAnalyticsForTesting(): void {
  currentStatus = "not-attempted";
  statusListeners.clear();
  if (cancelActiveLoad) {
    cancelActiveLoad();
  }
  activeLoadPromise = null;
  cancelActiveLoad = null;
  beforeReloadHook = null;
  restoreSendBeacon();
  originalSendBeacon = null;
}
