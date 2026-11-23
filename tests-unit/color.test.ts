import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rgbaToHex,
  hexToRgb,
  hexToHsl,
  hslToHex,
  hslToHsv,
  relativeLuminance,
  onAccentInk,
  VALID_COLOR,
} from "../src/app/utils/color.ts";

test("color: hexToRgb converts correctly", () => {
  assert.deepStrictEqual(hexToRgb("#ffffff"), [255, 255, 255]);
  assert.deepStrictEqual(hexToRgb("#000000"), [0, 0, 0]);
  assert.deepStrictEqual(hexToRgb("#ff0000"), [255, 0, 0]);
});

test("color: hexToHsl and hslToHex are inverses", () => {
  const [h, s, l] = hexToHsl("#ff0000");
  assert.strictEqual(h, 0);
  assert.strictEqual(s, 100);
  assert.strictEqual(l, 50);
  assert.strictEqual(hslToHex(h, s, l), "#ff0000");
});

test("color: rgbaToHex converts rgba strings", () => {
  assert.strictEqual(rgbaToHex("rgba(255, 0, 0, 1)"), "#ff0000");
  assert.strictEqual(rgbaToHex("rgba(4, 3, 18, 0.85)"), "#040312");
});

test("color: relativeLuminance calculates proper brightness", () => {
  const lumWhite = relativeLuminance("#ffffff");
  const lumBlack = relativeLuminance("#000000");
  assert.ok(lumWhite > lumBlack);
  assert.strictEqual(lumBlack, 0);
  assert.ok(Math.abs(lumWhite - 1.0) < 0.01);
});

test("color: onAccentInk chooses readable ink", () => {
  assert.strictEqual(onAccentInk("#ffffff"), "#06110c"); // dark ink on white
  assert.strictEqual(onAccentInk("#000000"), "#ffffff"); // light ink on black
});

test("color: VALID_COLOR regex checks", () => {
  assert.ok(VALID_COLOR.test("#ffffff"));
  assert.ok(VALID_COLOR.test("#fff"));
  assert.ok(VALID_COLOR.test("rgba(0, 0, 0, 0.5)"));
  assert.ok(!VALID_COLOR.test("javascript:alert(1)"));
  assert.ok(!VALID_COLOR.test("red"));
});

test("color: hslToHsv maps the HSV picker axes correctly", () => {
  assert.deepStrictEqual(hslToHsv(100, 50), { s: 1, v: 1 });
  assert.deepStrictEqual(hslToHsv(0, 100), { s: 0, v: 1 });
  assert.deepStrictEqual(hslToHsv(0, 0), { s: 0, v: 0 });
  const mid = hslToHsv(50, 50); // HSL 50/50/50 → HSV 2/3, 3/4
  assert.ok(Math.abs(mid.s - 2 / 3) < 1e-9);
  assert.ok(Math.abs(mid.v - 0.75) < 1e-9);
});
