// ── Easter Eggs & Secret Features ────────────────────────────────────
// All self-contained. Imported and initialised once in main.ts.

// ── 1. Konami Code → 8-bit theme ─────────────────────────────────────
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiIdx = 0;
let konamiActive = false;
type ThemeApplier  = (id: string) => void;
type ToastFn       = (msg: string, dur?: number) => void;
type SoundPlayer   = (id: string) => void;

let _applyThemeById: ThemeApplier  = () => {};
let _showToast:      ToastFn       = () => {};
let _playChiptune:   (() => void)  = () => {};

export function initEaster(applyById: ThemeApplier, toast: ToastFn, chiptune: () => void) {
  _applyThemeById = applyById;
  _showToast      = toast;
  _playChiptune   = chiptune;
  setupKonami();
  setupKeywordDetector();
  setupTripleClick();
  setupMidnightWatch();
  setupDeviceShake();
  setupHyperfocusHold();
  setupUTCPillSecret();
  check100Sessions();
}

function setupKonami() {
  window.addEventListener('keydown', e => {
    if (e.key === KONAMI[konamiIdx]) {
      konamiIdx++;
      if (konamiIdx === KONAMI.length) {
        konamiIdx = 0;
        konamiActive = !konamiActive;
        if (konamiActive) {
          _applyThemeById('8bit');
          _showToast('👾 8-bit mode activated!', 4000);
          _playChiptune();
        } else {
          _applyThemeById('aurora');
          _showToast('8-bit mode off', 2000);
        }
      }
    } else {
      konamiIdx = 0;
    }
  });
}

// ── 2. Keyword detector (type "matrix", "heisenberg", etc.) ───────────
let typedBuffer = '';
let typedTimer  = 0;

