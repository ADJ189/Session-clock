// Theme Finder — the visual discovery gallery behind every "Themes" action.
//
// This module owns browsing only: search, collections (all / recent /
// favourites / the six categories), favourite + recent persistence, and the
// editorial DOM (active-theme spotlight, recent rail, category worlds and the
// all-theme wall). It never applies a theme itself — selection goes through
// the `apply` callback (main.ts `applyTheme`), so there is exactly one code
// path that drives the renderer, transitions, CSS variables and
// `sc_last_theme`.
//
// Cards are built once per theme and cached; filtering only re-orders and
// re-attaches existing nodes, so typing in the search box never rebuilds
// ~100 cards (or their marks).

import { THEMES, THEME_BY_ID } from "./themes";
import { THEME_CATEGORIES, type Theme, type ThemeCategory } from "./types";
import { safeJsonGet, safeJsonSet } from "./storage";
import { PREVIEW_IDS } from "./themepreviews";
import { themeFinderReveal } from "./motion";

export const FAV_KEY = "sc_theme_favs_v1";
export const RECENT_KEY = "sc_theme_recent_v1";
export const RECENT_MAX = 12;

export const CATEGORY_LABELS: Record<ThemeCategory, string> = {
  nat: "Natural",
  tv: "TV Shows",
  movie: "Movies",
  animation: "Animation",
  anime: "Anime",
  f1: "F1 Teams",
};

// Nav order follows the original picker tabs, not THEME_CATEGORIES order.
const CATEGORY_ORDER: ThemeCategory[] = [
  "nat",
  "tv",
  "movie",
  "animation",
  "anime",
  "f1",
];

type View = "all" | "recent" | "favs" | ThemeCategory;
type Sort = "default" | "az";

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
    if (typeof v !== "string" || seen.has(v) || !THEME_BY_ID[v]) continue;
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
let view: View = "all";
let sort: Sort = "default";
let query = "";

const cards = new Map<string, HTMLElement>();

let overlay: HTMLElement;
let grid: HTMLElement;
let empty: HTMLElement;
let nav: HTMLElement;
let search: HTMLInputElement;
let clearBtn: HTMLButtonElement;
let sortSel: HTMLSelectElement;
let countEl: HTMLElement;
let mainEl: HTMLElement;
let spotlight: HTMLElement;
let recentSection: HTMLElement;
let recentRail: HTMLElement;
let worldsSection: HTMLElement;
let worldsGrid: HTMLElement;
let wallTitle: HTMLElement;
let wallCount: HTMLElement;
let wallEyebrow: HTMLElement;

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
const SVG_ARROW =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

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
  const tagline = stripEmoji(t.tagline ?? "");
  if (tagline) {
    const line = el("span", "tl-tagline", tagline);
    prev.appendChild(line);
  }

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

function toggleFav(id: string) {
  favs = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  safeJsonSet(FAV_KEY, favs);
  const t = THEME_BY_ID[id];
  const c = cards.get(id);
  if (t && c) syncCard(c, t);
  renderNav();
  // Removing a favourite while viewing Favourites drops the card.
  if (view === "favs") render();
  else renderSpotlight();
}

function pushRecent(id: string) {
  if (!THEME_BY_ID[id] || recents[0] === id) return;
  recents = [id, ...recents.filter((r) => r !== id)].slice(0, RECENT_MAX);
  safeJsonSet(RECENT_KEY, recents);
}

// ── Editorial sections ────────────────────────────────────────────────

/** The wide "using now" spotlight. Compact enough that the catalogue is
 *  still visible on a laptop screen without scrolling past a giant hero. */
function renderSpotlight(show = view === "all" && !query) {
  if (!spotlight) return;
  const t = THEME_BY_ID[deps.currentId()];
  spotlight.hidden = !show || !t;
  if (!show || !t) return;

  applyThemeVars(spotlight, t);
  spotlight.dataset.id = t.id;
  spotlight.replaceChildren();

  const bg = el("div", "tl-spotlight-bg");
  bg.setAttribute("aria-hidden", "true");
  addPreviewArt(bg, t);
  const scrim = el("div", "tl-spotlight-scrim");
  scrim.setAttribute("aria-hidden", "true");
  spotlight.append(bg, scrim);

  const content = el("div", "tl-spotlight-content");
  const top = el("div", "tl-spotlight-top");
  const markWrap = el("div", "tl-spotlight-mark");
  deps.fillMark(markWrap, t);
  const titles = el("div", "tl-spotlight-titles");
  const eyebrow = el("span", "tl-eyebrow");
  eyebrow.append(el("span", "tl-live-dot"), document.createTextNode("Using now"));
  const name = el("h3", "tl-spotlight-name", t.name);
  const sub = el(
    "p",
    "tl-spotlight-sub",
    t.sub ?? CATEGORY_LABELS[t.cat],
  );
  titles.append(eyebrow, name, sub);
  top.append(markWrap, titles);
  content.appendChild(top);

  const tagline = stripEmoji(t.tagline ?? "");
  if (tagline) content.appendChild(el("p", "tl-spotlight-tagline", tagline));

  const actions = el("div", "tl-spotlight-actions");
  const cont = el("button", "tl-continue");
  cont.type = "button";
  cont.innerHTML = `<span>Keep this atmosphere</span>${SVG_ARROW}`;
  cont.addEventListener("click", close);
  const fav = el("button", "tl-spotlight-fav");
  fav.type = "button";
  const isFav = favs.includes(t.id);
  fav.classList.toggle("is-fav", isFav);
  fav.setAttribute("aria-pressed", String(isFav));
  fav.setAttribute(
    "aria-label",
    isFav ? `Remove ${t.name} from favourites` : `Add ${t.name} to favourites`,
  );
  fav.innerHTML = SVG_STAR;
  fav.addEventListener("click", () => toggleFav(t.id));
  actions.append(cont, fav);
  content.appendChild(actions);

  const meta = el("div", "tl-spotlight-meta");
  meta.append(
    el("span", "tl-chip", CATEGORY_LABELS[t.cat]),
    el("span", "tl-chip", `${THEMES.length} worlds to explore`),
  );
  content.appendChild(meta);

  spotlight.appendChild(content);
}

