// Session history recording. The list/heatmap/CSV-export viewer UI was
// removed by request, but this data store stays: streaks, completion
// ratings, session-count displays, and a few easter eggs all read
// `sc_focus_log` directly, so gutting the recorder would silently break
// those unrelated features.
import type { LogEntry } from './types';

const KEY = 'sc_focus_log';

function load(): LogEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function save(d: LogEntry[]) { localStorage.setItem(KEY, JSON.stringify(d)); }

export function record(task: string, durMs: number) {
  if (durMs < 5000) return;
  const entry = { time: Date.now(), task: task || 'Untitled session', dur: Math.round(durMs), date: new Date().toDateString() };
  // Check incognito — import avoided via dynamic check on window
  const isIncognito = typeof (window as any).__scIncognito === 'function'
    ? (window as any).__scIncognito()
    : false;
  if (isIncognito) return; // don't persist
  const entries = load();
  entries.unshift(entry);
  if (entries.length > 500) entries.pop();
  save(entries);
}
