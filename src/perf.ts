// ── Performance & Adaptive Quality System ────────────────────────────
// Detects device capability at startup and adapts rendering quality.
// Tiers: LOW (weak device) | MED (average) | HIGH (powerful)
// Default target is HIGH with runtime measurement driving any adjustments.
// Can be overridden by user in settings.

export type QualityTier = "low" | "med" | "high";
import { safeGet } from "./storage";
import { frameMetrics, type FrameMetricsSnapshot } from "./frame-metrics";
export type QualityMode = "auto" | "fixed";

let tier: QualityTier = "high";
let savedTierOverride: QualityTier | null = null;
let qualityMode: QualityMode = "auto";
let frameCount = 0;
let fps = 60;
let lastFpsTs = performance.now();
let tabVisible = true;
let batterySaverActive = false;

// ── Tier detection (High-default with minimal hints only) ──────────────
export function detectTier(): QualityTier {
  // Check localStorage override first — explicit user choice always wins
  const override = safeGet("sc_quality") as QualityTier | null;
  if (override === "low" || override === "med" || override === "high") {
    savedTierOverride = override;
    return override;
  }
  savedTierOverride = null;

  // Minimal hints only: do not penalise touch screens, high DPR, or network speed.
  // Only severely constrained hardware (tiny RAM or very few cores) starts below High.
  if (typeof navigator !== "undefined") {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
    };
    const ram = nav.deviceMemory; // in GB
    const cores = nav.hardwareConcurrency;

    const hasLowRam = ram !== undefined && ram <= 1.5;
    const hasMedRam = ram !== undefined && ram <= 2.5;
    const hasLowCores = cores !== undefined && cores <= 2;

    if (hasLowRam && hasLowCores) {
      return "low";
    }
    if (hasLowRam || (hasMedRam && hasLowCores)) {
      return "med";
    }
  }

  // High quality is the default baseline for all modern devices
  return "high";
}

function recordTierChangeDiagnostic(newTier: QualityTier, reason: string): void {
  void import("./diagnostics")
    .then((m) => {
      m.getDiagnosticsRuntime()?.record({
        subsystem: "renderer",
        kind: "event",
        message: `Quality tier changed to ${newTier} (${reason})`,
        details: {
          tier: newTier,
          mode: qualityMode,
          batterySaver: batterySaverActive,
          fps,
          p95: frameMetrics.getP95(),
          droppedRatio: frameMetrics.getDroppedFrameRatio(),
        },
      });
    })
    .catch(() => {});
}

export function initPerf(): QualityTier {
  tier = detectTier();
  qualityMode = savedTierOverride ? "fixed" : "auto";
  setupVisibilityAPI();
  return getTier();
}

export function getTier(): QualityTier {
  if (batterySaverActive) return "low";
  return tier;
}

export function getQualityMode(): QualityMode {
  return qualityMode;
}

/** Pins quality to an explicit tier — the auto-adaptive logic in tickFps()
 *  will no longer move it until setAutoQuality() is called again. */
export function setTier(t: QualityTier) {
  tier = t;
  savedTierOverride = t;
  qualityMode = "fixed";
  batterySaverActive = false;
  try {
    localStorage.setItem("sc_quality", t);
  } catch {
    // Storage may be blocked or restricted
  }
  badStreak = 0;
  goodStreak = 0;
  lastTierChangeTs = performance.now();
  recordTierChangeDiagnostic(t, "user-override");
}

/** Returns to FPS-adaptive tier selection, re-running device detection
 *  immediately so the UI reflects a real tier right away rather than
 *  waiting for the next FPS window. */
export function setAutoQuality(): QualityTier {
  qualityMode = "auto";
  batterySaverActive = false;
  try {
    localStorage.removeItem("sc_quality");
  } catch {
    // Ignored
  }
  tier = detectTier();
  badStreak = 0;
  goodStreak = 0;
  lastTierChangeTs = performance.now();
  recordTierChangeDiagnostic(tier, "auto-quality-enabled");
  return getTier();
}

/**
 * Temporary battery saver downgrade. Never persists to localStorage or
 * changes qualityMode to fixed. Restores the prior active tier when disabled.
 */
export function applyBatterySaver(active: boolean): boolean {
  if (batterySaverActive === active) return false;
  batterySaverActive = active;
  recordTierChangeDiagnostic(
    getTier(),
    active ? "battery-saver-active" : "battery-saver-restored",
  );
  return true;
}

export function isBatterySaverActive(): boolean {
  return batterySaverActive;
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
  const activeTier = getTier();
  if (activeTier === "high") return true;
  if (activeTier === "med") return frameSkipCounter % 2 === 0; // 30fps for expensive ops
  return true;
}