function renderRecents(show = view === "all" && !query) {
  if (!recentSection || !recentRail) return;
  const list = recents
    .map((id) => THEME_BY_ID[id])
    .filter((t): t is Theme => Boolean(t));
  recentSection.hidden = !show || list.length === 0;
  if (!show || !list.length) return;
  recentRail.replaceChildren(
    ...list.map((t) => {
      const b = el("button", "tl-recent-card");
      b.type = "button";
      b.dataset.id = t.id;
      applyThemeVars(b, t);
      const art = el("span", "tl-recent-art");
      art.setAttribute("aria-hidden", "true");
      addPreviewArt(art, t);
      const mark = el("span", "tl-recent-mark");
      deps.fillMark(mark, t);
      art.appendChild(mark);
      const label = el("span", "tl-recent-name", t.name);
      b.append(art, label);
      b.setAttribute("aria-label", `Use ${t.name}`);
      b.addEventListener("click", () => chooseTheme(t, art));
      return b;
    }),
  );
}

function renderWorlds(show = view === "all" && !query) {
  if (!worldsSection || !worldsGrid) return;
  worldsSection.hidden = !show;
  if (!show) return;
  worldsGrid.replaceChildren();
  CATEGORY_ORDER.filter((c) => THEME_CATEGORIES.includes(c)).forEach((cat) => {
    const themed = THEMES.filter((t) => t.cat === cat);
    if (!themed.length) return;
    // A representative scene from the existing catalogue; counts always
    // come from the data so a new theme needs no bespoke markup here.
    const rep = themed[Math.min(1, themed.length - 1)]!;
    const b = el("button", "tl-world");
    b.type = "button";
    b.dataset.cat = cat;
    applyThemeVars(b, rep);
    const art = el("span", "tl-world-art");
    art.setAttribute("aria-hidden", "true");
    addPreviewArt(art, rep);
    const body = el("span", "tl-world-body");
    const label = el("span", "tl-world-name", CATEGORY_LABELS[cat]);
    const count = el(
      "span",
      "tl-world-count",
      `${themed.length} theme${themed.length === 1 ? "" : "s"}`,
    );
    body.append(label, count);
    b.append(art, body);
    b.addEventListener("click", () => setView(cat));
    worldsGrid.appendChild(b);
  });
}

// ── Rendering ─────────────────────────────────────────────────────────

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

// Nav buttons are built once and then updated in place. Rebuilding them on
// every theme change replaced the node under the user's (or a test's) pointer
// mid-click, which made the rail feel unstable and could drop focus.
const navItems = new Map<View, HTMLButtonElement>();
let navBuilt = false;

function buildNav() {
  nav.replaceChildren();
  navItems.clear();
  const item = (v: View, label: string) => {
    const b = el("button", "tl-nav-item");
    b.type = "button";
    b.dataset.view = v;
    b.append(el("span", "tl-nav-label", label), el("span", "tl-nav-count"));
    b.addEventListener("click", () => setView(v));
    navItems.set(v, b);
    return b;
  };
  nav.append(
    item("all", "All themes"),
    item("recent", "Recently used"),
    item("favs", "Favourites"),
  );
  nav.appendChild(el("span", "tl-nav-divider"));
  CATEGORY_ORDER.filter((c) => THEME_CATEGORIES.includes(c)).forEach((c) =>
    nav.appendChild(item(c, CATEGORY_LABELS[c])),
  );
  navBuilt = true;
}

function countFor(v: View): number {
  if (v === "all") return THEMES.length;
  if (v === "recent") return recents.length;
  if (v === "favs") return favs.length;
  return THEMES.filter((t) => t.cat === v).length;
}

function renderNav() {
  if (!navBuilt) buildNav();
  navItems.forEach((b, v) => {
    const active = v === view;
    b.classList.toggle("active", active);
    if (active) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
    const count = b.querySelector<HTMLElement>(".tl-nav-count");
    if (count) count.textContent = String(countFor(v));
  });
}

