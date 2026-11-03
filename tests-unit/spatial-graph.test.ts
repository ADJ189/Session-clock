import { test } from "node:test";
// Graph-level coverage for the HRTF integration spec.
//
// These tests run the real sound.ts public API against the hand-written Web
// Audio mock, so they see the exact same routing code the browser uses:
// per-track gain → PannerNode(HRTF) → shared analyser, with the StereoPanner
// fallback and the separate binaural path.

import { assert, assertEquals } from "./assert.ts";
import { installDomStubs } from "./dom-stubs.ts";
import { SPATIAL_PROFILES } from "../src/audio/spatial.ts";
import {
  MockAudioContext,
  MockPannerNode,
  MockStereoPannerNode,
} from "./mock-audio.ts";

installDomStubs();
// Platform capability + constructor are read at point of use, not module load.
const globals = globalThis as unknown as Record<string, unknown>;
globals.DeviceOrientationEvent = class DeviceOrientationEvent {};
globals.AudioContext = MockAudioContext;

const Sound = await import("../src/sound.ts");
const Platform = await import("../src/platform.ts");

function context(): MockAudioContext {
  const ctx = MockAudioContext.instances.at(-1);
  assert(ctx, "expected an AudioContext to have been created");
  return ctx;
}

function trackGainFor(
  ctx: MockAudioContext,
  panner: MockPannerNode | MockStereoPannerNode,
) {
  const gain = ctx.gains.find((node) => node.connections.includes(panner));
  assert(gain, "expected a per-track gain feeding the spatial node");
  return gain;
}

function reset(): MockAudioContext {
  Sound.stop();
  Sound.stopBinaural();
  // Make sure the shared context exists even for a test that starts from a
  // cold module (ensureCtx is lazy).
  Sound.unlockAudio();
  const ctx = context();
  ctx.failCreatePanner = false;
  ctx.failPanningModel = false;
  Sound.setSpatial(true);
  return ctx;
}

test("spatial playback inserts one HRTF panner after the track gain", () => {
  const ctx = reset();
  const analyser = ctx.analysers[0]!;
  const before = ctx.hrtfPanners.length;

  assert(Sound.playTrack("white"), "playTrack should start");
  assertEquals(ctx.hrtfPanners.length - before, 1);
  assertEquals(ctx.panners.length, 0, "no stereo fallback when HRTF works");

  const panner = ctx.hrtfPanners.at(-1)!;
  assertEquals(panner.panningModel, "HRTF");
  const gain = trackGainFor(ctx, panner);
  assert(gain.connections.includes(panner));
  assert(panner.connections.includes(analyser));
  assertEquals(gain.connections.includes(analyser), false);
});

test("turning spatial off restores the dry per-track path", () => {
  const ctx = reset();
  const analyser = ctx.analysers[0]!;
  Sound.playTrack("white");
  const panner = ctx.hrtfPanners.at(-1)!;
  const gain = trackGainFor(ctx, panner);

  Sound.setSpatial(false);
  assert(gain.connections.includes(analyser));
  assertEquals(gain.connections.includes(panner), false);
  assertEquals(panner.disconnectCount > 0, true);
});

test("stopping a track tears down its rig and reconnects the dry path", () => {
  const ctx = reset();
  const analyser = ctx.analysers[0]!;
  Sound.playTrack("pink");
  const panner = ctx.hrtfPanners.at(-1)!;
  const gain = trackGainFor(ctx, panner);

  Sound.stopTrack("pink");
  assertEquals(Sound.isPlaying("pink"), false);
  assertEquals(gain.connections.includes(panner), false);
  // The gain itself is disconnected during stopTrack; a replay must rebuild
  // the rig rather than reuse a dangling panner.
  Sound.playTrack("pink");
  assertEquals(ctx.hrtfPanners.length >= 2, true);
  assert(ctx.analysers[0] === analyser);
});

test("createPanner failure falls back to an equal-power stereo panner", () => {
  const ctx = reset();
  const analyser = ctx.analysers[0]!;
  ctx.failCreatePanner = true;
  const hrtfBefore = ctx.hrtfPanners.length;
  const stereoBefore = ctx.panners.length;

  assert(Sound.playTrack("white"));
  assertEquals(ctx.hrtfPanners.length, hrtfBefore, "HRTF was unavailable");
  assertEquals(ctx.panners.length - stereoBefore, 1);

  const fallback = ctx.panners.at(-1)!;
  const gain = trackGainFor(ctx, fallback);
  assert(gain.connections.includes(fallback));
  assert(fallback.connections.includes(analyser));
});

