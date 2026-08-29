// ── Command Palette ───────────────────────────────────────────────────
// Ctrl+K / Cmd+K opens a VS Code-style search palette.
// Commands are grouped: Themes · Easter Eggs · Actions · Settings

export interface CmdItem {
  id:       string;
  name:     string;
  desc?:    string;
  icon?:    string;       // emoji or theme logo html
  tag:      'theme' | 'egg' | 'action' | 'setting';
  action:   () => void;
  keywords?: string;     // extra search terms (space-separated)
}

let _items: CmdItem[] = [];
let _isOpen = false;
let _activeIdx = 0;
let _filtered: CmdItem[] = [];
let _lastQuery = '';

// These IDs are static markup in index.html (always present), so a lookup
// failure means the DOM structure changed — better to fail loudly than
// silently trust a non-null assertion.
function must<T extends Element>(el: T | null, id: string): T {
  if (!el) throw new Error(`cmdpalette: expected #${id} to exist in the DOM`);
  return el;
}
const overlay = () => must(document.getElementById('cmdOverlay'), 'cmdOverlay');
const input   = () => must(document.getElementById('cmdInput'), 'cmdInput') as HTMLInputElement;
const results = () => must(document.getElementById('cmdResults'), 'cmdResults');

// ── Register commands ─────────────────────────────────────────────────
export function registerItems(items: CmdItem[]) {
  _items = items;
}

// ── Open / close ──────────────────────────────────────────────────────
export function open(prefill = '') {
  if (_isOpen) { input().focus(); return; }
  _isOpen = true;
  overlay().classList.add('open');
  requestAnimationFrame(() => {
    const inp = input();
    inp.value = prefill;
    inp.focus();
    render(prefill);
  });
}

export function close() {
  if (!_isOpen) return;
  _isOpen = false;
  overlay().classList.remove('open');
  input().value = '';
  _activeIdx = 0;
}

export function isOpen() { return _isOpen; }

// ── Fuzzy search ──────────────────────────────────────────────────────
function score(item: CmdItem, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const n = (item.name + ' ' + (item.desc ?? '') + ' ' + (item.keywords ?? '')).toLowerCase();
  if (n.startsWith(q)) return 100;
  if (n.includes(q))   return 80;
  // fuzzy: all chars present in order
  let idx = 0;
  for (const ch of q) {
    const found = n.indexOf(ch, idx);
    if (found === -1) return 0;
    idx = found + 1;
  }
  return 50;
}

function highlight(text: string, query: string): string {
  if (!query) return esc(text);
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const start = lower.indexOf(q);
  if (start === -1) return esc(text);
  return esc(text.slice(0, start)) +
    `<mark>${esc(text.slice(start, start + q.length))}</mark>` +
    esc(text.slice(start + q.length));
}

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Render ────────────────────────────────────────────────────────────
const TAG_LABELS: Record<string, string> = {
  theme:   'Theme',
  egg:     'Easter Egg 🥚',
  action:  'Action',
  setting: 'Setting',
};

