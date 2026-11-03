import { test } from "node:test";
import { assert, assertEquals } from "./assert.ts";
import { MockAudioContext, MockBufferSourceNode } from "./mock-audio.ts";
import { getNoiseBuffer } from "../src/audio/noise.ts";
import { createNoiseHit } from "../src/audio/dsp.ts";

function sourceOf(ctx: MockAudioContext): MockBufferSourceNode {
  const source = ctx.bufferSources[0];
  assert(source, "expected a buffer source");
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

  assertEquals(source.loop, true);
  assert(hit.offset + hit.stopAt > buffer.duration);
  assertEquals(source.starts[0]?.duration, 5.55);
});

test("short noise hits do not loop", () => {
  const ctx = new MockAudioContext();
  const buffer = getNoiseBuffer(ctx.asBase(), "white", 4);
  createNoiseHit(ctx.asBase(), buffer, 0, { duration: 1, gain: 0.2 });
  const source = sourceOf(ctx);

  assertEquals(source.loop, false);
  assertEquals(source.starts[0]?.duration, 1.05);
});
