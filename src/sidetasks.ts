// ── Side task cards ─────────────────────────────────────────────────
// Compact "box" widgets for the focus sidebar, next to the music dock.
// Pure presentation layer — all data comes from the existing
// integrations.ts functions, nothing new is fetched or stored here.

import * as Integrations from './integrations';

const REFRESH_MS = 60_000;
let refreshTimer: number | null = null;
let stackEl: HTMLElement | null = null;

export function mountSideStack(container: HTMLElement): void {
  stackEl = document.createElement('div');
  stackEl.className = 'sc-side-stack';
  container.appendChild(stackEl);
  refresh();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = window.setInterval(refresh, REFRESH_MS);
}

async function refresh(): Promise<void> {
  if (!stackEl) return;
  const cards: string[] = [];

  if (Integrations.isGithubConnected()) cards.push(await githubCard());
  if (Integrations.isNotionConnected()) cards.push(await notionCard());
  if (Integrations.isTodoistConnected()) cards.push(await todoistCard());
  if (Integrations.isGCalConnected()) cards.push(await calendarCard());

  stackEl.innerHTML = cards.join('') || `<div class="sc-side-empty">Connect GitHub, Notion, Todoist, or Calendar in settings to see them here.</div>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

async function githubCard(): Promise<string> {
  const items = await Integrations.getGithubItems();
  const rows = items.slice(0, 6).map((i) =>
    `<div class="sc-side-item">${i.type === 'pr' ? '🔀' : '⭕'}
      <a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a>
      <span class="sc-tag">${esc(i.repo)}</span>
    </div>`).join('');
  return card('🐙', 'GitHub', rows);
}

async function notionCard(): Promise<string> {
  const tasks = await Integrations.getNotionTasks();
  const rows = tasks.slice(0, 6).map((t) =>
    `<div class="sc-side-item">${t.checked ? '✅' : '⬜'} ${esc(t.title)}
      ${t.priority ? `<span class="sc-tag">${esc(t.priority)}</span>` : ''}
    </div>`).join('');
  return card('📝', 'Notion', rows);
}

async function todoistCard(): Promise<string> {
  const tasks = await Integrations.getTodoistTasks();
  const rows = tasks.slice(0, 6).map((t) =>
    `<div class="sc-side-item">⬜ ${esc(t.content)}</div>`).join('');
  return card('✅', 'Todoist', rows);
}

async function calendarCard(): Promise<string> {
  const events = await Integrations.getUpcomingEvents(5);
  const rows = events.map((e) =>
    `<div class="sc-side-item">🕓 ${esc(e.summary)}
      <span class="sc-tag">${esc(Integrations.formatEventTime(e.start))}</span>
    </div>`).join('');
  return card('📅', 'Calendar', rows);
}

function card(icon: string, title: string, rowsHtml: string): string {
  return `<div class="sc-side-card"><h4>${icon} ${title}</h4>${rowsHtml || '<div class="sc-side-empty">Nothing due</div>'}</div>`;
}
