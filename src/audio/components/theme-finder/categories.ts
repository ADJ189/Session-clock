import type { ThemeCategory } from "../../../types";

/** Human labels for the six theme collections. Kept outside themelib.ts so
 *  the Svelte component can render nav/spotlight copy without importing the
 *  controller module back into itself. */
export const CATEGORY_LABELS: Record<ThemeCategory, string> = {
  nat: "Natural",
  tv: "TV Shows",
  movie: "Movies",
  animation: "Animation",
  anime: "Anime",
  f1: "F1 Teams",
};
