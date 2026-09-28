// ── Session Intelligence Engine ───────────────────────────────────────
// All data stays in localStorage. Zero cloud. Zero tracking.

const LOG_KEY = "sc_focus_log";
const STREAK_KEY = "sc_streak";
const VELOCITY_KEY = "sc_velocity";

interface LogEntry {
  time: number;
  task: string;
  dur: number;
  date: string;
}
interface StreakData {
  current: number;
  best: number;
  lastDate: string;
}
interface VelocityData {
  completed: number;
  abandoned: number;
}

function loadLog(): LogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

// ── Streak ────────────────────────────────────────────────────────────
export function getStreak(): StreakData {
  try {
    return JSON.parse(
      localStorage.getItem(STREAK_KEY) ||
        '{"current":0,"best":0,"lastDate":""}',
    );
  } catch {
    return { current: 0, best: 0, lastDate: "" };
  }
}

export function updateStreak(): StreakData {
  const today = new Date().toDateString();
  const s = getStreak();
  if (s.lastDate === today) return s; // Already updated today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yday = yesterday.toDateString();

  if (s.lastDate === yday) {
    s.current += 1;
  } else if (s.lastDate === "") {
    s.current = 1;
  } else {
    s.current = 1; // streak broken
  }
  s.best = Math.max(s.best, s.current);
  s.lastDate = today;
  localStorage.setItem(STREAK_KEY, JSON.stringify(s));
  return s;
}

export function getStreakMilestone(streak: number): string | null {
  const milestones: Record<number, string> = {
    3: "🔥 3-day streak",
    7: "🌟 One week streak",
    14: "💎 Two week streak",
    21: "🏆 21-day habit formed",
    30: "🚀 30-day streak",
    60: "⚡ 60-day streak",
    90: "🎯 90-day streak",
    365: "👑 One year streak",
  };
  return milestones[streak] ?? null;
}

// ── Session Velocity Score (0–100) ────────────────────────────────────
// Below this, a stopped session isn't a real "abandoned focus attempt" —
// it's a misclick or an instant change of mind, and shouldn't count
// against the score. (A stale comment on recordAbandoned() below used to
// say "5 minutes" here, but resetTimer()'s own completed/abandoned split
// in main.ts is mutually exclusive at 60s — anything ≥60s is already
// routed to recordCompleted() and never reaches recordAbandoned() at all,
// so a 5-*minute* floor would make this branch permanently unreachable
// and silently disable the whole abandoned-session signal. 5 seconds is
// the threshold that's actually been wired up on the caller side in
// main.ts; centralizing it here as a named constant, and enforcing it
// inside recordAbandoned() too, is what fixes the drift — not changing
// the value to match the old comment.)
export const MIN_ABANDON_MS = 5_000;

export function getVelocity(): VelocityData {
  try {
    return JSON.parse(
      localStorage.getItem(VELOCITY_KEY) || '{"completed":0,"abandoned":0}',
    );
  } catch {
    return { completed: 0, abandoned: 0 };
  }
}

export function recordCompleted() {
  const v = getVelocity();
  v.completed++;
  localStorage.setItem(VELOCITY_KEY, JSON.stringify(v));
}

export function recordAbandoned(durationMs: number) {
  if (durationMs < MIN_ABANDON_MS) return; // too short to represent a real attempt
  const v = getVelocity();
  v.abandoned++;
  localStorage.setItem(VELOCITY_KEY, JSON.stringify(v));
}

export function getVelocityScore(): number {
  const v = getVelocity();
  const total = v.completed + v.abandoned;
  if (total < 3) return -1; // not enough data
  // Weighted: recent abandons hurt more than old ones
  const raw = (v.completed / total) * 100;
  // Bonus for high volume
  const volumeBonus = Math.min(10, Math.floor(total / 5));
  return Math.min(100, Math.round(raw + volumeBonus));
}

export function getVelocityLabel(score: number): {
  label: string;
  colour: string;
} {
  if (score < 0) return { label: "New", colour: "rgba(255,255,255,.35)" };
  if (score < 40) return { label: "Building", colour: "#f59e0b" };
  if (score < 65) return { label: "Steady", colour: "#60a5fa" };
  if (score < 85) return { label: "Focused", colour: "#6ee7b7" };
  return { label: "In the Zone", colour: "#a78bfa" };
}

// ── Peak Hours Intelligence ───────────────────────────────────────────
export function getPeakHour(): number | null {
  const log = loadLog();
  if (log.length < 5) return null;

  const hourBuckets = new Array(24).fill(0) as number[];
  log.forEach((e) => {
    const h = new Date(e.time).getHours();
    hourBuckets[h] += e.dur / 60000; // weight by duration
  });

  const max = Math.max(...hourBuckets);
  if (max < 15) return null; // need at least 15 min in a bucket
  return hourBuckets.indexOf(max);
}

export function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

