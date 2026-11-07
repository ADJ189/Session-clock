import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUDIO_SCHEMA_VERSION,
  clampFadeMinutes,
  clampGain,
  clampMasterGain,
  gainToPercent,
  normalizePreset,
  normalizeScene,
  parsePresets,
  parseScene,
  percentToGain,
  serializePresets,
  serializeScene,
} from "../src/audio/settings.ts";

const IDS: ReadonlySet<string> = new Set(["rain", "fire", "wind"]);

test("gain clamping rejects non-finite values and bounds the range", () => {
  assert.strictEqual(clampGain(0.8), 0.8);
  assert.strictEqual(clampGain(-1), 0);
  assert.strictEqual(clampGain(9), 2);
  assert.strictEqual(clampGain(Number.NaN, 0.5), 0.5);
  assert.strictEqual(clampGain(Number.POSITIVE_INFINITY, 0.5), 0.5);
  assert.strictEqual(clampGain("0.4"), 0.4);
  assert.strictEqual(clampGain("nope", 0.5), 0.5);

  assert.strictEqual(clampMasterGain(3), 2);
  assert.strictEqual(clampMasterGain(undefined), 0.7);
});

test("fade minutes are clamped to the documented 0..60 range and rounded", () => {
  assert.strictEqual(clampFadeMinutes(0), 0);
  assert.strictEqual(clampFadeMinutes(10.4), 10);
  assert.strictEqual(clampFadeMinutes(10.6), 11);
  assert.strictEqual(clampFadeMinutes(-5), 0);
  assert.strictEqual(clampFadeMinutes(999), 60);
  assert.strictEqual(clampFadeMinutes("12"), 12);
  assert.strictEqual(clampFadeMinutes(null), 0);
});

test("percent helpers map 0..200 UI to 0..2 engine gain", () => {
  assert.strictEqual(percentToGain(0), 0);
  assert.strictEqual(percentToGain(80), 0.8);
  assert.strictEqual(percentToGain(200), 2);
  assert.strictEqual(percentToGain(500), 2);
  assert.strictEqual(percentToGain(Number.NaN, 0.4), 0.4);
  assert.strictEqual(gainToPercent(0.8), 80);
  assert.strictEqual(gainToPercent(9), 200);
});

test("legacy bare-array presets still load and are normalised", () => {
  const raw = JSON.stringify([
    { name: "Late Night", tracks: { rain: 0.6, fire: 5, ghost: 0.4 }, master: 0.5 },
  ]);
  const presets = parsePresets(raw, IDS);
  assert.strictEqual(presets.length, 1);
  assert.strictEqual(presets[0]!.name, "Late Night");
  assert.deepStrictEqual(presets[0]!.tracks, { rain: 0.6, fire: 2 });
  assert.strictEqual(presets[0]!.master, 0.5);
});

test("v2 envelopes round-trip with the schema version", () => {
  const serialized = serializePresets([
    { name: "Focus", tracks: { rain: 0.4, wind: 1.2 }, master: 0.9 },
  ]);
  const envelope = JSON.parse(serialized) as { v: number; presets: unknown[] };
  assert.strictEqual(envelope.v, AUDIO_SCHEMA_VERSION);
  assert.strictEqual(envelope.presets.length, 1);

  const parsed = parsePresets(serialized, IDS);
  assert.deepStrictEqual(parsed, [
    { name: "Focus", tracks: { rain: 0.4, wind: 1.2 }, master: 0.9 },
  ]);
});

test("corrupt, unknown-shape and empty storage never throw", () => {
  assert.deepStrictEqual(parsePresets(null, IDS), []);
  assert.deepStrictEqual(parsePresets("", IDS), []);
  assert.deepStrictEqual(parsePresets("{not json", IDS), []);
  assert.deepStrictEqual(parsePresets('{"v":99,"presets":"no"}', IDS), []);
  assert.deepStrictEqual(parsePresets('"a string"', IDS), []);
});

test("invalid preset entries are dropped individually", () => {
  const raw = JSON.stringify({
    v: 2,
    presets: [
      null,
      { name: "" },
      { name: "   " },
      { name: 42, tracks: {} },
      { name: "Good", tracks: {} },
    ],
  });
  const presets = parsePresets(raw, IDS);
  assert.deepStrictEqual(presets.map((p) => p.name), ["Good"]);
});

test("preset names are trimmed, bounded and deduplicated", () => {
  const longName = "x".repeat(80);
  const raw = JSON.stringify({
    v: 2,
    presets: [
      { name: "  One  ", tracks: {}, master: 1 },
      { name: longName, tracks: {}, master: 1 },
      { name: "One", tracks: { rain: 0.2 }, master: 1 },
      { name: "Two", tracks: {}, master: 1 },
    ],
  });
  const presets = parsePresets(raw, IDS);
  assert.deepStrictEqual(presets.map((p) => p.name), ["One", longName.slice(0, 40), "Two"]);
  // Later "One" wins over the earlier entry.
  assert.deepStrictEqual(presets[0]!.tracks, { rain: 0.2 });
  assert.ok(presets.every((p) => p.name.length <= 40));
});

test("the preset list is capped at five entries", () => {
  const raw = JSON.stringify({
    v: 2,
    presets: ["One", "Two", "Three", "Four", "Five", "Six"].map((name) => ({
      name,
      tracks: {},
      master: 1,
    })),
  });
  const presets = parsePresets(raw, IDS);
  assert.strictEqual(presets.length, 5);
  assert.deepStrictEqual(presets.map((p) => p.name), [
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
  ]);
});

test("normalizePreset re-validates a hand-built object", () => {
  const preset = normalizePreset(
    { name: "  Scene  ", tracks: { rain: -2, wind: Number.NaN }, master: 99 },
    IDS,
  );
  assert.deepStrictEqual(preset, {
    name: "Scene",
    tracks: { rain: 0 },
    master: 2,
  });
  assert.strictEqual(normalizePreset({ tracks: {} }, IDS), null);
  assert.strictEqual(normalizePreset("nope", IDS), null);
});

test("legacy and v2 scenes parse; an empty scene is valid silence", () => {
  assert.deepStrictEqual(parseScene('{"tracks":{"rain":0.5}}', IDS), {
    tracks: { rain: 0.5 },
  });
  assert.deepStrictEqual(
    parseScene('{"v":2,"tracks":{"rain":0.5,"ghost":1}}', IDS),
    { tracks: { rain: 0.5 } },
  );
  assert.deepStrictEqual(parseScene('{"v":2,"tracks":{}}', IDS), {
    tracks: {},
  });
  assert.strictEqual(parseScene("not json", IDS), null);
  assert.strictEqual(parseScene('"x"', IDS), null);
  assert.strictEqual(normalizeScene(null, IDS), null);
});

test("scene serialization carries the schema version", () => {
  const serialized = serializeScene({ tracks: { fire: 0.7 } });
  const parsed = JSON.parse(serialized) as {
    v: number;
    tracks: Record<string, number>;
  };
  assert.strictEqual(parsed.v, AUDIO_SCHEMA_VERSION);
  assert.deepStrictEqual(parsed.tracks, { fire: 0.7 });
});
