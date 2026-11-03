import { test } from "node:test";
import { assertEquals } from "./assert.ts";
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
  assertEquals(a === b, true);
  assertEquals(a === c, false);
});

test("buffers are mono by default and loop cleanly", () => {
  const ctx = new MockAudioContext().asBase();
  const buffer = getNoiseBuffer(ctx, "brown", 2);
  assertEquals(buffer.numberOfChannels, 1);
  assertEquals(buffer.sampleRate, 48_000);
  assertEquals(buffer.length, 48_000 * 2);
  assertEquals(buffer.duration, 2);
});

test("seconds are clamped to a sane range", () => {
  const ctx = new MockAudioContext().asBase();
  const short = getNoiseBuffer(ctx, "white", 0.01);
  const long = getNoiseBuffer(ctx, "white", 999);
  assertEquals(short.duration, 0.25);
  assertEquals(long.duration, 12);
});

test("cache bytes grow with entries and clear resets them", () => {
  const ctx = new MockAudioContext().asBase();
  assertEquals(getNoiseCacheBytes(ctx), 0);
  const buffer = getNoiseBuffer(ctx, "white", 1);
  const expected = buffer.length * buffer.numberOfChannels * 4;
  assertEquals(getNoiseCacheBytes(ctx), expected);
  clearNoiseCache(ctx);
  assertEquals(getNoiseCacheBytes(ctx), 0);
});

test("createNoiseSource loops and clamps its phase", () => {
  const ctx = new MockAudioContext();
  const handle = createNoiseSource(ctx.asBase(), "pink", {
    seconds: 1,
    phase: 99,
  });
  assertEquals(handle.source.loop, true);
  assertEquals(handle.source.buffer === handle.buffer, true);
  assertEquals(handle.phase <= handle.buffer.duration * 0.9, true);
  assertEquals(handle.phase >= 0, true);
});

test("different contexts do not share cached buffers", () => {
  const a = new MockAudioContext().asBase();
  const b = new MockAudioContext().asBase();
  const first = getNoiseBuffer(a, "white", 1);
  const second = getNoiseBuffer(b, "white", 1);
  assertEquals(first === second, false);
  assertEquals(getNoiseCacheBytes(a) > 0, true);
  assertEquals(getNoiseCacheBytes(b) > 0, true);
});