const KEYWORD_ACTIONS: Record<string, () => void> = {
  'matrix':      () => { triggerMatrixRain(); _showToast('💊 Wake up, Neo…', 3000); },
  'heisenberg':  () => { triggerThemeEasterEgg('breakingbad', '⚗️ You\'re goddamn right.'); },
  'winchester':  () => { triggerThemeEasterEgg('supernatural', '🔥 The Road So Far…'); },
  'redjohn':     () => { triggerThemeEasterEgg('mentalist', '🔴 He\'s been here.'); },
  'bada bing':   () => { triggerThemeEasterEgg('sopranos', '🥃 Bada bing.'); },
  'winden':      () => { triggerThemeEasterEgg('dark', '⏳ Sic Mundus Creatus Est.'); },
  'fncs':        () => { triggerThemeEasterEgg('severance', '🏢 We hope your time here is… agreeable.'); },
  'interstellar':() => { triggerThemeEasterEgg('interstellar', '🌌 Do not go gentle.'); },
  'spice':       () => { triggerThemeEasterEgg('dune', '🏜️ The spice must flow.'); },
  'inception':   () => { triggerDreamSpin(); },
  'godfather':   () => { triggerThemeEasterEgg('godfather', '🌹 Leave the gun. Take the cannoli.'); },
  'mrrobot':     () => { triggerThemeEasterEgg('mrrobot', '💻 Hello, friend.'); },
  'fsociety':    () => { triggerThemeEasterEgg('mrrobot', '💻 fsociety — we are finally free.'); },
  'oppenheimer': () => { triggerThemeEasterEgg('oppenheimer', '☢️ Now I am become Death.'); },
  'thebear':     () => { triggerThemeEasterEgg('thebear', '🍳 Yes, chef!'); },
  'nightcity':   () => { triggerThemeEasterEgg('cyberpunk', '🌆 Wake the f*** up, Samurai.'); },
  'samurai':     () => { triggerCyberpunkGlitch(); },
  'hal':         () => { triggerHALEasterEgg(); },
  'daisy':       () => { triggerHALSong(); },
  'dont try':    () => { triggerThemeEasterEgg('tenet', '⏪ Don\'t try to understand it.'); },
  'tenet':       () => { triggerTenetReverse(); },
  'dracarys':    () => { triggerThemeEasterEgg('dragonfire', '🐉 Dracarys.'); },
  'targaryen':   () => { triggerThemeEasterEgg('dragonfire', '🐉 Fire and Blood.'); },
  'khonshu':     () => { triggerThemeEasterEgg('moonknight', '🌙 The Moon\'s light reveals hidden truth.'); },
  'moonknight':  () => { triggerThemeEasterEgg('moonknight', '🌙 I am the Fist of Khonshu.'); },
  'luffy':       () => { triggerThemeEasterEgg('onepiece', '🏴‍☠️ I\'m going to be King of the Pirates!'); },
  'onepiece':    () => { triggerOnePieceEgg(); },
  'gomu gomu':   () => { triggerThemeEasterEgg('onepiece', '🏴‍☠️ Gomu Gomu no… PISTOL!'); },
  'dedicate':    () => { triggerThemeEasterEgg('attackontitan', '⚔️ DEDICATE YOUR HEART!'); },
  'eren':        () => { triggerThemeEasterEgg('attackontitan', '⚔️ I\'ll keep moving forward until my enemies are destroyed.'); },
  'lightyagami': () => { triggerDeathNoteEgg(); },
  'kira':        () => { triggerThemeEasterEgg('deathnote', '📓 I am justice. I am the god of the new world.'); },
  'potato chip': () => { triggerThemeEasterEgg('deathnote', '📓 I\'ll take a potato chip… and eat it!'); },
  'hailmary':    () => { triggerThemeEasterEgg('hailmary',   '🌟 My name is Ryland Grace. And I might be the only hope for my species.'); },
  'ryland':      () => { triggerThemeEasterEgg('hailmary',   '🌟 I\'m not dead. That\'s a good start.'); },
  'rocky':       () => { triggerThemeEasterEgg('hailmary', '🌟 ...That\'s not a name. That\'s a species description.'); },
  'shinji':      () => { triggerThemeEasterEgg('evangelion', '⚠️ I mustn\'t run away. I mustn\'t run away.'); },
  'nerv':        () => { triggerEvaAlert(); },
  'kaneda':      () => { triggerThemeEasterEgg('akira', '🏍 KANEDA!'); },
  'tetsuo':      () => { triggerAkiraBlast(); },
};

function setupKeywordDetector() {
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length === 1) typedBuffer = (typedBuffer + e.key.toLowerCase()).slice(-15);
    clearTimeout(typedTimer);
    typedTimer = window.setTimeout(() => { typedBuffer = ''; }, 2000);
    for (const keyword of Object.keys(KEYWORD_ACTIONS)) {
      if (typedBuffer.endsWith(keyword)) {
        typedBuffer = '';
        KEYWORD_ACTIONS[keyword]?.();
        break;
      }
    }
  });
}

function triggerThemeEasterEgg(themeId: string, msg: string) {
  _applyThemeById(themeId);
  _showToast(msg, 4000);
  flashScreen();
}

// ── Cyberpunk: full-screen RGB glitch ────────────────────────────────
function triggerCyberpunkGlitch() {
  _applyThemeById('cyberpunk');
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;pointer-events:none;';
  document.body.appendChild(overlay);
  let frame = 0;
  const interval = setInterval(() => {
    // Clear previous lines safely — no innerHTML
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
    const lines = 8 + Math.floor(Math.random() * 12);
    for (let i = 0; i < lines; i++) {
      const bar = document.createElement('div');
      const y = Math.random() * 100;
      const h = Math.random() * 3 + 1;
      const shift = (Math.random() - 0.5) * 30;
      const col = Math.random() > 0.5 ? '#ff0090' : '#00eeff';
      const op  = (0.15 + Math.random() * 0.2).toFixed(3);
      bar.style.cssText = `position:absolute;top:${y.toFixed(2)}%;left:${shift.toFixed(1)}px;right:${(-shift).toFixed(1)}px;height:${h.toFixed(1)}px;background:${col};opacity:${op};pointer-events:none;`;
      overlay.appendChild(bar);
    }
    if (++frame > 18) { clearInterval(interval); overlay.remove(); }
  }, 60);
  _showToast('🌆 Wake the f*** up, Samurai.', 4000);
}