function render(query: string) {
  _lastQuery = query;
  const q = query.startsWith('/') ? query.slice(1).trim() : query.trim();
  const forceEgg = query.startsWith('/');

  // Filter
  _filtered = _items
    .filter(item => {
      if (forceEgg) return item.tag === 'egg' && score(item, q) > 0;
      return score(item, q) > 0;
    })
    .sort((a, b) => {
      const sa = score(a, q), sb = score(b, q);
      if (sa !== sb) return sb - sa;
      // tag priority: action > theme > setting > egg
      const order = { action: 0, theme: 1, setting: 2, egg: 3 };
      return (order[a.tag] ?? 9) - (order[b.tag] ?? 9);
    })
    .slice(0, 48);

  // Clamp activeIdx
  if (_activeIdx >= _filtered.length) _activeIdx = 0;

  const container = results();
  // Clear using DOM — never innerHTML with user data
  while (container.firstChild) container.removeChild(container.firstChild);

  if (!_filtered.length) {
    const empty = document.createElement('div'); empty.className = 'cmd-empty';
    const icon = document.createElement('div'); icon.className = 'cmd-empty-icon'; icon.textContent = '🔍';
    const msg  = document.createElement('div'); msg.textContent = `No results for "${q || query}"`;
    empty.append(icon, msg);
    container.appendChild(empty);
    return;
  }

  // Group by tag
  const groups = new Map<string, CmdItem[]>();
  _filtered.forEach(item => {
    const g = groups.get(item.tag) ?? [];
    g.push(item);
    groups.set(item.tag, g);
  });

  // Render sections into a fragment to avoid per-item reflows
  const fragment = document.createDocumentFragment();
  const tagOrder = forceEgg ? ['egg'] : ['action', 'theme', 'setting', 'egg'];
  let globalIdx = 0;
  tagOrder.forEach(tag => {
    const group = groups.get(tag);
    if (!group?.length) return;

    const section = document.createElement('div'); section.className = 'cmd-section';
    section.textContent = TAG_LABELS[tag] ?? tag;
    fragment.appendChild(section);

    group.forEach(item => {
      const idx = globalIdx++;
      const el = document.createElement('div');
      el.className = 'cmd-item' + (idx === _activeIdx ? ' active' : '');
      el.dataset.idx = String(idx);

      // Icon — use DOMParser for SVG strings (developer-authored only), textContent for emoji
      const iconEl = document.createElement('div'); iconEl.className = 'cmd-item-icon';
      if (item.icon && typeof item.icon === 'string' && item.icon.trimStart().startsWith('<svg')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(item.icon, 'image/svg+xml');
        const svgEl = doc.documentElement;
        if (svgEl && svgEl.tagName.toLowerCase() === 'svg') {
          iconEl.appendChild(svgEl);
        } else {
          iconEl.textContent = '▸';
        }
      } else {
        iconEl.textContent = (item.icon as string) ?? '▸';
      }

      // Text
      const textEl  = document.createElement('div'); textEl.className  = 'cmd-item-text';
      const nameEl  = document.createElement('div'); nameEl.className  = 'cmd-item-name';
      nameEl.innerHTML = highlight(item.name, q); // highlight() escapes user input, only injects <mark> tags
      const descEl  = document.createElement('div'); descEl.className  = 'cmd-item-desc';
      descEl.textContent = item.desc ?? '';
      textEl.append(nameEl, descEl);

      // Tag badge
      const tagEl = document.createElement('span');
      tagEl.className = `cmd-item-tag tag-${item.tag}`;
      tagEl.textContent = TAG_LABELS[item.tag] ?? item.tag;

      el.append(iconEl, textEl, tagEl);

      // Click
      el.addEventListener('click', () => { item.action(); close(); });
      el.addEventListener('mouseenter', () => {
        _activeIdx = idx;
        highlightActive();
      });

      fragment.appendChild(el);
    });
  });

  // Single DOM write — one reflow instead of up to 48+
  container.appendChild(fragment);

  scrollActiveIntoView();
}

function highlightActive() {
  results().querySelectorAll('.cmd-item').forEach((el, i) => {
    el.classList.toggle('active', i === _activeIdx);
  });
  scrollActiveIntoView();
}

function scrollActiveIntoView() {
  const el = results().querySelectorAll('.cmd-item')[_activeIdx] as HTMLElement | undefined;
  el?.scrollIntoView({ block: 'nearest' });
}

// ── Keyboard navigation ───────────────────────────────────────────────
export function initPalette() {
  const inp = input();

  inp.addEventListener('input', () => render(inp.value));

  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _activeIdx = Math.min(_activeIdx + 1, _filtered.length - 1);
      highlightActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _activeIdx = Math.max(_activeIdx - 1, 0);
      highlightActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = _filtered[_activeIdx];
      if (item) { item.action(); close(); }
    } else if (e.key === 'Escape') {
      close();
    }
  });

  // Click outside to close
  overlay().addEventListener('click', e => {
    if (e.target === overlay()) close();
  });

  // Global Ctrl+K / Cmd+K
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      _isOpen ? close() : open();
    }
    // / key when nothing focused = open palette filtered to eggs
    if (e.key === '/' && document.activeElement === document.body) {
      e.preventDefault();
      open('/');
    }
  });
}
