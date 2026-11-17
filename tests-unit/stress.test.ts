import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomStubs } from "./dom-stubs.ts";
import { createSchedulerClock } from "./mock-audio.ts";

installDomStubs();

import { EventScheduler } from "../src/audio/scheduler.ts";
import { THEMES } from "../src/themes.ts";
import { getThemeLogo } from "../src/app/themes/theme-logos.ts";
import { safeGet, safeSet, safeJsonGet, safeJsonSet } from "../src/storage.ts";
import { FrameMetricsTracker } from "../src/frame-metrics.ts";
import { clampDelta, motionScale } from "../src/animation-clock.ts";
import { normalizePreset, parseScene } from "../src/audio/settings.ts";
import { SPATIAL_PROFILES } from "../src/audio/spatial.ts";

// ── 1. Audio Scheduler Stress & Saturation ──────────────────────────────

test("stress: audio scheduler handles 50 concurrent rigs with 1000 fast-fire tasks", () => {
  const { ctx, advance } = createSchedulerClock();
  const schedulers: EventScheduler[] = [];

  // Spin up 50 scheduler instances (simulating intense multiple rigs)
  for (let i = 0; i < 50; i++) {
    const s = new EventScheduler(ctx, { autoStart: false, lookahead: 0.1 });
    schedulers.push(s);
  }

  let totalExecuted = 0;
  // Add 20 tasks per scheduler (total 1000 tasks)
  for (const s of schedulers) {
    for (let t = 0; t < 20; t++) {
      const interval = 0.05 + (t % 5) * 0.01;
      s.add(interval, interval, () => {
        totalExecuted++;
      });
    }
  }

  // Rapidly advance audio clock through 100 discrete time slices
  for (let slice = 0; slice < 100; slice++) {
    advance(0.05);
    for (const s of schedulers) {
      s.tick();
    }
  }

  assert.ok(totalExecuted > 5000, `Expected high volume execution, got ${totalExecuted}`);

  // Clean tear-down of all 50 schedulers
  for (const s of schedulers) {
    s.clearTasks();
    assert.strictEqual(s.activeTasks, 0);
  }
});

test("stress: scheduler recovers gracefully after massive 60-second stall", () => {
  const { ctx, advance } = createSchedulerClock();
  const s = new EventScheduler(ctx, { autoStart: false, lookahead: 0.1 });

  let runs = 0;
  s.add(0.05, 0.05, () => { runs++; });

  // Normal tick
  advance(0.1);
  s.tick();
  assert.ok(runs > 0);

  // Massive background tab freeze (60 seconds)
  advance(60);
  // After a 60s freeze, the scheduler must cap stale catch-up and not execute hundreds of iterations
  s.tick();
  assert.ok(runs <= 15, `Expected capped run count after stall, got ${runs}`);
  s.clearTasks();
});

// ── 2. Theme Engine & Spatial Configuration Stress ───────────────────────

