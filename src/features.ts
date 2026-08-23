// ── New Features Module ────────────────────────────────────────────────
// 1.  Smart status line
// 2.  Time trust indicator
// 3.  Context-aware button labels
// 4.  Session templates
// 5.  Session completion + quality rating
// 6.  Distraction counter
// 7.  Onboarding wizard
// 8.  Day/night auto-theme suggestion
// 9.  Deadline countdown mode
// 10. Better empty states
// 11. Break activity suggestions
// 12. World clock widget

const $ = (id: string) => document.getElementById(id)!;

// ─────────────────────────────────────────────────────────────────────
// 1. SMART STATUS LINE
// ─────────────────────────────────────────────────────────────────────
type SessionState = 'idle' | 'running' | 'paused' | 'break' | 'complete';
let _sessionState: SessionState = 'idle';
let _pomPhase: string = 'work';
let _pomEnabled = false;
let _remainingSecs = 0;
let _todaySessions = 0;
let _statusCb: ((text: string, urgent?: boolean) => void) | null = null;

export function initStatusLine(cb: (text: string, urgent?: boolean) => void) {
  _statusCb = cb;
  updateStatusLine();
}

export function setStatusState(state: SessionState, opts: {
  pomPhase?: string;
  pomEnabled?: boolean;
  remainingSecs?: number;
  todaySessions?: number;
} = {}) {
  _sessionState = state;
  if (opts.pomPhase !== undefined) _pomPhase = opts.pomPhase;
  if (opts.pomEnabled !== undefined) _pomEnabled = opts.pomEnabled;
  if (opts.remainingSecs !== undefined) _remainingSecs = opts.remainingSecs;
  if (opts.todaySessions !== undefined) _todaySessions = opts.todaySessions;
  updateStatusLine();
}

