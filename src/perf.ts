// ── Performance & Adaptive Quality System ────────────────────────────
// Detects device capability at startup and adapts rendering quality.
// Tiers: LOW (weak device) | MED (average) | HIGH (powerful)
// Can be overridden by user in settings.

export type QualityTier = "low" | "med" | "high";
import { safeGet } from "./storage";
export type QualityMode = "auto" | "fixed";

let tier: QualityTier = "high";
// Whether `tier` is being driven by the FPS-adaptive logic below ('auto')
// or pinned by an explicit user/settings choice ('fixed'). Before this,
// setTier() always persisted `sc_quality`, but the automatic downgrade/
// upgrade in tickFps() only ever mutated the in-memory `tier` — it never
// touched storage. That made `sc_quality` in localStorage a reliable
// signal for "the user explicitly chose this" specifically because
// nothing else ever wrote it, which is what lets this infer the correct
// starting mode below without a migration.
let qualityMode: QualityMode = safeGet("sc_quality")
  ? "fixed"
  : "auto";
let frameCount = 0;
let fps = 60;
let lastFpsTs = performance.now();
let frameTimes: number[] = [];
let tabVisible = true;

// ── Tier detection ────────────────────────────────────────────────────
function detectTier(): QualityTier {
  // Check localStorage override first
  const override = safeGet("sc_quality") as QualityTier | null;
  if (override === "low" || override === "med" || override === "high")
    return override;

  const nav = navigator;

  // Signals: RAM, CPU cores, connection, device pixel ratio
  const ram = nav.deviceMemory ?? 4; // GB; undefined = assume 4
  const cores = nav.hardwareConcurrency ?? 4;
  const conn = navigator.connection?.effectiveType ?? "4g";
  const dpr = window.devicePixelRatio ?? 1;
  const touch = navigator.maxTouchPoints > 0; // mobile proxy

  let score = 0;
  if (ram >= 8) score += 2;
  else if (ram >= 4) score += 1;
  if (cores >= 8) score += 2;
  else if (cores >= 4) score += 1;
  if (conn === "4g" || conn === "wifi") score += 1;
  if (dpr <= 1.5) score += 1; // high-DPR = mobile = less GPU budget
  if (touch) score -= 1; // mobile proxy

  if (score >= 5) return "high";
  if (score >= 3) return "med";
  return "low";
}

export function initPerf(): QualityTier {
  tier = detectTier();
  setupVisibilityAPI();
  return tier;
}

export function getTier(): QualityTier {
  return tier;
}
export function getQualityMode(): QualityMode {
  return qualityMode;
}

/** Pins quality to an explicit tier — the auto-adaptive logic in tickFps()
 *  will no longer move it until setAutoQuality() is called again. */
export function setTier(t: QualityTier) {
  tier = t;
  qualityMode = "fixed";
  localStorage.setItem("sc_quality", t);
  badStreak = 0;
  goodStreak = 0;
  lastTierChangeTs = performance.now();
}

/** Returns to FPS-adaptive tier selection, re-running device detection
 *  immediately so the UI reflects a real tier right away rather than
 *  waiting for the next 2s FPS window. */
export function setAutoQuality(): QualityTier {
  qualityMode = "auto";
  localStorage.removeItem("sc_quality");
  tier = detectTier();
  badStreak = 0;
  goodStreak = 0;
  lastTierChangeTs = performance.now();
  return tier;
}
export function isTabVisible() {
  return tabVisible;
}

// ── Frame rate adaptation ─────────────────────────────────────────────
// Called every frame. Returns true if this frame should do expensive work.
let frameSkipCounter = 0;
export function shouldRenderFull(): boolean {
  if (!tabVisible) return false;
  frameSkipCounter++;
  if (tier === "high") return true;
  if (tier === "med") return frameSkipCounter % 2 === 0; // 30fps for expensive ops
  // LOW: the outer rAF scheduler (main.ts renderFrame) already skips 2 of
  // every 3 frames before this is even called, targeting ~20fps of actual
  // entries. Gating again here on top of that compounded into ~6.7fps of
  // real expensive-work updates instead of the intended ~20fps — always
  // draw once per accepted frame and let the outer scheduler own the
  // throttling, not both layers at once.
  return true;
}