// Separate skip for audio analysis (slightly less aggressive)
export function shouldSampleAudio(): boolean {
  if (!tabVisible) return false;
  const activeTier = getTier();
  if (activeTier === "high") return true;
  return frameSkipCounter % 2 === 0;
}

// ── FPS and Frame-time tracking ────────────────────────────────────────
// Minimum time between automatic tier changes — prevents the tier from
// flipping back and forth every couple of seconds when FPS is hovering
// right at a threshold.
const TIER_CHANGE_COOLDOWN_MS = 8000;
// Consecutive good/bad readings required before actually changing tier.
const STREAK_REQUIRED = 2;

let lastTierChangeTs = 0;
let badStreak = 0;
let goodStreak = 0;

/** Discards the rolling frame sample and restarts the measurement window.
 *  Call when frames were deliberately slowed (a dialog covering the app). */
export function resetFpsSampling(now: number): void {
  frameMetrics.reset(now);
  frameCount = 0;
  lastFpsTs = now;
  badStreak = 0;
  goodStreak = 0;
}

export function tickFps(now: number, drawDurationMs?: number): number {
  frameCount++;
  frameMetrics.recordFrame(now, drawDurationMs);

  // Re-evaluate adaptation window roughly every 2 seconds
  if (now - lastFpsTs >= 2000) {
    fps = frameMetrics.getFps();
    const snapshot: FrameMetricsSnapshot = frameMetrics.getSnapshot();
    lastFpsTs = now;

    if (qualityMode === "auto" && !batterySaverActive && snapshot.sampleCount >= 20) {
      const p95 = snapshot.p95;
      const droppedRatio = snapshot.droppedFrameRatio;

      // Downgrade when frame time P95 spikes or frame drop ratio is high
      const wantsDowngrade =
        (tier === "high" && (fps < 24 || p95 > 42 || droppedRatio > 0.35)) ||
        (tier === "med" && (fps < 16 || p95 > 55 || droppedRatio > 0.48));

      // Symmetric recovery requires clean headroom
      const wantsUpgrade =
        (tier === "low" && fps >= 50 && p95 < 24 && droppedRatio < 0.08) ||
        (tier === "med" && fps >= 55 && p95 < 20 && droppedRatio < 0.05);

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
        const prevTier = tier;
        if (tier === "high") tier = "med";
        else if (tier === "med") tier = "low";

        if (tier !== prevTier) {
          lastTierChangeTs = now;
          badStreak = 0;
          goodStreak = 0;
          recordTierChangeDiagnostic(tier, "auto-downgrade-frame-time");
        }
      } else if (cooledDown && goodStreak >= STREAK_REQUIRED) {
        const prevTier = tier;
        if (tier === "low") tier = "med";
        else if (tier === "med") tier = "high";

        if (tier !== prevTier) {
          lastTierChangeTs = now;
          badStreak = 0;
          goodStreak = 0;
          recordTierChangeDiagnostic(tier, "auto-recovery-frame-time");
        }
      }
    }
  }
  return fps;
}

export function getFps() {
  return fps;
}

export function getFrameCount(): number {
  return frameCount;
}

export function getPerfDiagnostics(): Record<string, unknown> {
  const snapshot = frameMetrics.getSnapshot();
  return {
    tier: getTier(),
    baseTier: tier,
    qualityMode,
    batterySaver: batterySaverActive,
    fps: snapshot.fps,
    p50Ms: snapshot.p50,
    p95Ms: snapshot.p95,
    p99Ms: snapshot.p99,
    droppedFrameRatio: snapshot.droppedFrameRatio,
    droppedFrameCount: snapshot.droppedFrameCount,
    longTaskCount: snapshot.longTaskCount,
    totalLongTaskDurationMs: snapshot.totalLongTaskDurationMs,
    lastDrawDurationMs: snapshot.lastDrawDurationMs,
  };
}

// ── Visibility API ────────────────────────────────────────────────────
function setupVisibilityAPI() {
  if (typeof document === "undefined") return;
  document.addEventListener("visibilitychange", () => {
    tabVisible = !document.hidden;
    if (!tabVisible) {
      frameMetrics.reset();
    }
  });
}

// ── Quality-gated canvas helpers ──────────────────────────────────────
// Max particles per tier
export function maxParticles(base: number): number {
  const activeTier = getTier();
  if (activeTier === "high") return base;
  if (activeTier === "med") return Math.round(base * 0.55);
  return Math.round(base * 0.25);
}

// Should draw expensive backdrop (radial gradients etc)?
export function shouldDrawGlow(): boolean {
  return getTier() !== "low";
}

// Particle update step multiplier — LOW skips physics frames
export function particleStepSize(): number {
  const activeTier = getTier();
  return activeTier === "low" ? 3 : activeTier === "med" ? 2 : 1;
}
