// ── Privacy & Data Management ─────────────────────────────────────────
// All data is local. This module provides transparency + control.

// Complete map of every localStorage key and what it holds
export interface DataCategory {
  id: string;
  label: string;
  icon: string;
  desc: string;
  keys: string[];
  sensitive: boolean; // contains behavioural data
}

export const DATA_CATEGORIES: DataCategory[] = [
  {
    id: 'sessions',
    label: 'Focus Sessions',
    icon: '📋',
    desc: 'Your session log — task names, durations, dates',
    keys: ['sc_focus_log'],
    sensitive: true,
  },
  {
    id: 'intelligence',
    label: 'Focus Intelligence',
    icon: '🧠',
    desc: 'Streak, velocity score, Pomodoro count history',
    keys: ['sc_streak', 'sc_velocity', 'sc_pom_count'],
    sensitive: true,
  },
  {
    id: 'shop',
    label: 'Token Shop',
    icon: '🪙',
    desc: 'Token balance, owned items, equipped items',
    keys: ['sc_tokens', 'sc_owned_items', 'sc_equipped'],
    sensitive: false,
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: '⚙️',
    desc: 'Theme, clock mode, quality, Pomodoro settings',
    keys: ['sc_last_theme', 'sc_clock_mode', 'sc_quality', 'sc_pom'],
    sensitive: false,
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: '🎵',
    desc: 'Saved sound presets, spatial audio setting',
    keys: ['sc_sound_presets', 'sc_spatial'],
    sensitive: false,
  },
  {
    id: 'customisation',
    label: 'Custom Themes',
    icon: '🎨',
    desc: 'Your saved custom colour themes',
    keys: ['sc_custom_themes'],
    sensitive: false,
  },
  {
    id: 'system',
    label: 'System',
    icon: '🔧',
    desc: 'Privacy flag, focus lock, breathing, sleep settings',
    keys: ['sc_privacy', 'sc_focus_lock', 'sc_breathing_break'],
    sensitive: false,
  },
];

// ── Storage sizing ────────────────────────────────────────────────────
export function getCategorySize(cat: DataCategory): number {
  return cat.keys.reduce((total, key) => {
    const val = localStorage.getItem(key);
    return total + (val ? new Blob([val]).size : 0);
  }, 0);
}

export function getTotalSize(): number {
  return DATA_CATEGORIES.reduce((t, c) => t + getCategorySize(c), 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 100) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ── Deletion ──────────────────────────────────────────────────────────
export function deleteCategory(cat: DataCategory): void {
  cat.keys.forEach(key => localStorage.removeItem(key));
}

export function deleteAll(): void {
  DATA_CATEGORIES.forEach(deleteCategory);
}

// ── Incognito session mode ─────────────────────────────────────────────
// When active, focus log writes go to memory only — nothing hits localStorage.
let _incognito = false;
const _memoryLog: unknown[] = [];

export function isIncognito() { return _incognito; }
export function setIncognito(v: boolean) {
  _incognito = v;
  if (!v) _memoryLog.length = 0; // clear on disable
}
export function getMemoryLog() { return _memoryLog; }
export function pushMemoryLog(entry: unknown) { _memoryLog.push(entry); }

// ── Auto-clear on close ───────────────────────────────────────────────
let _autoClear = localStorage.getItem('sc_auto_clear') === '1';

export function isAutoClear() { return _autoClear; }
export function setAutoClear(v: boolean) {
  _autoClear = v;
  localStorage.setItem('sc_auto_clear', v ? '1' : '0');
  if (v) {
    window.addEventListener('beforeunload', _doClear);
  } else {
    window.removeEventListener('beforeunload', _doClear);
  }
}

function _doClear() {
  // Only clear sensitive data on close — keep preferences
  ['sc_focus_log', 'sc_streak', 'sc_velocity', 'sc_pom_count'].forEach(k => localStorage.removeItem(k));
}

// Initialise auto-clear listener on load
if (_autoClear) window.addEventListener('beforeunload', _doClear);

// ── Export all data ───────────────────────────────────────────────────
export function exportAllData(): void {
  const data: Record<string, unknown> = {};
  DATA_CATEGORIES.forEach(cat => {
    data[cat.id] = {};
    cat.keys.forEach(key => {
      const val = localStorage.getItem(key);
      if (val) {
        try { (data[cat.id] as Record<string, unknown>)[key] = JSON.parse(val); }
        catch { (data[cat.id] as Record<string, unknown>)[key] = val; }
      }
    });
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `session-clock-data-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
