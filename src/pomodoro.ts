import type { PomodoroSettings, PomPhase } from './types';
import { p2 } from './utils';
import { playChime } from './sound';

const CIRC = 339.3;
const KEY = 'sc_pom';
const COUNT_KEY = 'sc_pom_count';

const defaults: PomodoroSettings = { workMins: 25, breakMins: 5, longBreakMins: 15, longBreakAfter: 4 };

let settings: PomodoroSettings = { ...defaults };
let active = false;
let phase: PomPhase = 'work';
let phaseStart = 0;
let pomCount = 0;

// External refs set by main
let sessionRunning = () => false;
let getSessionStart = () => 0;
let onPhaseChange: ((pill: string) => void) | null = null;
let timerEl: HTMLElement | null = null;
let ringArc: SVGCircleElement | null = null;
let ringEl: SVGSVGElement | null = null;
let pillEl: HTMLElement | null = null;
let labelEl: HTMLElement | null = null;

export function init(opts: {
  isRunning: () => boolean;
  getStart: () => number;
  timer: HTMLElement;
  arc: SVGCircleElement;
  ring: SVGSVGElement;
  pill: HTMLElement;
  label: HTMLElement;
  onPhase: (text: string) => void;
}) {
  sessionRunning = opts.isRunning;
  getSessionStart = opts.getStart;
  timerEl = opts.timer; ringArc = opts.arc; ringEl = opts.ring;
  pillEl = opts.pill; labelEl = opts.label; onPhaseChange = opts.onPhase;
  load();
}

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); Object.assign(settings, s); } catch {}
}
function persist() { localStorage.setItem(KEY, JSON.stringify(settings)); }

function totalMs() {
  return (phase === 'work' ? settings.workMins : phase === 'break' ? settings.breakMins : settings.longBreakMins) * 60_000;
}

function updateRing(rem: number, tot: number) {
  if (!ringArc) return;
  const pct = tot > 0 ? rem / tot : 0;
  ringArc.style.strokeDashoffset = String(CIRC * (1 - pct));
  ringArc.style.stroke = phase === 'work' ? 'var(--clr-accent)' : phase === 'break' ? '#38bdf8' : '#a78bfa';
}

function nextPhase() {
  playChime();
  if (phase === 'work') {
    pomCount++;
    const today = new Date().toDateString();
    const stored: Record<string, number> = JSON.parse(localStorage.getItem(COUNT_KEY) || '{}');
    stored[today] = (stored[today] || 0) + 1;
    localStorage.setItem(COUNT_KEY, JSON.stringify(stored));
    phase = (pomCount % settings.longBreakAfter === 0) ? 'longBreak' : 'break';
  } else { phase = 'work'; }
  phaseStart = performance.now();
  const labels: Record<PomPhase, string> = { work: '🍅 Work', break: '☕ Break', longBreak: '💤 Long Break' };
  pillEl && (pillEl.textContent = labels[phase]);
  onPhaseChange?.(labels[phase]);
  updateRing(totalMs(), totalMs());
}

export function tick(now: number) {
  if (!active || !sessionRunning()) return;
  const tot = totalMs();
  const elapsed = now - phaseStart;
  const rem = Math.max(0, tot - elapsed);
  updateRing(rem, tot);
  const ms = rem;
  const s = (ms / 1000) | 0;
  const m = (s / 60) | 0;
  if (timerEl) timerEl.textContent = '00:' + p2(m) + ':' + p2(s % 60);
  if (rem <= 0 && sessionRunning()) nextPhase();
}

export function onStart() { phaseStart = performance.now(); }

export function reset() {
  phase = 'work'; phaseStart = 0; pomCount = 0;
  updateRing(0, 0);
}

export function setActive(v: boolean) {
  active = v;
  if (ringEl) ringEl.style.display = v ? 'block' : 'none';
  if (pillEl) pillEl.classList.toggle('visible', v);
  if (labelEl) labelEl.textContent = v ? 'Pomodoro' : 'Session Timer';
  if (!v) reset();
}

export function isActive() { return active; }

export function toggle() { setActive(!active); }

export function getSettings() { return { ...settings }; }

export function updateSettings(patch: Partial<PomodoroSettings>) {
  Object.assign(settings, patch);
  persist();
}

export function todayCount(): number {
  const today = new Date().toDateString();
  const stored: Record<string, number> = JSON.parse(localStorage.getItem(COUNT_KEY) || '{}');
  return stored[today] || 0;
}

export function getPhase(): import('./types').PomPhase { return phase; }
export function getRemainingSeconds(): number {
  if (!active || !phaseStart) return 0;
  const elapsed = performance.now() - phaseStart;
  const total = (phase === 'work' ? settings.workMins : phase === 'break' ? settings.breakMins : settings.longBreakMins) * 60_000;
  return Math.max(0, Math.round((total - elapsed) / 1000));
}
export function setWorkMins(mins: number) {
  settings.workMins = Math.max(1, Math.min(120, mins));
  localStorage.setItem('sc_pom_settings', JSON.stringify(settings));
}
export function setBreakMins(mins: number) {
  settings.breakMins = Math.max(1, Math.min(60, mins));
  localStorage.setItem('sc_pom_settings', JSON.stringify(settings));
}
