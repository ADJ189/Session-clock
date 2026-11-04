// Focused runtime coverage for the spatial clock contract.
//
// `src/audio/spatial.ts` is pure maths and is covered by spatial.test.ts.
// These tests run the real `src/sound.ts` rig against the Web Audio mock and
// assert the *time origin* rules that the pure tests cannot see:
//
//  • One audio clock (`ctx.currentTime`) drives placement, movement and the
//    update throttle. The animation-frame timestamp is not part of the API.
//  • One phase offset per rig, generated at attach time and reused, so the
//    first tick never jumps to a different point on the movement curve.
//  • Suspending the context freezes movement, because a suspended
//    AudioContext's `currentTime` stops advancing.

import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomStubs } from "./dom-stubs.ts";
import { SPATIAL_PROFILES, positionForProfile } from "../src/audio/spatial.ts";
import { MockAudioContext, MockPannerNode } from "./mock-audio.ts";

installDomStubs();
const globals = globalThis as unknown as Record<string, unknown>;
globals.DeviceOrientationEvent = class DeviceOrientationEvent {
  alpha = 0;
};
globals.AudioContext = MockAudioContext;

const Sound = await import("../src/sound.ts");

const RAIN = SPATIAL_PROFILES.rain;
const WIND = SPATIAL_PROFILES.wind;
const FIRE = SPATIAL_PROFILES.fire;

/** Half a movement period: a sweep/wander sample is mirrored at this offset. */
const HALF_PERIOD = Math.PI / 0.04; // rain's rateRadPerSec

function context(): MockAudioContext {
  const ctx = MockAudioContext.instances.at(-1);
  assert.ok(ctx, "expected an AudioContext to have been created");
  return ctx;
}

/** Fresh track state on the shared context, with the throttle cleared. */
function reset(): MockAudioContext {
  Sound.stop();
  Sound.stopBinaural();
  Sound.unlockAudio();
  const ctx = context();
  ctx.failCreatePanner = false;
  ctx.failPanningModel = false;
  Sound.setSpatial(true);
  // The 25 Hz update throttle is on the audio clock and persists across
  // tracks, so move the clock past any tick left by the previous test.
  ctx.currentTime += 0.5;
  return ctx;
}

function lastPanner(ctx: MockAudioContext): MockPannerNode {
  const panner = ctx.hrtfPanners.at(-1);
  assert.ok(panner, "expected a spatial panner");
  return panner;
}

test("the first tick keeps the placement made at attach time", () => {
  const ctx = reset();
  // A large clock value proves the rig is placed at `elapsed = 0`, not at
  // absolute page/audio time.
  ctx.currentTime = 1234.5;
  assert.ok(Sound.playTrack("rain"));
  const panner = lastPanner(ctx);
  const x0 = panner.positionX.value;
  const y0 = panner.positionY.value;
  const z0 = panner.positionZ.value;

  Sound.tickSpatial();

  assert.strictEqual(panner.positionX.value, x0);
  assert.strictEqual(panner.positionY.value, y0);
  assert.strictEqual(panner.positionZ.value, z0);
  assert.strictEqual(
    panner.positionX.events.at(-1)?.value,
    x0,
    "the tick recomputed the same position from the stored phase",
  );
});

test("advancing the audio clock by half a period mirrors the azimuth", () => {
  const ctx = reset();
  assert.ok(Sound.playTrack("rain"));
  const panner = lastPanner(ctx);
  const x0 = panner.positionX.value;
  const z0 = panner.positionZ.value;
  // Sanity: the initial placement matches the pure helper at elapsed 0.
  // `recoveredPhase()` round-trips the phase through trigonometry, so compare
  // with a tolerance — a recovered phase can differ in the last bit and a
  // strict equality would flake on some random phase values.
  assert.ok(
    Math.abs(x0 - positionForProfile(RAIN, 0, recoveredPhase(x0, z0)).x) <
      1e-9,
    "the initial placement matches the helper at elapsed 0",
  );

  ctx.currentTime += HALF_PERIOD;
  Sound.tickSpatial();

  assert.ok(
    Math.abs(panner.positionX.value + x0) < 1e-9,
    "sin(phase + pi) flips the lateral component",
  );
  assert.ok(
    Math.abs(panner.positionZ.value - z0) < 1e-9,
    "the forward component is unchanged by a half turn",
  );
  assert.strictEqual(
    panner.positionX.events.at(-1)?.time,
    ctx.currentTime,
    "automation is scheduled on the audio clock",
  );
});

test("a whole movement period returns to the starting point", () => {
  const ctx = reset();
  assert.ok(Sound.playTrack("rain"));
  const panner = lastPanner(ctx);
  const x0 = panner.positionX.value;
  const z0 = panner.positionZ.value;

  ctx.currentTime += HALF_PERIOD * 2;
  Sound.tickSpatial();

  assert.ok(Math.abs(panner.positionX.value - x0) < 1e-9);
  assert.ok(Math.abs(panner.positionZ.value - z0) < 1e-9);
});

