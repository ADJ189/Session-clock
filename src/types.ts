export interface Theme {
  id: string;
  name: string;
  cat: 'nat' | 'tv' | 'movie' | 'f1' | 'anime';
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
export type LitClock = Record<string, LitEntry>;

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
