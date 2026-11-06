// ── Command Controller ────────────────────────────────────────────────
// Pure headless controller for command palette state, fuzzy scoring,
// grouping, navigation, and item selection.

export interface CmdItem {
  id: string;
  name: string;
  desc?: string;
  icon?: string;
  tag: "theme" | "egg" | "action" | "setting";
  action: () => void;
  keywords?: string;
}

export interface HighlightSegment {
  text: string;
  match: boolean;
}

export interface GroupedCmdItem {
  item: CmdItem;
  globalIndex: number;
  nameSegments: HighlightSegment[];
}

export interface CmdGroup {
  tag: string;
  label: string;
  items: GroupedCmdItem[];
}

export interface PaletteSnapshot {
  isOpen: boolean;
  query: string;
  activeIdx: number;
  filtered: CmdItem[];
  groups: CmdGroup[];
  empty: boolean;
}

export const TAG_LABELS: Record<string, string> = {
  theme: "Theme",
  egg: "Easter Egg 🥚",
  action: "Action",
  setting: "Setting",
};

export function score(item: CmdItem, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const n = (
    item.name +
    " " +
    (item.desc ?? "") +
    " " +
    (item.keywords ?? "")
  ).toLowerCase();
  if (n.startsWith(q)) return 100;
  if (n.includes(q)) return 80;
  let idx = 0;
  for (const ch of q) {
    const found = n.indexOf(ch, idx);
    if (found === -1) return 0;
    idx = found + 1;
  }
  return 50;
}

export function highlightSegments(text: string, query: string): HighlightSegment[] {
  if (!query) return [{ text, match: false }];
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const start = lower.indexOf(q);
  if (start === -1) return [{ text, match: false }];
  const res: HighlightSegment[] = [];
  if (start > 0) {
    res.push({ text: text.slice(0, start), match: false });
  }
  res.push({ text: text.slice(start, start + q.length), match: true });
  if (start + q.length < text.length) {
    res.push({ text: text.slice(start + q.length), match: false });
  }
  return res;
}

const TAG_SORT_ORDER: Record<string, number> = {
  action: 0,
  theme: 1,
  setting: 2,
  egg: 3,
};

export function filterAndGroup(
  items: CmdItem[],
  query: string,
): {
  filtered: CmdItem[];
  groups: CmdGroup[];
} {
  const q = query.startsWith("/") ? query.slice(1).trim() : query.trim();
  const forceEgg = query.startsWith("/");

  const filtered = items
    .filter((item) => {
      if (forceEgg) return item.tag === "egg" && score(item, q) > 0;
      return score(item, q) > 0;
    })
    .sort((a, b) => {
      const sa = score(a, q),
        sb = score(b, q);
      if (sa !== sb) return sb - sa;
      return (TAG_SORT_ORDER[a.tag] ?? 9) - (TAG_SORT_ORDER[b.tag] ?? 9);
    })
    .slice(0, 48);

  const groupsMap = new Map<string, CmdItem[]>();
  filtered.forEach((item) => {
    const g = groupsMap.get(item.tag) ?? [];
    g.push(item);
    groupsMap.set(item.tag, g);
  });

  const tagOrder = forceEgg ? ["egg"] : ["action", "theme", "setting", "egg"];
  let globalIdx = 0;
  const groups: CmdGroup[] = [];

  tagOrder.forEach((tag) => {
    const groupItems = groupsMap.get(tag);
    if (!groupItems?.length) return;
    const items: GroupedCmdItem[] = groupItems.map((item) => ({
      item,
      globalIndex: globalIdx++,
      nameSegments: highlightSegments(item.name, q),
    }));
    groups.push({
      tag,
      label: TAG_LABELS[tag] ?? tag,
      items,
    });
  });

  return { filtered, groups };
}

export class CommandController {
  private items: CmdItem[] = [];
  private isOpen = false;
  private query = "";
  private activeIdx = 0;
  private listeners: Set<() => void> = new Set();
  private returnFocus: HTMLElement | null = null;

  registerItems(items: CmdItem[]) {
    this.items = items;
    this.notify();
  }

  getItems(): CmdItem[] {
    return this.items;
  }

  getSnapshot(): PaletteSnapshot {
    const { filtered, groups } = filterAndGroup(this.items, this.query);
    const clampedActive =
      filtered.length > 0
        ? Math.max(0, Math.min(this.activeIdx, filtered.length - 1))
        : 0;

    return {
      isOpen: this.isOpen,
      query: this.query,
      activeIdx: clampedActive,
      filtered,
      groups,
      empty: filtered.length === 0,
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  open(prefill = "") {
    if (this.isOpen) return;
    this.isOpen = true;
    this.query = prefill;
    this.activeIdx = 0;
    if (typeof document !== "undefined") {
      const active = document.activeElement;
      this.returnFocus =
        active instanceof HTMLElement && active !== document.body
          ? active
          : null;
    }
    this.notify();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.query = "";
    this.activeIdx = 0;
    this.notify();

    if (typeof document !== "undefined") {
      const ret = this.returnFocus;
      this.returnFocus = null;
      const active = document.activeElement;
      const overlay = document.getElementById("cmdOverlay");
      const focusInPalette =
        !active ||
        active === document.body ||
        (overlay ? overlay.contains(active) : false);
      if (
        ret &&
        ret.isConnected &&
        ret.getClientRects &&
        ret.getClientRects().length > 0 &&
        focusInPalette
      ) {
        ret.focus({ preventScroll: true });
      }
    }
  }

  setQuery(query: string) {
    this.query = query;
    this.activeIdx = 0;
    this.notify();
  }

  setActiveIndex(idx: number) {
    this.activeIdx = idx;
    this.notify();
  }

  next() {
    const { filtered } = filterAndGroup(this.items, this.query);
    if (!filtered.length) return;
    this.activeIdx = Math.min(this.activeIdx + 1, filtered.length - 1);
    this.notify();
  }

  prev() {
    const { filtered } = filterAndGroup(this.items, this.query);
    if (!filtered.length) return;
    this.activeIdx = Math.max(this.activeIdx - 1, 0);
    this.notify();
  }

  selectCurrent() {
    const { filtered } = filterAndGroup(this.items, this.query);
    const item = filtered[this.activeIdx];
    if (item) {
      item.action();
      this.close();
    }
  }

  selectItem(item: CmdItem) {
    item.action();
    this.close();
  }

  getIsOpen(): boolean {
    return this.isOpen;
  }
}

export const commandController = new CommandController();
