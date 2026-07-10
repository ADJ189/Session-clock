// Single source of truth for theme categories. Add a new one here and
// everything downstream (Theme.cat's type, THEMES_BY_CAT, the category
// tab UI) picks it up automatically — no hunting through multiple files.
export const THEME_CATEGORIES = ['nat', 'tv', 'movie', 'f1', 'anime', 'animation'] as const;
export type ThemeCategory = typeof THEME_CATEGORIES[number];

export interface Theme {
  id: string;
  name: string;
  cat: ThemeCategory;
  sub?: string;
  tagline?: string;
  swatch?: string;
  font: string;
  bgType: string;
  baseBg: string[];
  bgColors?: string[];
  overlay: string;
  vignette: string;
  text: string;
  accent: string;
  accent2: string;
  track: string;
  btnBg: string;
  btnFg: string;
  pill: string;
  panel: string;
  glow: string;
  hdr: boolean;
  grain: boolean;
  scanlines: boolean;
  lb: boolean;
  isMedia: boolean;
  light?: boolean;
  transition?: string;
  quotes?: string[];
}

export interface LitEntry { quote: string; source: string; }
// "HH:MM" — catches malformed keys (e.g. "14:0" instead of "14:00") at
// compile time instead of the clock silently going blank at that minute.
export type TimeString = `${number}:${number}`;
export type LitClock = Record<TimeString, LitEntry>;

export interface SoundDef { id: string; name: string; icon: string; desc?: string; }
export interface SoundNode { stop(): void; }

export interface LogEntry {
  time: number;
  task: string;
  dur: number;
  date: string;
}

export interface PomodoroSettings {
  workMins: number;
  breakMins: number;
  longBreakMins: number;
  longBreakAfter: number;
}

export type PomPhase = 'work' | 'break' | 'longBreak';

export interface SyncResult { offset: number; rtt: number; }
