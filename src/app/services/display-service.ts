// Display services: display modes, preferences, parallax, and idle tracking
import { safeGet } from "../../storage";
import { showToast } from "../ui/toast";
import * as Sound from "../../sound";
import * as Pom from "../../pomodoro";
import * as Integrations from "../../integrations";
import * as Motion from "../../motion";
import { setTier, getTier } from "../../perf";
import { invalidateCache } from "../../renderer";
import { CAPS, subscribeOrientation } from "../../platform";
import { stopWeather, initWeather, getWeatherOverlay } from "../../weather";
import { syncAnalytics, unloadAnalytics } from "../../analytics";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// Hide seconds / ms / 24h
const savedHideSeconds = safeGet("sc_hide_seconds");
const savedHideMs = safeGet("sc_hide_ms");
export let hideSeconds = savedHideSeconds === null ? true : savedHideSeconds === "1";
export let hideMs = savedHideMs === null ? true : savedHideMs === "1";
export let use24Hour = safeGet("sc_24h") === "1";
export let privacyMode = safeGet("sc_privacy") === "1";

let onUpdateClockCanvas: () => void = () => {};
let onSaveSessionState: () => void = () => {};
let isSessionRunning: () => boolean = () => false;

export function initDisplayService(options: {
  updateClockCanvas: () => void;
  saveSessionState: () => void;
  sessionRunning: () => boolean;
}) {
  onUpdateClockCanvas = options.updateClockCanvas;
  onSaveSessionState = options.saveSessionState;
  isSessionRunning = options.sessionRunning;

  // Apply persisted motion/animation preferences
  const reduceMotion =
    localStorage.getItem("sc_reduce_motion") === "1" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) document.body.classList.add("reduced-motion");
  if (localStorage.getItem("sc_calm_mode") === "1")
    document.body.classList.add("calm-mode");
  if (localStorage.getItem("sc_focus_mode") === "1")
    wireFocusModeListeners(true);
  if (localStorage.getItem("sc_idle_detect") === "1") wireIdleListeners(true);
  if (localStorage.getItem("sc_nowplaying_theme") === "1")
    startNowPlayingPoll();

  document.body.classList.toggle("hide-seconds", hideSeconds);
  document.body.classList.toggle("hide-ms", hideSeconds || hideMs);
  document.body.classList.toggle("use-24h", use24Hour);

  if (CAPS.deviceOrientation && !CAPS.deviceOrientationNeedsPermission) {
    attachGyroParallax();
  }

  // Cross-browser fullscreenchange sync
  [
    "fullscreenchange",
    "webkitfullscreenchange",
    "mozfullscreenchange",
    "MSFullscreenChange",
  ].forEach((evt) => {
    document.addEventListener(evt, () => {
      if (!currentFSElement() && kioskOn) {
        kioskOn = false;
        document.body.classList.remove("kiosk");
      }
    });
  });
}

export function applyUse24Hour(on: boolean) {
  use24Hour = on;
  localStorage.setItem("sc_24h", on ? "1" : "0");
  document.body.classList.toggle("use-24h", on);
  onUpdateClockCanvas();
  showToast(on ? "24-hour time on" : "12-hour time on");
}

export function applyHideSeconds(on: boolean) {
  hideSeconds = on;
  localStorage.setItem("sc_hide_seconds", on ? "1" : "0");
  document.body.classList.toggle("hide-seconds", on);
  document.body.classList.toggle("hide-ms", on || hideMs);
  onUpdateClockCanvas();
  showToast(on ? "Seconds hidden" : "Seconds shown");
}

export function applyHideMs(on: boolean) {
  hideMs = on;
  localStorage.setItem("sc_hide_ms", on ? "1" : "0");
  document.body.classList.toggle("hide-ms", on || hideSeconds);
  showToast(on ? "Milliseconds hidden" : "Milliseconds shown");
}

export function isPrivacyMode(): boolean {
  return privacyMode;
}

