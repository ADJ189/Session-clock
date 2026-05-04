// ── Command Palette ───────────────────────────────────────────────────
// Cmd/Ctrl+K opens a VS Code-style palette with fuzzy search.
// Every command, theme switch, easter egg, and setting is accessible here.

export interface PaletteCommand {
  id:       string;
  label:    string;
  hint?:    string;        // right-side description
  icon:     string;
  group:    string;
  action:   () => void;
  keywords?: string[];     // extra search terms
  badge?:   string;        // optional tag: 'easter egg', 'new', etc.
}

let _commands: PaletteCommand[] = [];
let _el: HTMLElement | null = null;
let _input: HTMLInputElement | null = null;
let _list: HTMLElement | null = null;
let _selectedIdx = 0;
let _filtered: PaletteCommand[] = [];
let _open = false;

// ── Register commands ─────────────────────────────────────────────────
export function registerCommands(cmds: PaletteCommand[]) {
  _commands = cmds;
}

export function addCommand(cmd: PaletteCommand) {
  // Replace if id exists, otherwise add
  const idx = _commands.findIndex(c => c.id === cmd.id);
  if (idx >= 0) _commands[idx] = cmd;
  else _commands.push(cmd);
}

// ── Fuzzy match ───────────────────────────────────────────────────────
function fuzzyScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return 2 + (t.startsWith(q) ? 1 : 0);
  // Character-by-character fuzzy
  let qi = 0, score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) { qi++; score++; }
  }
  return qi === q.length ? score / t.length : 0;
}

function matchCommand(cmd: PaletteCommand, query: string): number {
  if (!query) return 1;
  const targets = [cmd.label, cmd.group, ...(cmd.keywords ?? [])];
  return Math.max(...targets.map(t => fuzzyScore(query, t)));
}

// ── Highlight matching chars ──────────────────────────────────────────
function highlight(text: string, query: string): HTMLElement {
  const span = document.createElement('span');
  if (!query) { span.textContent = text; return span; }
  const q = query.toLowerCase(), t = text.toLowerCase();
  const idx = t.indexOf(q);
  if (idx >= 0) {
    // Simple substring highlight
    const before = document.createTextNode(text.slice(0, idx));
    const mark = document.createElement('mark');
    mark.className = 'palette-match';
    mark.textContent = text.slice(idx, idx + q.length);
    const after = document.createTextNode(text.slice(idx + q.length));
    span.append(before, mark, after);
  } else {
    span.textContent = text;
  }
  return span;
}

