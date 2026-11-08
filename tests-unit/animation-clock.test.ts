import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampDelta,
  FixedStepAccumulator,
  motionScale,
  REFERENCE_FRAME_SECONDS,
} from "../src/animation-clock.ts";

test("clampDelta rejects unusable values and caps long stalls", () => {
  assert.strictEqual(clampDelta(Number.NaN), 0);
  assert.strictEqual(clampDelta(Number.POSITIVE_INFINITY), 0);
  assert.strictEqual(clampDelta(-1), 0);
  assert.strictEqual(clampDelta(0), 0);
  assert.strictEqual(clampDelta(0.016), 0.016);
  assert.strictEqual(clampDelta(5), 0.1);
  assert.strictEqual(clampDelta(5, 0.3), 0.3);
});

test("motionScale is 1 at 60 Hz and tracks refresh rate", () => {
  assert.ok(Math.abs(motionScale(REFERENCE_FRAME_SECONDS) - 1) < 1e-9);
  assert.ok(Math.abs(motionScale(1 / 120) - 0.5) < 1e-9);
  assert.ok(Math.abs(motionScale(1 / 30) - 2) < 1e-9);
  assert.ok(Math.abs(motionScale(1 / 240) - 0.25) < 1e-9);
});

test("motionScale clamps a resumed tab to a few frames", () => {
  assert.strictEqual(motionScale(10), 4);
  assert.strictEqual(motionScale(10, 2), 2);
});

test("a fixed-step accumulator carries the remainder forward", () => {
  const acc = new FixedStepAccumulator(0.01);
  let steps = 0;
  assert.strictEqual(acc.advance(0.035, () => steps++), 3);
  assert.strictEqual(steps, 3);
  assert.strictEqual(acc.advance(0.005, () => steps++), 1);
  assert.strictEqual(steps, 4);
});

test("a fixed-step accumulator caps catch-up work after a stall", () => {
  const acc = new FixedStepAccumulator(0.01, 3);
  let steps = 0;
  assert.strictEqual(acc.advance(5, () => steps++), 3);
  assert.strictEqual(steps, 3);
  // The next small delta must not immediately run another full burst.
  assert.ok(acc.advance(0.005, () => steps++) <= 1);
});

test("the accumulator rejects a non-positive step", () => {
  assert.throws(() => new FixedStepAccumulator(0), RangeError);
  assert.throws(() => new FixedStepAccumulator(Number.NaN), RangeError);
});
