import { test } from "node:test";
import assert from "node:assert/strict";
import { AMBIENT_PRESET_IDS } from "../src/audio/engine.ts";
import {
  clampFinite,
  degreesToRadians,
  getSpatialProfile,
  movementPan,
  positionForProfile,
  SPATIAL_PROFILES,
  sphericalToCartesian,
} from "../src/audio/spatial.ts";

const EPS = 1e-9;

function close(actual: number, expected: number, eps = 1e-6): void {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`,
  );
}

test("every ambient preset has a spatial profile and nothing extra", () => {
  const profileIds = Object.keys(SPATIAL_PROFILES);
  assert.deepStrictEqual(profileIds, [...AMBIENT_PRESET_IDS]);
  assert.strictEqual(new Set(profileIds).size, AMBIENT_PRESET_IDS.length);
});

// The profile shape is part of the audio contract: every key must be read by
// the graph. `inputLayout` was removed because PannerNode already inherits the
// track's channel layout, so a per-profile mono/stereo flag was configuration
// that changed nothing. This assertion keeps it from creeping back in unread.
test("profiles are finitely specified and use HRTF panning", () => {
  const expectedKeys = [
    "distance",
    "mode",
    "movement",
    "panningModel",
    "position",
  ];
  for (const id of AMBIENT_PRESET_IDS) {
    const p = SPATIAL_PROFILES[id];
    assert.deepStrictEqual(Object.keys(p).sort(), expectedKeys, `${id} keys`);
    assert.strictEqual(p.panningModel, "HRTF", id);
    assert.ok(
      ["track-emitter", "centered", "bypass"].includes(p.mode),
      `${id} mode`,
    );
    assert.ok(Number.isFinite(p.position.azimuthDeg), `${id} azimuth`);
    assert.ok(Number.isFinite(p.position.elevationDeg), `${id} elevation`);
    assert.ok(p.position.distanceM > 0, `${id} distance`);
    assert.ok(p.distance.maxDistance >= p.distance.refDistance, `${id} distance range`);
    assert.ok(p.distance.rolloffFactor >= 0, `${id} rolloff`);
    if (p.movement.kind !== "fixed") {
      assert.ok(p.movement.widthDeg > 0, `${id} width`);
      assert.ok(p.movement.rateRadPerSec > 0, `${id} rate`);
    }
  }
});

test("getSpatialProfile returns null for unknown ids", () => {
  assert.strictEqual(getSpatialProfile("rain")?.mode, "track-emitter");
  assert.strictEqual(getSpatialProfile("heartbeat")?.mode, "bypass");
  assert.strictEqual(getSpatialProfile("nope"), null);
});

test("degreesToRadians converts a half turn", () => {
  assert.ok(Number.isFinite(degreesToRadians(180)));
  close(degreesToRadians(180), Math.PI);
  close(degreesToRadians(90), Math.PI / 2);
});

test("clampFinite treats non-finite input as the lower bound", () => {
  assert.strictEqual(clampFinite(Number.NaN, -5, 5), -5);
  assert.strictEqual(clampFinite(Number.POSITIVE_INFINITY, -5, 5), -5);
  assert.strictEqual(clampFinite(2, -5, 5), 2);
});

test("spherical coordinates use +X right, +Y up, -Z forward", () => {
  const front = sphericalToCartesian(0, 0, 1);
  assert.ok(front);
  close(front.x, 0);
  close(front.y, 0);
  close(front.z, -1);

  const right = sphericalToCartesian(90, 0, 1);
  assert.ok(right);
  close(right.x, 1);
  close(right.z, 0);

  const up = sphericalToCartesian(0, 90, 1);
  assert.ok(up);
  close(up.y, 1);
  close(up.z, 0);
});

test("spherical clamps out-of-range input", () => {
  const clamped = sphericalToCartesian(400, 200, 0);
  const expected = sphericalToCartesian(180, 90, 0.05);
  assert.ok(clamped && expected);
  close(clamped.x, expected.x);
  close(clamped.y, expected.y);
  close(clamped.z, expected.z);
});

test("movementPan is deterministic and bounded", () => {
  assert.strictEqual(movementPan({ kind: "fixed" }, 12, 3), 0);
  const sweep = movementPan({ kind: "sweep", widthDeg: 30, rateRadPerSec: 1 }, 0.5, 0.25);
  close(sweep, Math.sin(0.75), EPS);
  for (const movement of [
    { kind: "wander", widthDeg: 30, rateRadPerSec: 0.2, secondaryRatio: 1.618 },
    { kind: "burst", widthDeg: 30, rateRadPerSec: 0.3 },
  ] as const) {
    for (let t = 0; t < 100; t += 0.37) {
      const value = movementPan(movement, t, 0.1);
      assert.ok(value >= -1.0000001 && value <= 1.0000001, `out of range ${value}`);
    }
  }
});

test("fixed profiles only follow their configured azimuth", () => {
  const profile = SPATIAL_PROFILES.fire;
  assert.strictEqual(profile.movement.kind, "fixed");
  const a = positionForProfile(profile, 0, 0);
  const b = positionForProfile(profile, 100, 5);
  close(a.x, b.x);
  close(a.y, b.y);
  close(a.z, b.z);
  assert.ok(a.x > 0, "fire sits slightly right");
});

test("bypass profiles stay centred regardless of elapsed time", () => {
  const profile = SPATIAL_PROFILES.heartbeat;
  assert.strictEqual(profile.mode, "bypass");
  const a = positionForProfile(profile, 0, 0);
  const b = positionForProfile(profile, 42, 9);
  close(a.x, 0);
  close(a.z, -profile.position.distanceM);
  close(a.x, b.x);
  close(a.z, b.z);
});

test("moving profiles swing around their base azimuth", () => {
  const profile = SPATIAL_PROFILES.rain;
  assert.ok(profile.movement.kind === "sweep");
  const left = positionForProfile(profile, 0, -Math.PI / 2);
  const right = positionForProfile(profile, 0, Math.PI / 2);
  assert.ok(left.x < 0, "phase -90° should sit left");
  assert.ok(right.x > 0, "phase +90° should sit right");
});

test("distance influences attenuation geometry", () => {
  const near = sphericalToCartesian(0, 0, 1);
  const far = sphericalToCartesian(0, 0, 10);
  assert.ok(near && far);
  close(Math.hypot(near.x, near.y, near.z), 1);
  close(Math.hypot(far.x, far.y, far.z), 10);
});
