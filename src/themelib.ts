// Theme Finder — the visual discovery gallery behind every "Themes" action.
//
// The Svelte 5 component under app/components/theme-finder owns the gallery
// chrome: header, search, sort, collections, current-theme spotlight, recent
// rail, wall heading and empty state. This module remains the
// framework-independent controller: persistence, filtering, theme application
// and the cached card wall. Cards stay outside Svelte so filtering re-attaches
// the same DOM nodes instead of rebuilding ~100 previews on every keystroke.
//
// Selection still goes through the `apply` callback (main.ts `applyTheme`), so
// there is exactly one code path that drives the renderer, transitions, CSS
// variables and `sc_last_theme`.

import { mount, unmount } from "svelte";
import { THEMES, THEME_BY_ID } from "./themes";
import { THEME_CATEGORIES, type Theme, type ThemeCategory } from "./types";
import { safeJsonGet, safeJsonSet } from "./storage";
import { PREVIEW_IDS } from "./themepreviews";
import { themeFinderReveal } from "./motion";
import ThemeFinder from "./app/components/theme-finder/ThemeFinder.svelte";
import { CATEGORY_LABELS } from "./app/components/theme-finder/categories";
import type {
  ThemeFinderController,
  ThemeLibSnapshot,
  ThemeLibSort,
  ThemeLibView,
} from "./app/components/theme-finder/types";

export { CATEGORY_LABELS };

export const FAV_KEY = "sc_theme_favs_v1";
export const RECENT_KEY = "sc_theme_recent_v1";
export const RECENT_MAX = 12;

// Nav order follows the original picker tabs, not THEME_CATEGORIES order.
const CATEGORY_ORDER: ThemeCategory[] = [
  "nat",
  "tv",
  "movie",
  "animation",
  "anime",
  "f1",
];

export interface ThemeLibDeps {
  /** Applies a theme through the app's single theme path. */
  apply: (theme: Theme) => void;
  /** Id of the theme that is currently applied. */
  currentId: () => string;
  /** Fills `el` with the theme's brand mark (SVG or generated fallback). */
  fillMark: (el: HTMLElement, theme: Theme) => void;
  openOverlay: () => void;
  closeOverlay: () => void;
}

// ── Pure helpers (exported for tests) ─────────────────────────────────

/** Keeps only known, unique theme ids. Anything else is silently dropped. */
export function sanitizeIds(raw: unknown, max = Infinity): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string" || seen.has(v) || !Object.prototype.hasOwnProperty.call(THEME_BY_ID, v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

const stripEmoji = (s: string) =>
  s
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\uFE0F/g, "")
    .trim();