// ── HAL 9000: "I'm sorry Dave" overlay ──────────────────────────────
function triggerHALEasterEgg() {
  _applyThemeById('hal9000');
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.9);
    display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;
    animation:halFadeIn .8s ease forwards;cursor:pointer;
  `;
  const msg = document.createElement('div');
  msg.style.cssText = `color:#cc0000;font-family:'Orbitron',monospace;font-size:clamp(1rem,3vw,2rem);font-weight:900;text-align:center;letter-spacing:.1em;text-shadow:0 0 30px #cc0000;`;
  msg.textContent = "I'm sorry, Dave.";
  const sub = document.createElement('div');
  sub.style.cssText = `color:#cc000088;font-family:'Orbitron',monospace;font-size:clamp(.6rem,1.5vw,1rem);letter-spacing:.15em;`;
  sub.textContent = "I'M AFRAID I CAN'T DO THAT.";
  overlay.append(msg, sub);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', () => overlay.remove());
  setTimeout(() => overlay.remove(), 5000);
  _showToast('🔴 HAL 9000 activated. Click to dismiss.', 5500);
}

// ── HAL: sing Daisy ──────────────────────────────────────────────────
function triggerHALSong() {
  _applyThemeById('hal9000');
  const lines = ['Daisy…', 'Daisy…', 'Give me your answer do…', 'I\'m half crazy…', 'All for the love of you…'];
  let i = 0;
  const show = () => { if (i < lines.length) { _showToast(`🔴 ${lines[i++]}`, 1800); setTimeout(show, 2000); } };
  show();
}

// ── Tenet: reverse the clock display briefly ─────────────────────────
function triggerTenetReverse() {
  _applyThemeById('tenet');
  document.body.classList.add('tenet-reverse');
  _showToast('⏪ What\'s happened, happened.', 4000);
  setTimeout(() => document.body.classList.remove('tenet-reverse'), 5000);
}

// ── Evangelion: NERV alert screen ────────────────────────────────────
function triggerEvaAlert() {
  _applyThemeById('evangelion');
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;pointer-events:none;';
  document.body.appendChild(overlay);
  let frame = 0;
  const interval = setInterval(() => {
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
    if (frame % 6 < 3) {
      const bar = document.createElement('div');
      bar.style.cssText = `position:absolute;inset:0;background:rgba(200,0,0,${0.08 + Math.random() * 0.06});`;
      overlay.appendChild(bar);
      // NERV text
      const txt = document.createElement('div');
      txt.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:monospace;font-size:clamp(.6rem,1.5vw,.9rem);color:#ff4400;opacity:.6;letter-spacing:.2em;text-align:center;white-space:nowrap;';
      txt.textContent = '⚠ PATTERN BLUE DETECTED ⚠';
      overlay.appendChild(txt);
    }
    if (++frame > 24) { clearInterval(interval); overlay.remove(); }
  }, 80);
  _showToast('⚠️ Pattern Blue detected. Evangelion Unit-01, launch!', 5000);
}

// ── Akira: psychic blast screen shake ────────────────────────────────
function triggerAkiraBlast() {
  _applyThemeById('akira');
  document.body.style.transition = 'transform .06s';
  let frame = 0;
  const shakes = [[-4,2],[4,-3],[-3,-4],[3,3],[-2,4],[2,-2],[0,0]];
  const interval = setInterval(() => {
    const s = shakes[frame % shakes.length]!;
    document.body.style.transform = `translate(${s[0]}px,${s[1]}px)`;
    if (++frame > 14) {
      clearInterval(interval);
      document.body.style.transform = '';
      setTimeout(() => { document.body.style.transition = ''; }, 200);
    }
  }, 40);
  _showToast('🏍 The power of Akira awakens!', 4000);
}

