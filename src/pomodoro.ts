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
// Ms already spent in the *current* phase, accumulated across previous
// run segments — i.e. whatever was elapsed as of the last pause. Mirrors
// how main.ts's own sessionElapsed/sessionStart pair survives a pause;
// without this, onStart() resetting phaseStart to "now" on every resume
// (see onStart() below) had no record of pre-pause progress to preserve,
// so resuming looked identical to starting the phase over from scratch.
let phaseElapsedBeforeSegment = 0;
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
  phaseElapsedBeforeSegment = 0; // genuine new phase — nothing carried over
  const labels: Record<PomPhase, string> = { work: '🍅 Work', break: '☕ Break', longBreak: '💤 Long Break' };
  pillEl && (pillEl.textContent = labels[phase]);
  onPhaseChange?.(labels[phase]);
  updateRing(totalMs(), totalMs());
}

export function tick(now: number) {
  if (!active || !sessionRunning()) return;
  const tot = totalMs();
  const elapsed = phaseElapsedBeforeSegment + (now - phaseStart);
  const rem = Math.max(0, tot - elapsed);
  updateRing(rem, tot);
  const ms = rem;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (timerEl) timerEl.textContent = '00:' + p2(m) + ':' + p2(s % 60);
  if (rem <= 0 && sessionRunning()) nextPhase();
}

// Called on both a genuine phase start and a resume-from-pause — main.ts's
// startTimer() doesn't distinguish the two, so this can't either. That's
// fine: phaseElapsedBeforeSegment already holds 0 on a real fresh phase
// (set by nextPhase()/reset()) and the real accumulated total on a resume
// (set by onPause() below), so simply re-anchoring phaseStart to now and
// letting tick()'s phaseElapsedBeforeSegment + (now - phaseStart) do the
// rest is correct either way.
export function onStart() { phaseStart = performance.now(); }

// Mirrors main.ts's own pauseTimer() (sessionElapsed = now - sessionStart)
// — must be called from there whenever a session pauses, or a resume has
// nothing to add back and looks exactly like restarting the phase.
export function onPause() {
  if (!active || !phaseStart) return;
  phaseElapsedBeforeSegment += performance.now() - phaseStart;
}

export function reset() {
  phase = 'work'; phaseStart = 0; phaseElapsedBeforeSegment = 0; pomCount = 0;
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
  const elapsed = phaseElapsedBeforeSegment + (performance.now() - phaseStart);
  return Math.max(0, Math.round((totalMs() - elapsed) / 1000));
}
export function setWorkMins(mins: number) {
  settings.workMins = Math.max(1, Math.min(120, mins));
  localStorage.setItem('sc_pom_settings', JSON.stringify(settings));
}
export function setBreakMins(mins: number) {
  settings.breakMins = Math.max(1, Math.min(60, mins));
  localStorage.setItem('sc_pom_settings', JSON.stringify(settings));
}
