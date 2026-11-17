import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BREAK_MINUTES,
  WORK_MINUTES,
  isPomPhase,
  parseHandoffElapsed,
  parseHandoffMinutes,
} from "../src/app/utils/handoff.ts";

test("handoff durations use the settings bounds", () => {
  assert.strictEqual(parseHandoffMinutes("25", 25, WORK_MINUTES), 25);
  assert.strictEqual(parseHandoffMinutes("0", 25, WORK_MINUTES), 1);
  assert.strictEqual(parseHandoffMinutes("999", 25, WORK_MINUTES), 120);
  assert.strictEqual(parseHandoffMinutes("5", 5, BREAK_MINUTES), 5);
  assert.strictEqual(parseHandoffMinutes("0", 5, BREAK_MINUTES), 1);
  assert.strictEqual(parseHandoffMinutes("999", 5, BREAK_MINUTES), 60);
});

test("handoff durations fall back to defaults for invalid input", () => {
  for (const raw of [null, "", "abc", "25.5", "NaN", "Infinity"]) {
    assert.strictEqual(parseHandoffMinutes(raw, 25, WORK_MINUTES), 25);
  }
});

test("handoff elapsed values must be finite non-negative integers", () => {
  assert.strictEqual(parseHandoffElapsed("45000"), 45000);
  assert.strictEqual(parseHandoffElapsed("0"), 0);
  assert.strictEqual(parseHandoffElapsed(null, 7), 7);
  assert.strictEqual(parseHandoffElapsed("-1", 0), 0);
  assert.strictEqual(parseHandoffElapsed("1.5", 0), 0);
  assert.strictEqual(parseHandoffElapsed("oops", 0), 0);
});

test("handoff phase accepts only known Pomodoro phases", () => {
  assert.strictEqual(isPomPhase("work"), true);
  assert.strictEqual(isPomPhase("break"), true);
  assert.strictEqual(isPomPhase("longBreak"), true);
  assert.strictEqual(isPomPhase("rest"), false);
  assert.strictEqual(isPomPhase(null), false);
});