/** Every whitespace-separated token must appear in name, id, category, sub or tagline. */
export function matchesQuery(t: Theme, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = [
    t.name,
    t.id,
    CATEGORY_LABELS[t.cat],
    t.sub ?? "",
    stripEmoji(t.tagline ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  return tokens.every((tok) => hay.includes(tok));
}

// ── State ─────────────────────────────────────────────────────────────

let deps: ThemeLibDeps;
let favs: string[] = [];
let recents: string[] = [];
let view: ThemeLibView = "all";
let sort: ThemeLibSort = "default";
let query = "";

const cards = new Map<string, HTMLElement>();
const listeners = new Set<(snapshot: ThemeLibSnapshot) => void>();

let overlay: HTMLElement | null = null;
let grid: HTMLElement | null = null;
let mainEl: HTMLElement | null = null;
let app: ReturnType<typeof mount> | null = null;
let wired = false;

const $id = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const SVG_STAR =
  '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" stroke-width="2" stroke-linejoin="round"/></svg>';
const SVG_CHECK =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// ── Shared art helpers ────────────────────────────────────────────────

/** Theme data drives every preview surface. Values are compile-time
 *  constants from themes.ts, never user input. */
function applyThemeVars(node: HTMLElement, t: Theme) {
  node.style.setProperty("--tl-bg0", t.baseBg[0] ?? "#000");
  node.style.setProperty("--tl-bg1", t.baseBg[1] ?? t.baseBg[0] ?? "#000");
  node.style.setProperty("--tl-bg2", t.baseBg[2] ?? t.baseBg[0] ?? "#000");
  node.style.setProperty("--tl-accent", t.accent);
  node.style.setProperty("--tl-accent2", t.accent2);
  node.style.setProperty("--tl-text", t.text);
  node.style.setProperty("--tl-font", t.font);
  node.dataset.bg = t.bgType;
}

/** Adds the static scene canvas + real thumbnail when one has been
 *  generated. Missing/failed previews simply leave the layered CSS scene
 *  in place — a designed fallback, never a broken-image icon. */
function addPreviewArt(parent: HTMLElement, t: Theme) {
  const scene = el("span", "tl-scene");
  scene.setAttribute("aria-hidden", "true");
  parent.appendChild(scene);
  if (PREVIEW_IDS.has(t.id)) {
    const img = new Image(640, 360);
    img.className = "tl-img";
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = `${import.meta.env.BASE_URL}theme-previews/${t.id}.webp`;
    img.addEventListener("error", () => img.remove());
    parent.appendChild(img);
  }
}

// ── Cards ─────────────────────────────────────────────────────────────

function buildCard(t: Theme): HTMLElement {
  const card = el("div", "tl-card");
  card.dataset.id = t.id;
  card.setAttribute("role", "listitem");
  applyThemeVars(card, t);

  const main = el("button", "tl-pick");
  main.type = "button";

  const prev = el("span", "tl-prev");
  prev.setAttribute("aria-hidden", "true");
  addPreviewArt(prev, t);
  const mark = el("span", "tl-mark");
  deps.fillMark(mark, t);
  prev.appendChild(mark);

  const meta = el("span", "tl-meta");
  const name = el("span", "tl-name", t.name);
  const sub = el("span", "tl-sub", t.sub ?? CATEGORY_LABELS[t.cat]);
  const using = el("span", "tl-using");
  using.innerHTML = SVG_CHECK;
  using.append(document.createTextNode("Using now"));
  meta.append(name, sub, using);

  main.append(prev, meta);
  main.addEventListener("click", () => chooseTheme(t, prev));

  const fav = el("button", "tl-fav");
  fav.type = "button";
  const star = el("span", "tl-fav-icon");
  star.innerHTML = SVG_STAR;
  fav.appendChild(star);
  fav.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFav(t.id);
  });

  card.append(main, fav);
  syncCard(card, t);
  return card;
}

function chooseTheme(t: Theme, origin: HTMLElement | null) {
  // Decorative reveal only — the theme applies on the same tick either way.
  const rect = origin ? origin.getBoundingClientRect() : null;
  themeFinderReveal(rect, t.accent);
  deps.apply(t);
}

function syncCard(card: HTMLElement, t: Theme) {
  const active = t.id === deps.currentId();
  card.classList.toggle("active", active);
  const main = card.querySelector<HTMLElement>(".tl-pick")!;
  if (active) main.setAttribute("aria-current", "true");
  else main.removeAttribute("aria-current");
  main.setAttribute(
    "aria-label",
    `${t.name}, ${t.sub ?? CATEGORY_LABELS[t.cat]}${active ? ", using now" : ""}`,
  );
  const isFav = favs.includes(t.id);
  const fav = card.querySelector<HTMLElement>(".tl-fav")!;
  fav.setAttribute("aria-pressed", String(isFav));
  fav.setAttribute(
    "aria-label",
    isFav ? `Remove ${t.name} from favourites` : `Add ${t.name} to favourites`,
  );
  card.classList.toggle("is-fav", isFav);
}

const cardFor = (t: Theme) => {
  let c = cards.get(t.id);
  if (!c) {
    c = buildCard(t);
    cards.set(t.id, c);
  }
  return c;
};

// ── Persistence ───────────────────────────────────────────────────────

function readFavs(): string[] {
  return sanitizeIds(safeJsonGet<unknown>(FAV_KEY, []));
}

function readRecents(): string[] {
  return sanitizeIds(safeJsonGet<unknown>(RECENT_KEY, []), RECENT_MAX);
}

function toggleFav(id: string) {
  // Storage is the source of truth, not this module's snapshot: another tab
  // may have added or removed a favourite since we loaded, and writing our
  // stale copy back would silently drop that change.
  favs = readFavs();
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  safeJsonSet(FAV_KEY, favs);
  const t = THEME_BY_ID[id];
  const c = cards.get(id);
  if (t && c) syncCard(c, t);
  // Removing a favourite while viewing Favourites drops the card.
  if (view === "favs") paint();
  else notify();
}