export function togglePrivacy() {
  privacyMode = !privacyMode;
  localStorage.setItem("sc_privacy", privacyMode ? "1" : "0");
  if (privacyMode) {
    stopWeather();
    const wp = $("weatherPill");
    if (wp) {
      wp.classList.remove("loaded");
    }
    document.body.style.fontFamily =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
    const settingsModal = $("settingsOverlay");
    if (settingsModal?.classList.contains("open")) {
      try {
        sessionStorage.setItem("sc_reopen_settings", "privacy");
      } catch {
        // ignore
      }
    }
    onSaveSessionState();
    unloadAnalytics();
    showToast("🔒 Privacy Mode: fonts, weather & analytics disabled");
  } else {
    syncAnalytics(false);
    initWeather(
      $("weatherIcon"),
      $("weatherText"),
      $("weatherPill"),
      isPrivacyMode,
      (_code, _temp, _desc) => {
        if (localStorage.getItem("sc_weather_theme") !== "0") {
          const overlay = getWeatherOverlay();
          const all = ["clear", "rain", "snow", "thunder", "fog", "cloudy"];
          all.forEach((c) => document.body.classList.remove(`weather-${c}`));
          if (overlay !== "none")
            document.body.classList.add(`weather-${overlay}`);
        }
      },
    );
    document.body.style.fontFamily = "";
    showToast("Privacy Mode off — reconnected");
  }
  const settingsToggle = document.getElementById("togglePrivacyS");
  if (settingsToggle) settingsToggle.classList.toggle("on", privacyMode);
}

// ── Display modes: Kiosk & Present ─────────────────────────────────────
let kioskOn = false;
let presentOn = false;

function requestFS(el: HTMLElement): Promise<void> {
  const fn = (el.requestFullscreen ||
    (el as any).webkitRequestFullscreen ||
    (el as any).mozRequestFullScreen ||
    (el as any).msRequestFullscreen) as
    | ((this: HTMLElement) => Promise<void> | void)
    | undefined;
  return Promise.resolve(fn?.call(el));
}

function exitFS(): Promise<void> {
  const fn = (document.exitFullscreen ||
    (document as any).webkitExitFullscreen ||
    (document as any).mozCancelFullScreen ||
    (document as any).msExitFullscreen) as
    | ((this: Document) => Promise<void> | void)
    | undefined;
  return Promise.resolve(fn?.call(document));
}

function currentFSElement(): Element | null {
  return (
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement ||
    null
  );
}

export function toggleKiosk() {
  kioskOn = !kioskOn;
  document.body.classList.toggle("kiosk", kioskOn);
  if (kioskOn) requestFS(document.documentElement).catch(() => {});
  else exitFS().catch(() => {});
}

export function isKioskOn(): boolean {
  return kioskOn;
}

export function togglePresent() {
  presentOn = !presentOn;
  document.body.classList.toggle("present", presentOn);
}

export function isPresentOn(): boolean {
  return presentOn;
}

// ── Zen Mode ──────────────────────────────────────────────────────────
export let zenOn = false;
let zenHintTimer: number | null = null;
let zenMouseTimer: number | null = null;
let zenSoundStartedByZen = false;

export function getZenDimDelayMs(): number {
  const v = localStorage.getItem("sc_zen_dim_delay");
  return v ? Number.parseInt(v, 10) : 2500;
}

export function toggleZen() {
  zenOn = !zenOn;
  document.body.classList.toggle("zen-mode", zenOn);
  document.body.classList.toggle(
    "zen-no-rings",
    localStorage.getItem("sc_zen_rings") === "0",
  );
  if (zenOn) {
    showToast("🧘 Zen Mode — Press Esc to exit", 3000);
    const zenSoundId = localStorage.getItem("sc_zen_sound") || "";
    if (
      zenSoundId &&
      !Sound.isPlaying(zenSoundId) &&
      Sound.isFileTrackSupported(zenSoundId)
    ) {
      Sound.play(zenSoundId);
      zenSoundStartedByZen = true;
    } else {
      zenSoundStartedByZen = false;
    }
    zenMouseTimer = window.setTimeout(() => {}, 0);
    const onMove = () => {
      document.body.classList.add("zen-hinting");
      if (zenHintTimer) clearTimeout(zenHintTimer);
      zenHintTimer = window.setTimeout(() => {
        document.body.classList.remove("zen-hinting");
      }, getZenDimDelayMs());
    };
    (window as any).__zenMoveHandler = onMove;
    window.addEventListener("mousemove", onMove, { passive: true });
  } else {
    document.body.classList.remove("zen-hinting");
    if (zenHintTimer) clearTimeout(zenHintTimer);
    const h = (window as any).__zenMoveHandler;
    if (h) window.removeEventListener("mousemove", h);
    delete (window as any).__zenMoveHandler;
    if (zenSoundStartedByZen) {
      const zenSoundId = localStorage.getItem("sc_zen_sound") || "";
      if (zenSoundId) Sound.stopTrack(zenSoundId);
      zenSoundStartedByZen = false;
    }
  }
}

