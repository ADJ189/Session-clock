import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomStubs } from "./dom-stubs.ts";

installDomStubs();

const { soundMixerController } = await import(
  "../src/app/controllers/sound-mixer-controller.ts"
);

test("soundMixerController: snapshot contains tracks and binaural presets", () => {
  const snap = soundMixerController.getSnapshot();
  assert.ok(snap.tracks.length > 0, "tracks should not be empty");
  assert.ok(snap.binauralPresets.length > 0, "binauralPresets should not be empty");
  assert.strictEqual(typeof snap.masterVol, "number");
  assert.strictEqual(typeof snap.fade, "number");
  assert.ok(["auto", "on", "off"].includes(snap.nightMode));
});

test("soundMixerController: volume clamping works", () => {
  soundMixerController.setMasterVolume(75);
  assert.strictEqual(soundMixerController.getMasterVolume(), 75);

  soundMixerController.setMasterVolume(250);
  assert.strictEqual(soundMixerController.getMasterVolume(), 200);

  soundMixerController.setMasterVolume(-10);
  assert.strictEqual(soundMixerController.getMasterVolume(), 0);
});

test("soundMixerController: fade duration updates", () => {
  soundMixerController.setFade(10);
  assert.strictEqual(soundMixerController.getFade(), 10);
  soundMixerController.setFade(0);
  assert.strictEqual(soundMixerController.getFade(), 0);
});

test("soundMixerController: night mode cycles correctly", () => {
  localStorage.setItem("sc_mixer_night", "auto");
  assert.strictEqual(soundMixerController.getNightMode(), "auto");

  soundMixerController.toggleNightMode();
  assert.strictEqual(soundMixerController.getNightMode(), "on");
  assert.strictEqual(localStorage.getItem("sc_mixer_night"), "on");

  soundMixerController.toggleNightMode();
  assert.strictEqual(soundMixerController.getNightMode(), "off");
  assert.strictEqual(localStorage.getItem("sc_mixer_night"), "off");

  soundMixerController.toggleNightMode();
  assert.strictEqual(soundMixerController.getNightMode(), "auto");
  assert.strictEqual(localStorage.getItem("sc_mixer_night"), "auto");
});

test("soundMixerController: sound presets CRUD", () => {
  localStorage.removeItem("sc_sound_presets");
  soundMixerController.savePreset("Test Focus");

  const presets = soundMixerController.getSoundPresets();
  assert.strictEqual(presets.length, 1);
  assert.strictEqual(presets[0].name, "Test Focus");

  soundMixerController.deletePreset("Test Focus");
  assert.strictEqual(soundMixerController.getSoundPresets().length, 0);
});

test("soundMixerController: auto crossfade setting persists", () => {
  soundMixerController.setAutoCrossfade(true);
  assert.strictEqual(localStorage.getItem("sc_mixer_autofade"), "1");

  soundMixerController.setAutoCrossfade(false);
  assert.strictEqual(localStorage.getItem("sc_mixer_autofade"), "0");
});

test("soundMixerController: corrupt presets never block the mixer", () => {
  localStorage.setItem("sc_sound_presets", "{not json");
  assert.deepStrictEqual(soundMixerController.getSoundPresets(), []);

  localStorage.setItem(
    "sc_sound_presets",
    JSON.stringify([
      { name: "  Loud  ", tracks: { rain: 9, ghost: 0.5 }, master: 9 },
      null,
      { name: "" },
    ]),
  );
  const presets = soundMixerController.getSoundPresets();
  assert.strictEqual(presets.length, 1);
  assert.strictEqual(presets[0]!.name, "Loud");
  assert.deepStrictEqual(presets[0]!.tracks, { rain: 2 });
  assert.strictEqual(presets[0]!.master, 2);
});

test("soundMixerController: scenes are validated and unknown tracks dropped", () => {
  localStorage.setItem(
    "sc_scene_focus",
    JSON.stringify({ tracks: { rain: 0.5, ghost: 1 } }),
  );
  assert.deepStrictEqual(soundMixerController.getScene("focus"), {
    tracks: { rain: 0.5 },
  });

  localStorage.setItem("sc_scene_break", "{bad");
  assert.strictEqual(soundMixerController.getScene("break"), null);
});

test("soundMixerController: fade duration is clamped and persisted", () => {
  soundMixerController.setFade(999);
  assert.strictEqual(soundMixerController.getFade(), 60);
  assert.strictEqual(localStorage.getItem("sc_sound_fade"), "60");

  soundMixerController.setFade(-2);
  assert.strictEqual(soundMixerController.getFade(), 0);
  assert.strictEqual(localStorage.getItem("sc_sound_fade"), "0");

  soundMixerController.setFade(5.6);
  assert.strictEqual(soundMixerController.getFade(), 6);
  soundMixerController.setFade(0);
});
