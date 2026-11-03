import type { Theme, ThemeCategory } from "../../../types";

export type ThemeLibView = "all" | "recent" | "favs" | ThemeCategory;
export type ThemeLibSort = "default" | "az";

export interface ThemeLibNavItem {
  view: ThemeLibView;
  label: string;
  count: number;
  active: boolean;
  /** Draw the divider before the first category item. */
  dividerBefore?: boolean;
}

export interface ThemeLibEmptyState {
  title: string;
  body: string;
  action: "clear" | "all";
  actionLabel: string;
}

/** Serialisable presentation state handed to the Svelte component. Domain
 *  state (favourites/recents persistence, theme application) stays in
 *  themelib.ts; this is only what the gallery needs to paint. */
export interface ThemeLibSnapshot {
  query: string;
  sort: ThemeLibSort;
  view: ThemeLibView;
  navItems: ThemeLibNavItem[];
  countLabel: string;
  clearVisible: boolean;
  sortDisabled: boolean;
  spotlight: Theme | null;
  /** `sub` when present, otherwise the human category label. */
  spotlightSub: string;
  spotlightFav: boolean;
  recents: Theme[];
  recentsVisible: boolean;
  wallTitle: string;
  wallCount: string;
  empty: ThemeLibEmptyState | null;
}

/** Narrow bridge between the Svelte gallery and the TypeScript controller. */
export interface ThemeFinderController {
  getSnapshot(): ThemeLibSnapshot;
  subscribe(listener: (snapshot: ThemeLibSnapshot) => void): () => void;
  setQuery(value: string): void;
  setSort(value: string): void;
  setView(view: ThemeLibView): void;
  toggleFav(id: string): void;
  chooseTheme(theme: Theme, origin: HTMLElement | null): void;
  clearSearch(): void;
  close(): void;
  fillMark(el: HTMLElement, theme: Theme): void;
}
