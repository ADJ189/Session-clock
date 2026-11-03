import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** Svelte 5 is used only for the Theme Finder UI pilot. The canvas renderer,
 *  audio engine, timer services and PWA layer stay framework-independent. */
export default {
  preprocess: vitePreprocess(),
};