// ── One Piece: Luffy scream effect ────────────────────────────────────
function triggerOnePieceEgg() {
  _applyThemeById('onepiece');
  // Flash the screen yellow then back
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;background:#ffcc00;z-index:9999;pointer-events:none;animation:eggFlash .6s ease forwards;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 700);
  _showToast('🏴‍☠️ "I\'m gonna be King of the Pirates!" — Luffy', 5000);
}

// ── Death Note: L solves your session ────────────────────────────────
function triggerDeathNoteEgg() {
  _applyThemeById('deathnote');
  const lines = [
    'L speaking.',
    'I\'ve been observing your sessions.',
    `You have completed ${JSON.parse(localStorage.getItem('sc_focus_log')||'[]').length} sessions.`,
    'Productivity level: Kira-tier.',
    '...I\'ll take the case.',
  ];
  let i = 0;
  const show = () => { if (i < lines.length) { _showToast(`🍰 ${lines[i++]}`, 2200); setTimeout(show, 2400); } };
  show();
}

function flashScreen() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:9999;pointer-events:none;animation:eggFlash .5s ease forwards;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

// ── Matrix rain overlay ───────────────────────────────────────────────
let matrixRainActive = false;
export function triggerMatrixRain() {
  if (matrixRainActive) return;
  matrixRainActive = true;
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;z-index:888;pointer-events:none;opacity:0;transition:opacity .4s;';
  cv.width  = window.innerWidth;
  cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d')!;
  const cols = Math.floor(cv.width / 14);
  const drops = new Array(cols).fill(1);
  requestAnimationFrame(() => cv.style.opacity = '1');
  const chars = '田由甲申甴电甶男甸甹町画甼甽甾甿畀ABCDEFabcdef0123456789';
  let frame = 0;
  const raf = setInterval(() => {
    ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(0,0,cv.width,cv.height);
    ctx.fillStyle = '#00ee00'; ctx.font = '13px monospace';
    drops.forEach((y, i) => {
      const ch = chars[Math.floor(Math.random() * chars.length)]!;
      ctx.fillText(ch, i * 14, y * 14);
      if (y * 14 > cv.height && Math.random() > .975) drops[i] = 0;
      else drops[i] = y + 1;
    });
    if (++frame > 300) {
      clearInterval(raf);
      cv.style.opacity = '0';
      setTimeout(() => { cv.remove(); matrixRainActive = false; }, 500);
    }
  }, 33);
}

function triggerDreamSpin() {
  _showToast('🌀 "You\'re waiting for a train…"', 5000);
  document.body.style.transition = 'transform 1.2s cubic-bezier(.65,0,.35,1)';
  document.body.style.transform  = 'rotate(360deg)';
  setTimeout(() => {
    document.body.style.transform  = '';
    setTimeout(() => document.body.style.transition = '', 1500);
  }, 1300);
}

// ── 3. Triple-click clock → dev console ──────────────────────────────
let clickCount = 0; let clickTimer = 0;

function setupTripleClick() {
  const clockEl = document.getElementById('clock-block-wrap') ??
                  document.getElementById('mainUI');
  if (!clockEl) return;
  clockEl.addEventListener('click', () => {
    clickCount++;
    clearTimeout(clickTimer);
    if (clickCount >= 3) {
      clickCount = 0;
      openDevConsole();
    } else {
      clickTimer = window.setTimeout(() => { clickCount = 0; }, 500);
    }
  });
}

