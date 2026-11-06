import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomStubs } from "./dom-stubs.ts";

installDomStubs();

const { themeBuilderController } = await import(
  "../src/app/controllers/theme-builder-controller.ts"
);

test("themeBuilderController: initial snapshot is populated", () => {
  const snap = themeBuilderController.getSnapshot();
  assert.strictEqual(snap.activeField, "accent");
  assert.strictEqual(typeof snap.activeHex, "string");
  assert.strictEqual(snap.rgb.length, 3);
  assert.strictEqual(snap.hsl.length, 3);
});

test("themeBuilderController: setActiveField switches field", () => {
  themeBuilderController.setActiveField("text");
  assert.strictEqual(themeBuilderController.getActiveField(), "text");
  themeBuilderController.setActiveField("accent");
  assert.strictEqual(themeBuilderController.getActiveField(), "accent");
});

test("themeBuilderController: setHex validates input", () => {
  themeBuilderController.setActiveField("accent");
  const ok = themeBuilderController.setHex("#ff00aa");
  assert.strictEqual(ok, true);
  assert.strictEqual(themeBuilderController.getActiveHex().toLowerCase(), "#ff00aa");

  const bad = themeBuilderController.setHex("not-a-color");
  assert.strictEqual(bad, false);
});

test("themeBuilderController: setRgb validates input", () => {
  themeBuilderController.setActiveField("accent");
  const ok = themeBuilderController.setRgb("0, 255, 0");
  assert.strictEqual(ok, true);
  assert.strictEqual(themeBuilderController.getActiveHex().toLowerCase(), "#00ff00");

  const bad = themeBuilderController.setRgb("300, 0, 0");
  assert.strictEqual(bad, false);
});

test("themeBuilderController: setHsl validates input", () => {
  themeBuilderController.setActiveField("accent");
  const ok = themeBuilderController.setHsl("180, 100%, 50%");
  assert.strictEqual(ok, true);
  assert.strictEqual(themeBuilderController.getActiveHex().toLowerCase(), "#00ffff");

  const bad = themeBuilderController.setHsl("500, 200%, 150%");
  assert.strictEqual(bad, false);
});

test("themeBuilderController: save theme persists to storage", () => {
  localStorage.removeItem("sc_custom_themes");
  themeBuilderController.save();

  const saved = themeBuilderController.loadSavedCustomThemes();
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].name, "Custom 1");
});

test("themeBuilderController: export and import round-trip", () => {
  themeBuilderController.setDraftColor("#123456");
  const code = themeBuilderController.export();
  assert.ok(code.startsWith("SCTHEME1:"));

  const imported = themeBuilderController.import(code);
  assert.strictEqual(imported, true);

  const invalid = themeBuilderController.import("INVALID_CODE");
  assert.strictEqual(invalid, false);
});
