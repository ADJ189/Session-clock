import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  detectTier,
  initPerf,
  getTier,
  setTier,
  setAutoQuality,
  applyBatterySaver,
  isBatterySaverActive,
  getQualityMode,
  tickFps,
  getPerfDiagnostics,
} from "../src/perf.ts";

beforeEach(() => {
  localStorage.clear();
  setAutoQuality();
  applyBatterySaver(false);
});

test("detectTier defaults to high when storage is empty and hints are unconstrained", () => {
  localStorage.clear();
  const tier = detectTier();
  assert.strictEqual(tier, "high");
});

test("detectTier honors explicit user setting in localStorage", () => {
  localStorage.setItem("sc_quality", "low");
  assert.strictEqual(detectTier(), "low");

  localStorage.setItem("sc_quality", "med");
  assert.strictEqual(detectTier(), "med");

  localStorage.setItem("sc_quality", "high");
  assert.strictEqual(detectTier(), "high");
});

test("setTier pins quality to fixed mode and persists to storage", () => {
  setTier("med");
  assert.strictEqual(getTier(), "med");
  assert.strictEqual(getQualityMode(), "fixed");
  assert.strictEqual(localStorage.getItem("sc_quality"), "med");
});

test("setAutoQuality removes storage override and returns to auto mode", () => {
  setTier("low");
  assert.strictEqual(getQualityMode(), "fixed");

  const restored = setAutoQuality();
  assert.strictEqual(getQualityMode(), "auto");
  assert.strictEqual(localStorage.getItem("sc_quality"), null);
  assert.strictEqual(restored, "high");
});

test("applyBatterySaver temporarily lowers tier to low without persisting", () => {
  setTier("high");
  assert.strictEqual(getTier(), "high");

  // Activate battery saver
  const changed = applyBatterySaver(true);
  assert.strictEqual(changed, true);
  assert.strictEqual(isBatterySaverActive(), true);
  assert.strictEqual(getTier(), "low");
  // localStorage must NOT be modified by battery saver!
  assert.strictEqual(localStorage.getItem("sc_quality"), "high");

  // Deactivate battery saver
  applyBatterySaver(false);
  assert.strictEqual(isBatterySaverActive(), false);
  assert.strictEqual(getTier(), "high");
});

test("tickFps records frame timestamps and getPerfDiagnostics reports metrics", () => {
  let now = 1000;
  for (let i = 0; i < 30; i++) {
    now += 16.67;
    tickFps(now, 3);
  }

  const diag = getPerfDiagnostics();
  assert.strictEqual(typeof diag.fps, "number");
  assert.strictEqual(typeof diag.p50Ms, "number");
  assert.strictEqual(typeof diag.p95Ms, "number");
  assert.strictEqual(typeof diag.droppedFrameRatio, "number");
  assert.strictEqual(diag.qualityMode, "auto");
  assert.strictEqual(diag.batterySaver, false);
});
