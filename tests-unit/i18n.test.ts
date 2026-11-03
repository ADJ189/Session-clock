import { test } from "node:test";
import { assert, assertEquals } from "./assert.ts";
import {
  t,
  getLocale,
  setLocale,
  format,
  LOCALE_NAMES,
  LOCALE_FLAGS,
  LOCALES_LIST,
  type Locale,
} from "../src/i18n.ts";

test("all supported locales are defined with names and flags", () => {
  assertEquals(LOCALES_LIST.length, 8);
  for (const loc of LOCALES_LIST) {
    assert(LOCALE_NAMES[loc], `Missing name for ${loc}`);
    assert(LOCALE_FLAGS[loc], `Missing flag for ${loc}`);
  }
});

test("every supported language resolves all 138 keys without undefined values", () => {
  const initial = getLocale();
  try {
    for (const loc of LOCALES_LIST) {
      setLocale(loc);
      assertEquals(getLocale(), loc);
      const strings = t();
      const keys = Object.keys(strings);
      assertEquals(keys.length, 138);
      for (const key of keys) {
        const val = strings[key as keyof typeof strings];
        assert(typeof val === "string" && val.length > 0, `Empty string for ${loc}.${key}`);
      }
    }
  } finally {
    setLocale(initial);
  }
});

test("format() interpolates named placeholders correctly", () => {
  assertEquals(format("Feels like {temp}°", { temp: 24 }), "Feels like 24°");
  assertEquals(
    format("{speed} km/h wind and {humidity}% humidity", { speed: 15, humidity: 65 }),
    "15 km/h wind and 65% humidity",
  );
  assertEquals(format("Step {n} of {total}", { n: 1, total: 4 }), "Step 1 of 4");
  assertEquals(format("No placeholder here", { foo: "bar" }), "No placeholder here");
  assertEquals(format("Missing {missing} token", {}), "Missing {missing} token");
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
    assertEquals(getLocale(), "ja");
    if (typeof globalThis.addEventListener === "function") {
      assertEquals(eventFired, true);
      assertEquals(eventDetail, "ja");
    }
  } finally {
    globalThis.removeEventListener?.("sc:locale", handler);
    setLocale(initial);
  }
});
