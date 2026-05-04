import type { LogEntry } from './types';
import { p2, fmtSession } from './utils';

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

export function render(container: HTMLElement) {
  const entries = load();
  if (!entries.length) {
    const msg = document.createElement('div'); msg.className = 'log-empty';
    msg.textContent = 'No sessions recorded yet. Start the timer to begin logging.';
    container.appendChild(msg); return;
  }
  const today = new Date().toDateString();
  const groups: Record<string, LogEntry[]> = {};
  entries.forEach(e => { (groups[e.date] ??= []).push(e); });
  container.innerHTML = '';
  for (const [date, items] of Object.entries(groups)) {
    const hdr = document.createElement('div');
    hdr.className = 'log-date-hdr';
    hdr.textContent = date === today ? 'Today' : date;
    container.appendChild(hdr);
    items.forEach(e => {
      const d = new Date(e.time);
      const row = document.createElement('div'); row.className = 'log-entry';
      const timeEl = document.createElement('span'); timeEl.className = 'log-time';
      timeEl.textContent = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
      const taskEl = document.createElement('span'); taskEl.className = 'log-task';
      taskEl.textContent = e.task;
      const durEl  = document.createElement('span'); durEl.className = 'log-dur';
      durEl.textContent = fmtSession(e.dur);
      row.append(timeEl, taskEl, durEl);
      container.appendChild(row);
    });
  }
}

// ── Heatmap (GitHub contribution grid style) ──────────────────────────
export function renderHeatmap(container: HTMLElement) {
  const entries = load();

  // Build a map of dateString → total minutes
  const dayMap: Record<string, number> = {};
  entries.forEach(e => {
    dayMap[e.date] = (dayMap[e.date] ?? 0) + e.dur / 60000;
  });

  // Build 52 weeks × 7 days grid ending today
  const today = new Date();
  today.setHours(0,0,0,0);
  const endDay = new Date(today);
  // Start from Sunday 52 weeks ago
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() - (52 * 7 - 1));
  // Align to Sunday
  startDay.setDate(startDay.getDate() - startDay.getDay());

  const totalDays: Date[] = [];
  for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
    totalDays.push(new Date(d));
  }

  const maxMins = Math.max(...Object.values(dayMap), 30);

  // Month labels
  const months: { label: string; col: number }[] = [];
  let lastMonth = -1;

  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';

  totalDays.forEach((d, i) => {
    const col = Math.floor(i / 7);
    const row = i % 7;
    const ds = d.toDateString();
    const mins = dayMap[ds] ?? 0;
    const intensity = mins > 0 ? Math.min(1, mins / maxMins) : 0;

    if (d.getMonth() !== lastMonth && row === 0) {
      lastMonth = d.getMonth();
      months.push({ label: d.toLocaleString('default', { month: 'short' }), col });
    }

    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.dataset.col = String(col);
    cell.dataset.row = String(row);
    if (intensity > 0) {
      cell.style.setProperty('--heat', String(intensity));
      cell.classList.add('has-data');
    }
    const hrs = Math.floor(mins / 60), mns = Math.floor(mins % 60);
    cell.title = `${ds}: ${mins > 0 ? `${hrs > 0 ? hrs+'h ' : ''}${mns}m focus` : 'No sessions'}`;
    grid.appendChild(cell);
  });

  // Month label bar
  const labelBar = document.createElement('div');
  labelBar.className = 'heatmap-months';
  const totalCols = Math.ceil(totalDays.length / 7);
  months.forEach(m => {
    const lbl = document.createElement('span');
    lbl.textContent = m.label;
    lbl.style.gridColumnStart = String(m.col + 1);
    labelBar.appendChild(lbl);
  });

  // Stats summary
  const totalSessions = entries.length;
  const totalMins = Math.floor(entries.reduce((s, e) => s + e.dur, 0) / 60000);
  const activeDays = Object.keys(dayMap).length;
  const stats = document.createElement('div'); stats.className = 'heatmap-stats';
  const totalTime = totalMins >= 60 ? `${Math.floor(totalMins/60)}h ${totalMins%60}m` : `${totalMins}m`;
  [
    `${totalSessions} sessions`,
    `${totalTime} total`,
    `${activeDays} active days`,
  ].forEach(txt => {
    const s = document.createElement('span'); s.textContent = txt; stats.appendChild(s);
  });

  container.innerHTML = '';
  container.appendChild(labelBar);
  container.appendChild(grid);
  container.appendChild(stats);
}

export function exportCSV() {
  const entries = load();
  if (!entries.length) return;
  const rows = ['Time,Task,Duration,Date', ...entries.map(e => {
    const d = new Date(e.time);
    return `"${d.toLocaleString()}","${e.task.replace(/"/g, '""')}","${fmtSession(e.dur)}","${e.date}"`;
  })];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
  a.download = `session-log-${Date.now()}.csv`;
  a.click();
}

export function clear() {
  if (!confirm('Clear all session log entries?')) return;
  localStorage.removeItem(KEY);
}