// ── Build DOM ─────────────────────────────────────────────────────────
function build() {
  if (_el) return;

  // Overlay backdrop
  const overlay = document.createElement('div');
  overlay.id = 'paletteOverlay';
  overlay.className = 'palette-overlay';
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // Modal box
  const modal = document.createElement('div');
  modal.className = 'palette-modal';

  // Search bar
  const searchWrap = document.createElement('div');
  searchWrap.className = 'palette-search-wrap';

  const searchIcon = document.createElement('span');
  searchIcon.className = 'palette-search-icon';
  searchIcon.textContent = '⌘';

  _input = document.createElement('input');
  _input.type = 'text';
  _input.className = 'palette-input';
  _input.placeholder = 'Search commands, themes, easter eggs…';
  _input.setAttribute('autocomplete', 'off');
  _input.setAttribute('spellcheck', 'false');
  _input.addEventListener('input', () => render(_input!.value));
  _input.addEventListener('keydown', onKey);

  const kbHint = document.createElement('span');
  kbHint.className = 'palette-kb-hint';
  kbHint.textContent = 'esc';

  searchWrap.append(searchIcon, _input, kbHint);

  // Results list
  _list = document.createElement('div');
  _list.className = 'palette-list';

  // Footer
  const footer = document.createElement('div');
  footer.className = 'palette-footer';
  const navHints: [string, string][] = [['↑↓', 'navigate'], ['↵', 'run'], ['esc', 'close']];
  navHints.forEach(([key, desc]) => {
    const kbd = document.createElement('span'); kbd.className = 'palette-footer-item';
    const k = document.createElement('kbd'); k.textContent = key;
    const d = document.createTextNode(` ${desc}`);
    kbd.append(k, d);
    footer.appendChild(kbd);
  });

  modal.append(searchWrap, _list, footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  _el = overlay;
}

// ── Render filtered list ──────────────────────────────────────────────
function render(query: string) {
  if (!_list) return;
  _list.innerHTML = '';
  _selectedIdx = 0;

  // Score and filter
  _filtered = _commands
    .map(cmd => ({ cmd, score: matchCommand(cmd, query) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.cmd.group.localeCompare(b.cmd.group))
    .map(x => x.cmd);

  if (_filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'palette-empty';
    empty.textContent = `No commands matching "${query}"`;
    _list.appendChild(empty);
    return;
  }

  // Group by group name
  const groups = new Map<string, PaletteCommand[]>();
  _filtered.forEach(cmd => {
    const g = groups.get(cmd.group) ?? [];
    g.push(cmd);
    groups.set(cmd.group, g);
  });

  let globalIdx = 0;
  groups.forEach((cmds, groupName) => {
    // Group header
    const header = document.createElement('div');
    header.className = 'palette-group-header';
    header.textContent = groupName;
    _list!.appendChild(header);

    cmds.forEach(cmd => {
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.dataset.idx = String(globalIdx);
      if (globalIdx === 0) item.classList.add('selected');

      const iconEl = document.createElement('span');
      iconEl.className = 'palette-item-icon';
      iconEl.textContent = cmd.icon;

      const textWrap = document.createElement('div');
      textWrap.className = 'palette-item-text';

      const labelEl = document.createElement('span');
      labelEl.className = 'palette-item-label';
      labelEl.appendChild(highlight(cmd.label, query));

      textWrap.appendChild(labelEl);

      if (cmd.hint) {
        const hintEl = document.createElement('span');
        hintEl.className = 'palette-item-hint';
        hintEl.textContent = cmd.hint;
        textWrap.appendChild(hintEl);
      }

      const right = document.createElement('div');
      right.className = 'palette-item-right';

      if (cmd.badge) {
        const badge = document.createElement('span');
        badge.className = `palette-badge palette-badge--${cmd.badge.replace(' ', '-')}`;
        badge.textContent = cmd.badge;
        right.appendChild(badge);
      }

      item.append(iconEl, textWrap, right);
      item.addEventListener('mouseenter', () => selectIdx(globalIdx));
      item.addEventListener('click', () => { runSelected(); });
      _list!.appendChild(item);
      globalIdx++;
    });
  });
}

function selectIdx(idx: number) {
  if (!_list) return;
  _selectedIdx = Math.max(0, Math.min(_filtered.length - 1, idx));
  _list.querySelectorAll<HTMLElement>('.palette-item').forEach((el, i) => {
    el.classList.toggle('selected', i === _selectedIdx);
    if (i === _selectedIdx) el.scrollIntoView({ block: 'nearest' });
  });
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); selectIdx(_selectedIdx + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); selectIdx(_selectedIdx - 1); }
  else if (e.key === 'Enter') { e.preventDefault(); runSelected(); }
  else if (e.key === 'Escape') { e.preventDefault(); close(); }
}

function runSelected() {
  const cmd = _filtered[_selectedIdx];
  if (cmd) {
    close();
    // Small delay so close animation plays before action
    setTimeout(() => cmd.action(), 80);
  }
}

// ── Open / close ──────────────────────────────────────────────────────
export function open() {
  build();
  if (!_el || !_input || !_list) return;
  _open = true;
  _el.classList.add('open');
  _input.value = '';
  render('');
  // Focus after transition starts
  requestAnimationFrame(() => _input!.focus());
}

export function close() {
  if (!_el) return;
  _open = false;
  _el.classList.remove('open');
  _input?.blur();
}

export function toggle() { _open ? close() : open(); }
export function isOpen() { return _open; }

// ── Global keyboard shortcut: Cmd/Ctrl+K ─────────────────────────────
export function initPalette() {
  window.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggle();
    }
  });
}