// ── Smart Break Suggester ─────────────────────────────────────────────
// Tracks *focused running time*, not wall-clock time — deliberately, so
// leaving the tab open and idle for hours before ever starting a session
// doesn't make the very first session immediately eligible for a break
// suggestion. `focusedMsSinceBreak` only advances while a session is
// actually running (see onSessionStart/onSessionPause below); pausing
// freezes it exactly like Pomodoro's own phaseElapsedBeforeSegment
// pattern in pomodoro.ts freezes phase progress across a pause.
let sessionStartTs = 0;
let breakSuggested = false;
let focusedMsSinceBreak = 0;
let runSegmentStart = 0; // performance.now() when the current running segment began; 0 while not running

export function onSessionStart() {
  sessionStartTs = Date.now();
  breakSuggested = false;
  runSegmentStart = performance.now();
}

// Call when a running session pauses (or ends without a break), so the
// idle/paused gap that follows isn't silently counted as focused time.
export function onSessionPause() {
  if (runSegmentStart) {
    focusedMsSinceBreak += performance.now() - runSegmentStart;
    runSegmentStart = 0;
  }
}

export function onBreakTaken() {
  focusedMsSinceBreak = 0;
  runSegmentStart = 0;
  breakSuggested = false;
}

export function checkBreakNeeded(
  sessionRunning: boolean,
  thresholdMins = 90,
): boolean {
  if (!sessionRunning || breakSuggested) return false;
  const liveMs =
    focusedMsSinceBreak +
    (runSegmentStart ? performance.now() - runSegmentStart : 0);
  const minsNoBreak = liveMs / 60000;
  if (minsNoBreak >= thresholdMins) {
    breakSuggested = true;
    return true;
  }
  return false;
}

// ── Flow State Detection ──────────────────────────────────────────────
let flowStartTs = 0;
let lastInterruptTs = Date.now();
export let flowActive = false;

const FLOW_THRESHOLD_MS = 25 * 60 * 1000; // 25 minutes uninterrupted

export function onFlowInterrupt() {
  lastInterruptTs = Date.now();
  if (flowActive) {
    flowActive = false;
  }
}

export function checkFlowState(sessionRunning: boolean): boolean {
  if (!sessionRunning) {
    flowActive = false;
    return false;
  }
  const uninterrupted = Date.now() - lastInterruptTs;
  if (!flowActive && uninterrupted >= FLOW_THRESHOLD_MS) {
    flowActive = true;
    flowStartTs = Date.now();
  }
  return flowActive;
}

export function getFlowDuration(): number {
  return flowActive ? Math.floor((Date.now() - flowStartTs) / 60000) : 0;
}

// ── Flow Intensity (0–1) ──────────────────────────────────────────────
// Grows continuously from 0 during a session. 0 = just started,
// 1 = 45+ uninterrupted minutes. Tab switches and pauses decay it.
// Used by renderer to evolve theme visuals in real time.
let _flowIntensity = 0;
let _tabHiddenAt = 0;

export function getFlowIntensity(): number {
  return _flowIntensity;
}

export function tickFlowIntensity(sessionRunning: boolean, dt: number): void {
  if (!sessionRunning) {
    // Decay quickly when not in a session
    _flowIntensity = Math.max(0, _flowIntensity - dt * 0.08);
    return;
  }
  // Build toward 1.0 over 45 minutes of uninterrupted focus
  // Rate: reaches 0.5 at ~22 min, 1.0 at ~45 min
  const buildRate = dt / (45 * 60);
  _flowIntensity = Math.min(1, _flowIntensity + buildRate);
}

export function onTabHidden(): void {
  _tabHiddenAt = Date.now();
}

export function onTabVisible(): void {
  if (_tabHiddenAt > 0) {
    const hiddenMs = Date.now() - _tabHiddenAt;
    // More than 30s away = significant decay (switched to another app)
    if (hiddenMs > 30_000) {
      const decayFactor = Math.min(1, hiddenMs / (5 * 60_000)); // full decay after 5 min away
      _flowIntensity = Math.max(0, _flowIntensity * (1 - decayFactor * 0.7));
      onFlowInterrupt();
    }
    _tabHiddenAt = 0;
  }
}

// ── Info strip intelligence items ─────────────────────────────────────
export function getIntelligenceInsights(): Array<() => string> {
  const items: Array<() => string> = [];

  const peakH = getPeakHour();
  if (peakH !== null) {
    items.push(() => `🔥 You focus best at ${formatHour(peakH)}`);
  }

  items.push(() => {
    const { current, best } = getStreak();
    if (current === 0) return "Start a session to build your streak";
    if (current === best && current > 1)
      return `🏆 Personal best — ${current} day streak!`;
    return `🔥 ${current} day streak${best > current ? ` · Best: ${best}` : ""}`;
  });

  const score = getVelocityScore();
  if (score >= 0) {
    items.push(() => {
      const { label } = getVelocityLabel(score);
      return `⚡ Focus score: ${score} — ${label}`;
    });
  }

  items.push(() => {
    const log = loadLog();
    const today = new Date().toDateString();
    const todayMs = log
      .filter((e) => e.date === today)
      .reduce((s, e) => s + e.dur, 0);
    const todayMins = Math.floor(todayMs / 60000);
    if (todayMins < 1) return "Start your first focus session today";
    const h = Math.floor(todayMins / 60),
      m = todayMins % 60;
    return `${h > 0 ? h + "h " : ""}${m}m focused today`;
  });

  return items;
}
