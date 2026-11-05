import type { Theme } from "../../../types";

/** Star glyph shared by the Svelte spotlight and the imperative card fallback.
 *  Keeping the path geometry in one place stops the two surfaces drifting. */
export const STAR_PATH =
  "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z";

/** Theme colours as CSS custom properties. Both the Svelte spotlight/recents
 *  and the imperative card wall consume this one mapping. */
export function themeVars(t: Theme): Record<string, string> {
  return {
    "--tl-bg0": t.baseBg[0] ?? "#000",
    "--tl-bg1": t.baseBg[1] ?? t.baseBg[0] ?? "#000",
    "--tl-bg2": t.baseBg[2] ?? t.baseBg[0] ?? "#000",
    "--tl-accent": t.accent,
    "--tl-accent2": t.accent2,
    "--tl-text": t.text,
    "--tl-font": t.font,
  };
}

/** Inline style string for Svelte's `style={...}` binding. */
export function themeStyle(t: Theme): string {
  return Object.entries(themeVars(t))
    .map(([prop, value]) => `${prop}:${value}`)
    .join(";");
}