function setEmpty(title: string, body: string, action?: [string, () => void]) {
  empty.replaceChildren(el("p", "tl-empty-title", title), el("p", "tl-empty-body", body));
  if (action) {
    const b = el("button", "tl-empty-btn", action[0]);
    b.type = "button";
    b.addEventListener("click", action[1]);
    empty.appendChild(b);
  }
}

function render() {
  const list = themesForView();
  const editorial = view === "all" && !query;
  renderSpotlight(editorial);
  renderRecents(editorial);
  renderWorlds(editorial);

  const nodes: HTMLElement[] = list.map((t) => cardFor(t));
  cards.forEach((c) => c.classList.remove("tl-card--featured"));
  if (editorial && nodes.length > 1) nodes[0]!.classList.add("tl-card--featured");
  grid.replaceChildren(...nodes);

  const none = list.length === 0;
  empty.hidden = !none;
  grid.hidden = none;
  if (none) {
    if (query) {
      setEmpty(
        "No themes found",
        `Nothing matches “${query}”. Try a show, film, colour or mood.`,
        ["Clear search", clearSearch],
      );
    } else if (view === "favs") {
      setEmpty("No favourites yet", "Tap the star on any theme to keep it here.", [
        "Browse all themes",
        () => setView("all"),
      ]);
    } else if (view === "recent") {
      setEmpty("Your selected themes will appear here", "Pick a theme and it shows up in this list.", [
        "Browse all themes",
        () => setView("all"),
      ]);
    }
  }

  const filtered = query || view !== "all";
  countEl.textContent = filtered
    ? `${list.length} of ${THEMES.length} themes`
    : `${THEMES.length} themes`;
  clearBtn.hidden = !query;
  sortSel.disabled = view === "recent";

  // Wall heading tracks the active collection so the full catalogue still
  // reads as one coherent surface under the editorial shelves.
  if (wallTitle) {
    wallTitle.textContent = query
      ? "Search results"
      : view === "all"
        ? "All atmospheres"
        : view === "recent"
          ? "Recently used"
          : view === "favs"
            ? "Favourites"
            : CATEGORY_LABELS[view];
  }
  if (wallEyebrow) {
    wallEyebrow.textContent = query
      ? "Filtered catalogue"
      : view === "all"
        ? "The full catalogue"
        : "Your collection";
  }
  if (wallCount) {
    wallCount.textContent = `${list.length} theme${list.length === 1 ? "" : "s"}`;
  }
}

function setView(v: View) {
  view = v;
  renderNav();
  render();
  mainEl.scrollTop = 0;
}

function clearSearch() {
  query = "";
  search.value = "";
  render();
  search.focus();
}

// ── Public API ────────────────────────────────────────────────────────

export function init(d: ThemeLibDeps) {
  deps = d;
  overlay = $id("themeLibOverlay");
  if (!overlay) return;
  grid = $id("tlGrid");
  empty = $id("tlEmpty");
  nav = $id("tlNav");
  search = $id<HTMLInputElement>("tlSearch");
  clearBtn = $id<HTMLButtonElement>("tlClear");
  sortSel = $id<HTMLSelectElement>("tlSort");
  countEl = $id("tlCount");
  mainEl = $id("tlMain");
  spotlight = $id("tlSpotlight");
  recentSection = $id("tlRecentSection");
  recentRail = $id("tlRecentRail");
  worldsSection = $id("tlWorldsSection");
  worldsGrid = $id("tlWorldsGrid");
  wallTitle = $id("tlWallTitle");
  wallCount = $id("tlWallCount");
  wallEyebrow = $id("tlWallEyebrow");

  favs = sanitizeIds(safeJsonGet<unknown>(FAV_KEY, []));
  recents = sanitizeIds(safeJsonGet<unknown>(RECENT_KEY, []), RECENT_MAX);

  search.addEventListener("input", () => {
    query = search.value.trim();
    render();
  });
  search.addEventListener("keydown", (e) => {
    // Escape clears a non-empty query first; with an empty box it closes the library
    // (the global handler only blurs focused inputs).
    if (e.key === "Escape") {
      e.stopPropagation();
      if (search.value) clearSearch();
      else close();
    }
  });
  clearBtn.addEventListener("click", clearSearch);
  $id("tlRecentAll")?.addEventListener("click", () => setView("recent"));
  sortSel.addEventListener("change", () => {
    sort = sortSel.value === "az" ? "az" : "default";
    render();
  });

  renderNav();
}

export function isOpen(): boolean {
  return !!overlay && overlay.classList.contains("open");
}

export function open() {
  if (!overlay) return;
  renderNav();
  render();
  deps.openOverlay();
  // The modal lifecycle focuses the dialog on open; move to search afterwards,
  // but only with a fine pointer so phones don't pop the keyboard unasked.
  setTimeout(() => {
    if (window.matchMedia("(pointer: fine)").matches) search.focus();
    if (query || view !== "all") {
      const active = grid.querySelector<HTMLElement>(".tl-card.active");
      if (active) active.scrollIntoView({ block: "center" });
    } else {
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
  if (view === "recent") render();
  else {
    renderNav();
    renderSpotlight(view === "all" && !query);
    renderRecents(view === "all" && !query);
  }
}
