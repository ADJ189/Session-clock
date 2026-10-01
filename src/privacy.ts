// ── Privacy & Data Management ─────────────────────────────────────────
// All data is local. This module provides transparency + control.

// Complete map of every localStorage key and what it holds
export interface DataCategory {
  id: string;
  label: string;
  icon: string;
  desc: string;
  keys: string[];
  // Key *prefixes* for dynamic, per-instance keys that can't be listed by
  // exact name up front — e.g. integrations.ts mints one `sc_int_<id>`
  // token key per connected provider (KEY = (id) => `sc_int_${id}`), so
  // there's no fixed list of them to enumerate. Every category-scoped
  // operation below (size, delete, export) sweeps these the same way it
  // handles `keys`.
  keyPrefixes?: string[];
  sensitive: boolean; // contains behavioural data
}

// This was previously a hand-maintained subset (18 of the ~65 `sc_*` keys
// actually used across the app), so a category's "delete this" button
// could leave real data behind. Rebuilt from an actual scan of every
// literal `sc_*` localStorage key referenced in src/ so this list — and
// therefore deleteCategory()/deleteAll()/exportAllData() below, which all
// derive from it — has a real claim to being complete. deleteAll() also
// runs one unconditional `sc_*` sweep as a backstop afterwards (see
// below) so a future key that isn't added here yet still gets removed by
// "Delete All", even though it wouldn't yet show up in a per-category
// breakdown.
export const DATA_CATEGORIES: DataCategory[] = [
  {
    id: "sessions",
    label: "Focus Sessions",
    icon: "📋",
    desc: "Your session log — task names, durations, dates",
    keys: ["sc_focus_log"],
    sensitive: true,
  },
  {
    id: "intelligence",
    label: "Focus Intelligence",
    icon: "🧠",
    desc: "Streak, velocity score, Pomodoro count history, distraction log",
    keys: [
      "sc_streak",
      "sc_velocity",
      "sc_pom_count",
      "sc_distractions",
      "sc_distraction_today",
    ],
    sensitive: true,
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: "⚙️",
    desc: "Theme, clock, quality, Pomodoro, mode & layout settings",
    keys: [
      "sc_last_theme",
      "sc_clock_mode",
      "sc_clock_pos",
      "sc_clock_pos_map",
      "sc_hide_seconds",
      "sc_hide_ms",
      "sc_quality",
      "sc_pom",
      "sc_24h",
      "sc_locale",
      "sc_world_clocks",
      "sc_center_minimal",
      "sc_reduce_motion",
      "sc_parallax",
      "sc_calm_mode",
      "sc_focus_mode",
      "sc_smart_break",
      "sc_idle_detect",
      "sc_break_reminder_mins",
      "sc_haptics",
      "sc_ui_sounds",
      "sc_music_autosync",
      "sc_nowplaying_theme",
      "sc_nowplaying_manual",
      "sc_daynight_suggested",
      "sc_auto_theme_ambience",
      "sc_wake_lock",
      "sc_zen_dim_delay",
      "sc_zen_rings",
      "sc_zen_sound",
      "sc_force_no_blur",
      "sc_music_capsule",
      "sc_weather_theme",
      "sc_onboarded_v2",
    ],
    sensitive: false,
  },
  {
    id: "audio",
    label: "Audio",
    icon: "🎵",
    desc: "Saved sound presets, spatial audio & head-tracking settings",
    keys: [
      "sc_sound_presets",
      "sc_spatial",
      "sc_head_tracking",
      "sc_mixer_autofade",
      "sc_mixer_night",
    ],
    sensitive: false,
  },
  {
    id: "customisation",
    label: "Custom Themes",
    icon: "🎨",
    desc: "Your saved custom colour themes, unlocked easter eggs",
    keys: ["sc_custom_themes", "sc_phoenix_unlocked"],
    sensitive: false,
  },
  {
    id: "weather",
    label: "Weather",
    icon: "🌦️",
    desc: "Saved location (name + coordinates) used for weather & theming",
    keys: ["sc_weather_loc"],
    sensitive: true, // a saved lat/lon is location data
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: "🔗",
    desc: "Connected-service tokens (Spotify/YouTube/Notion/GitHub/etc.), OAuth state, BYO client IDs",
    // (sc_oauth_state / sc_oauth_verifier used to live here too; they're
    // now sessionStorage-only — see SESSION_KEYS below.)
    keys: [
      "sc_spotify_client_id",
      "sc_google_client_id",
      "sc_google_client_secret",
      "sc_notion_client_id",
      "sc_github_client_id",
      "sc_linear_client_id",
      "sc_todoist_client_id",
    ],
    // sc_int_<provider> — one dynamic key per connected integration,
    // holding an access/refresh token (see integrations.ts). This is
    // exactly the family Finding PR2 flagged as invisible to a fixed key
    // list; keyPrefixes is what lets deleteCategory('integrations') (and
    // "Delete All") actually reach it.
    keyPrefixes: ["sc_int_"],
    sensitive: true, // credentials/tokens
  },
  {
    id: "system",
    label: "System",
    icon: "🔧",
    desc: "Privacy flag, focus lock, breathing/sleep settings, misc caches",
    keys: [
      "sc_privacy",
      "sc_focus_lock",
      "sc_breathing_break",
      "sc_gh_stats_cache_v1",
      "sc_auto_clear",
    ],
    sensitive: false,
  },
];