// ── Focus Lock ────────────────────────────────────────────────────────
export let focusLockEnabled = safeGet("sc_focus_lock") === "1";
let focusLockTimer: number | null = null;
let focusLockBar: HTMLElement | null = null;

export function isFocusLocked(): boolean {
  return focusLockEnabled && Pom.isActive() && isSessionRunning();
}

export function isFocusLockEnabled(): boolean {
  return focusLockEnabled;
}

export function toggleFocusLock() {
  focusLockEnabled = !focusLockEnabled;
  localStorage.setItem("sc_focus_lock", focusLockEnabled ? "1" : "0");
}

export function focusLockIntercept(action: () => void): void {
  if (!isFocusLocked()) {
    action();
    return;
  }

  if (focusLockTimer !== null) {
    clearTimeout(focusLockTimer);
    focusLockTimer = null;
    if (focusLockBar) {
      focusLockBar.remove();
      focusLockBar = null;
    }
    action();
    return;
  }

  const bar = document.createElement("div");
  bar.className = "focus-lock-bar";
  const fill = document.createElement("div");
  fill.className = "focus-lock-fill";
  const lbl = document.createElement("span");
  lbl.className = "focus-lock-label";
  lbl.textContent = "Stay focused… click again to open";
  bar.append(fill, lbl);
  document.body.appendChild(bar);
  focusLockBar = bar;

  requestAnimationFrame(() => {
    fill.style.transition = "width 3s linear";
    fill.style.width = "100%";
  });

  focusLockTimer = window.setTimeout(() => {
    if (focusLockBar) {
      focusLockBar.remove();
      focusLockBar = null;
    }
    focusLockTimer = null;
    action();
  }, 3000);
}

// ── Calm Mode ─────────────────────────────────────────────────────────
export function applyCalmMode(on: boolean) {
  localStorage.setItem("sc_calm_mode", on ? "1" : "0");
  document.body.classList.toggle("calm-mode", on);
  if (on) {
    localStorage.setItem("sc_reduce_motion", "1");
    document.body.classList.add("reduced-motion");
    localStorage.setItem("sc_parallax", "0");
    setTier("med");
    invalidateCache();
  }
  showToast(on ? "🌿 Calm Mode on — simplified & lighter" : "Calm Mode off");
}

// ── Focus Mode ────────────────────────────────────────────────────────
let focusModeIdleTimer = 0;
function focusModeActivity() {
  document.body.classList.remove("focus-mode-hidden");
  scheduleFocusModeHide();
}

function scheduleFocusModeHide() {
  clearTimeout(focusModeIdleTimer);
  const delaySec = Number.parseInt(
    localStorage.getItem("sc_focus_mode_delay") || "4",
    10,
  );
  focusModeIdleTimer = window.setTimeout(
    () => {
      document.body.classList.add("focus-mode-hidden");
    },
    Math.max(1, delaySec) * 1000,
  );
}

export function wireFocusModeListeners(on: boolean) {
  document.removeEventListener("mousemove", focusModeActivity);
  document.removeEventListener("touchstart", focusModeActivity);
  document.removeEventListener("keydown", focusModeActivity);
  clearTimeout(focusModeIdleTimer);
  document.body.classList.remove("focus-mode-hidden");
  if (on) {
    document.addEventListener("mousemove", focusModeActivity, {
      passive: true,
    });
    document.addEventListener("touchstart", focusModeActivity, {
      passive: true,
    });
    document.addEventListener("keydown", focusModeActivity);
    scheduleFocusModeHide();
  }
}

export function applyFocusMode(on: boolean) {
  localStorage.setItem("sc_focus_mode", on ? "1" : "0");
  wireFocusModeListeners(on);
  showToast(
    on
      ? "🎯 Focus mode on: chrome hides when idle (tap screen to restore)"
      : "Focus mode off",
  );
}

