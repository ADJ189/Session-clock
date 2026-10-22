// Theme Library — the searchable gallery behind the "Themes" actions.
//
// This module owns browsing only: search, collections (all / recent /
// favourites / the six categories), favourite + recent persistence, and the
// card DOM. It never applies a theme itself — selection goes through the
// `apply` callback (main.ts `applyTheme`), so there is exactly one code path
// that drives the renderer, transitions, CSS variables and `sc_last_theme`.
//
// Cards are built once per theme and cached; filtering only re-orders and
// re-attaches existing nodes, so typing in the search box never rebuilds
// ~100 cards (or their marks).

import { THEMES, THEME_BY_ID } from "./themes";
import { THEME_CATEGORIES, type Theme, type ThemeCategory } from "./types";
import { safeJsonGet, safeJsonSet } from "./storage";
import { PREVIEW_IDS } from "./themepreviews";

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

// ── Cards ─────────────────────────────────────────────────────────────

function buildCard(t: Theme): HTMLElement {
  const card = el("div", "tl-card");
  card.dataset.id = t.id;
  card.setAttribute("role", "listitem");
  // Theme data drives the preview. Values are compile-time constants from
  // themes.ts, never user input.
  card.style.setProperty("--tl-bg0", t.baseBg[0] ?? "#000");
  card.style.setProperty("--tl-bg1", t.baseBg[1] ?? t.baseBg[0] ?? "#000");
  card.style.setProperty("--tl-bg2", t.baseBg[2] ?? t.baseBg[0] ?? "#000");
  card.style.setProperty("--tl-accent", t.accent);
  card.style.setProperty("--tl-accent2", t.accent2);
  card.style.setProperty("--tl-text", t.text);
  card.style.setProperty("--tl-font", t.font);

  const main = el("button", "tl-pick");
  main.type = "button";
  main.addEventListener("click", () => deps.apply(t));

  const prev = el("span", "tl-prev");
  prev.setAttribute("aria-hidden", "true");
  const time = el("span", "tl-time", "10:42");
  prev.appendChild(time);
  const mark = el("span", "tl-mark");
  deps.fillMark(mark, t);
  prev.appendChild(mark);

  if (PREVIEW_IDS.has(t.id)) {
    const img = new Image(320, 180);
    img.className = "tl-img";
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = `${import.meta.env.BASE_URL}theme-previews/${t.id}.webp`;
    // A missing or broken thumbnail falls back to the gradient underneath.
    img.addEventListener("error", () => img.remove());
    prev.appendChild(img);
  }

  const meta = el("span", "tl-meta");
  const name = el("span", "tl-name", t.name);
  const sub = el("span", "tl-sub", t.sub ?? CATEGORY_LABELS[t.cat]);
  const using = el("span", "tl-using");
  using.innerHTML = SVG_CHECK;
  using.append(document.createTextNode("Using now"));
  meta.append(name, sub, using);

  main.append(prev, meta);

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
}

function pushRecent(id: string) {
  if (!THEME_BY_ID[id] || recents[0] === id) return;
  recents = [id, ...recents.filter((r) => r !== id)].slice(0, RECENT_MAX);
  safeJsonSet(RECENT_KEY, recents);
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

function renderNav() {
  nav.replaceChildren();
  const item = (v: View, label: string, count: number) => {
    const b = el("button", "tl-nav-item");
    b.type = "button";
    b.dataset.view = v;
    if (v === view) {
      b.classList.add("active");
      b.setAttribute("aria-current", "true");
    }
    b.append(
      el("span", "tl-nav-label", label),
      el("span", "tl-nav-count", String(count)),
    );
    b.addEventListener("click", () => setView(v));
    return b;
  };
  const group = (title: string) => {
    const g = el("div", "tl-nav-title", title);
    return g;
  };
  nav.append(
    group("Browse"),
    item("all", "All themes", THEMES.length),
    item("recent", "Recently used", recents.length),
    item("favs", "Favourites", favs.length),
    group("Categories"),
  );
  CATEGORY_ORDER.filter((c) => THEME_CATEGORIES.includes(c)).forEach((c) =>
    nav.appendChild(
      item(c, CATEGORY_LABELS[c], THEMES.filter((t) => t.cat === c).length),
    ),
  );
}

function setEmpty(title: string, body: string, action?: [string, () => void]) {
  empty.replaceChildren(
    el("p", "tl-empty-title", title),
    el("p", "tl-empty-body", body),
  );
  if (action) {
    const b = el("button", "tl-empty-btn", action[0]);
    b.type = "button";
    b.addEventListener("click", action[1]);
    empty.appendChild(b);
  }
}

function render() {
  const list = themesForView();
  const nodes: HTMLElement[] = [];
  const grouped = view === "all" && !query && sort === "default";

  if (grouped) {
    CATEGORY_ORDER.forEach((c) => {
      const inCat = list.filter((t) => t.cat === c);
      if (!inCat.length) return;
      const h = el("div", "tl-sec");
      h.setAttribute("role", "presentation");
      h.append(
        el("span", "tl-sec-name", CATEGORY_LABELS[c]),
        el("span", "tl-sec-count", String(inCat.length)),
      );
      nodes.push(h);
      inCat.forEach((t) => nodes.push(cardFor(t)));
    });
  } else {
    list.forEach((t) => nodes.push(cardFor(t)));
  }
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
      setEmpty(
        "No favourites yet",
        "Tap the star on any theme to keep it here.",
        ["Browse all themes", () => setView("all")],
      );
    } else if (view === "recent") {
      setEmpty(
        "Your selected themes will appear here",
        "Pick a theme and it shows up in this list.",
        ["Browse all themes", () => setView("all")],
      );
    }
  }

  const filtered = query || view !== "all";
  countEl.textContent = filtered
    ? `${list.length} of ${THEMES.length} themes`
    : `${THEMES.length} themes`;
  clearBtn.hidden = !query;
  sortSel.disabled = view === "recent";
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
    const active = grid.querySelector<HTMLElement>(".tl-card.active");
    if (active && !query) active.scrollIntoView({ block: "center" });
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
}
