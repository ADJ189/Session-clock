import { safeJsonGet } from "../../storage";
import { showToast } from "../ui/toast";
import {
  rgbaToHex,
  hexToRgb,
  hexToHsl,
  hslToHex,
  onAccentInk,
  VALID_COLOR,
  THEME_CODE_PREFIX,
} from "../utils/color";
import { mount, unmount } from "svelte";

export interface ThemeFieldDef {
  key: string;
  label: string;
  icon: string;
  hint: string;
}

export const THEME_FIELDS: ThemeFieldDef[] = [
  {
    key: "accent",
    label: "Main Accent",
    icon: "✦",
    hint: "Clock glow, highlights, active states",
  },
  {
    key: "accent2",
    label: "Accent 2",
    icon: "◈",
    hint: "Secondary highlights, pomodoro ring",
  },
  { key: "text", label: "Text", icon: "T", hint: "All readable text" },
  {
    key: "btnFg",
    label: "Button Text",
    icon: "▶",
    hint: "Text on accent buttons",
  },
  {
    key: "baseBg0",
    label: "Background",
    icon: "▪",
    hint: "Base canvas background",
  },
  { key: "panel", label: "Panel", icon: "▭", hint: "Cards, modals, panels" },
];

export const QUICK_PICKS = [
  "#6ee7b7",
  "#818cf8",
  "#f472b6",
  "#fbbf24",
  "#34d399",
  "#60a5fa",
  "#a78bfa",
  "#fb923c",
  "#e879f9",
  "#00eeff",
  "#ff0090",
  "#ff6600",
  "#22d3ee",
  "#ffffff",
  "#000000",
];

export interface ThemeDraft {
  text: string;
  accent: string;
  accent2: string;
  btnFg: string;
  baseBg0: string;
  panel: string;
  [key: string]: string;
}

export interface SavedCustomTheme {
  id: string;
  name: string;
  draft: Record<string, string>;
}

export interface ThemeBuilderSnapshot {
  draft: ThemeDraft;
  activeField: string;
  activeHex: string;
  fieldHexes: Record<string, string>;
  rgb: [number, number, number];
  hsl: [number, number, number];
  savedThemes: SavedCustomTheme[];
}

export class ThemeBuilderController {
  private draft: ThemeDraft = {
    text: "#e0f2fe",
    accent: "#6ee7b7",
    accent2: "#818cf8",
    btnFg: "#06030f",
    baseBg0: "#06030f",
    panel: "rgba(4,3,18,.85)",
  };

  private activeField = "accent";
  private subscribers = new Set<(snapshot: ThemeBuilderSnapshot) => void>();
  private appInstance: Record<string, any> | null = null;
  private onResetCallback: (() => void) | null = null;

  init(options: { onReset: () => void }): void {
    this.onResetCallback = options.onReset;
  }

  subscribe(cb: (snapshot: ThemeBuilderSnapshot) => void): () => void {
    this.subscribers.add(cb);
    cb(this.getSnapshot());
    return () => this.subscribers.delete(cb);
  }

  notify(): void {
    const snap = this.getSnapshot();
    for (const cb of this.subscribers) {
      cb(snap);
    }
  }

  getDraft(): ThemeDraft {
    return { ...this.draft };
  }

  setDraft(d: ThemeDraft): void {
    this.draft = { ...d };
    this.preview();
    this.notify();
  }

  getActiveField(): string {
    return this.activeField;
  }

  setActiveField(key: string): void {
    if (THEME_FIELDS.some((f) => f.key === key)) {
      this.activeField = key;
      this.notify();
    }
  }

  getActiveHex(): string {
    const raw = this.draft[this.activeField] ?? "#6ee7b7";
    return raw.startsWith("r") ? rgbaToHex(raw) : raw;
  }

  setDraftColor(hex: string): void {
    this.draft[this.activeField] = hex;
    this.preview();
    this.notify();
  }

  setHex(val: string): boolean {
    const clean = val.startsWith("#") ? val : "#" + val;
    if (/^#[0-9a-fA-F]{6}$/i.test(clean)) {
      this.setDraftColor(clean);
      return true;
    }
    return false;
  }

  setRgb(val: string): boolean {
    const parts = val.split(",").map((s) => Number.parseInt(s.trim()));
    if (
      parts.length === 3 &&
      parts.every((p) => !Number.isNaN(p) && p >= 0 && p <= 255)
    ) {
      const hex =
        "#" + parts.map((p) => p.toString(16).padStart(2, "0")).join("");
      this.setDraftColor(hex);
      return true;
    }
    return false;
  }

  setHsl(val: string): boolean {
    const parts = val
      .replace(/%/g, "")
      .split(",")
      .map((s) => Number.parseFloat(s.trim()));
    if (
      parts.length === 3 &&
      !parts.some((p) => Number.isNaN(p)) &&
      parts[0] >= 0 &&
      parts[0] <= 360 &&
      parts[1] >= 0 &&
      parts[1] <= 100 &&
      parts[2] >= 0 &&
      parts[2] <= 100
    ) {
      const hex = hslToHex(parts[0], parts[1], parts[2]);
      this.setDraftColor(hex);
      return true;
    }
    return false;
  }

