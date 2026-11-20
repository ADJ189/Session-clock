import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcSunTimes,
  getCircadianWarmth,
  getSunMinuteOfDay,
} from "../src/weather.ts";

test("sun times keep the offset used to calculate them", () => {
  const sun = calcSunTimes(40.7128, -74.006, -300); // New York, UTC-5
  assert.strictEqual(sun.tzOffsetMins, -300);
  assert.ok(Number.isFinite(sun.rise));
  assert.ok(Number.isFinite(sun.set));
});

test("sun minute-of-day converts the instant to the location offset", () => {
  const now = new Date("2026-06-21T16:00:00Z");
  assert.strictEqual(getSunMinuteOfDay(now, -300), 11 * 60); // 11:00 in UTC-5
  assert.strictEqual(getSunMinuteOfDay(now, 60), 17 * 60); // 17:00 in UTC+1
  // Wraps across midnight instead of producing a negative minute.
  assert.strictEqual(getSunMinuteOfDay(new Date("2026-06-21T23:30:00Z"), 30), 0);
});

test("circadian warmth compares in the sun times' offset, not the browser's", () => {
  const sun = {
    rise: 720,
    set: 780,
    noon: 750,
    tzOffsetMins: 60,
  };
  // 11:30 UTC is 12:30 at UTC+1 (750 minutes), two thirds into sunset window.
  const warmth = getCircadianWarmth(
    sun,
    new Date("2026-06-21T11:30:00Z"),
  );
  assert.ok(Math.abs(warmth - 2 / 3) < 1e-9);
});
