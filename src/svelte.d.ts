// Svelte components are compiled by @sveltejs/vite-plugin-svelte. This
// declaration lets TypeScript resolve `.svelte` imports from the controller
// modules without pulling the compiler into the tsc program.
declare module "*.svelte" {
  import type { Component } from "svelte";

  const component: Component<Record<string, unknown>>;
  export default component;
}