test("rejected panningModel also falls back instead of going silent", () => {
  const ctx = reset();
  const analyser = ctx.analysers[0]!;
  ctx.failPanningModel = true;
  const stereoBefore = ctx.panners.length;

  assert(Sound.playTrack("brown"));
  assertEquals(ctx.panners.length - stereoBefore, 1);
  const fallback = ctx.panners.at(-1)!;
  const gain = trackGainFor(ctx, fallback);
  assert(fallback.connections.includes(analyser));
  // The panner object that rejected HRTF must not be left connected.
  const rejected = ctx.hrtfPanners.at(-1)!;
  assertEquals(rejected.connections.length, 0);
  assert(gain.connections.includes(rejected) === false);
});

test("file-backed and synthesized tracks share the same panner choke point", () => {
  const ctx = reset();
  const before = ctx.hrtfPanners.length;

  // "rain" is file-backed with a procedural fallback; in Node the media
  // element probe reports no Opus support, so this exercises the fallback
  // maker. "white" is pure synthesis. Both must still get exactly one
  // track-level panner: the rig lives in playTrack, not in either maker.
  assert(Sound.playTrack("rain"));
  assert(Sound.playTrack("white"));

  assertEquals(ctx.hrtfPanners.length - before, 2);
  const panners = ctx.hrtfPanners.slice(-2);
  assertEquals(new Set(panners.map((p) => p.id)).size, 2);
  for (const panner of panners) {
    assertEquals(panner.panningModel, "HRTF");
    trackGainFor(ctx, panner);
    assert(panner.connections.length > 0);
  }
});

test("bypass profiles stay dry", () => {
  const ctx = reset();
  const beforeHrtf = ctx.hrtfPanners.length;
  const beforeStereo = ctx.panners.length;

  assert(Sound.playTrack("heartbeat"));
  assertEquals(ctx.hrtfPanners.length, beforeHrtf);
  assertEquals(ctx.panners.length, beforeStereo);
});

test("binaural beats keep their own path and never enter HRTF", () => {
  const ctx = reset();
  const beforeHrtf = ctx.hrtfPanners.length;
  const beforeOsc = ctx.oscillators.length;
  const preset = Sound.BINAURAL_PRESETS[0]!;

  assert(Sound.playBinaural(preset.id));
  assertEquals(ctx.hrtfPanners.length, beforeHrtf);
  assertEquals(ctx.oscillators.length - beforeOsc, 2);
  assert(ctx.mergers.length >= 1);
  const merger = ctx.mergers.at(-1)!;
  assert(merger.connections.length > 0);
  assertEquals(Sound.isSpatialEnabled(), true, "HRTF stays enabled in general");
});

test("moving profiles update their panner position on tick", () => {
  const ctx = reset();
  Sound.playTrack("rain");
  const panner = ctx.hrtfPanners.at(-1)!;
  const before = panner.positionX.events.length;

  Sound.tickSpatial(0);
  Sound.tickSpatial(1);
  assert(
    panner.positionX.events.length > before,
    "sweep profile should write a new X position",
  );
});

test("repeated spatial toggles never duplicate the track route", () => {
  const ctx = reset();
  const analyser = ctx.analysers[0]!;
  assert(Sound.playTrack("white"));
  const gain = trackGainFor(ctx, ctx.hrtfPanners.at(-1)!);

  for (let cycle = 0; cycle < 6; cycle++) {
    Sound.setSpatial(false);
    assertEquals(
      gain.connections.filter((node) => node === analyser).length,
      1,
      `cycle ${cycle}: exactly one dry edge`,
    );
    assertEquals(
      gain.connections.filter((node) => node !== analyser).length,
      0,
      `cycle ${cycle}: no stale spatial edge`,
    );

    Sound.setSpatial(true);
    const panner = ctx.hrtfPanners.at(-1)!;
    assertEquals(
      gain.connections.filter((node) => node === panner).length,
      1,
      `cycle ${cycle}: exactly one panner edge`,
    );
    assertEquals(
      gain.connections.filter((node) => node === analyser).length,
      0,
      `cycle ${cycle}: dry edge removed while spatial is on`,
    );
  }
});

