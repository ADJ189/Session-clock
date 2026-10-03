import type { PomodoroSettings, PomPhase } from "./types";
import { safeJsonGet } from "./storage";
import { p2 } from "./utils";
import { playChime } from "./sound";

const CIRC = 339.3;
const KEY = "sc_pom";
const COUNT_KEY = "sc_pom_count";

const defaults: PomodoroSettings = {
  workMins: 25,
  breakMins: 5,
  longBreakMins: 15,
  longBreakAfter: 4,
};

let settings: PomodoroSettings = { ...defaults };
let active = false;
let phase: PomPhase = "work";
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
  timerEl = opts.timer;
  ringArc = opts.arc;
  ringEl = opts.ring;
  pillEl = opts.pill;
  labelEl = opts.label;
  onPhaseChange = opts.onPhase;
  load();
}

/** Per-day completed-pomodoro counts; corrupt storage yields an empty map. */
function loadCounts(): Record<string, number> {
  const v = safeJsonGet<unknown>(COUNT_KEY, {});
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, number>)
    : {};
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "{}");
    Object.assign(settings, s);
  } catch {}
  // One-time migration: setWorkMins()/setBreakMins() used to write to a
  // different key ('sc_pom_settings') than load() ever read from ('sc_pom'),
  // so a custom duration set through those two (now-fixed) controls
  // silently reverted after every reload.
  //
  // Neither key carries a timestamp, and the stray key can itself be
  // OLDER than the canonical snapshot above for every field except the
  // two it was actually written for — workMins/breakMins. (Everything
  // else in it is just whatever the rest of `settings` happened to be at
  // that earlier moment; every other setting has always gone through
  // persist() to the canonical key correctly.) So rather than letting
  // either snapshot broadly overwrite the other, only backfill those two
  // specific fields, and only when the canonical value is still the
  // built-in default — i.e. it was never set through a correct-path
  // write since. If canonical already differs from default, that's a
  // real user change made after the bugfix shipped, so it's kept as-is
  // rather than risking clobbering it with the older stray value.
  try {
    const stray = localStorage.getItem("sc_pom_settings");
    if (stray) {
      const s = JSON.parse(stray) as Partial<PomodoroSettings>;
      let recovered = false;
      if (
        typeof s.workMins === "number" &&
        s.workMins !== defaults.workMins &&
        settings.workMins === defaults.workMins
      ) {
        settings.workMins = s.workMins;
        recovered = true;
      }
      if (
        typeof s.breakMins === "number" &&
        s.breakMins !== defaults.breakMins &&
        settings.breakMins === defaults.breakMins
      ) {
        settings.breakMins = s.breakMins;
        recovered = true;
      }
      // Only drop the stray key once its recovered value (if any) is
      // safely persisted under the canonical one. persist() is inside
      // this try block (unlike a prior version of this fix) specifically
      // so that if it throws — storage quota, private-browsing
      // restrictions — the removeItem below never runs and the stray
      // key survives for another migration attempt on the next load,
      // instead of being deleted with nothing successfully saved in its
      // place and an uncaught error breaking Pomodoro init.
      if (recovered) persist();
      localStorage.removeItem("sc_pom_settings");
    }
  } catch {}
}
function persist() {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

function totalMs() {
  return (
    (phase === "work"
      ? settings.workMins
      : phase === "break"
        ? settings.breakMins
        : settings.longBreakMins) * 60_000
  );
}

function updateRing(rem: number, tot: number) {
  if (!ringArc) return;
  const pct = tot > 0 ? rem / tot : 0;
  ringArc.style.strokeDashoffset = String(CIRC * (1 - pct));
  ringArc.style.stroke =
    phase === "work"
      ? "var(--clr-accent)"
      : phase === "break"
        ? "#38bdf8"
        : "#a78bfa";
}

function nextPhase() {
  playChime();
  if (phase === "work") {
    pomCount++;
    const today = new Date().toDateString();
    const stored = loadCounts();
    stored[today] = (stored[today] || 0) + 1;
    try {
      localStorage.setItem(COUNT_KEY, JSON.stringify(stored));
    } catch {
      /* storage full/blocked — the in-memory count still advances */
    }
    phase = pomCount % settings.longBreakAfter === 0 ? "longBreak" : "break";
  } else {
    phase = "work";
  }
  phaseStart = performance.now();
  phaseElapsedBeforeSegment = 0; // genuine new phase — nothing carried over
  const labels: Record<PomPhase, string> = {
    work: "🍅 Work",
    break: "☕ Break",
    longBreak: "💤 Long Break",
  };
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
  if (timerEl) timerEl.textContent = "00:" + p2(m) + ":" + p2(s % 60);
  if (rem <= 0 && sessionRunning()) nextPhase();
}

// Called on both a genuine phase start and a resume-from-pause — main.ts's
// startTimer() doesn't distinguish the two, so this can't either. That's
// fine: phaseElapsedBeforeSegment already holds 0 on a real fresh phase
// (set by nextPhase()/reset()) and the real accumulated total on a resume
// (set by onPause() below), so simply re-anchoring phaseStart to now and
// letting tick()'s phaseElapsedBeforeSegment + (now - phaseStart) do the
// rest is correct either way.
export function onStart() {
  phaseStart = performance.now();
}

// Mirrors main.ts's own pauseTimer() (sessionElapsed = now - sessionStart)
// — must be called from there whenever a session pauses, or a resume has
// nothing to add back and looks exactly like restarting the phase.
export function onPause() {
  if (!active || !phaseStart) return;
  phaseElapsedBeforeSegment += performance.now() - phaseStart;
}

export function reset() {
  phase = "work";
  phaseStart = 0;
  phaseElapsedBeforeSegment = 0;
  pomCount = 0;
  updateRing(0, 0);
}

export function setActive(v: boolean) {
  active = v;
  if (ringEl) ringEl.style.display = v ? "block" : "none";
  if (pillEl) pillEl.classList.toggle("visible", v);
  if (labelEl) labelEl.textContent = v ? "Pomodoro" : "Session Timer";
  if (!v) reset();
}

export function isActive() {
  return active;
}

export function toggle() {
  setActive(!active);
}

export function getSettings() {
  return { ...settings };
}

export function updateSettings(patch: Partial<PomodoroSettings>) {
  Object.assign(settings, patch);
  persist();
}

export function todayCount(): number {
  const today = new Date().toDateString();
  return loadCounts()[today] || 0;
}

export function getPhase(): import("./types").PomPhase {
  return phase;
}
export function getRemainingSeconds(): number {
  if (!active || !phaseStart) return 0;
  const elapsed = phaseElapsedBeforeSegment + (performance.now() - phaseStart);
  return Math.max(0, Math.round((totalMs() - elapsed) / 1000));
}
export function setWorkMins(mins: number) {
  settings.workMins = Math.max(1, Math.min(120, mins));
  persist();
}
export function setBreakMins(mins: number) {
  settings.breakMins = Math.max(1, Math.min(60, mins));
  persist();
}
