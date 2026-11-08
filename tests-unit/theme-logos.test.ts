import { test } from "node:test";
import assert from "node:assert/strict";
import { THEMES } from "../src/themes.ts";
import { LOGOS, getThemeLogo } from "../src/app/themes/theme-logos.ts";

test("every theme in THEMES has an icon entry in LOGOS", () => {
  assert.strictEqual(THEMES.length, 103);
  for (const theme of THEMES) {
    const logo = LOGOS[theme.id];
    assert.ok(
      typeof logo === "string" && logo.length > 0,
      `Theme "${theme.id}" must have a valid logo in LOGOS`,
    );
    assert.ok(
      logo.includes('<svg viewBox="0 0 32 22"'),
      `Theme "${theme.id}" logo must be an SVG with viewBox 0 0 32 22`,
    );
  }
});

test("getThemeLogo returns registered logo or deterministic fallback", () => {
  const existing = getThemeLogo("matrix");
  assert.strictEqual(existing, LOGOS["matrix"]);

  const fallback = getThemeLogo("unknown_theme_xyz", "Test Theme", "#000", "#fff");
  assert.ok(fallback.includes('<svg viewBox="0 0 32 22"'));
  assert.ok(fallback.includes("TE"));
});
