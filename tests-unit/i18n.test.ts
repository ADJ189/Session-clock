import { test } from "node:test";
import assert from "node:assert/strict";
import {
  t,
  getLocale,
  setLocale,
  format,
  LOCALE_NAMES,
  LOCALE_FLAGS,
  LOCALES_LIST,
} from "../src/i18n.ts";

test("all supported locales are defined with names and flags", () => {
  assert.strictEqual(LOCALES_LIST.length, 8);
  for (const loc of LOCALES_LIST) {
    assert.ok(LOCALE_NAMES[loc], `Missing name for ${loc}`);
    assert.ok(LOCALE_FLAGS[loc], `Missing flag for ${loc}`);
  }
});

test("every supported language resolves all 138 keys without undefined values", () => {
  const initial = getLocale();
  try {
    for (const loc of LOCALES_LIST) {
      setLocale(loc);
      assert.strictEqual(getLocale(), loc);
      const strings = t();
      const keys = Object.keys(strings);
      assert.strictEqual(keys.length, 138);
      for (const key of keys) {
        const val = strings[key as keyof typeof strings];
        assert.ok(typeof val === "string" && val.length > 0, `Empty string for ${loc}.${key}`);
      }
    }
  } finally {
    setLocale(initial);
  }
});

test("format() interpolates named placeholders correctly", () => {
  assert.strictEqual(format("Feels like {temp}°", { temp: 24 }), "Feels like 24°");
  assert.strictEqual(
    format("{speed} km/h wind and {humidity}% humidity", { speed: 15, humidity: 65 }),
    "15 km/h wind and 65% humidity",
  );
  assert.strictEqual(format("Step {n} of {total}", { n: 1, total: 4 }), "Step 1 of 4");
  assert.strictEqual(format("No placeholder here", { foo: "bar" }), "No placeholder here");
  assert.strictEqual(format("Missing {missing} token", {}), "Missing {missing} token");
});

test("setLocale dispatches sc:locale event when window exists", () => {
  const initial = getLocale();
  let eventFired = false;
  let eventDetail = "";

  const handler = (e: Event) => {
    eventFired = true;
    eventDetail = (e as CustomEvent<string>).detail;
  };

  globalThis.addEventListener?.("sc:locale", handler);
  try {
    setLocale("ja");
    assert.strictEqual(getLocale(), "ja");
    if (typeof globalThis.addEventListener === "function") {
      assert.strictEqual(eventFired, true);
      assert.strictEqual(eventDetail, "ja");
    }
  } finally {
    globalThis.removeEventListener?.("sc:locale", handler);
    setLocale(initial);
  }
});
