import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomStubs } from "./dom-stubs.ts";
import { MockAudioContext } from "./mock-audio.ts";

// Graph-level tests for the scene crossfade contract: the engine must ramp
// from the current live gain to the validated target instead of having the
// controller write the target first (which used to erase the ramp).
installDomStubs();
const globals = globalThis as unknown as Record<string, unknown>;
globals.AudioContext = MockAudioContext;

const Sound = await import("../src/sound.ts");

function reset(): MockAudioContext {
  Sound.stop();
  Sound.stopBinaural();
  Sound.unlockAudio();
  const ctx = MockAudioContext.instances.at(-1);
  assert.ok(ctx, "expected an AudioContext");
  Sound.setSpatial(false);
  return ctx;
}

function eventsFor(gain: { gain: { events: { type: string; value: number }[] } }) {
  return gain.gain.events;
}

test("a crossfade target is scheduled from silence, not written first", () => {
  const ctx = reset();
  assert.ok(Sound.playTrack("rain"));
  const rainGain = ctx.gains.at(-1)!;
  rainGain.gain.events.length = 0;

  Sound.crossfadeTo({ fire: 0.5 }, 50);

  const fireGain = ctx.gains.at(-1)!;
  const fireEvents = eventsFor(fireGain);
  assert.ok(
    fireEvents.some((e) => e.type === "curve" && Math.abs(e.value - 0.5) < 1e-6),
    "new target should ramp in on a curve",
  );
  assert.strictEqual(
    fireEvents.some((e) => e.type === "set" && Math.abs(e.value - 0.5) < 1e-6),
    false,
    "target gain must not be set before the ramp",
  );
  assert.strictEqual(Sound.getTrackVolume("fire"), 0.5);

  const rainEvents = eventsFor(rainGain);
  const outCurve = rainEvents.find((e) => e.type === "curve");
  assert.ok(outCurve, "non-target track should fade out");
  assert.ok(outCurve.value < 1e-6, "fade-out curve ends at silence");
});

test("a track that stays in the mix ramps to its new target", () => {
  const ctx = reset();
  assert.ok(Sound.playTrack("rain"));
  const rainGain = ctx.gains.at(-1)!;
  Sound.setTrackVolume("rain", 0.8);
  rainGain.gain.events.length = 0;

  Sound.crossfadeTo({ rain: 0.35 }, 50);

  const ramp = eventsFor(rainGain).find((e) => e.type === "linear");
  assert.ok(ramp, "existing track should get a linear target ramp");
  assert.ok(Math.abs(ramp.value - 0.35) < 1e-6);
});

test("disjoint and overlapping transitions stay deterministic", () => {
  const ctx = reset();
  assert.ok(Sound.playTrack("rain"));
  assert.ok(Sound.playTrack("fire"));

  Sound.crossfadeTo({ fire: 0.6, wind: 0.2 }, 50);
  const windGain = ctx.gains.at(-1)!;
  assert.ok(
    eventsFor(windGain).some(
      (e) => e.type === "curve" && Math.abs(e.value - 0.2) < 1e-6,
    ),
  );
  assert.strictEqual(Sound.getTrackVolume("fire"), 0.6);

  // Interrupting with a new scene must not throw and must re-target.
  Sound.crossfadeTo({ rain: 0.9 }, 50);
  assert.strictEqual(Sound.getTrackVolume("rain"), 0.9);
  assert.doesNotThrow(() => Sound.crossfadeTo({ rain: 0.9 }, 50));
});

test("an empty scene fades every playing track out", () => {
  const ctx = reset();
  assert.ok(Sound.playTrack("rain"));
  const rainGain = ctx.gains.at(-1)!;
  rainGain.gain.events.length = 0;

  Sound.crossfadeTo({}, 50);

  const outCurve = eventsFor(rainGain).find((e) => e.type === "curve");
  assert.ok(outCurve);
  assert.ok(outCurve.value < 1e-6);
});

test("unknown and non-finite targets are ignored", () => {
  const ctx = reset();
  assert.ok(Sound.playTrack("rain"));
  const before = ctx.gains.length;
  Sound.crossfadeTo({ ghost: 1, fire: Number.NaN }, 50);
  assert.strictEqual(ctx.gains.length, before, "no track should start");
});