function pushRecent(id: string) {
  if (!THEME_BY_ID[id]) return;
  // Same reasoning as toggleFav: merge into the latest persisted list so a
  // recent recorded in another tab isn't overwritten by this one.
  recents = readRecents();
  if (recents[0] === id) return;
  recents = [id, ...recents.filter((r) => r !== id)].slice(0, RECENT_MAX);
  safeJsonSet(RECENT_KEY, recents);
}

// ── View model ────────────────────────────────────────────────────────

function themesForView(): Theme[] {
  let list: Theme[];
  if (view === "recent") list = recents.map((id) => THEME_BY_ID[id]!);
  else if (view === "favs") list = favs.map((id) => THEME_BY_ID[id]!);
  else if (view === "all") list = THEMES;
  else list = THEMES.filter((t) => t.cat === view);
  if (query) list = list.filter((t) => matchesQuery(t, query));
  if (sort === "az" && view !== "recent") {
    list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  }
  return list;
}

function countFor(v: ThemeLibView): number {
  if (v === "all") return THEMES.length;
  if (v === "recent") return recents.length;
  if (v === "favs") return favs.length;
  return THEMES.filter((t) => t.cat === v).length;
}

function navItems(): ThemeLibSnapshot["navItems"] {
  const base: {
    view: ThemeLibView;
    label: string;
    dividerBefore?: boolean;
  }[] = [
    { view: "all", label: "All themes" },
    { view: "recent", label: "Recently used" },
    { view: "favs", label: "Favourites" },
  ];
  CATEGORY_ORDER.filter((c) => THEME_CATEGORIES.includes(c)).forEach(
    (c, index) => {
      base.push({
        view: c,
        label: CATEGORY_LABELS[c],
        dividerBefore: index === 0,
      });
    },
  );
  return base.map((item) => ({
    ...item,
    count: countFor(item.view),
    active: item.view === view,
  }));
}

function emptyState(list: Theme[]): ThemeLibSnapshot["empty"] {
  if (list.length > 0) return null;
  if (query) {
    return {
      title: "No themes found",
      body: `Nothing matches “${query}”. Try a show, film, colour or mood.`,
      action: "clear",
      actionLabel: "Clear search",
    };
  }
  if (view === "favs") {
    return {
      title: "No favourites yet",
      body: "Tap the star on any theme to keep it here.",
      action: "all",
      actionLabel: "Browse all themes",
    };
  }
  if (view === "recent") {
    return {
      title: "Your selected themes will appear here",
      body: "Pick a theme and it shows up in this list.",
      action: "all",
      actionLabel: "Browse all themes",
    };
  }
  return null;
}

function wallTitle(): string {
  if (query) return "Search results";
  if (view === "all") return "All themes";
  if (view === "recent") return "Recently used";
  if (view === "favs") return "Favourites";
  return CATEGORY_LABELS[view];
}

function buildSnapshot(list = themesForView()): ThemeLibSnapshot {
  const current = THEME_BY_ID[deps.currentId()];
  const recentThemes = recents
    .map((id) => THEME_BY_ID[id])
    .filter((t): t is Theme => Boolean(t));
  const filtered = Boolean(query) || view !== "all";
  return {
    query,
    sort,
    view,
    navItems: navItems(),
    countLabel: filtered
      ? `${list.length} of ${THEMES.length} themes`
      : `${THEMES.length} themes`,
    clearVisible: Boolean(query),
    sortDisabled: view === "recent",
    spotlight: current ?? null,
    spotlightSub: current ? (current.sub ?? CATEGORY_LABELS[current.cat]) : "",
    spotlightFav: current ? favs.includes(current.id) : false,
    recents: recentThemes,
    recentsVisible: view === "all" && !query && recentThemes.length > 0,
    wallTitle: wallTitle(),
    wallCount: `${list.length} theme${list.length === 1 ? "" : "s"}`,
    empty: emptyState(list),
  };
}

function getSnapshot(): ThemeLibSnapshot {
  return buildSnapshot();
}

function notify(list = themesForView()) {
  const snapshot = buildSnapshot(list);
  for (const listener of listeners) listener(snapshot);
}