function fmt(secs: number): string {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateStatusLine() {
  if (!_statusCb) return;
  let text = '';
  let urgent = false;

  if (_sessionState === 'idle') {
    const hour = new Date().getHours();
    if (_todaySessions === 0) {
      text = 'Ready when you are. Begin your first session.';
    } else if (hour >= 21) {
      text = `${_todaySessions} session${_todaySessions > 1 ? 's' : ''} today — great work. Wind down soon.`;
    } else {
      text = `${_todaySessions} session${_todaySessions > 1 ? 's' : ''} today. Keep the momentum going.`;
    }
  } else if (_sessionState === 'running') {
    if (_pomEnabled && _remainingSecs > 0) {
      if (_pomPhase === 'work') {
        if (_remainingSecs <= 120) {
          text = `Almost there — ${fmt(_remainingSecs)} left in this focus block.`;
          urgent = true;
        } else {
          text = `In focus — ${fmt(_remainingSecs)} remaining. You are doing great.`;
        }
      } else if (_pomPhase === 'break') {
        text = `Break time — ${fmt(_remainingSecs)} left. Step away from the screen.`;
      } else {
        text = `Long break — ${fmt(_remainingSecs)} remaining. You earned it.`;
      }
    } else {
      text = 'Focus session in progress. Stay with it.';
    }
  } else if (_sessionState === 'paused') {
    text = 'Session paused. Continue when you are ready.';
  } else if (_sessionState === 'break') {
    text = _remainingSecs > 0
      ? `Break in progress — ${fmt(_remainingSecs)} left.`
      : 'Break time. Breathe, stretch, hydrate.';
  } else if (_sessionState === 'complete') {
    text = `Session complete. Well done!`;
  }

  _statusCb(text, urgent);
}

// ─────────────────────────────────────────────────────────────────────
// 2. TIME TRUST INDICATOR  
// ─────────────────────────────────────────────────────────────────────
type SyncSource = 'ntp' | 'system' | 'offline';
let _syncSource: SyncSource = 'system';
let _syncAgeMs = 0;
let _syncTimestamp = 0;

export function setSyncTrust(source: SyncSource, timestampMs = Date.now()) {
  _syncSource = source;
  _syncTimestamp = timestampMs;
}

export function getTrustLabel(): string {
  if (_syncSource === 'ntp') {
    _syncAgeMs = Date.now() - _syncTimestamp;
    const secs = Math.round(_syncAgeMs / 1000);
    const age = secs < 60 ? `${secs}s ago` : `${Math.round(secs / 60)}m ago`;
    return `🔵 NTP · ${age}`;
  }
  if (_syncSource === 'offline') return `📴 Offline · System clock`;
  return `⚪ System clock`;
}

export function getTrustTooltip(): string {
  if (_syncSource === 'ntp') return 'Network-synced — Cloudflare NTP probe';
  if (_syncSource === 'offline') return 'No network — showing device clock';
  return 'System clock — not yet synced';
}

// ─────────────────────────────────────────────────────────────────────
// 3. CONTEXT-AWARE BUTTON LABELS
// ─────────────────────────────────────────────────────────────────────
export function updateButtonLabels(
  state: SessionState,
  pomPhase: string,
  pomEnabled: boolean,
  btnStart: HTMLButtonElement
) {
  const playIcon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  const pauseIcon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

  let label = 'Begin Session';
  let icon = playIcon;

  if (state === 'running') {
    if (pomEnabled && pomPhase === 'break') {
      label = 'Pause Break'; icon = pauseIcon;
    } else {
      label = 'Take a Break'; icon = pauseIcon;
    }
  } else if (state === 'paused') {
    label = 'Continue Focus'; icon = playIcon;
  } else if (state === 'idle' || state === 'complete') {
    if (pomEnabled) {
      label = pomPhase === 'break' ? 'Start Break' : 'Begin Focus'; icon = playIcon;
    } else {
      label = 'Begin Session'; icon = playIcon;
    }
  }

  // Build using DOM to avoid any innerHTML risk
  while (btnStart.firstChild) btnStart.removeChild(btnStart.firstChild);
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(icon, 'image/svg+xml');
  const svgEl = svgDoc.documentElement;
  if (svgEl && svgEl.tagName === 'svg') btnStart.appendChild(svgEl);
  btnStart.appendChild(document.createTextNode(' ' + label));
}

// ─────────────────────────────────────────────────────────────────────
// 4. SESSION TEMPLATES
// ─────────────────────────────────────────────────────────────────────
export interface SessionTemplate {
  id: string;
  name: string;
  icon: string;
  desc: string;
  durationMins: number;
  breakMins: number;
  soundId?: string;
  themeId?: string;
}

export const SESSION_TEMPLATES: SessionTemplate[] = [
  { id:'deep-work',   name:'Deep Work',      icon:'🧠', desc:'Long uninterrupted focus block', durationMins:90, breakMins:15, soundId:'rain' },
  { id:'study',       name:'Study Session',  icon:'📚', desc:'Classic Pomodoro for studying',  durationMins:25, breakMins:5 },
  { id:'coding',      name:'Coding Sprint',  icon:'💻', desc:'45-minute dev session',           durationMins:45, breakMins:10, soundId:'brown' },
  { id:'writing',     name:'Writing Flow',   icon:'✍️', desc:'Focused writing without breaks',  durationMins:50, breakMins:10, soundId:'cafe' },
  { id:'reading',     name:'Reading',        icon:'📖', desc:'Quiet 30-minute read',            durationMins:30, breakMins:5,  soundId:'forest' },
  { id:'creative',    name:'Creative Work',  icon:'🎨', desc:'Open-ended creative session',     durationMins:60, breakMins:15 },
  { id:'workout',     name:'Workout',        icon:'💪', desc:'Movement session timer',          durationMins:45, breakMins:5 },
  { id:'quick-sprint',name:'Quick Sprint',   icon:'⚡', desc:'15-minute laser focus',           durationMins:15, breakMins:5 },
];

type TemplateCb = (t: SessionTemplate) => void;

export function buildTemplatesUI(
  container: HTMLElement,
  onSelect: TemplateCb
) {
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;padding:18px;';

  SESSION_TEMPLATES.forEach(t => {
    const card = document.createElement('button');
    card.className = 'template-card';

    const iconEl = document.createElement('div'); iconEl.className = 'template-icon'; iconEl.textContent = t.icon;
    const nameEl = document.createElement('div'); nameEl.className = 'template-name'; nameEl.textContent = t.name;
    const descEl = document.createElement('div'); descEl.className = 'template-desc'; descEl.textContent = t.desc;
    const metaEl = document.createElement('div'); metaEl.className = 'template-meta';
    metaEl.textContent = `${t.durationMins}min · ${t.breakMins}min break`;

    card.append(iconEl, nameEl, descEl, metaEl);
    card.addEventListener('click', () => onSelect(t));
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

// ─────────────────────────────────────────────────────────────────────
// 5. SESSION COMPLETION + QUALITY RATING
// ─────────────────────────────────────────────────────────────────────
const RATING_EMOJIS = ['😵', '😕', '😐', '😊', '🔥'];
const RATING_LABELS = ['Rough', 'Distracted', 'Okay', 'Focused', 'In the zone'];

export function showCompletionRating(
  durationSecs: number,
  task: string,
  onRate: (rating: number) => void
) {
  const container = $('ratingContent');
  container.innerHTML = '';

  const mins = Math.round(durationSecs / 60);

  // Stats row
  const stats = document.createElement('div');
  stats.style.cssText = 'display:flex;gap:24px;justify-content:center;padding:20px 24px 8px;';
  const addStat = (val: string, label: string) => {
    const d = document.createElement('div');
    d.style.cssText = 'text-align:center;';
    const v = document.createElement('div'); v.style.cssText = 'font-size:1.6rem;font-weight:800;color:var(--clr-accent);'; v.textContent = val;
    const l = document.createElement('div'); l.style.cssText = 'font-size:.6rem;opacity:.5;letter-spacing:.08em;text-transform:uppercase;'; l.textContent = label;
    d.append(v, l); stats.appendChild(d);
  };
  addStat(`${mins}`, 'Minutes');
  if (task) addStat(task.slice(0, 14), 'Task');

  // Prompt
  const prompt = document.createElement('div');
  prompt.style.cssText = 'text-align:center;font-size:.78rem;opacity:.6;padding:0 24px 16px;';
  prompt.textContent = 'How did that session feel?';

  // Rating row
  const ratingRow = document.createElement('div');
  ratingRow.style.cssText = 'display:flex;gap:12px;justify-content:center;padding:0 24px 12px;';

  RATING_EMOJIS.forEach((emoji, i) => {
    const btn = document.createElement('button');
    btn.className = 'rating-btn';
    btn.title = RATING_LABELS[i] ?? '';
    const em = document.createElement('div'); em.style.cssText = 'font-size:1.8rem;'; em.textContent = emoji;
    const lbl = document.createElement('div'); lbl.style.cssText = 'font-size:.55rem;opacity:.5;margin-top:2px;'; lbl.textContent = RATING_LABELS[i] ?? '';
    btn.append(em, lbl);
    btn.addEventListener('click', () => {
      onRate(i + 1);
      document.getElementById('ratingOverlay')?.classList.remove('open');
    });
    ratingRow.appendChild(btn);
  });

  // Skip
  const skip = document.createElement('button');
  skip.style.cssText = 'display:block;margin:0 auto 20px;font-size:.62rem;opacity:.35;background:none;border:none;color:inherit;cursor:pointer;padding:4px 12px;';
  skip.textContent = 'Skip';
  skip.addEventListener('click', () => {
    onRate(0);
    document.getElementById('ratingOverlay')?.classList.remove('open');
  });

  // Break suggestion
  const breakSug = document.createElement('div');
  breakSug.className = 'break-suggestion';
  breakSug.textContent = getBreakSuggestion(mins);

  container.append(stats, prompt, ratingRow, skip, breakSug);
  document.getElementById('ratingOverlay')?.classList.add('open');
}

// ─────────────────────────────────────────────────────────────────────
// 11. BREAK ACTIVITY SUGGESTIONS (used inside rating modal)
// ─────────────────────────────────────────────────────────────────────
const SHORT_BREAKS = [
  'Take 5 deep breaths before your next session.',
  'Stand up and stretch your shoulders and neck.',
  'Look at something 20 feet away for 20 seconds.',
  'Grab a glass of water.',
  'Step outside for fresh air if you can.',
];
const LONG_BREAKS = [
  'Go for a 10-minute walk — it resets focus.',
  'Do a short stretch or yoga flow.',
  'Make yourself a proper meal or snack.',
  'Step fully away from all screens for a few minutes.',
  'Journal one sentence about what you accomplished.',
];

export function getBreakSuggestion(sessionMins: number): string {
  const pool = sessionMins >= 45 ? LONG_BREAKS : SHORT_BREAKS;
  return pool[Math.floor(Date.now() / 60000) % pool.length]!;
}

// ─────────────────────────────────────────────────────────────────────
// 6. DISTRACTION COUNTER
// ─────────────────────────────────────────────────────────────────────
const DISTRACTION_KEY = 'sc_distractions';

interface DistractionEntry { date: string; count: number; }

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function logDistraction() {
  try {
    const data: DistractionEntry[] = JSON.parse(localStorage.getItem(DISTRACTION_KEY) || '[]');
    const today = todayKey();
    const entry = data.find(e => e.date === today);
    if (entry) { entry.count++; } else { data.push({ date: today, count: 1 }); }
    localStorage.setItem(DISTRACTION_KEY, JSON.stringify(data.slice(-30)));
    return getTodayDistractions();
  } catch { return 0; }
}

export function getTodayDistractions(): number {
  try {
    const data: DistractionEntry[] = JSON.parse(localStorage.getItem(DISTRACTION_KEY) || '[]');
    return data.find(e => e.date === todayKey())?.count ?? 0;
  } catch { return 0; }
}

export function updateDistractionUI(running: boolean) {
  const row = $('distractionRow');
  if (!row) return;
  row.style.display = running ? 'flex' : 'none';
  const countEl = $('distractionCount');
  if (countEl) {
    const n = getTodayDistractions();
    countEl.textContent = n === 0 ? 'No distractions' : `${n} distraction${n !== 1 ? 's' : ''} today`;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 7. ONBOARDING WIZARD
// ─────────────────────────────────────────────────────────────────────
const ONBOARD_KEY = 'sc_onboarded_v2';

export function shouldShowOnboarding(): boolean {
  return !localStorage.getItem(ONBOARD_KEY);
}

export function markOnboarded() {
  localStorage.setItem(ONBOARD_KEY, '1');
}

interface OnboardCallbacks {
  setDuration: (mins: number) => void;
  applyThemeById: (id: string) => void;
  enableSound: (id: string) => void;
}

export function showOnboarding(cbs: OnboardCallbacks) {
  const overlay = $('onboardOverlay');
  const container = $('onboardContent');
  overlay.classList.add('open');
  const TOTAL_STEPS = 4;
  let step = 0;

  const finish = (soundId = '') => {
    if (soundId) cbs.enableSound(soundId);
    markOnboarded();
    overlay.classList.remove('open');
  };

  const goNext = () => { step = Math.min(step + 1, TOTAL_STEPS - 1); renderStep(); };

  const renderStep = () => {
    container.innerHTML = '';
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;';

    // ── Progress dots ──
    const dots = document.createElement('div');
    dots.style.cssText = 'display:flex;gap:6px;justify-content:center;padding:20px 0 0;';
    for (let i = 0; i < TOTAL_STEPS; i++) {
      const d = document.createElement('div');
      d.style.cssText = `width:${i === step ? 20 : 6}px;height:6px;border-radius:99px;background:${i === step ? 'var(--clr-accent)' : 'rgba(255,255,255,.18)'};transition:all .3s;`;
      dots.appendChild(d);
    }

    // ── Skip all link ── always visible top-right
    const skipAll = document.createElement('button');
    skipAll.style.cssText = 'position:absolute;top:16px;right:18px;font-size:.6rem;opacity:.35;background:none;border:none;color:inherit;cursor:pointer;letter-spacing:.04em;padding:4px 8px;';
    skipAll.textContent = 'Skip all';
    skipAll.addEventListener('click', () => finish());

    // ── Content area ──
    const body = document.createElement('div');
    body.style.cssText = 'flex:1;padding:16px 24px 8px;overflow-y:auto;';

    // ── Bottom nav ──
    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 24px 24px;gap:12px;';

    if (step === 0) renderWelcome(body, nav, goNext, finish);
    else if (step === 1) renderDuration(body, nav, (m) => { cbs.setDuration(m); goNext(); }, finish);
    else if (step === 2) renderThemePick(body, nav, (id) => { if (id) cbs.applyThemeById(id); goNext(); }, finish);
    else if (step === 3) renderSoundPick(body, nav, (id) => finish(id), finish);

    // Wrap with relative positioning for skip-all button
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;display:flex;flex-direction:column;height:100%;';
    wrapper.append(skipAll, dots, body, nav);
    container.appendChild(wrapper);
  };
  renderStep();
}

function obH(text: string): HTMLElement {
  const h = document.createElement('h2');
  h.style.cssText = 'font-size:1.25rem;font-weight:800;margin:16px 0 4px;text-align:center;letter-spacing:-.01em;';
  h.textContent = text; return h;
}
function obP(text: string): HTMLElement {
  const p = document.createElement('p');
  p.style.cssText = 'font-size:.7rem;opacity:.46;margin:0 0 18px;text-align:center;line-height:1.65;';
  p.textContent = text; return p;
}
function obNavBtn(label: string, primary: boolean, cb: () => void): HTMLElement {
  const btn = document.createElement('button');
  btn.style.cssText = primary
    ? 'flex:1;padding:11px 0;border-radius:12px;background:var(--clr-accent);color:#000;font-weight:700;font-size:.78rem;border:none;cursor:pointer;transition:filter .15s,transform .1s;'
    : 'font-size:.62rem;opacity:.38;background:none;border:none;color:inherit;cursor:pointer;padding:4px 8px;white-space:nowrap;';
  btn.textContent = label;
  btn.addEventListener('click', cb);
  return btn;
}
function obGrid(cols = 2): HTMLElement {
  const g = document.createElement('div');
  g.style.cssText = `display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;margin-bottom:4px;`;
  return g;
}
function obCard(icon: string, label: string, sub: string, cb: () => void): HTMLElement {
  const btn = document.createElement('button');
  btn.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 8px 10px;border-radius:14px;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.08);cursor:pointer;color:inherit;transition:background .15s,border-color .15s,transform .12s;';
  btn.addEventListener('mouseenter', () => { btn.style.background='rgba(255,255,255,.1)'; btn.style.borderColor='var(--clr-accent)'; });
  btn.addEventListener('mouseleave', () => { btn.style.background='rgba(255,255,255,.05)'; btn.style.borderColor='rgba(255,255,255,.08)'; });
  btn.addEventListener('mousedown', () => { btn.style.transform='scale(.96)'; });
  btn.addEventListener('mouseup', () => { btn.style.transform=''; cb(); });
  btn.addEventListener('touchend', () => { btn.style.transform=''; cb(); }, { passive: true });
  const ic = document.createElement('div'); ic.style.cssText = 'font-size:1.65rem;line-height:1;'; ic.textContent = icon;
  const lbl = document.createElement('div'); lbl.style.cssText = 'font-size:.72rem;font-weight:700;letter-spacing:-.01em;'; lbl.textContent = label;
  const sb = document.createElement('div'); sb.style.cssText = 'font-size:.56rem;opacity:.4;'; sb.textContent = sub;
  btn.append(ic, lbl, sb);
  return btn;
}

function renderWelcome(body: HTMLElement, nav: HTMLElement, next: () => void, finish: (s?: string) => void) {
  const icon = document.createElement('div');
  icon.style.cssText = 'font-size:3.2rem;text-align:center;margin:12px 0 4px;filter:drop-shadow(0 0 24px rgba(110,231,183,.4));';
  icon.textContent = '⏱';
  body.append(icon, obH('Session Clock'), obP('A precise, beautiful focus timer — themes, binaural beats, session tracking, and more. Set up in 30 seconds or skip and dive in.'));
  nav.append(
    obNavBtn('Get started →', true, next),
    obNavBtn('Skip, use defaults', false, () => finish()),
  );
}

function renderDuration(body: HTMLElement, nav: HTMLElement, onPick: (m: number) => void, finish: (s?: string) => void) {
  body.append(obH('Session length?'), obP('How long is your typical focus block? You can change this any time.'));
  const grid = obGrid(3);
  const opts: [number, string, string][] = [
    [15, '15 min', 'Quick sprint'],
    [25, '25 min', 'Pomodoro'],
    [45, '45 min', 'Deep work'],
    [60, '60 min', 'Long block'],
    [90, '90 min', 'Ultra focus'],
    [50, '50 min', 'Animedoro'],
  ];
  opts.forEach(([m, lbl, sub]) => grid.appendChild(obCard('', lbl, sub, () => onPick(m))));
  // Update icons after creating
  grid.querySelectorAll('button').forEach((btn, i) => {
    const icons = ['⚡','🍅','🧠','🔭','🎯','🎬'];
    btn.querySelector('div')!.textContent = icons[i] ?? '⏱';
  });
  body.appendChild(grid);
  nav.append(obNavBtn('Skip →', false, () => onPick(25)));
}

function renderThemePick(body: HTMLElement, nav: HTMLElement, onPick: (id: string) => void, finish: (s?: string) => void) {
  body.append(obH('Choose your vibe'), obP('45+ themes available — pick a favourite to start. Change anytime with T or Ctrl+K.'));
  const grid = obGrid(3);
  const themes: [string, string, string, string][] = [
    ['midnight',    '🌃', 'Midnight',    'Deep purple'],
    ['aurora',      '🌌', 'Aurora',      'Northern lights'],
    ['cyberpunk',   '🌆', 'Cyberpunk',   'Night City'],
    ['nordic',      '❄️',  'Nordic',      'Clean minimal'],
    ['forest',      '🌲', 'Forest',      'Calm green'],
    ['breakingbad', '⚗️',  'Breaking Bad','Chemistry'],
    ['onepiece',    '🏴‍☠️', 'One Piece',   'Grand Line'],
    ['dune',        '🏜️',  'Dune',        'Arrakis'],
    ['severance',   '🏢', 'Severance',   'Lumon Corp'],
    ['hal9000',     '🔴', '2001: Space', 'Kubrick'],
    ['dragonfire',  '🐉', 'Dragonfire',  'Targaryen'],
    ['terminal',    '💻', 'Terminal',    'Air-gapped'],
  ];
  themes.forEach(([id, icon, name, sub]) => grid.appendChild(obCard(icon, name, sub, () => onPick(id))));
  body.appendChild(grid);
  nav.append(obNavBtn('Skip →', false, () => onPick('')));
}

function renderSoundPick(body: HTMLElement, nav: HTMLElement, onPick: (id: string) => void, finish: (s?: string) => void) {
  body.append(obH('Ambient sound?'), obP('Background audio helps many people focus deeply. Completely optional — mute any time.'));
  const grid = obGrid(3);
  const sounds: [string, string, string, string][] = [
    ['rain',    '🌧', 'Rain',        'Steady drops'],
    ['brown',   '🌊', 'Brown Noise', 'Deep rumble'],
    ['cafe',    '☕', 'Café',        'Busy chatter'],
    ['forest',  '🌲', 'Forest',      'Birds & breeze'],
    ['ocean',   '🌊', 'Ocean',       'Wave cycles'],
    ['fire',    '🔥', 'Fireplace',   'Crackling warmth'],
    ['',        '🔇', 'No sound',    'Stay silent'],
  ];
  sounds.forEach(([id, icon, name, sub]) => grid.appendChild(obCard(icon, name, sub, () => onPick(id))));
  body.appendChild(grid);
  nav.append(obNavBtn('Skip →', false, () => onPick('')));
}

// ─────────────────────────────────────────────────────────────────────
// 8. DAY/NIGHT AUTO-THEME SUGGESTION
// ─────────────────────────────────────────────────────────────────────
const TIME_THEMES: [number, number, string, string][] = [
  // [startHour, endHour, themeId, reason]
  [5,  8,  'sunrise',   'Good morning — Sunrise theme for the golden hour'],
  [8,  12, 'nordic',    'Morning light — clean and focused'],
  [12, 15, 'lemon',     'Afternoon energy — bright and clear'],
  [15, 18, 'forest',    'Late afternoon — calm and grounded'],
  [18, 21, 'commonroom','Evening — warm and cozy'],
  [21, 24, 'midnight',  'Night mode — easy on the eyes'],
  [0,  5,  'terminal',  'Deep night — minimalist dark mode'],
];

export function getDayNightThemeSuggestion(): { themeId: string; reason: string } | null {
  const h = new Date().getHours();
  const match = TIME_THEMES.find(([s, e]) => h >= s && h < e);
  if (!match) return null;
  return { themeId: match[2], reason: match[3] };
}

// Weather-aware suggestion — overrides time suggestion when conditions are strong
export function getWeatherThemeSuggestion(
  isRaining: boolean, isSnowing: boolean, isClear: boolean
): { themeId: string; reason: string } | null {
  if (isRaining) return { themeId: 'commonroom', reason: '🌧 Raining outside — warm and cosy inside' };
  if (isSnowing) return { themeId: 'nordic',     reason: '❄️ Snowing — clean Nordic light' };
  const h = new Date().getHours();
  if (isClear && h >= 6 && h < 10) return { themeId: 'sunrise', reason: '☀️ Clear morning — golden hour' };
  if (isClear && h >= 20) return { themeId: 'midnight',reason: '🌙 Clear night — perfect for midnight' };
  return null;
}

const SHOWN_SUGGESTION_KEY = 'sc_daynight_suggested';

export function shouldSuggestDayNightTheme(currentThemeId: string): boolean {
  const suggestion = getDayNightThemeSuggestion();
  if (!suggestion) return false;
  if (suggestion.themeId === currentThemeId) return false;
  const last = localStorage.getItem(SHOWN_SUGGESTION_KEY);
  const hourSlot = Math.floor(new Date().getHours() / 3); // suggest once per 3-hour block
  const slotKey = `${new Date().toDateString()}-${hourSlot}`;
  if (last === slotKey) return false;
  localStorage.setItem(SHOWN_SUGGESTION_KEY, slotKey);
  return true;
}

// ─────────────────────────────────────────────────────────────────────
// 9. DEADLINE COUNTDOWN MODE
// ─────────────────────────────────────────────────────────────────────
let _countdownTarget: Date | null = null;
let _countdownLabel = '';
let _countdownCb: ((display: string, done: boolean) => void) | null = null;

export function setCountdownTarget(label: string, target: Date, cb: (display: string, done: boolean) => void) {
  _countdownLabel = label;
  _countdownTarget = target;
  _countdownCb = cb;
  tickCountdown();
}

export function clearCountdown() {
  _countdownTarget = null;
  _countdownLabel = '';
  _countdownCb = null;
}

export function tickCountdown() {
  if (!_countdownTarget || !_countdownCb) return;
  const diff = _countdownTarget.getTime() - Date.now();
  if (diff <= 0) { _countdownCb('Time is up! — ' + _countdownLabel, true); clearCountdown(); return; }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const parts = d > 0 ? [`${d}d`, `${h}h`, `${m}m`] : h > 0 ? [`${h}h`, `${m}m`, `${s}s`] : [`${m}m`, `${s}s`];
  _countdownCb(`⏳ ${_countdownLabel} — ${parts.join(' ')}`, false);
}

export function buildCountdownUI(container: HTMLElement, onSet: (label: string, target: Date) => void) {
  container.innerHTML = '';
  container.style.cssText = 'padding:24px;';

  const desc = document.createElement('p');
  desc.style.cssText = 'font-size:.72rem;opacity:.5;margin:0 0 18px;';
  desc.textContent = 'Count down to any deadline — exam, meeting, event, or end of day.';

  const labelInput = document.createElement('input');
  labelInput.placeholder = 'Label (e.g. "Exam", "Meeting", "End of day")';
  labelInput.setAttribute('aria-label', 'Countdown label');
  labelInput.style.cssText = 'width:100%;padding:10px 14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.78rem;margin-bottom:12px;box-sizing:border-box;';

  const dateInput = document.createElement('input');
  dateInput.type = 'datetime-local';
  dateInput.setAttribute('aria-label', 'Countdown target date and time');
  dateInput.style.cssText = 'width:100%;padding:10px 14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.78rem;margin-bottom:16px;box-sizing:border-box;color-scheme:dark;';
  // Default to end of today
  const now = new Date();
  now.setHours(23, 59, 0, 0);
  dateInput.value = now.toISOString().slice(0, 16);

  // Quick presets
  const presets = document.createElement('div');
  presets.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;';
  const PRESETS: [string, number][] = [['1 hour', 60], ['2 hours', 120], ['End of day', -1], ['Tomorrow', -2]];
  PRESETS.forEach(([label, mins]) => {
    const btn = document.createElement('button');
    btn.style.cssText = 'padding:5px 12px;border-radius:99px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:inherit;font-size:.62rem;cursor:pointer;';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      const t = new Date();
      if (mins === -1) { t.setHours(23, 59, 0, 0); }
      else if (mins === -2) { t.setDate(t.getDate() + 1); t.setHours(9, 0, 0, 0); }
      else { t.setMinutes(t.getMinutes() + mins); }
      dateInput.value = t.toISOString().slice(0, 16);
      if (!labelInput.value) labelInput.value = label;
    });
    presets.appendChild(btn);
  });

  const setBtn = document.createElement('button');
  setBtn.className = 'btn btn-primary';
  setBtn.style.cssText = 'width:100%;justify-content:center;';
  setBtn.textContent = 'Start countdown';
  setBtn.addEventListener('click', () => {
    const target = new Date(dateInput.value);
    if (isNaN(target.getTime())) return;
    const label = labelInput.value.trim() || 'Deadline';
    onSet(label, target);
    document.getElementById('countdownOverlay')?.classList.remove('open');
  });

  const clearBtn = document.createElement('button');
  clearBtn.style.cssText = 'display:block;margin:10px auto 0;font-size:.62rem;opacity:.3;background:none;border:none;color:inherit;cursor:pointer;';
  clearBtn.textContent = 'Clear countdown';
  clearBtn.addEventListener('click', () => {
    clearCountdown();
    document.getElementById('countdownOverlay')?.classList.remove('open');
  });

  container.append(desc, labelInput, dateInput, presets, setBtn, clearBtn);
}

// ─────────────────────────────────────────────────────────────────────
// 10. BETTER EMPTY STATES
// ─────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
// 12. WORLD CLOCK WIDGET
// ─────────────────────────────────────────────────────────────────────
const WORLD_CLOCK_KEY = 'sc_world_clocks';

const TIMEZONE_PRESETS: [string, string, string][] = [
  ['America/New_York',     'New York',    '🗽'],
  ['America/Los_Angeles',  'Los Angeles', '🌴'],
  ['America/Chicago',      'Chicago',     '🏙'],
  ['America/Toronto',      'Toronto',     '🍁'],
  ['America/Sao_Paulo',    'São Paulo',   '🇧🇷'],
  ['Europe/London',        'London',      '🇬🇧'],
  ['Europe/Paris',         'Paris',       '🗼'],
  ['Europe/Berlin',        'Berlin',      '🇩🇪'],
  ['Europe/Moscow',        'Moscow',      '🇷🇺'],
  ['Asia/Dubai',           'Dubai',       '🇦🇪'],
  ['Asia/Kolkata',         'Mumbai',      '🇮🇳'],
  ['Asia/Singapore',       'Singapore',   '🇸🇬'],
  ['Asia/Tokyo',           'Tokyo',       '🇯🇵'],
  ['Asia/Shanghai',        'Shanghai',    '🇨🇳'],
  ['Asia/Seoul',           'Seoul',       '🇰🇷'],
  ['Australia/Sydney',     'Sydney',      '🦘'],
  ['Pacific/Auckland',     'Auckland',    '🇳🇿'],
];

export function getWorldClocks(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(WORLD_CLOCK_KEY) || '[]');
    if (saved.length) return saved;
  } catch { /**/ }
  return ['America/New_York', 'Europe/London', 'Asia/Kolkata'];
}

export function saveWorldClocks(tzs: string[]) {
  localStorage.setItem(WORLD_CLOCK_KEY, JSON.stringify(tzs));
}

export function buildWorldClockUI(container: HTMLElement) {
  container.innerHTML = '';
  container.style.cssText = 'padding:16px;';

  const clocks = getWorldClocks();

  // Live display
  const displayWrap = document.createElement('div');
  displayWrap.id = 'worldClockDisplay';
  displayWrap.style.cssText = 'margin-bottom:18px;';
  updateWorldClockDisplay(displayWrap, clocks);
  container.appendChild(displayWrap);

  // Picker
  const pickerLabel = document.createElement('div');
  pickerLabel.style.cssText = 'font-size:.62rem;opacity:.4;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;';
  pickerLabel.textContent = 'Add timezone (up to 5)';

  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Add timezone (up to 5)');
  select.style.cssText = 'width:100%;padding:8px 12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:inherit;font:inherit;font-size:.74rem;margin-bottom:8px;';
  const defaultOpt = document.createElement('option'); defaultOpt.value = ''; defaultOpt.textContent = '— Select timezone —';
  select.appendChild(defaultOpt);
  TIMEZONE_PRESETS.forEach(([tz, name, flag]) => {
    const opt = document.createElement('option'); opt.value = tz; opt.textContent = `${flag} ${name}`;
    select.appendChild(opt);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.style.cssText = 'width:100%;justify-content:center;';
  addBtn.textContent = '+ Add clock';
  addBtn.addEventListener('click', () => {
    if (!select.value) return;
    const cur = getWorldClocks();
    if (cur.includes(select.value) || cur.length >= 5) return;
    cur.push(select.value);
    saveWorldClocks(cur);
    buildWorldClockUI(container);
  });

  container.append(pickerLabel, select, addBtn);
}

function updateWorldClockDisplay(wrap: HTMLElement, tzs: string[]) {
  wrap.innerHTML = '';
  const now = new Date();
  tzs.forEach(tz => {
    const preset = TIMEZONE_PRESETS.find(([t]) => t === tz);
    const flag = preset?.[2] ?? '🌐';
    const city = preset?.[1] ?? tz.split('/')[1]?.replace('_', ' ') ?? tz;

    let timeStr = '—';
    try {
      timeStr = now.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { /**/ }

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,.04);margin-bottom:6px;';

    const fl = document.createElement('span'); fl.style.cssText = 'font-size:1.2rem;width:24px;text-align:center;'; fl.textContent = flag;
    const cityEl = document.createElement('div'); cityEl.style.cssText = 'flex:1;font-size:.74rem;font-weight:600;'; cityEl.textContent = city;
    const timeEl = document.createElement('div'); timeEl.style.cssText = 'font-size:.95rem;font-weight:800;letter-spacing:.04em;color:var(--clr-accent);font-variant-numeric:tabular-nums;'; timeEl.textContent = timeStr;

    const removeBtn = document.createElement('button');
    removeBtn.style.cssText = 'font-size:.7rem;opacity:.25;background:none;border:none;color:inherit;cursor:pointer;padding:2px 6px;';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      const cur = getWorldClocks().filter(t => t !== tz);
      saveWorldClocks(cur);
      const parent = wrap.parentElement;
      if (parent) buildWorldClockUI(parent);
    });

    row.append(fl, cityEl, timeEl, removeBtn);
    wrap.appendChild(row);
  });
}

// Live tick for world clock (call from render loop every second)
export function tickWorldClock() {
  const display = document.getElementById('worldClockDisplay');
  if (!display || !document.getElementById('worldClockOverlay')?.classList.contains('open')) return;
  updateWorldClockDisplay(display, getWorldClocks());
}

// ─────────────────────────────────────────────────────────────────────
// LUNAR PHASE — pure math, no API needed
// ─────────────────────────────────────────────────────────────────────
// Returns 0–1 where 0 = new moon, 0.5 = full moon
export function getLunarPhase(): { phase: number; name: string; emoji: string; illumination: number } {
  // Known new moon: 2000-01-06 18:14 UTC (J2000 epoch reference)
  const KNOWN_NEW_MOON_MS = 947182440000;
  const SYNODIC_PERIOD_MS = 29.53058867 * 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - KNOWN_NEW_MOON_MS;
  const phase = ((elapsed % SYNODIC_PERIOD_MS) / SYNODIC_PERIOD_MS + 1) % 1;

  const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100);

  let name: string, emoji: string;
  if      (phase < 0.0625) { name = 'New Moon';        emoji = '🌑'; }
  else if (phase < 0.1875) { name = 'Waxing Crescent'; emoji = '🌒'; }
  else if (phase < 0.3125) { name = 'First Quarter';   emoji = '🌓'; }
  else if (phase < 0.4375) { name = 'Waxing Gibbous';  emoji = '🌔'; }
  else if (phase < 0.5625) { name = 'Full Moon';        emoji = '🌕'; }
  else if (phase < 0.6875) { name = 'Waning Gibbous';  emoji = '🌖'; }
  else if (phase < 0.8125) { name = 'Last Quarter';    emoji = '🌗'; }
  else if (phase < 0.9375) { name = 'Waning Crescent'; emoji = '🌘'; }
  else                     { name = 'New Moon';         emoji = '🌑'; }

  return { phase, name, emoji, illumination };
}