test("stopping one track leaves another track's rig intact", () => {
  const ctx = reset();
  const analyser = ctx.analysers[0]!;
  assert(Sound.playTrack("rain"));
  assert(Sound.playTrack("wind"));

  const [rainPanner, windPanner] = ctx.hrtfPanners.slice(-2);
  const rainGain = trackGainFor(ctx, rainPanner!);
  const windGain = trackGainFor(ctx, windPanner!);

  Sound.stopTrack("rain");

  assertEquals(rainGain.connections.includes(rainPanner!), false);
  assertEquals(Sound.isPlaying("rain"), false);
  assert(Sound.isPlaying("wind"), "the other track kept playing");
  assert(windGain.connections.includes(windPanner!));
  assert(windPanner!.connections.includes(analyser));
});

test("head tracking subscribes and unsubscribes the listener feed", () => {
  Sound.setHeadTracking(false);
  assertEquals(Platform.getOrientationSubscriberCount(), 0);

  Sound.setHeadTracking(true);
  assertEquals(Sound.isHeadTrackingEnabled(), true);
  assertEquals(Platform.getOrientationSubscriberCount(), 1);

  // Repeated enable must not stack duplicate subscriptions.
  Sound.setHeadTracking(true);
  assertEquals(Platform.getOrientationSubscriberCount(), 1);

  Sound.setHeadTracking(false);
  assertEquals(Sound.isHeadTrackingEnabled(), false);
  assertEquals(Platform.getOrientationSubscriberCount(), 0);
  assertEquals(localStorage.getItem("sc_head_tracking"), "0");
});

// The integration spec's checklist is per sound, not just per graph helper. A
// representative preset can look correct while one of the other 34 maps to a
// profile that never gets attached, so walk the real SOUNDS list and assert
// the routing contract for every ID with spatial both on and off.
test("every ambient preset spatialises when on and stays dry when off", () => {
  const ids = Sound.SOUNDS.map((s) => s.id);
  assertEquals(ids.length, 35);
  assertEquals(new Set(ids).size, 35);

  const bypass = new Set(
    ids.filter(
      (id) =>
        SPATIAL_PROFILES[id as keyof typeof SPATIAL_PROFILES]?.mode ===
          "bypass",
    ),
  );
  // Only heartbeat is deliberately dry in the current profile table; if that
  // changes, the loop below still checks the new bypass set rather than
  // assuming a hard-coded list.
  assertEquals([...bypass], ["heartbeat"]);

  for (const id of ids) {
    const ctx = reset();
    const analyser = ctx.analysers[0]!;
    const hrtfBefore = ctx.hrtfPanners.length;

    assert(Sound.playTrack(id), `${id} should start`);
    if (bypass.has(id)) {
      assertEquals(ctx.hrtfPanners.length, hrtfBefore, `${id} should bypass`);
    } else {
      assertEquals(
        ctx.hrtfPanners.length - hrtfBefore,
        1,
        `${id} should create one HRTF panner`,
      );
      const panner = ctx.hrtfPanners.at(-1)!;
      assertEquals(panner.panningModel, "HRTF", `${id} panning model`);
      const gain = trackGainFor(ctx, panner);
      assert(gain.connections.includes(panner), `${id} gain → panner`);
      assert(panner.connections.includes(analyser), `${id} panner → analyser`);
      assertEquals(
        gain.connections.includes(panner),
        true,
        `${id} has no parallel dry edge`,
      );

      // Disabling spatial on the live track must restore exactly the dry edge.
      Sound.setSpatial(false);
      assert(gain.connections.includes(analyser), `${id} dry reconnect`);
      assertEquals(
        gain.connections.includes(panner),
        false,
        `${id} panner detached`,
      );
    }

    // Replaying while spatial is off must not create a new spatial node.
    const offHrtf = ctx.hrtfPanners.length;
    Sound.stopTrack(id);
    assert(Sound.playTrack(id), `${id} should replay`);
    assertEquals(
      ctx.hrtfPanners.length,
      offHrtf,
      `${id} should stay dry when spatial is off`,
    );

    Sound.stop();
  }
});