function openDevConsole() {
  const existing = document.getElementById('devConsole');
  if (existing) { existing.remove(); return; }
  const fps = (window as any).__scFps?.() ?? 0;
  const tier = (window as any).__scTier?.() ?? '?';
  const lsSize = JSON.stringify(localStorage).length;
  const audioNodes = (window as any).__scAudioNodes?.() ?? '?';
  const panel = document.createElement('div');
  panel.id = 'devConsole';
  panel.style.cssText = `
    position:fixed;bottom:80px;right:16px;z-index:9000;
    background:rgba(0,0,0,.92);color:#00ff41;font-family:monospace;
    font-size:.65rem;padding:14px 18px;border-radius:10px;line-height:1.9;
    border:1px solid #00ff4133;backdrop-filter:blur(12px);
    animation:fadeUp .3s ease;min-width:220px;
  `;
  const rows: [string, string | number][] = [
    ['🎯 Render tier', tier.toUpperCase()],
    ['📊 FPS',         fps],
    ['🔊 Audio nodes', audioNodes],
    ['💾 localStorage', `${(lsSize/1024).toFixed(1)} KB`],
    ['🎨 Themes',      (window as any).__scThemeCount?.() ?? '?'],
    ['📋 Sessions',    JSON.parse(localStorage.getItem('sc_focus_log')||'[]').length],
    ['🔥 Streak',      `${JSON.parse(localStorage.getItem('sc_streak')||'{"current":0}').current} days`],
  ];

  rows.forEach(([label, value]) => {
    const line = document.createElement('div');
    line.style.cssText = 'display:flex;gap:8px;justify-content:space-between;min-width:200px;';
    const lbl = document.createElement('span'); lbl.style.opacity = '0.55'; lbl.textContent = String(label);
    const val = document.createElement('span'); val.style.color = '#00ff41'; val.textContent = String(value);
    line.append(lbl, val);
    panel.appendChild(line);
  });

  const hint = document.createElement('div');
  hint.style.cssText = 'opacity:.35;font-size:.55rem;margin-top:6px;text-align:center;';
  hint.textContent = 'click clock again to close';
  panel.appendChild(hint);
  document.body.appendChild(panel);
}

// ── 4. Midnight confetti ──────────────────────────────────────────────
function setupMidnightWatch() {
  const checkMidnight = () => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 0) {
      fireConfetti();
      _showToast('✨ Happy New Day!', 5000);
    }
  };
  // Check every second via the main clock tick — expose via window
  (window as any).__checkMidnight = checkMidnight;
}

export function fireConfetti() {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;z-index:999;pointer-events:none;';
  cv.width  = window.innerWidth;
  cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d')!;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--clr-accent').trim() || '#6ee7b7';
  const colours = [accent, '#f472b6', '#fbbf24', '#60a5fa', '#a78bfa', '#34d399'];
  const particles = Array.from({ length: 120 }, () => ({
    x: Math.random() * cv.width,
    y: -10 - Math.random() * 100,
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 4,
    rot: Math.random() * Math.PI * 2,
    rotV: (Math.random() - 0.5) * 0.2,
    w: 6 + Math.random() * 8,
    h: 3 + Math.random() * 5,
    col: colours[Math.floor(Math.random() * colours.length)]!,
    alpha: 1,
  }));
  let frame = 0;
  const raf = requestAnimationFrame(function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
      p.vy *= 1.01; p.alpha = Math.max(0, 1 - frame / 140);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.col; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    });
    if (++frame < 150) requestAnimationFrame(draw);
    else cv.remove();
  });
  void raf;
}

// ── 5. Device shake → random theme ───────────────────────────────────
let lastShake = 0;
let lastAcc = { x: 0, y: 0, z: 0 };