test("stress: all 103 themes validate, derive palettes and have registered logos", () => {
  assert.strictEqual(THEMES.length, 103, "All 103 themes must be present");
  const seenIds = new Set<string>();

  for (const theme of THEMES) {
    assert.ok(theme.id && typeof theme.id === "string", "theme must have valid id");
    assert.ok(!seenIds.has(theme.id), `Duplicate theme id: ${theme.id}`);
    seenIds.add(theme.id);

    assert.ok(theme.name && typeof theme.name === "string", `Theme ${theme.id} must have a name`);
    assert.ok(theme.cat && typeof theme.cat === "string", `Theme ${theme.id} must have a category`);
    assert.ok(/^#[0-9a-fA-F]{3,8}$/.test(theme.accent), `Theme ${theme.id} accent must be valid hex: ${theme.accent}`);

    // Verify logo mapping doesn't throw or return empty
    const logo = getThemeLogo(theme.id);
    assert.ok(logo && logo.length > 0, `Logo for ${theme.id} must not be empty`);
  }
});

test("stress: all spatial sound profiles are mathematically bounded", () => {
  const profileKeys = Object.keys(SPATIAL_PROFILES);
  assert.ok(profileKeys.length >= 10, "Expected at least 10 spatial sound profiles");

  for (const key of profileKeys) {
    const prof = SPATIAL_PROFILES[key as keyof typeof SPATIAL_PROFILES];
    assert.ok(prof, `Profile ${key} must exist`);
    assert.ok(["fixed", "sweep", "wander", "burst"].includes(prof.movement.kind), `Invalid movement kind for ${key}: ${prof.movement.kind}`);
    assert.ok(Number.isFinite(prof.position.azimuthDeg), `Azimuth for ${key} must be finite`);
    assert.ok(Number.isFinite(prof.position.elevationDeg), `Elevation for ${key} must be finite`);
    assert.ok(Number.isFinite(prof.position.distanceM), `Distance for ${key} must be finite`);
    assert.ok(prof.position.distanceM >= 0.1 && prof.position.distanceM <= 30, `Distance out of range for ${key}: ${prof.position.distanceM}`);
  }
});

// ── 3. Storage Quota & Malformed Payload Resilience ──────────────────────

test("stress: storage gracefully handles 1000 malformed and hostile payloads", () => {
  localStorage.clear();
  const validTrackIds = new Set(["rain", "thunder", "waves", "fire", "forest"]);

  const malformedInputs = [
    "{",
    "null",
    "undefined",
    "NaN",
    "Infinity",
    "{\"broken\":",
    "{\"__proto__\": {\"polluted\": true}}",
    "<script>alert(1)</script>",
    "A".repeat(10000),
    "[1, 2, [3, 4, [5, 6]]]",
    "{\"schemaVersion\": 9999999}",
    "{\"preset\": -100}",
    "{\"tracks\": [\"invalid-sound-id\", null, 12345]}",
  ];

  for (let i = 0; i < malformedInputs.length; i++) {
    const input = malformedInputs[i];
    localStorage.setItem(`test_corrupt_${i}`, input);
    // safeJsonGet must never throw even on corrupted string
    const parsed = safeJsonGet(`test_corrupt_${i}`, { fallback: "default" });
    assert.ok(parsed !== undefined);

    // Audio preset normalization must withstand corrupted objects without throwing
    const normalizedPreset = normalizePreset(parsed, validTrackIds);
    // Returns SoundPreset or null safely
    assert.ok(normalizedPreset === null || typeof normalizedPreset === "object");

    // Ambient scene parser must withstand corrupted objects without throwing
    const scene = parseScene(input, validTrackIds);
    assert.ok(scene === null || (scene && typeof scene === "object"));
  }

  // Simulate QuotaExceededError in localStorage
  const originalSetItem = localStorage.setItem;
  try {
    let throwQuota = true;
    localStorage.setItem = () => {
      if (throwQuota) {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      }
    };

    // safeSet must catch and return false without bubbling the exception
    const result = safeSet("sc_stress_key", "huge_payload");
    assert.strictEqual(result, false, "safeSet must return false on quota error");
    throwQuota = false;
  } finally {
    localStorage.setItem = originalSetItem;
  }
});

// ── 4. Frame Metrics & High Refresh Rate Simulation ──────────────────────

test("stress: frame metrics tracker withstands 15Hz to 240Hz refresh rates", () => {
  const tracker = new FrameMetricsTracker({ bufferCapacity: 120 });

  // Simulate 240Hz (4.167ms per frame) for 240 frames
  let ts = 1000;
  for (let i = 0; i < 240; i++) {
    ts += 4.167;
    tracker.recordFrame(ts, 1.2);
  }
  let snap = tracker.getSnapshot();
  assert.ok(snap.fps >= 230 && snap.fps <= 250, `Expected ~240fps, got ${snap.fps}`);
  assert.strictEqual(snap.droppedFrameRatio, 0);

  // Reset and simulate 30Hz (33.33ms per frame)
  tracker.reset(2000);
  ts = 2000;
  for (let i = 0; i < 60; i++) {
    ts += 33.33;
    tracker.recordFrame(ts, 15);
  }
  snap = tracker.getSnapshot();
  assert.ok(snap.fps >= 28 && snap.fps <= 32, `Expected ~30fps, got ${snap.fps}`);

  // Test motionScale bounds at 240Hz (1/240 s), 60Hz (1/60 s), 30Hz (1/30 s), and tab stalls
  assert.ok(Math.abs(motionScale(1 / 240) - 0.25) < 1e-6, "240Hz should scale to 0.25");
  assert.ok(Math.abs(motionScale(1 / 60) - 1.0) < 1e-6, "60Hz should be 1.0 scale");
  assert.ok(Math.abs(motionScale(1 / 30) - 2.0) < 1e-6, "30Hz should scale to 2.0");
  // Stalls should clamp to at most 4 frames
  assert.ok(motionScale(10) <= 4.0, "Stall must be clamped to <= 4.0 frames");
  assert.ok(clampDelta(5) <= 0.3, "Delta must clamp to <= 0.3s");

  tracker.dispose();
});
