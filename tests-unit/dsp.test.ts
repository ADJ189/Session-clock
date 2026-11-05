import { test } from "node:test";
import assert from "node:assert/strict";
import { MockAudioContext, MockBufferSourceNode } from "./mock-audio.ts";
import { getNoiseBuffer } from "../src/audio/noise.ts";
import { createNoiseHit } from "../src/audio/dsp.ts";

function sourceOf(ctx: MockAudioContext): MockBufferSourceNode {
  const source = ctx.bufferSources[0];
  assert.ok(source, "expected a buffer source");
  return source;
}

test("long noise hits loop so the tail is not cut off", () => {
  const ctx = new MockAudioContext();
  const buffer = getNoiseBuffer(ctx.asBase(), "white", 4);
  const hit = createNoiseHit(ctx.asBase(), buffer, 0, {
    duration: 5.5,
    gain: 0.2,
  });
  const source = sourceOf(ctx);

  assert.strictEqual(source.loop, true);
  assert.ok(hit.offset + hit.stopAt > buffer.duration);
  assert.strictEqual(source.starts[0]?.duration, 5.55);
});

test("short noise hits do not loop", () => {
  const ctx = new MockAudioContext();
  const buffer = getNoiseBuffer(ctx.asBase(), "white", 4);
  createNoiseHit(ctx.asBase(), buffer, 0, { duration: 1, gain: 0.2 });
  const source = sourceOf(ctx);

  assert.strictEqual(source.loop, false);
  assert.strictEqual(source.starts[0]?.duration, 1.05);
});