// ── Idle Detection ────────────────────────────────────────────────────
let idleTimer = 0;
function scheduleIdleCheck() {
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    if (!document.hidden && !isSessionRunning()) {
      showToast("⏳ 15 minutes idle — ready to start a session?", 6000);
    }
  }, 15 * 60 * 1000);
}

function idleActivity() {
  scheduleIdleCheck();
}

export function wireIdleListeners(on: boolean) {
  document.removeEventListener("mousemove", idleActivity);
  document.removeEventListener("keydown", idleActivity);
  document.removeEventListener("touchstart", idleActivity);
  clearTimeout(idleTimer);
  if (on) {
    document.addEventListener("mousemove", idleActivity, { passive: true });
    document.addEventListener("keydown", idleActivity);
    document.addEventListener("touchstart", idleActivity, { passive: true });
    scheduleIdleCheck();
  }
}

export function applyIdleDetection(on: boolean) {
  localStorage.setItem("sc_idle_detect", on ? "1" : "0");
  wireIdleListeners(on);
  showToast(
    on ? "🔔 Idle nudge on (15 min, gentle reminder only)" : "Idle nudge off",
  );
}

// ── Parallax ──────────────────────────────────────────────────────────
export let parallaxX = 0;
export let parallaxY = 0;
export let targetPX = 0;
export let targetPY = 0;
const PARALLAX_STRENGTH = 18;
let gyroAttached = false;

export function setParallaxCoords(px: number, py: number) {
  parallaxX = px;
  parallaxY = py;
}

export function setTargetParallax(tx: number, ty: number) {
  targetPX = tx;
  targetPY = ty;
}

export function attachGyroParallax() {
  if (gyroAttached || !CAPS.deviceOrientation) return;
  gyroAttached = true;
  subscribeOrientation((o) => {
    if (o.gamma != null && o.beta != null) {
      targetPX = Math.max(
        -PARALLAX_STRENGTH,
        Math.min(PARALLAX_STRENGTH, o.gamma / 2),
      );
      targetPY = Math.max(
        -PARALLAX_STRENGTH,
        Math.min(PARALLAX_STRENGTH, (o.beta - 45) / 2),
      );
    }
  });
}

// ── Now Playing Poll ──────────────────────────────────────────────────
let nowPlayingPollTimer = 0;

export function startNowPlayingPoll() {
  stopNowPlayingPoll();
  nowPlayingPollTimer = window.setInterval(async () => {
    if (localStorage.getItem("sc_nowplaying_theme") !== "1") {
      stopNowPlayingPoll();
      return;
    }
    if (!Integrations.isSpotifyConnected()) return;
    try {
      const np = await Integrations.spotifyNowPlaying();
      if (np && np.playing) {
        // Will match theme if registered
      }
    } catch {
      // transient network error
    }
  }, 20_000);
}

export function stopNowPlayingPoll() {
  clearInterval(nowPlayingPollTimer);
  nowPlayingPollTimer = 0;
}

// ── GitHub Modal ──────────────────────────────────────────────────────
export function wireGithubCelebration() {
  const link = document.querySelector<HTMLAnchorElement>(
    '.topbar-icon-btn[href*="github.com"]',
  );
  const overlay = $("ghOverlay");
  if (!link || !overlay) return;

  const closeIt = () => overlay.classList.remove("open");

  link.addEventListener("click", (e) => {
    e.preventDefault();
    overlay.classList.add("open");
    void Motion.modalSpotlightIn($("ghOverlay")?.querySelector(".gh-modal"));

    void import("../../github")
      .then((m) => m.fetchRepoStats())
      .then((stats) => {
        if (!stats) return;
        const row = $("ghStats");
        if (!row) return;
        row.hidden = false;
        void Motion.countUp($("ghStatStars"), stats.stars);
        void Motion.countUp($("ghStatForks"), stats.forks);
      })
      .catch(() => {
        /* decorative */
      });
  });

  $("ghClose")?.addEventListener("click", closeIt);
  $("ghSkip")?.addEventListener("click", closeIt);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeIt();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeIt();
  });

  $("ghBtnView")?.addEventListener("click", () => setTimeout(closeIt, 400));
  $("ghBtnStar")?.addEventListener("click", () => setTimeout(closeIt, 400));
  $("ghBtnDonate")?.addEventListener("click", () => setTimeout(closeIt, 400));
}