export function getDaysToNextFullMoon(): number {
  const SYNODIC_PERIOD = 29.53058867;
  const KNOWN_NEW_MOON_MS = 947182440000;
  const elapsed = Date.now() - KNOWN_NEW_MOON_MS;
  const SYNODIC_MS = SYNODIC_PERIOD * 24 * 60 * 60 * 1000;
  const phase = ((elapsed % SYNODIC_MS) / SYNODIC_MS + 1) % 1;
  const daysToFull = phase < 0.5
    ? (0.5 - phase) * SYNODIC_PERIOD
    : (1.5 - phase) * SYNODIC_PERIOD;
  return Math.round(daysToFull);
}

// ─────────────────────────────────────────────────────────────────────
// VOICE TIMER — Web Speech API
// Recognises: "start [N] minute session", "stop", "pause", "zen mode"
// ─────────────────────────────────────────────────────────────────────
export interface VoiceCommand {
  type: 'start' | 'pause' | 'reset' | 'zen' | 'theme' | 'unknown';
  minutes?: number;
  themeName?: string;
  raw: string;
}

let _voiceActive = false;
let _voiceRecog: any = null;

export function isVoiceActive() { return _voiceActive; }

export function parseVoiceCommand(transcript: string): VoiceCommand {
  const s = transcript.toLowerCase().trim();

  // "start [N] minute[s]" | "start session" | "begin"
  const startMatch = s.match(/(?:start|begin|go)(?:\s+(?:a\s+)?(\d+)(?:\s*-?\s*minute|\s*min))?/);
  if (startMatch) {
    return { type: 'start', minutes: startMatch[1] ? parseInt(startMatch[1]) : undefined, raw: s };
  }
  if (/(?:stop|pause|hold|wait)/.test(s)) return { type: 'pause', raw: s };
  if (/(?:reset|restart|cancel)/.test(s)) return { type: 'reset', raw: s };
  if (/zen/.test(s)) return { type: 'zen', raw: s };

  // "switch to [theme]" | "use [theme] theme"
  const themeMatch = s.match(/(?:switch to|use|activate|show)\s+(.+?)(?:\s+theme)?$/);
  if (themeMatch) return { type: 'theme', themeName: themeMatch[1].trim(), raw: s };

  return { type: 'unknown', raw: s };
}