test("suspending the context freezes movement; resuming continues", () => {
  const ctx = reset();
  ctx.currentTime = 42;
  assert.ok(Sound.playTrack("wind"));
  const panner = lastPanner(ctx);
  Sound.tickSpatial();
  const x0 = panner.positionX.value;

  ctx.state = "suspended";
  // A suspended AudioContext does not advance `currentTime`, however many
  // animation frames the page still runs.
  for (let frame = 0; frame < 20; frame++) Sound.tickSpatial();
  assert.strictEqual(panner.positionX.value, x0, "frozen while suspended");

  ctx.state = "running";
  ctx.currentTime += 5;
  Sound.tickSpatial();
  assert.notStrictEqual(
    panner.positionX.value,
    x0,
    "movement resumes from the audio clock",
  );
});

test("the update throttle is measured on the audio clock", () => {
  const ctx = reset();
  assert.ok(Sound.playTrack("rain"));
  const panner = lastPanner(ctx);
  const base = panner.positionX.events.length;

  Sound.tickSpatial();
  const afterFirst = panner.positionX.events.length;
  assert.ok(afterFirst > base);

  ctx.currentTime += 0.01; // faster than the 1/25 s throttle
  Sound.tickSpatial();
  assert.strictEqual(
    panner.positionX.events.length,
    afterFirst,
    "a second tick inside the same audio-time window is skipped",
  );

  ctx.currentTime += 0.05; // 60 ms later: past the throttle window
  Sound.tickSpatial();
  assert.ok(panner.positionX.events.length > afterFirst);
});

test("fixed profiles keep their placement across ticks", () => {
  const ctx = reset();
  assert.ok(Sound.playTrack("fire"));
  const panner = lastPanner(ctx);
  const x0 = panner.positionX.value;
  const z0 = panner.positionZ.value;
  const events = panner.positionX.events.length;

  ctx.currentTime += 30;
  Sound.tickSpatial();

  assert.strictEqual(panner.positionX.value, x0);
  assert.strictEqual(panner.positionZ.value, z0);
  assert.strictEqual(panner.positionX.events.length, events);
});

test("the equal-power fallback moves on the same audio clock", () => {
  const ctx = reset();
  ctx.failCreatePanner = true;
  assert.ok(Sound.playTrack("rain"));
  const fallback = ctx.panners.at(-1);
  assert.ok(fallback, "expected the stereo fallback");
  const pan0 = fallback.pan.value;

  ctx.currentTime += HALF_PERIOD;
  Sound.tickSpatial();

  assert.ok(
    Math.abs(fallback.pan.value + pan0) < 1e-9,
    "half a sweep period mirrors the pan position",
  );
  assert.strictEqual(fallback.pan.events.at(-1)?.time, ctx.currentTime);
});

test("two rigs keep independent start times and phases", () => {
  const ctx = reset();
  ctx.currentTime = 100;
  assert.ok(Sound.playTrack("rain"));
  const rain = lastPanner(ctx);

  ctx.currentTime = 140;
  assert.ok(Sound.playTrack("wind"));
  const panners = ctx.hrtfPanners.slice(-2);
  const wind = panners[1]!;
  assert.notStrictEqual(rain.id, wind.id);

  // Both are placed at their own elapsed = 0 even though the shared context
  // clock is 40 s further along when the second rig attaches.
  const windX0 = wind.positionX.value;
  Sound.tickSpatial();
  assert.strictEqual(wind.positionX.value, windX0);
  assert.notStrictEqual(rain.positionX.value, windX0);
});

test("every ambient profile has a usable spatial geometry", () => {
  for (const [id, profile] of Object.entries(SPATIAL_PROFILES)) {
    const start = positionForProfile(profile, 0, 0.5);
    const later = positionForProfile(profile, 10, 0.5);
    for (const value of [start.x, start.y, start.z, later.x, later.y, later.z]) {
      assert.ok(Number.isFinite(value), `${id} produced a non-finite position`);
    }
    if (profile.mode === "bypass") {
      assert.deepStrictEqual(
        start,
        later,
        `${id} is bypassed and must not move`,
      );
    }
    if (profile.movement.kind === "fixed") {
      assert.deepStrictEqual(start, later, `${id} is fixed`);
    }
  }
  assert.ok(WIND.movement.kind !== "fixed");
  assert.ok(FIRE.movement.kind === "fixed");
});

/**
 * The rig's phase is private, but for a zero-azimuth sweep at elapsed 0 the
 * lateral component is `sin(phase) * width`, so the pure helper can be
 * re-run with the same phase recovered from the placement. This keeps the
 * test honest about the initial placement without exporting test-only state.
 */
function recoveredPhase(x: number, z: number): number {
  const azimuthRad = Math.atan2(x, -z);
  const widthRad = (RAIN.movement.kind === "fixed" ? 0 : RAIN.movement.widthDeg) *
    (Math.PI / 180);
  return Math.asin(Math.max(-1, Math.min(1, azimuthRad / widthRad)));
}
