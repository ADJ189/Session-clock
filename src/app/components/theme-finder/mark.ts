import type { Action } from "svelte/action";
import type { Theme } from "../../../types";

export interface MarkParams {
  theme: Theme;
  fillMark: (el: HTMLElement, theme: Theme) => void;
}

/** Svelte action wrapping main.ts's imperative brand-mark renderer. The mark
 *  itself is a leaf owned by that renderer; the component keeps ownership of
 *  the surrounding element and only calls in when the theme changes. */
export const mark: Action<HTMLElement, MarkParams> = (node, params) => {
  let current = params.theme;
  params.fillMark(node, current);
  return {
    update(next) {
      if (next.theme.id === current.id) return;
      current = next.theme;
      next.fillMark(node, current);
    },
  };
};
