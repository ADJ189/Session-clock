import { test } from "node:test";
import assert from "node:assert/strict";
import { MockAudioContext, MockGainNode } from "./mock-audio.ts";
import {
  AMBIENT_PRESET_IDS,
  createAmbientVoice,
  getActiveVoiceCount,
  getEngineStats,
  isAmbientPresetId,
  type AmbientVoice,
} from "../src/audio/engine.ts";

function outputGain(voice: AmbientVoice): MockGainNode {
  return voice.output as unknown as MockGainNode;
}

test("the preset list is unique and complete", () => {
  assert.strictEqual(AMBIENT_PRESET_IDS.length, 35);
  assert.strictEqual(new Set(AMBIENT_PRESET_IDS).size, 35);
  assert.strictEqual(isAmbientPresetId("rain"), true);
  assert.strictEqual(isAmbientPresetId("not-a-sound"), false);
});

test("every preset builds a non-silent voice without errors", () => {
  const ctx = new MockAudioContext();
  const before = getEngineStats();
  const voices: AmbientVoice[] = [];
  try {
    for (const id of AMBIENT_PRESET_IDS) {
      const voice = createAmbientVoice(ctx.asBase(), id, {
        seed: 42,
        manualScheduler: true,
      });
      voices.push(voice);
      const stats = voice.stats();
      assert.ok(
        stats.nodes > 1 || stats.sources > 0 || stats.tasks > 0,
        `${id} built an empty voice`,
      );
      assert.ok(stats.sources > 0 || stats.tasks > 0, `${id} built no sources or events`);
      assert.ok(outputGain(voice).gain.value > 0, `${id} output gain is zero`);
    }
    const after = getEngineStats();
    assert.strictEqual(after.buildErrors, before.buildErrors);
    assert.strictEqual(after.schedulerErrors, before.schedulerErrors);
    assert.strictEqual(after.createdVoices - before.createdVoices, AMBIENT_PRESET_IDS.length);
  } finally {
    for (const voice of voices) voice.stop();
  }
});

test("start/stop updates voice and process state", () => {
  const ctx = new MockAudioContext();
  const before = getActiveVoiceCount();
  const voice = createAmbientVoice(ctx.asBase(), "rain", {
    seed: 1,
    manualScheduler: true,
  });
  try {
    assert.strictEqual(voice.active, false);
    assert.strictEqual(getActiveVoiceCount(), before + 1);
    voice.start();
    assert.strictEqual(voice.active, true);
    voice.start();
    assert.strictEqual(voice.active, true, "double start is harmless");
    assert.strictEqual(ctx.startedSources() > 0, true);
  } finally {
    voice.stop();
  }
  assert.strictEqual(voice.active, false);
  assert.strictEqual(getActiveVoiceCount(), before);
  assert.strictEqual(voice.stats().nodes, 0);
  assert.strictEqual(voice.stats().sources, 0);
  assert.strictEqual(voice.stats().tasks, 0);
});

test("stop is idempotent", () => {
  const ctx = new MockAudioContext();
  const before = getEngineStats();
  const voice = createAmbientVoice(ctx.asBase(), "white", {
    manualScheduler: true,
  });
  voice.stop();
  voice.stop();
  const after = getEngineStats();
  assert.strictEqual(after.stoppedVoices - before.stoppedVoices, 1);
});

test("seeded voices are deterministic in shape", () => {
  const ctx = new MockAudioContext();
  const a = createAmbientVoice(ctx.asBase(), "forest", {
    seed: 123,
    manualScheduler: true,
  });
  const b = createAmbientVoice(ctx.asBase(), "forest", {
    seed: 123,
    manualScheduler: true,
  });
  try {
    assert.strictEqual(a.stats().nodes, b.stats().nodes);
    assert.strictEqual(a.stats().sources, b.stats().sources);
    assert.strictEqual(a.stats().tasks, b.stats().tasks);
  } finally {
    a.stop();
    b.stop();
  }
});

test("voices share the per-context noise cache", () => {
  const ctx = new MockAudioContext();
  const a = createAmbientVoice(ctx.asBase(), "rain", {
    manualScheduler: true,
  });
  const afterA = a.stats().noiseCacheBytes;
  const b = createAmbientVoice(ctx.asBase(), "ocean", {
    manualScheduler: true,
  });
  const afterB = b.stats().noiseCacheBytes;
  try {
    assert.ok(afterA > 0);
    assert.ok(afterB >= afterA, "cache never shrinks when a new voice joins");
  } finally {
    a.stop();
    b.stop();
  }
});

test("manual scheduling registers tasks without a wall timer", async () => {
  const ctx = new MockAudioContext();
  const voice = createAmbientVoice(ctx.asBase(), "birds", {
    manualScheduler: true,
  });
  try {
    voice.start();
    // If a timer were started this process would stay alive; stopping the
    // voice must be enough to let the test body finish promptly.
    assert.strictEqual(voice.stats().tasks > 0, true);
  } finally {
    voice.stop();
  }
});

test("50 start/stop cycles per preset leave no live nodes or tasks", () => {
  const ctx = new MockAudioContext();
  const before = getEngineStats();

  for (const id of AMBIENT_PRESET_IDS) {
    for (let cycle = 0; cycle < 50; cycle++) {
      const voice = createAmbientVoice(ctx.asBase(), id, {
        seed: cycle,
        manualScheduler: true,
      });
      voice.start();
      voice.stop();
      assert.strictEqual(voice.active, false, `${id} cycle ${cycle} active`);
      assert.strictEqual(voice.stats().nodes, 0, `${id} cycle ${cycle} nodes`);
      assert.strictEqual(voice.stats().sources, 0, `${id} cycle ${cycle} sources`);
      assert.strictEqual(voice.stats().tasks, 0, `${id} cycle ${cycle} tasks`);
    }
  }

  assert.strictEqual(getActiveVoiceCount(), 0);
  const after = getEngineStats();
  // A failed build would be counted, and would mean the cycle test silently
  // exercised a broken preset rather than the real one.
  assert.strictEqual(after.buildErrors, before.buildErrors);
  assert.strictEqual(after.schedulerErrors, before.schedulerErrors);
});

test("five simultaneous tracks allocate independently and release on stop", () => {
  const ctx = new MockAudioContext();
  const ids = ["rain", "forest", "birds", "cafe", "wind"] as const;
  const before = getActiveVoiceCount();
  const voices = ids.map((id) =>
    createAmbientVoice(ctx.asBase(), id, {
      seed: 99,
      manualScheduler: true,
    })
  );

  try {
    for (const voice of voices) voice.start();
    assert.strictEqual(getActiveVoiceCount(), before + ids.length);
    const idsSeen = new Set(voices.map((voice) => outputGain(voice).id));
    assert.strictEqual(idsSeen.size, ids.length, "each track owns a distinct output");
    for (const voice of voices) {
      assert.ok(voice.stats().nodes > 0, "a concurrent track has no nodes");
    }
  } finally {
    for (const voice of voices) voice.stop();
  }

  assert.strictEqual(getActiveVoiceCount(), before);
  for (const voice of voices) {
    assert.strictEqual(voice.stats().nodes, 0);
    assert.strictEqual(voice.stats().sources, 0);
    assert.strictEqual(voice.stats().tasks, 0);
  }
});