// Separate skip for audio analysis (slightly less aggressive)
export function shouldSampleAudio(): boolean {
  if (!tabVisible) return false;
  if (tier === "high") return true;
  return frameSkipCounter % 2 === 0;
}

// ── FPS tracking ──────────────────────────────────────────────────────
// Minimum time between automatic tier changes — prevents the tier from
// flipping back and forth every couple of seconds when FPS is hovering
// right at a threshold (e.g. oscillating between 22-26fps), which reads
// as stuttery/buggy even though each individual decision was "correct".
const TIER_CHANGE_COOLDOWN_MS = 8000;
// Consecutive good/bad readings required before actually changing tier —
// smooths out one-off blips (a GC pause, a theme-switch hitch) so a
// single bad frame window can't tank quality for the rest of the session.
const STREAK_REQUIRED = 2;

let lastTierChangeTs = 0;
let badStreak = 0;
let goodStreak = 0;

export function tickFps(now: number): number {
  frameCount++;
  frameTimes.push(now);
  // Keep last 60 samples
  if (frameTimes.length > 60) frameTimes.shift();
  if (now - lastFpsTs >= 2000) {
    const span = frameTimes[frameTimes.length - 1]! - frameTimes[0]!;
    // A tab that was backgrounded and just resumed has one huge gap in
    // frameTimes (rAF doesn't run while hidden) — that would compute as
    // a near-zero FPS and trigger a false downgrade. Skip this window
    // entirely rather than act on a meaningless reading.
    const isStaleWindow = span > 6000;
    // (length - 1): `span` covers the interval between the first and
    // last sample, i.e. (length - 1) frame intervals, not `length` of
    // them — dividing by the sample count instead slightly over-counts
    // FPS (e.g. 60 samples over 59 real intervals reports high), which
    // matters right at the up/downgrade thresholds below.
    fps =
      span > 0 && !isStaleWindow
        ? Math.round((frameTimes.length - 1) / (span / 1000))
        : fps;
    lastFpsTs = now;

    if (!isStaleWindow && qualityMode === "auto") {
      const wantsDowngrade =
        (tier === "high" && fps < 24) || (tier === "med" && fps < 16);
      const wantsUpgrade =
        (tier === "low" && fps > 50) || (tier === "med" && fps > 55);

      if (wantsDowngrade) {
        badStreak++;
        goodStreak = 0;
      } else if (wantsUpgrade) {
        goodStreak++;
        badStreak = 0;
      } else {
        badStreak = 0;
        goodStreak = 0;
      }

      const cooledDown = now - lastTierChangeTs >= TIER_CHANGE_COOLDOWN_MS;

      if (cooledDown && badStreak >= STREAK_REQUIRED) {
        if (tier === "high") tier = "med";
        else if (tier === "med") tier = "low";
        lastTierChangeTs = now;
        badStreak = 0;
        goodStreak = 0;
      } else if (cooledDown && goodStreak >= STREAK_REQUIRED) {
        // Symmetric recovery: low → med → high. Previously this only
        // handled low → med, so a device that dipped to 'med' quality
        // once could never automatically climb back to 'high' even
        // after FPS fully recovered and stayed high for a long time.
        if (tier === "low") tier = "med";
        else if (tier === "med") tier = "high";
        lastTierChangeTs = now;
        badStreak = 0;
        goodStreak = 0;
      }
    }
  }
  return fps;
}

export function getFps() {
  return fps;
}

// ── Visibility API ────────────────────────────────────────────────────
function setupVisibilityAPI() {
  document.addEventListener("visibilitychange", () => {
    tabVisible = !document.hidden;
    if (!tabVisible) {
      // rAF doesn't run while hidden, so the buffer would otherwise
      // contain one huge stale gap when the tab resumes.
      frameTimes = [];
    }
  });
}

// ── Quality-gated canvas helpers ──────────────────────────────────────
// Max particles per tier
export function maxParticles(base: number): number {
  if (tier === "high") return base;
  if (tier === "med") return Math.round(base * 0.55);
  return Math.round(base * 0.25);
}

// Should draw expensive backdrop (radial gradients etc)?
export function shouldDrawGlow(): boolean {
  return tier !== "low";
}

// Particle update step multiplier — LOW skips physics frames
export function particleStepSize(): number {
  return tier === "low" ? 3 : tier === "med" ? 2 : 1;
}