  preview(): void {
    if (
      typeof document === "undefined" ||
      !document.documentElement ||
      !document.documentElement.style ||
      typeof document.documentElement.style.setProperty !== "function"
    ) {
      return;
    }
    const root = document.documentElement;
    root.style.setProperty("--clr-text", this.draft.text);
    root.style.setProperty("--clr-accent", this.draft.accent);
    root.style.setProperty("--clr-accent2", this.draft.accent2);
    root.style.setProperty("--clr-on-accent", onAccentInk(this.draft.accent));
    root.style.setProperty("--clr-btn-fg", this.draft.btnFg);
    root.style.setProperty("--clr-panel", this.draft.panel);
  }

  loadSavedCustomThemes(): SavedCustomTheme[] {
    const v = safeJsonGet<unknown>("sc_custom_themes", []);
    if (!Array.isArray(v)) return [];
    return v.filter((item): item is SavedCustomTheme => {
      return (
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        item.draft &&
        typeof item.draft === "object"
      );
    });
  }

  save(): void {
    const saved = this.loadSavedCustomThemes();
    saved.push({
      id: "custom_" + Date.now(),
      name: "Custom " + (saved.length + 1),
      draft: { ...this.draft },
    });
    if (saved.length > 10) saved.shift();
    localStorage.setItem("sc_custom_themes", JSON.stringify(saved));
    this.notify();
    showToast("🎨 Custom theme saved!");
  }

  loadSaved(item: SavedCustomTheme): void {
    this.draft = { ...this.draft, ...item.draft };
    this.preview();
    this.notify();
  }

  reset(): void {
    if (this.onResetCallback) {
      this.onResetCallback();
    }
  }

  export(): string {
    const payload: Record<string, string> = {};
    THEME_FIELDS.forEach((f) => {
      payload[f.key] = this.draft[f.key] ?? "";
    });
    const code = THEME_CODE_PREFIX + btoa(JSON.stringify(payload));
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(code).then(
        () => showToast("📋 Theme code copied — paste it anywhere to share"),
        () => showToast(code, 6000),
      );
    } else {
      showToast(code, 6000);
    }
    return code;
  }

  import(rawCode: string): boolean {
    const code = rawCode.trim();
    if (!code.startsWith(THEME_CODE_PREFIX)) {
      showToast("⚠️ Not a valid theme code");
      return false;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(atob(code.slice(THEME_CODE_PREFIX.length)));
    } catch {
      showToast("⚠️ Could not read that theme code");
      return false;
    }
    if (!parsed || typeof parsed !== "object") {
      showToast("⚠️ Could not read that theme code");
      return false;
    }
    const obj = parsed as Record<string, unknown>;
    const next: ThemeDraft = { ...this.draft };
    let applied = 0;
    THEME_FIELDS.forEach((f) => {
      const v = obj[f.key];
      if (typeof v === "string" && VALID_COLOR.test(v.trim())) {
        next[f.key] = v.trim();
        applied++;
      }
    });
    if (!applied) {
      showToast("⚠️ That code had no valid colors");
      return false;
    }
    this.draft = next;
    this.preview();
    this.notify();
    showToast(
      `🎨 Theme code imported (${applied}/${THEME_FIELDS.length} colors)`,
    );
    return true;
  }

  getSnapshot(): ThemeBuilderSnapshot {
    const fieldHexes: Record<string, string> = {};
    THEME_FIELDS.forEach((f) => {
      const raw = this.draft[f.key] ?? "#ffffff";
      fieldHexes[f.key] = raw.startsWith("r") ? rgbaToHex(raw) : raw;
    });

    const activeHex = this.getActiveHex();
    const rgb = hexToRgb(activeHex);
    const hsl = hexToHsl(activeHex);

    return {
      draft: { ...this.draft },
      activeField: this.activeField,
      activeHex,
      fieldHexes,
      rgb,
      hsl,
      savedThemes: this.loadSavedCustomThemes(),
    };
  }

  closeModal(): void {
    const modals = (window as unknown as { SC?: { modals?: { close?: (id: string) => void } } })
      .SC?.modals;
    if (modals?.close) {
      modals.close("themeBuilderOverlay");
    } else {
      const overlay = document.getElementById("themeBuilderOverlay");
      if (overlay) {
        overlay.classList.remove("open");
      }
    }
  }

  async mount(target?: HTMLElement): Promise<void> {
    const el = target || document.getElementById("themeBuilderOverlay");
    if (!el) return;
    if (this.appInstance) {
      unmount(this.appInstance);
      this.appInstance = null;
    }
    el.innerHTML = "";
    const { default: CustomThemeBuilderDialog } = await import(
      "../modals/CustomThemeBuilderDialog.svelte"
    );
    this.appInstance = mount(CustomThemeBuilderDialog, {
      target: el,
    });
  }
}

export const themeBuilderController = new ThemeBuilderController();
