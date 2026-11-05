import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomStubs } from "./dom-stubs.ts";
import { AMBIENT_PRESET_IDS } from "../src/audio/engine.ts";
import { SPATIAL_PROFILES } from "../src/audio/spatial.ts";

// Stubs must exist before any module that touches platform.ts is evaluated,
// so sound.ts and soundfiles.ts are imported dynamically below.
installDomStubs();
const sound = await import("../src/sound.ts");
const { AUDIO_CDN_BASE, FILE_TRACKS } = await import("../src/soundfiles.ts");

const FILE_TRACK_SNAPSHOT: Record<
  string,
  { crossfadeSec: number; gainTrim: number }
> = {
  rain: { crossfadeSec: 2, gainTrim: 0.9 },
  fire: { crossfadeSec: 3, gainTrim: 0.85 },
  wind: { crossfadeSec: 3, gainTrim: 0.9 },
  forest: { crossfadeSec: 4, gainTrim: 0.85 },
  cafe: { crossfadeSec: 3, gainTrim: 0.85 },
  library: { crossfadeSec: 3, gainTrim: 0.85 },
  waves: { crossfadeSec: 3, gainTrim: 0.9 },
  river: { crossfadeSec: 2, gainTrim: 0.9 },
  waterfall: { crossfadeSec: 2, gainTrim: 0.85 },
  thunder: { crossfadeSec: 4, gainTrim: 0.8 },
  night: { crossfadeSec: 3, gainTrim: 0.85 },
  birds: { crossfadeSec: 3, gainTrim: 0.85 },
};

test("sound ids, names, icons and order are unchanged", () => {
  assert.strictEqual(sound.SOUNDS.length, 35);
  assert.deepStrictEqual(
    sound.SOUNDS.map((s) => s.id),
    [...AMBIENT_PRESET_IDS],
  );
  for (const s of sound.SOUNDS) {
    assert.ok(s.name.length > 0, `${s.id} has no name`);
    assert.ok(s.icon.length > 0, `${s.id} has no icon`);
    assert.ok((s.desc ?? "").length > 0, `${s.id} has no description`);
  }
  assert.strictEqual(new Set(sound.SOUNDS.map((s) => s.name)).size, 35);
});

test("every sound has an accent and every accent is a hex colour", () => {
  for (const s of sound.SOUNDS) {
    const accent = sound.SOUND_ACCENT[s.id];
    assert.ok(accent, `${s.id} has no accent`);
    assert.match(accent, /^#[0-9a-f]{6}$/i);
  }
});

test("spatial coverage matches the visible sound list exactly", () => {
  assert.deepStrictEqual(
    Object.keys(SPATIAL_PROFILES),
    sound.SOUNDS.map((s) => s.id),
  );
});

test("recorded ambience keeps its CDN and per-track trims", () => {
  assert.strictEqual(
    AUDIO_CDN_BASE,
    "https://cdn.jsdelivr.net/gh/ADJ189/Ambient-Sounds@v2",
  );
  assert.deepStrictEqual(Object.keys(FILE_TRACKS).sort(), Object.keys(FILE_TRACK_SNAPSHOT).sort());
  for (const [id, expected] of Object.entries(FILE_TRACK_SNAPSHOT)) {
    const config = FILE_TRACKS[id];
    assert.ok(config, `${id} missing from FILE_TRACKS`);
    assert.strictEqual(config.crossfadeSec, expected.crossfadeSec, `${id} crossfade`);
    assert.strictEqual(config.gainTrim, expected.gainTrim, `${id} gain trim`);
    assert.strictEqual(config.proceduralFallback, true, `${id} fallback`);
    assert.match(config.url, /^\/opus\/[a-z]+\/[a-z]+\.opus$/);
  }
});

test("binaural presets keep their names, carriers and beats", () => {
  assert.deepStrictEqual(
    sound.BINAURAL_PRESETS.map((p) => p.id),
    ["gamma", "beta", "alpha", "theta", "delta"],
  );
  const beats: Record<string, number> = {
    gamma: 40,
    beta: 18,
    alpha: 10,
    theta: 6,
    delta: 2,
  };
  for (const preset of sound.BINAURAL_PRESETS) {
    assert.strictEqual(preset.carrier, 200);
    assert.strictEqual(preset.beat, beats[preset.id]);
    assert.ok(preset.name.length > 0);
    assert.ok(preset.icon.length > 0);
    assert.match(sound.SOUND_ACCENT[preset.id]!, /^#[0-9a-f]{6}$/i);
  }
});

test("UI toggles and storage keys still exist in the module surface", () => {
  for (const fn of [
    "playTrack",
    "stopTrack",
    "toggleTrack",
    "isPlaying",
    "setTrackVolume",
    "getTrackVolume",
    "setMasterVolume",
    "getMasterVolume",
    "setFade",
    "setSpatial",
    "isSpatialEnabled",
    "tickSpatial",
    "setHeadTracking",
    "isHeadTrackingEnabled",
    "isHeadTrackingAvailable",
    "playBinaural",
    "stopBinaural",
    "toggleBinaural",
    "crossfadeTo",
    "playChime",
    "stop",
    "play",
    "toggle",
  ] as const) {
    assert.strictEqual(typeof sound[fn], "function", `${fn} is missing`);
  }
});

test("spatial mode defaults off and toggles through the public API", () => {
  assert.strictEqual(sound.isSpatialEnabled(), false);
  sound.setSpatial(true);
  assert.strictEqual(sound.isSpatialEnabled(), true);
  sound.setSpatial(false);
  assert.strictEqual(sound.isSpatialEnabled(), false);
});

test("head tracking defaults off on a device without permission", () => {
  assert.strictEqual(sound.isHeadTrackingEnabled(), false);
  sound.setHeadTracking(true);
  // Without DeviceOrientationEvent/CAPS support the call must not enable a
  // listener it cannot drive; either result is safe, but it must not throw.
  assert.strictEqual(typeof sound.isHeadTrackingEnabled(), "boolean");
  sound.setHeadTracking(false);
});