export function initVoiceTimer(onCommand: (cmd: VoiceCommand) => void, onStateChange: (active: boolean) => void) {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return false;

  _voiceRecog = new SR();
  _voiceRecog.continuous = false;
  _voiceRecog.interimResults = false;
  _voiceRecog.lang = 'en-US';

  _voiceRecog.onresult = (e: any) => {
    const transcript = e.results[0]?.[0]?.transcript ?? '';
    if (transcript) onCommand(parseVoiceCommand(transcript));
  };
  _voiceRecog.onerror = () => { _voiceActive = false; onStateChange(false); };
  _voiceRecog.onend   = () => { _voiceActive = false; onStateChange(false); };
  return true;
}

export function startVoiceListening() {
  if (!_voiceRecog || _voiceActive) return;
  try { _voiceRecog.start(); _voiceActive = true; } catch { _voiceActive = false; }
}

export function stopVoiceListening() {
  if (!_voiceRecog || !_voiceActive) return;
  try { _voiceRecog.stop(); } catch {}
  _voiceActive = false;
}

// ─────────────────────────────────────────────────────────────────────
// SMART BREAK CALCULATOR
// Uses: session duration, distraction count, velocity score, pomodoro phase
// Outputs: recommended break minutes with reasoning
// ─────────────────────────────────────────────────────────────────────
export interface SmartBreakResult {
  minutes: number;
  reason: string;
  activity: string;
}