function setupDeviceShake() {
  if (!('DeviceMotionEvent' in window)) return;
  window.addEventListener('devicemotion', (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const dx = Math.abs((a.x ?? 0) - lastAcc.x);
    const dy = Math.abs((a.y ?? 0) - lastAcc.y);
    const dz = Math.abs((a.z ?? 0) - lastAcc.z);
    lastAcc = { x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 };
    if (dx + dy + dz > 30 && Date.now() - lastShake > 2000) {
      lastShake = Date.now();
      (window as any).__scRandomTheme?.();
      _showToast('🎲 Theme shuffled!', 2500);
    }
  });
}

// ── 6. Hyperfocus hold (hold session timer 3s) ────────────────────────
let holdTimer = 0; let holdActive = false;

function setupHyperfocusHold() {
  const btn = document.getElementById('sessionTimer');
  if (!btn) return;
  const startHold = () => {
    holdTimer = window.setTimeout(() => {
      holdActive = !holdActive;
      document.body.classList.toggle('hyperfocus', holdActive);
      _showToast(holdActive ? '🧘 Hyperfocus — press Escape to exit' : 'Hyperfocus off', 3000);
    }, 3000);
  };
  const cancelHold = () => clearTimeout(holdTimer);
  btn.addEventListener('mousedown',  startHold);
  btn.addEventListener('touchstart', startHold, { passive: true });
  btn.addEventListener('mouseup',    cancelHold);
  btn.addEventListener('touchend',   cancelHold);
  btn.addEventListener('mouseleave', cancelHold);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && holdActive) {
      holdActive = false;
      document.body.classList.remove('hyperfocus');
    }
  });
}

// ── 7. UTC pill 7× → Sidereal Time ────────────────────────────────────
let utcClickCount = 0; let utcClickTimer = 0;
let siderealMode = false;

function setupUTCPillSecret() {
  const pill = document.getElementById('utcPill');
  if (!pill) return;
  pill.addEventListener('click', () => {
    utcClickCount++;
    clearTimeout(utcClickTimer);
    if (utcClickCount >= 7) {
      utcClickCount = 0;
      siderealMode = !siderealMode;
      pill.title = siderealMode ? 'Local Sidereal Time — astronomical measure' : '';
      _showToast(siderealMode ? '🔭 Sidereal time mode — for astronomers' : 'UTC mode restored', 3500);
    }
    utcClickTimer = window.setTimeout(() => { utcClickCount = 0; }, 1500);
  });
}

export function isSiderealMode() { return siderealMode; }

export function getSiderealTime(lat: number): string {
  // Greenwich Mean Sidereal Time calculation
  const now    = new Date();
  const J2000  = new Date('2000-01-01T12:00:00Z');
  const D      = (now.getTime() - J2000.getTime()) / 86400000; // days since J2000
  const GMST_h = (18.697374558 + 24.06570982441908 * D) % 24;
  const LMST_h = ((GMST_h + lat / 15) % 24 + 24) % 24;
  const h = Math.floor(LMST_h);
  const m = Math.floor((LMST_h - h) * 60);
  const s = Math.floor(((LMST_h - h) * 60 - m) * 60);
  return `🔭 ${String(h).padStart(2,'0')}ʰ${String(m).padStart(2,'0')}ᵐ${String(s).padStart(2,'0')}ˢ`;
}

// ── 8. 100 sessions → Phoenix unlock ──────────────────────────────────
function check100Sessions() {
  const sessions = (() => { try { return JSON.parse(localStorage.getItem('sc_focus_log')||'[]').length; } catch { return 0; } })();
  if (sessions >= 100 && !localStorage.getItem('sc_phoenix_unlocked')) {
    localStorage.setItem('sc_phoenix_unlocked', '1');
    setTimeout(() => {
      _showToast('🔥 100 sessions! Phoenix theme unlocked — check the shop!', 6000);
    }, 2000);
  }
}

export function isPhoenixUnlocked(): boolean {
  return localStorage.getItem('sc_phoenix_unlocked') === '1' ||
    ((() => { try { return JSON.parse(localStorage.getItem('sc_focus_log')||'[]').length >= 100; } catch { return false; } })());
}
