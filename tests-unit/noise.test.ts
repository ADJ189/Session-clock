import { test } from "node:test";
import assert from "node:assert/strict";
import { MockAudioContext } from "./mock-audio.ts";
import {
  clearNoiseCache,
  createNoiseSource,
  getNoiseBuffer,
  getNoiseCacheBytes,
} from "../src/audio/noise.ts";

test("noise buffers are cached per context and colour", () => {
  const ctx = new MockAudioContext().asBase();
  const a = getNoiseBuffer(ctx, "white");
  const b = getNoiseBuffer(ctx, "white");
  const c = getNoiseBuffer(ctx, "pink");
  assert.strictEqual(a === b, true);
  assert.strictEqual(a === c, false);
});

test("buffers are mono by default and loop cleanly", () => {
  const ctx = new MockAudioContext().asBase();
  const buffer = getNoiseBuffer(ctx, "brown", 2);
  assert.strictEqual(buffer.numberOfChannels, 1);
  assert.strictEqual(buffer.sampleRate, 48_000);
  assert.strictEqual(buffer.length, 48_000 * 2);
  assert.strictEqual(buffer.duration, 2);
});

test("seconds are clamped to a sane range", () => {
  const ctx = new MockAudioContext().asBase();
  const short = getNoiseBuffer(ctx, "white", 0.01);
  const long = getNoiseBuffer(ctx, "white", 999);
  assert.strictEqual(short.duration, 0.25);
  assert.strictEqual(long.duration, 12);
});

test("cache bytes grow with entries and clear resets them", () => {
  const ctx = new MockAudioContext().asBase();
  assert.strictEqual(getNoiseCacheBytes(ctx), 0);
  const buffer = getNoiseBuffer(ctx, "white", 1);
  const expected = buffer.length * buffer.numberOfChannels * 4;
  assert.strictEqual(getNoiseCacheBytes(ctx), expected);
  clearNoiseCache(ctx);
  assert.strictEqual(getNoiseCacheBytes(ctx), 0);
});

test("createNoiseSource loops and clamps its phase", () => {
  const ctx = new MockAudioContext();
  const handle = createNoiseSource(ctx.asBase(), "pink", {
    seconds: 1,
    phase: 99,
  });
  assert.strictEqual(handle.source.loop, true);
  assert.strictEqual(handle.source.buffer === handle.buffer, true);
  assert.strictEqual(handle.phase <= handle.buffer.duration * 0.9, true);
  assert.strictEqual(handle.phase >= 0, true);
});

test("different contexts do not share cached buffers", () => {
  const a = new MockAudioContext().asBase();
  const b = new MockAudioContext().asBase();
  const first = getNoiseBuffer(a, "white", 1);
  const second = getNoiseBuffer(b, "white", 1);
  assert.strictEqual(first === second, false);
  assert.strictEqual(getNoiseCacheBytes(a) > 0, true);
  assert.strictEqual(getNoiseCacheBytes(b) > 0, true);
});