const BREAK_ACTIVITIES_SHORT = [
  'Look 20 feet away for 20 seconds', 'Drink a glass of water', 'Stand and stretch your neck',
  'Roll your shoulders 5 times each direction', 'Take 5 deep breaths', 'Walk to another room and back',
];
const BREAK_ACTIVITIES_LONG = [
  'Go for a 10-minute walk outside', 'Make tea or coffee mindfully', 'Do 10 minutes of light stretching',
  'Step outside for fresh air', 'Eat a snack away from your desk', 'Do a short meditation or breathing exercise',
];

export function calcSmartBreak(
  sessionMinutes: number,
  distractionCount: number,
  velocityScore: number, // 0-100
  isPomodoroMode: boolean
): SmartBreakResult {
  // Base break from session length
  let base = sessionMinutes >= 90 ? 20
           : sessionMinutes >= 50 ? 10
           : sessionMinutes >= 25 ? 5
           : 3;

  // Distraction penalty — more distractions = slightly longer recovery
  const distractionBonus = Math.min(5, Math.floor(distractionCount / 2));

  // Velocity adjustment — low focus = slightly longer, high focus = shorter
  const velocityAdj = velocityScore >= 80 ? -2 : velocityScore <= 30 ? 3 : 0;

  let minutes = Math.max(3, base + distractionBonus + velocityAdj);
  if (isPomodoroMode) minutes = minutes > 10 ? 15 : 5; // snap to Pom defaults

  let reason: string;
  if (distractionCount > 4) reason = `You had ${distractionCount} distractions — take a proper break`;
  else if (velocityScore >= 80) reason = 'Excellent focus — a short reset keeps you sharp';
  else if (sessionMinutes >= 90) reason = 'Long session — your brain needs a proper rest';
  else reason = `${sessionMinutes} minutes done — recharge for ${minutes} minutes`;

  const activities = minutes >= 10 ? BREAK_ACTIVITIES_LONG : BREAK_ACTIVITIES_SHORT;
  const activity = activities[Math.floor(Date.now() / 60000) % activities.length]!;

  return { minutes, reason, activity };
}
