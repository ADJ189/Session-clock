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