function subscribe(listener: (snapshot: ThemeLibSnapshot) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ── Rendering ─────────────────────────────────────────────────────────

/** Repaints the cached card wall and pushes a fresh view model to Svelte.
 *  The grid element itself is Svelte-owned; its card children stay here. */
function paint() {
  const list = themesForView();
  if (grid) {
    grid.replaceChildren(...list.map((t) => cardFor(t)));
    grid.hidden = list.length === 0;
  }
  notify(list);
}

function setView(v: ThemeLibView) {
  view = v;
  paint();
  if (mainEl) mainEl.scrollTop = 0;
}

function setQuery(value: string) {
  query = value.trim();
  paint();
}

function setSort(value: string) {
  sort = value === "az" ? "az" : "default";
  paint();
}

function focusSearch() {
  const search = document.getElementById("tlSearch") as HTMLInputElement | null;
  search?.focus();
}

function clearSearch() {
  query = "";
  paint();
  focusSearch();
}

// ── Public API ────────────────────────────────────────────────────────

export function init(d: ThemeLibDeps) {
  deps = d;
  overlay = document.getElementById("themeLibOverlay");
  if (!overlay) return;
  const root = overlay.querySelector<HTMLElement>(".sc-modal.themelib");
  if (!root) return;

  favs = readFavs();
  recents = readRecents();

  const controller: ThemeFinderController = {
    getSnapshot,
    subscribe,
    setQuery,
    setSort,
    setView,
    toggleFav,
    chooseTheme,
    clearSearch,
    close,
    fillMark: (el, t) => deps.fillMark(el, t),
  };

  if (app) {
    unmount(app);
    app = null;
  }
  root.replaceChildren();
  app = mount(ThemeFinder, { target: root, props: { controller } });
  grid = $id("tlGrid");
  mainEl = $id("tlMain");

  // Keep the module's lists in sync when they change outside this tab, or
  // when Privacy deletes them in this tab (that path dispatches the custom
  // event, because same-tab writes never fire `storage`).
  if (!wired) {
    wired = true;
    window.addEventListener("storage", (e) => {
      if (e.key === null || e.key === FAV_KEY || e.key === RECENT_KEY)
        resetSavedLists();
    });
    window.addEventListener("sc-theme-lists-reset", resetSavedLists);
  }

  paint();
}

export function isOpen(): boolean {
  return !!overlay && overlay.classList.contains("open");
}

export function open() {
  if (!overlay) return;
  paint();
  deps.openOverlay();
  // The modal lifecycle focuses the dialog on open; move to search afterwards,
  // but only with a fine pointer so phones don't pop the keyboard unasked.
  // Guard with isOpen() to avoid focus race when Ctrl+K opens palette while
  // this deferred callback is still pending (themelib closes, palette opens).
  setTimeout(() => {
    if (!isOpen()) return;
    if (window.matchMedia("(pointer: fine)").matches) focusSearch();
    if (query || view !== "all") {
      const active = grid?.querySelector<HTMLElement>(".tl-card.active");
      if (active) active.scrollIntoView({ block: "center" });
    } else if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, 0);
}

export function close() {
  if (overlay) deps.closeOverlay();
}

export function toggle() {
  if (isOpen()) close();
  else open();
}

/** Called from applyTheme: marks the active card and records the recent. */
export function onThemeApplied(id: string) {
  if (!overlay) return;
  pushRecent(id);
  cards.forEach((c, cid) => {
    const t = THEME_BY_ID[cid];
    if (t) syncCard(c, t);
  });
  // Counts and ordering both depend on `recents`, so refresh the wall before
  // choosing a view — "recent" needs a full paint for order, every other view
  // only needs the spotlight/recents rail patched.
  if (view === "recent") paint();
  else notify();
}

/** Re-read favourites/recents from storage and repaint.
 *
 * Used when another tab changes them, and after Privacy → delete removes the
 * saved keys: the lists are cached in module memory, so without this a
 * deleted favourite would still render and would be written back the next
 * time anything toggled a star. */
export function resetSavedLists() {
  if (!overlay) return;
  favs = readFavs();
  recents = readRecents();
  cards.forEach((c, id) => {
    const t = THEME_BY_ID[id];
    if (t) syncCard(c, t);
  });
  if (isOpen()) paint();
  else notify();
}
