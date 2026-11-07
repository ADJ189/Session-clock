import { test } from "node:test";
import assert from "node:assert/strict";
import {
  curveParam,
  equalPowerCurve,
  holdParam,
  rampParam,
} from "../src/audio/automation.ts";
import { MockAudioParam } from "./mock-audio.ts";

const asParam = (param: MockAudioParam): AudioParam =>
  param as unknown as AudioParam;

test("holdParam prefers cancelAndHoldAtTime", () => {
  const param = new MockAudioParam(0.4);
  holdParam(asParam(param), 2);
  assert.deepStrictEqual(
    param.events.map((e) => e.type),
    ["hold"],
  );
});

test("holdParam falls back to cancelScheduledValues + setValueAtTime", () => {
  const param = new MockAudioParam(0.4);
  (param as unknown as { cancelAndHoldAtTime?: unknown }).cancelAndHoldAtTime =
    undefined;
  holdParam(asParam(param), 2);
  assert.deepStrictEqual(
    param.events.map((e) => e.type),
    ["cancel", "set"],
  );
  assert.strictEqual(param.events[1]!.value, 0.4);
});

test("rampParam schedules a short linear ramp on the audio clock", () => {
  const param = new MockAudioParam(0.1);
  rampParam(asParam(param), 0.9, 10, 0.04);
  const ramp = param.events.find((e) => e.type === "linear");
  assert.ok(ramp);
  assert.strictEqual(ramp.value, 0.9);
  assert.strictEqual(ramp.time, 10.04);
});

test("rampParam ignores non-finite targets and handles zero duration", () => {
  const param = new MockAudioParam(0.1);
  rampParam(asParam(param), Number.NaN, 1, 0.04);
  assert.strictEqual(param.events.length, 0);

  rampParam(asParam(param), 0.5, 3, 0);
  const set = param.events.find((e) => e.type === "set" && e.time === 3);
  assert.ok(set);
  assert.strictEqual(set.value, 0.5);
});

test("curveParam rejects unusable curves instead of throwing", () => {
  const param = new MockAudioParam(1);
  assert.strictEqual(curveParam(asParam(param), new Float32Array(0), 1, 1), false);
  assert.strictEqual(
    curveParam(asParam(param), new Float32Array(1), 1, 1),
    false,
  );
  assert.strictEqual(
    curveParam(asParam(param), equalPowerCurve("in", 1), 1, 0),
    false,
  );
  assert.strictEqual(
    curveParam(asParam(param), equalPowerCurve("in", 1), 1, 1),
    true,
  );
});

test("equal-power curves start and end at the expected gains", () => {
  const fadeOut = equalPowerCurve("out", 0.8, 64);
  assert.strictEqual(fadeOut.length, 64);
  assert.ok(Math.abs(fadeOut[0]! - 0.8) < 1e-6);
  assert.ok(Math.abs(fadeOut.at(-1)!) < 1e-6);

  const fadeIn = equalPowerCurve("in", 0.8, 64);
  assert.ok(Math.abs(fadeIn[0]!) < 1e-6);
  assert.ok(Math.abs(fadeIn.at(-1)! - 0.8) < 1e-6);
});
