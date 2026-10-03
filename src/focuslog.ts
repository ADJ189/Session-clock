// Session history recording. The list/heatmap/CSV-export viewer UI was
// removed by request, but this data store stays: streaks, completion
// ratings, session-count displays, and a few easter eggs all read
// `sc_focus_log` directly, so gutting the recorder would silently break
// those unrelated features.
import type { LogEntry } from "./types";
import { safeGet, safeRemove, safeSet } from "./storage";

const KEY = "sc_focus_log";

/**
 * The one safe way to read the focus log. Missing, unreadable, malformed or
 * wrongly-shaped (not an array) data yields an empty log instead of throwing,
 * and a malformed value is removed so it can't keep breaking later reads.
 * Never parse `sc_focus_log` directly elsewhere.
 */
export function readFocusLog(): LogEntry[] {
  const raw = safeGet(KEY);
  if (raw == null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as LogEntry[];
  } catch {
    /* fall through to repair */
  }
  safeRemove(KEY);
  return [];
}

/** Persists the log. Returns false if storage refused the write. */
export function writeFocusLog(d: LogEntry[]): boolean {
  return safeSet(KEY, JSON.stringify(d));
}

/** Number of recorded sessions (0 when the log is missing or corrupt). */
export function focusLogCount(): number {
  return readFocusLog().length;
}

const load = readFocusLog;
const save = writeFocusLog;

/**
 * Records a finished session. Returns the entry that was written, or null if
 * nothing was recorded (too short, or Private Focus Log is on) — callers that
 * need to amend *this* session later (e.g. its rating) must hold on to it and
 * look it up with findEntry(), because position 0 can change underneath them
 * when another tab records a newer session.
 */
export function record(task: string, durMs: number): LogEntry | null {
  if (durMs < 5000) return null;
  const entry = {
    time: Date.now(),
    task: task || "Untitled session",
    dur: Math.round(durMs),
    date: new Date().toDateString(),
  };
  // Check incognito — import avoided via dynamic check on window
  const isIncognito = window.__scIncognito?.() ?? false;
  if (isIncognito) return null; // don't persist
  const entries = load();
  entries.unshift(entry);
  if (entries.length > 500) entries.pop();
  save(entries);
  return entry;
}

/** Finds the stored copy of an entry previously returned by record(). */
export function findEntry(
  log: LogEntry[],
  rec: LogEntry,
): LogEntry | undefined {
  return log.find(
    (e) => e.time === rec.time && e.dur === rec.dur && e.task === rec.task,
  );
}