function categoryLocalStorageKeys(cat: DataCategory): string[] {
  const dynamic = cat.keyPrefixes?.length
    ? Object.keys(localStorage).filter((k) =>
        cat.keyPrefixes!.some((p) => k.startsWith(p)),
      )
    : [];
  return [...cat.keys, ...dynamic];
}

// ── Storage sizing ────────────────────────────────────────────────────
export function getCategorySize(cat: DataCategory): number {
  return categoryLocalStorageKeys(cat).reduce((total, key) => {
    const val = localStorage.getItem(key);
    return total + (val ? new Blob([val]).size : 0);
  }, 0);
}

export function getTotalSize(): number {
  return DATA_CATEGORIES.reduce((t, c) => t + getCategorySize(c), 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 100) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ── Deletion ──────────────────────────────────────────────────────────
// Transient per-tab state that lives in sessionStorage, not localStorage.
// Listed here so an "Integrations" or "Delete All" wipe also clears any
// half-finished OAuth attempt instead of leaving its PKCE verifier around
// for the rest of the tab's life.
const SESSION_KEYS: Record<string, string[]> = {
  integrations: ["sc_oauth_state", "sc_oauth_verifier"],
};

export function deleteCategory(cat: DataCategory): void {
  categoryLocalStorageKeys(cat).forEach((key) => localStorage.removeItem(key));
  (SESSION_KEYS[cat.id] ?? []).forEach((key) => sessionStorage.removeItem(key));
}

export function deleteAll(): void {
  DATA_CATEGORIES.forEach(deleteCategory);
  // Backstop: remove every remaining `sc_*` key regardless of whether
  // it's declared above. This is what makes "Delete All" a real
  // guarantee rather than a promise that depends on this file staying
  // perfectly in sync with every other module that ever calls
  // localStorage.setItem — the exact drift that caused Findings PR1/PR2.
  Object.keys(localStorage)
    .filter((k) => k.startsWith("sc_"))
    .forEach((k) => localStorage.removeItem(k));
  Object.keys(sessionStorage)
    .filter((k) => k.startsWith("sc_"))
    .forEach((k) => sessionStorage.removeItem(k));
}

// ── Incognito session mode ─────────────────────────────────────────────
// When active, focus log writes go to memory only — nothing hits localStorage.
let _incognito = false;
const _memoryLog: unknown[] = [];

export function isIncognito() {
  return _incognito;
}
export function setIncognito(v: boolean) {
  _incognito = v;
  if (!v) _memoryLog.length = 0; // clear on disable
}

// ── Auto-clear on close ───────────────────────────────────────────────
let _autoClear = localStorage.getItem("sc_auto_clear") === "1";

export function isAutoClear() {
  return _autoClear;
}
export function setAutoClear(v: boolean) {
  _autoClear = v;
  localStorage.setItem("sc_auto_clear", v ? "1" : "0");
  if (v) {
    window.addEventListener("beforeunload", _doClear);
  } else {
    window.removeEventListener("beforeunload", _doClear);
  }
}

function _doClear() {
  // Only clear sensitive data on close — keep preferences
  ["sc_focus_log", "sc_streak", "sc_velocity", "sc_pom_count"].forEach((k) =>
    localStorage.removeItem(k),
  );
}

// Initialise auto-clear listener on load
if (_autoClear) window.addEventListener("beforeunload", _doClear);

// ── Export all data ───────────────────────────────────────────────────
export function exportAllData(): void {
  const data: Record<string, unknown> = {};
  DATA_CATEGORIES.forEach((cat) => {
    data[cat.id] = {};
    categoryLocalStorageKeys(cat).forEach((key) => {
      const val = localStorage.getItem(key);
      if (val) {
        try {
          (data[cat.id] as Record<string, unknown>)[key] = JSON.parse(val);
        } catch {
          (data[cat.id] as Record<string, unknown>)[key] = val;
        }
      }
    });
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `session-clock-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
