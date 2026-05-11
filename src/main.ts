import type { Theme } from './types';
import { THEMES, THEME_BY_ID, THEMES_BY_CAT, NAT_QUOTES } from './themes';
import { LIT_CLOCK } from './litclock';
import { p2, p3, fmtSession, DAYS, MONTHS, GREETS } from './utils';
import { clockOffset, synced, syncTime, setSyncHandler } from './timesync';
import { initWeather, stopWeather, isRaining, isSnowing, isClear } from './weather';
import * as Sound from './sound';
import * as Pom from './pomodoro';
import * as Log from './focuslog';
import { resize, buildParticles, drawBg, runTransition, setBreathing, setParallax, invalidateCache } from './renderer';
import { drawQR } from './qr';
import * as Intel from './intelligence';
import { generateShareCard } from './share';
import { initPerf, getTier, setTier, tickFps, getFps, isTabVisible, type QualityTier } from './perf';
import * as APIs from './apis';
import * as Privacy from './privacy';
import * as Easter from './easter';
import * as Cmd from './cmdpalette';
import * as Features from './features';
import * as Integrations from './integrations';
import { t, setLocale, getLocale, LOCALE_NAMES, LOCALE_FLAGS, type Locale } from './i18n';
import * as Palette from './palette';

// ── Clock mode ────────────────────────────────────────────────────────
export type ClockMode = 'digital' | 'analogue' | 'flip' | 'word' | 'minimal' | 'segment';
let clockMode: ClockMode = (localStorage.getItem('sc_clock_mode') as ClockMode) || 'digital';
function setClockMode(m: ClockMode) {
  clockMode = m;
  localStorage.setItem('sc_clock_mode', m);
  updateClockModeDOM();
}
function updateClockModeDOM() {
  const cb = document.getElementById('clock-block-wrap');
  if (cb) cb.dataset.mode = clockMode;
  document.querySelectorAll('.clock-mode-btn').forEach(b => {
    (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset.mode === clockMode);
  });
}

// ── SVG Logos ─────────────────────────────────────────────────────────
const LOGOS: Record<string, string> = {
  supernatural: `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#1a0800"/><path d="M6 17L16 5L26 17" stroke="#e05500" stroke-width="1.5" fill="none"/><path d="M10 17L16 9L22 17" stroke="#ff9944" stroke-width="1" fill="none" opacity=".6"/><circle cx="16" cy="14" r="2" fill="#e05500" opacity=".8"/></svg>`,
  mentalist:    `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#180800"/><circle cx="16" cy="11" r="7" stroke="#cc1100" stroke-width="1.2" fill="none"/><circle cx="13" cy="9.5" r="1.2" fill="#cc1100"/><circle cx="19" cy="9.5" r="1.2" fill="#cc1100"/><path d="M12 14Q16 17 20 14" stroke="#cc1100" stroke-width="1.2" fill="none"/></svg>`,
  sopranos:     `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#080808"/><rect x="4" y="6" width="24" height="10" rx="1" stroke="#c8a000" stroke-width="1" fill="none" opacity=".7"/><text x="16" y="14.5" text-anchor="middle" fill="#c8a000" font-size="6" font-family="Georgia,serif" font-weight="700">TS</text></svg>`,
  dark:         `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#000004"/><circle cx="16" cy="11" r="8" stroke="#4488cc" stroke-width=".8" fill="none" opacity=".5"/><circle cx="16" cy="11" r="5" stroke="#4488cc" stroke-width=".6" fill="none" opacity=".35"/><circle cx="16" cy="11" r="2" fill="#4488cc" opacity=".7"/></svg>`,
  breakingbad:  `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#040900"/><text x="4" y="10" fill="#7ec800" font-size="7.5" font-family="Arial,sans-serif" font-weight="900">Br</text><text x="4" y="19" fill="#b8f040" font-size="6" font-family="Arial,sans-serif" font-weight="700" letter-spacing="2">BAD</text></svg>`,
  strangerthings:`<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#04000e"/><text x="16" y="9" text-anchor="middle" fill="#cc44ff" font-size="5.5" font-family="Georgia,serif" font-weight="700" letter-spacing="-.5">STRANGER</text><text x="16" y="17" text-anchor="middle" fill="#ee88ff" font-size="5.5" font-family="Georgia,serif" font-weight="700" letter-spacing="-.5">THINGS</text></svg>`,
  interstellar: `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#000305"/><circle cx="16" cy="11" r="6" fill="none" stroke="#4499ee" stroke-width=".8" opacity=".6"/><ellipse cx="16" cy="11" rx="9" ry="2.5" fill="none" stroke="#88ccff" stroke-width=".7" opacity=".4"/><circle cx="16" cy="11" r="1.2" fill="#4499ee" opacity=".6"/></svg>`,
  dune:         `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#1a1000"/><path d="M2 16Q8 8 16 10Q24 12 30 6" stroke="#d4a020" stroke-width="1.2" fill="none" opacity=".7"/><text x="16" y="21" text-anchor="middle" fill="#d4a020" font-size="4.5" font-family="Georgia,serif" letter-spacing="3" opacity=".8">DUNE</text></svg>`,
  matrix:       `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#000a00"/><text x="4" y="8" fill="#00ee00" font-size="5" font-family="monospace" opacity=".9">10110</text><text x="4" y="14" fill="#00ee00" font-size="5" font-family="monospace" opacity=".6">01001</text><text x="24.5" y="13" text-anchor="middle" fill="#00ee00" font-size="7" font-family="monospace" font-weight="700">M</text></svg>`,
  bladerunner:  `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#0a0500"/><rect x="2" y="14" width="28" height="6" fill="#050200"/><path d="M2 5L5 2L27 2L30 5" stroke="#e87020" stroke-width=".6" fill="none" opacity=".5"/></svg>`,
  inception:    `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#060608"/><circle cx="16" cy="11" r="9" stroke="#9090ee" stroke-width=".6" fill="none" opacity=".35"/><circle cx="16" cy="11" r="5" stroke="#9090ee" stroke-width=".6" fill="none" opacity=".3"/><circle cx="16" cy="11" r="1.5" fill="#9090ee" opacity=".6"/></svg>`,
  godfather:    `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#050500"/><path d="M16 4Q10 8 10 12Q10 17 16 18Q22 17 22 12Q22 8 16 4Z" fill="none" stroke="#b09040" stroke-width=".8" opacity=".6"/></svg>`,
  redbull:      `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#1c1f26"/><text x="16" y="10" text-anchor="middle" fill="#e8002d" font-size="5" font-family="Arial Black,sans-serif" font-weight="900">RED BULL</text><text x="16" y="17" text-anchor="middle" fill="#1e41ff" font-size="3.8" font-family="Arial,sans-serif" font-weight="700" letter-spacing="1">RACING</text></svg>`,
  ferrari:      `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#dc0000"/><text x="16" y="13" text-anchor="middle" fill="#ffed00" font-size="8" font-family="Arial Black,sans-serif" font-weight="900">SF</text></svg>`,
  mercedes:     `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#00d2be"/><text x="16" y="13" text-anchor="middle" fill="#fff" font-size="5" font-family="Arial Black,sans-serif" font-weight="900" letter-spacing=".5">AMG</text><path d="M16 5 L19 9 L16 8 L13 9 Z" fill="white" opacity=".9"/></svg>`,
  mclaren:      `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#ff8000"/><path d="M3 11 Q16 4 29 11 Q16 18 3 11Z" fill="#c86000" opacity=".7"/><text x="16" y="13" text-anchor="middle" fill="white" font-size="5.5" font-family="Arial Black,sans-serif" font-weight="900">MCL</text></svg>`,
  astonmartin:  `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#006f62"/><path d="M8 14 Q16 6 24 14" stroke="#cedc00" stroke-width="1.5" fill="none"/><text x="16" y="19" text-anchor="middle" fill="#cedc00" font-size="3.5" font-family="Arial,sans-serif" font-weight="700" letter-spacing=".5">ASTON MARTIN</text></svg>`,
  severance:    `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#000408"/><rect x="2" y="9" width="28" height="4" rx=".5" fill="#0088cc" opacity=".15"/><text x="16" y="12.5" text-anchor="middle" fill="#0088cc" font-size="5.5" font-family="'Josefin Sans',Arial,sans-serif" font-weight="300" letter-spacing="3" opacity=".9">LUMON</text><line x1="2" y1="16" x2="30" y2="16" stroke="#0088cc" stroke-width=".4" opacity=".3"/></svg>`,
  blueprint:    `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#040d1a"/><line x1="4" y1="4" x2="28" y2="4" stroke="#00cfff" stroke-width=".6" opacity=".4"/><line x1="4" y1="11" x2="28" y2="11" stroke="#00cfff" stroke-width=".6" opacity=".4"/><line x1="4" y1="18" x2="28" y2="18" stroke="#00cfff" stroke-width=".6" opacity=".4"/><line x1="4" y1="4" x2="4" y2="18" stroke="#00cfff" stroke-width=".6" opacity=".4"/><line x1="16" y1="4" x2="16" y2="18" stroke="#00cfff" stroke-width=".6" opacity=".4"/><line x1="28" y1="4" x2="28" y2="18" stroke="#00cfff" stroke-width=".6" opacity=".4"/><circle cx="16" cy="11" r="4" stroke="#00cfff" stroke-width="1" fill="none" opacity=".9"/><line x1="12" y1="11" x2="20" y2="11" stroke="#00cfff" stroke-width=".7" opacity=".7"/><line x1="16" y1="7" x2="16" y2="15" stroke="#00cfff" stroke-width=".7" opacity=".7"/></svg>`,
  commonroom:   `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#0d0603"/><path d="M6 18 Q10 8 16 12 Q22 8 26 18" stroke="#e07030" stroke-width="1.2" fill="rgba(200,60,10,.3)"/><circle cx="16" cy="10" r="2.5" fill="#e8a040" opacity=".8"/><path d="M13 14 Q16 10 19 14" stroke="#ff8020" stroke-width=".8" fill="none" opacity=".6"/></svg>`,
  smpte:        `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#0d0d0d"/><rect x="2" y="14" width="28" height="5" rx=".5" fill="#222"/><rect x="14" y="11" width="2" height="9" fill="#e94560" opacity=".9"/><line x1="2" y1="14" x2="30" y2="14" stroke="#444" stroke-width=".4"/><text x="16" y="9" text-anchor="middle" fill="#e94560" font-size="4" font-family="monospace" opacity=".8">TIMELINE</text></svg>`,
  terminal:     `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#000a00"/><text x="4" y="9" fill="#00ff41" font-size="4.5" font-family="monospace" opacity=".7">0f3a 88c1</text><text x="4" y="16" fill="#00ff41" font-size="4.5" font-family="monospace" opacity=".4">b72d 0044</text><rect x="25" y="11" width="2.5" height="5" fill="#00ff41" opacity=".9"/></svg>`,
  gameoflife:   `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#050a05"/><rect x="5" y="5" width="2" height="2" fill="#00e87a" opacity=".8"/><rect x="9" y="5" width="2" height="2" fill="#00e87a" opacity=".8"/><rect x="7" y="7" width="2" height="2" fill="#00e87a" opacity=".8"/><rect x="5" y="9" width="2" height="2" fill="#00e87a" opacity=".5"/><rect x="7" y="9" width="2" height="2" fill="#00e87a" opacity=".8"/><rect x="17" y="6" width="2" height="2" fill="#00e87a" opacity=".7"/><rect x="19" y="8" width="2" height="2" fill="#00e87a" opacity=".7"/><rect x="15" y="8" width="2" height="2" fill="#00e87a" opacity=".7"/><rect x="15" y="10" width="2" height="2" fill="#00e87a" opacity=".5"/><rect x="17" y="10" width="2" height="2" fill="#00e87a" opacity=".7"/></svg>`,
  cyberpunk:    `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#030010"/><rect x="2" y="14" width="28" height="6" fill="#060020" rx="1"/><rect x="3" y="4" width="6" height="8" fill="#0a0030" rx="1"/><rect x="12" y="5" width="4" height="7" fill="#0a0030" rx="1"/><rect x="20" y="3" width="8" height="9" fill="#0a0030" rx="1"/><rect x="5" y="7" width="1" height="1" fill="#ff0090" opacity=".9"/><rect x="14" y="6" width="1" height="1" fill="#00eeff" opacity=".9"/><rect x="22" y="5" width="1" height="2" fill="#ff0090" opacity=".8"/><text x="16" y="21" text-anchor="middle" fill="#ff0090" font-size="3.5" font-family="monospace" opacity=".7" letter-spacing="1">NIGHT CITY</text></svg>`,
  hal9000:      `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#000000"/><radialGradient id="halG" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ff0000"/><stop offset="60%" stop-color="#880000"/><stop offset="100%" stop-color="#330000"/></radialGradient><circle cx="16" cy="11" r="7" fill="url(#halG)"/><circle cx="13.5" cy="9" r="1.5" fill="rgba(255,200,200,.15)"/><circle cx="16" cy="11" r="2" fill="#cc0000" opacity=".5"/></svg>`,
  tenet:        `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#040408"/><text x="16" y="9" text-anchor="middle" fill="#8888ff" font-size="5" font-family="sans-serif" letter-spacing="2" opacity=".8">TENET</text><text x="16" y="18" text-anchor="middle" fill="#ff8800" font-size="5" font-family="sans-serif" letter-spacing="2" opacity=".5" transform="scale(-1,1) translate(-32,0)">TENET</text></svg>`,
  dragonfire:   `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#0e0200"/><path d="M10 18 Q12 10 16 8 Q20 10 22 18" fill="#e84000" opacity=".6"/><path d="M13 18 Q14 13 16 11 Q18 13 19 18" fill="#ffa020" opacity=".5"/><circle cx="16" cy="6" r="2.5" fill="#e84000" opacity=".4"/><path d="M11 8 Q13 5 16 4 Q19 5 21 8" fill="none" stroke="#ffa020" stroke-width=".8" opacity=".5"/></svg>`,
  moonknight:   `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#04060e"/><circle cx="21" cy="8" r="5.5" fill="#c8d8ff" opacity=".85"/><circle cx="24" cy="7" r="4.5" fill="#04060e"/><line x1="16" y1="14" x2="16" y2="20" stroke="#c8d8ff" stroke-width="1" opacity=".4"/><line x1="13" y1="16" x2="19" y2="16" stroke="#c8d8ff" stroke-width="1" opacity=".4"/><circle cx="16" cy="14" r="1.5" fill="none" stroke="#c8d8ff" stroke-width=".8" opacity=".4"/></svg>`,
  onepiece:     `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#000d1a"/><circle cx="16" cy="8" r="4" fill="#ffcc00" opacity=".9"/><path d="M4 16 Q8 12 16 14 Q24 12 28 16 L28 22 L4 22 Z" fill="#003d8f" opacity=".8"/><circle cx="8" cy="6" r="1.5" fill="#ffcc00" opacity=".5"/><circle cx="24" cy="6" r="1.5" fill="#ffcc00" opacity=".5"/></svg>`,
  attackontitan:`<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#0a0800"/><path d="M22 22 L26 8 L28 22" fill="#1a1400" stroke="#c8a000" stroke-width=".8"/><path d="M22 22 L20 14 L24 14 Z" fill="#c8a000" opacity=".6"/><path d="M24 14 L28 14 L26 8 Z" fill="#884400" opacity=".5"/><line x1="4" y1="10" x2="18" y2="10" stroke="#c8a000" stroke-width=".5" opacity=".3" stroke-dasharray="2 2"/></svg>`,
  deathnote:       `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#060006"/><rect x="8" y="3" width="16" height="16" rx="2" fill="#0c000c" stroke="#cc00cc" stroke-width=".8"/><text x="16" y="11" text-anchor="middle" font-size="5" fill="#cc00cc" font-family="serif" opacity=".8">死</text><text x="16" y="17" text-anchor="middle" font-size="3.5" fill="#880088" font-family="serif" opacity=".6">神</text></svg>`,
  hailmary:        `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#000a0f"/><circle cx="26" cy="4" r="3" fill="rgba(255,240,180,.7)"/><circle cx="16" cy="11" r="2" fill="#00e8a8" opacity=".8"/><circle cx="8" cy="14" r="1.5" fill="#00e8a8" opacity=".5"/><circle cx="22" cy="15" r="1" fill="#00b8ff" opacity=".6"/><circle cx="12" cy="7" r="1" fill="#00e8a8" opacity=".4"/><path d="M14 10 Q16 9 18 10 Q20 12 18 14 Q16 15 14 14 Q12 12 14 10Z" fill="rgba(0,230,160,.2)" stroke="#00e8a8" stroke-width=".5"/></svg>`,
  evangelion:      `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#0a0400"/><path d="M8 18 L16 3 L24 18 L20 18 L16 9 L12 18 Z" fill="#ff4400" opacity=".7"/><rect x="14" y="12" width="4" height="6" fill="#00cc44" opacity=".6"/><rect x="2" y="9" width="28" height="1" fill="#ff4400" opacity=".2"/></svg>`,
  akira:           `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#000008"/><circle cx="16" cy="11" r="8" fill="none" stroke="#ee0044" stroke-width=".8" opacity=".8"/><circle cx="16" cy="11" r="5" fill="none" stroke="#0044ff" stroke-width=".5" opacity=".5"/><circle cx="16" cy="11" r="2" fill="#ee0044" opacity=".8"/><text x="16" y="20" text-anchor="middle" font-size="3.5" fill="#ee0044" opacity=".6" font-family="sans-serif" letter-spacing="1">AKIRA</text></svg>`,
  bettercallsaul:  `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#0c0a00"/><rect x="4" y="6" width="24" height="12" rx="1.5" fill="none" stroke="#c8a800" stroke-width=".7" opacity=".7"/><text x="16" y="14" text-anchor="middle" font-size="5" fill="#c8a800" font-family="serif" font-weight="bold" opacity=".9">BCS</text><line x1="4" y1="11" x2="28" y2="11" stroke="#c8a800" stroke-width=".3" opacity=".3"/></svg>`,
  peakyblinders:   `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#080400"/><path d="M8 18 Q16 4 24 18" fill="none" stroke="#c87000" stroke-width="1.2" opacity=".8"/><line x1="6" y1="12" x2="26" y2="12" stroke="#c87000" stroke-width=".4" opacity=".4"/><circle cx="16" cy="10" r="3" fill="none" stroke="#f0a030" stroke-width=".6" opacity=".6"/><rect x="14" y="9" width="4" height="2" rx=".3" fill="#c87000" opacity=".5"/></svg>`,
  thewire:         `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#050505"/><line x1="4" y1="11" x2="28" y2="11" stroke="#889944" stroke-width="1" opacity=".8"/><circle cx="8" cy="11" r="2" fill="#889944" opacity=".7"/><circle cx="16" cy="11" r="2" fill="#889944" opacity=".7"/><circle cx="24" cy="11" r="2" fill="#889944" opacity=".7"/><text x="16" y="19" text-anchor="middle" font-size="3.5" fill="#889944" opacity=".5" font-family="sans-serif" letter-spacing=".5">THE WIRE</text></svg>`,
  succession:      `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#060606"/><rect x="6" y="5" width="20" height="14" rx="1" fill="none" stroke="#b09060" stroke-width=".6" opacity=".6"/><text x="16" y="14" text-anchor="middle" font-size="4.5" fill="#b09060" font-family="serif" font-weight="bold" opacity=".8">ROY</text><line x1="6" y1="8" x2="26" y2="8" stroke="#b09060" stroke-width=".3" opacity=".3"/></svg>`,
  lost:            `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#010810"/><circle cx="16" cy="9" r="6" fill="none" stroke="#2288cc" stroke-width=".7" opacity=".7"/><text x="16" y="12" text-anchor="middle" font-size="5" fill="#2288cc" font-family="sans-serif" font-weight="bold" opacity=".8">4</text><text x="7" y="19" text-anchor="middle" font-size="3" fill="#2288cc" opacity=".5" font-family="monospace">8 15 16 23 42</text></svg>`,
  shogun:          `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#060200"/><circle cx="24" cy="5" r="4" fill="none" stroke="#cc2200" stroke-width=".8" opacity=".8"/><circle cx="24" cy="5" r="2" fill="#cc2200" opacity=".6"/><line x1="4" y1="18" x2="20" y2="18" stroke="#cc2200" stroke-width=".5" opacity=".4"/><text x="12" y="14" text-anchor="middle" font-size="5" fill="#cc2200" font-family="serif" opacity=".7">将</text></svg>`,
  fallout:         `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#080a00"/><circle cx="16" cy="11" r="7" fill="none" stroke="#88cc00" stroke-width=".7" opacity=".8"/><circle cx="16" cy="11" r="4" fill="none" stroke="#88cc00" stroke-width=".5" opacity=".5"/><circle cx="16" cy="11" r="1.5" fill="#88cc00" opacity=".8"/><text x="16" y="20" text-anchor="middle" font-size="3" fill="#88cc00" opacity=".6" font-family="monospace" letter-spacing=".5">VAULT</text></svg>`,
  futurama:        `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#000814"/><ellipse cx="22" cy="6" rx="5" ry="5" fill="none" stroke="#00aaff" stroke-width=".6" opacity=".7"/><ellipse cx="22" cy="6" rx="2.5" ry="2.5" fill="#00aaff" opacity=".4"/><rect x="4" y="14" width="16" height="5" rx="1" fill="none" stroke="#00aaff" stroke-width=".5" opacity=".5"/><text x="12" y="18.5" text-anchor="middle" font-size="3" fill="#00aaff" opacity=".7" font-family="monospace">FUTURAMA</text></svg>`,
  familyguy:       `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#0a0400"/><circle cx="16" cy="9" r="6" fill="none" stroke="#ff8800" stroke-width=".7" opacity=".7"/><circle cx="13.5" cy="8" r="1" fill="#ff8800" opacity=".8"/><circle cx="18.5" cy="8" r="1" fill="#ff8800" opacity=".8"/><path d="M13 11 Q16 13 19 11" fill="none" stroke="#ff8800" stroke-width=".8" opacity=".7"/><text x="16" y="20" text-anchor="middle" font-size="3" fill="#ff8800" opacity=".5" font-family="sans-serif">QUAHOG</text></svg>`,
  rickmorty:       `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#020a00"/><circle cx="16" cy="11" r="8" fill="none" stroke="#00ff88" stroke-width=".8" opacity=".8"/><circle cx="16" cy="11" r="5" fill="none" stroke="#00ff88" stroke-width=".5" opacity=".5"/><circle cx="16" cy="11" r="2" fill="#00ff88" opacity=".7"/><text x="16" y="20.5" text-anchor="middle" font-size="2.8" fill="#00ff88" opacity=".6" font-family="monospace">PORTAL</text></svg>`,
  simpsons:        `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#001a2e"/><circle cx="16" cy="10" r="6" fill="#ffcc00" opacity=".8"/><circle cx="14" cy="9" r="1" fill="#001a2e" opacity=".9"/><circle cx="18" cy="9" r="1" fill="#001a2e" opacity=".9"/><path d="M13 12 Q16 14.5 19 12" fill="none" stroke="#001a2e" stroke-width=".9" opacity=".8"/><text x="16" y="20.5" text-anchor="middle" font-size="3" fill="#ffcc00" opacity=".6" font-family="sans-serif">D'OH</text></svg>`,
  southpark:       `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#000c18"/><rect x="10" y="4" width="12" height="10" rx="5" fill="none" stroke="#66aaff" stroke-width=".7" opacity=".7"/><rect x="12" y="14" width="8" height="5" rx=".5" fill="none" stroke="#66aaff" stroke-width=".5" opacity=".5"/><circle cx="13.5" cy="8.5" r=".8" fill="#66aaff" opacity=".8"/><circle cx="18.5" cy="8.5" r=".8" fill="#66aaff" opacity=".8"/><text x="16" y="21" text-anchor="middle" font-size="2.5" fill="#66aaff" opacity=".5" font-family="sans-serif">SOUTH PARK</text></svg>`,
  boondocks:       `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#080400"/><circle cx="16" cy="9" r="5" fill="none" stroke="#cc6600" stroke-width=".7" opacity=".7"/><circle cx="14" cy="8" r=".9" fill="#cc6600" opacity=".8"/><circle cx="18" cy="8" r=".9" fill="#cc6600" opacity=".8"/><path d="M13 11 Q16 12.5 19 11" fill="none" stroke="#cc6600" stroke-width=".7" opacity=".6"/><text x="16" y="20" text-anchor="middle" font-size="3" fill="#cc6600" opacity=".6" font-family="sans-serif">BNDKS</text></svg>`,
  archer:          `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#08060e"/><rect x="6" y="4" width="20" height="14" rx="1.5" fill="none" stroke="#aa66ff" stroke-width=".6" opacity=".6"/><line x1="6" y1="8" x2="26" y2="8" stroke="#aa66ff" stroke-width=".3" opacity=".3"/><line x1="6" y1="12" x2="26" y2="12" stroke="#aa66ff" stroke-width=".3" opacity=".3"/><text x="16" y="11.5" text-anchor="middle" font-size="4" fill="#aa66ff" opacity=".8" font-family="sans-serif" font-weight="bold">ISIS</text></svg>`,
  bobsburgers:     `<svg viewBox="0 0 32 22" fill="none"><rect width="32" height="22" fill="#020c10"/><rect x="5" y="6" width="22" height="11" rx="2" fill="none" stroke="#00cccc" stroke-width=".6" opacity=".6"/><circle cx="11" cy="11.5" r="3" fill="#cc4444" opacity=".4"/><circle cx="11" cy="11.5" r="3" fill="none" stroke="#ff6666" stroke-width=".5" opacity=".6"/><text x="20" y="13" text-anchor="middle" font-size="3.5" fill="#00cccc" opacity=".8" font-family="sans-serif">BOB'S</text></svg>`,
};

// ── Cached DOM refs ────────────────────────────────────────────────────
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const DOM = {
  digitHr:        $('digitHr'),
  digitMin:       $('digitMin'),
  digitSec:       $('digitSec'),
  timeDis:        $('timeDis'),   // hidden, kept for compat
  ampmDis:        $('ampmDis'),
  secMs:          $('secMs'),
  dateDis:        $('dateDis'),
  dayPct:         $('dayPct'),
  pFill:          $('progressFill'),
  sTmr:           $('sessionTimer'),
  utcPill:        $('utcPill'),
  greeting:       $('greeting'),
  quoteText:      $('quoteText'),
  litMeta:        $('litMeta'),
  syncDot:        $('syncDot'),
  syncLabel:      $('syncLabel'),
  focusInput:     $<HTMLInputElement>('focusInput'),
  focusInputWrap: $('focusInputWrap'),
  themePanel:     $('themePanel'),
  btnStart:       $('btnStart'),
  btnReset:       $('btnReset'),
  pomPill:        $('pomModePill'),
  sessionLabel:   $('sessionLabel'),
  pomRingSvg:     document.getElementById('pomRingSvg') as unknown as SVGSVGElement,
  pomRingArc:     document.getElementById('pomRingArc') as unknown as SVGCircleElement,
  showBadge:      $('showBadge'),
  infoLabel:      $('infoLabel'),
  infoSlide:      $('infoSlide'),
};

// ── Session timer ──────────────────────────────────────────────────────
let sessionRunning = false;
let sessionStart = 0;
let sessionElapsed = 0;

function startTimer() {
  sessionRunning = true;
  sessionStart = performance.now() - sessionElapsed;
  document.body.classList.add('session-running');
  (window as any).__uiSounds?.sessionStart();
  Features.updateButtonLabels('running', Pom.getPhase(), Pom.isActive(), DOM.btnStart as HTMLButtonElement);
  Features.setStatusState('running', { pomEnabled: Pom.isActive() });
  Features.updateDistractionUI(true);
  DOM.focusInputWrap.classList.add('visible');
  if (Pom.isActive()) Pom.onStart();
  Intel.onSessionStart();
  Intel.onFlowInterrupt();
  bcBroadcast('session', { running: true });
  APIs.requestNotifications();
  APIs.acquireWakeLock();
}

function pauseTimer() {
  sessionRunning = false;
  sessionElapsed = performance.now() - sessionStart;
  document.body.classList.remove('session-running');
  Features.updateButtonLabels('paused', Pom.getPhase(), Pom.isActive(), DOM.btnStart as HTMLButtonElement);
  Features.setStatusState('paused');
  Features.updateDistractionUI(false);
  Intel.onFlowInterrupt();
  bcBroadcast('session', { running: false });
}

function resetTimer() {
  const dur = sessionRunning ? performance.now() - sessionStart : sessionElapsed;
  Log.record(DOM.focusInput.value.trim(), dur);
  Features.updateDistractionUI(false);
  if (dur > 60_000) {
    (window as any).__uiSounds?.sessionEnd();
    Intel.recordCompleted();
    const streak = Intel.updateStreak();
    const milestone = Intel.getStreakMilestone(streak.current);
    if (milestone) showToast(milestone);
    Intel.onBreakTaken();

    // Smart break recommendation
    const sessionMins = Math.floor(dur / 60000);
    const distractionCount = parseInt(localStorage.getItem('sc_distraction_today') ?? '0');
    const smartBreak = Features.calcSmartBreak(sessionMins, distractionCount, Intel.getVelocityScore(), Pom.isActive());
    setTimeout(() => showToast(`☕ ${smartBreak.activity}`, 7000), 1200);

    // Session completion rating
    const todaySessions = JSON.parse(localStorage.getItem('sc_focus_log') || '[]').length;
    Features.setStatusState('complete', { todaySessions });
    Features.showCompletionRating(dur / 1000, DOM.focusInput.value.trim(), (rating) => {
      if (rating > 0) {
        try {
          const log = JSON.parse(localStorage.getItem('sc_focus_log') || '[]');
          if (log.length) log[log.length - 1].rating = rating;
          localStorage.setItem('sc_focus_log', JSON.stringify(log));
        } catch { /**/ }
      }
    });
  } else if (dur > 5_000) {
    Intel.recordAbandoned();
  }
  Intel.onFlowInterrupt();
  document.body.classList.remove('session-running');
  resetMilestones();
  sessionRunning = false; sessionStart = sessionElapsed = 0;
  Features.updateButtonLabels('idle', 'work', Pom.isActive(), DOM.btnStart as HTMLButtonElement);
  const todaySessions = JSON.parse(localStorage.getItem('sc_focus_log') || '[]').length;
  Features.setStatusState('idle', { todaySessions });
  DOM.sTmr.textContent = '00:00:00';
  DOM.focusInputWrap.classList.remove('visible');
  DOM.focusInput.value = '';
  if (Pom.isActive()) Pom.reset();
  bcBroadcast('session', { running: false });
}

DOM.btnStart.addEventListener('click', () => sessionRunning ? pauseTimer() : startTimer());
DOM.btnReset.addEventListener('click', resetTimer);

// ── Privacy toggle ────────────────────────────────────────────────────
let privacyMode = localStorage.getItem('sc_privacy') === '1';
let breathingBreakEnabled = localStorage.getItem('sc_breathing_break') !== '0';

// Clock position: 'top' (default) | 'center'
let clockPosition: 'top' | 'center' = (localStorage.getItem('sc_clock_pos') ?? 'top') as 'top' | 'center';
function applyClockPosition(pos: 'top' | 'center') {
  clockPosition = pos;
  localStorage.setItem('sc_clock_pos', pos);
  document.body.classList.toggle('clock-top',    pos === 'top');
  document.body.classList.toggle('clock-center', pos === 'center');
  // Update toggle pill
  document.querySelectorAll('.clock-pos-pill').forEach(el => {
    (el as HTMLElement).classList.toggle('center-active', pos === 'center');
    (el as HTMLElement).textContent = pos === 'center' ? '⊞ Centred' : '⊟ Top';
  });
}

function isPrivacyMode() { return privacyMode; }
function togglePrivacy() {
  privacyMode = !privacyMode;
  localStorage.setItem('sc_privacy', privacyMode ? '1' : '0');
  if (privacyMode) {
    updateSyncDisplay('failed');
    stopWeather();
    const wp = $('weatherPill');
    if (wp) { wp.classList.remove('loaded'); }
    // Apply system fonts — no Google Fonts in privacy mode
    document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
    showToast('🔒 Privacy Mode: fonts, weather & sync disabled');
  } else {
    syncTime();
    initWeather($('weatherIcon'), $('weatherText'), $('weatherPill'), isPrivacyMode);
    document.body.style.fontFamily = '';
    showToast('Privacy Mode off — reconnected');
  }
  // Sync settings toggle state
  const settingsToggle = document.getElementById('togglePrivacyS');
  if (settingsToggle) settingsToggle.classList.toggle('on', privacyMode);
}

// ── Data Management Panel ─────────────────────────────────────────────
function openDataPanel() { buildDataPanel(); openModal('dataOverlay'); }

function buildDataPanel() {
  const el = $('dataContent');
  if (!el) return;
  el.innerHTML = '';

  const totalBytes = Privacy.getTotalSize();

  // Header summary
  const summary = document.createElement('div'); summary.className = 'data-summary';
  const totalEl = document.createElement('p'); totalEl.className = 'data-total';
  totalEl.textContent = `Total stored: ${Privacy.formatBytes(totalBytes)} — all on your device, never sent anywhere.`;
  summary.appendChild(totalEl);

  // Incognito mode toggle
  const incogRow = document.createElement('div'); incogRow.className = 'settings-row';
  const incogInfo = document.createElement('div'); incogInfo.className = 'settings-row-info';
  const incogLbl = document.createElement('span'); incogLbl.className = 'settings-row-label'; incogLbl.textContent = '🕵 Incognito Sessions';
  const incogDesc = document.createElement('span'); incogDesc.className = 'settings-row-desc'; incogDesc.textContent = 'Sessions run in memory only — nothing written to storage';
  incogInfo.append(incogLbl, incogDesc);
  const incogToggle = document.createElement('button');
  incogToggle.className = 'settings-toggle' + (Privacy.isIncognito() ? ' on' : '');
  incogToggle.addEventListener('click', () => {
    Privacy.setIncognito(!Privacy.isIncognito());
    incogToggle.classList.toggle('on', Privacy.isIncognito());
    showToast(Privacy.isIncognito() ? '🕵 Incognito mode on' : 'Incognito mode off');
  });
  incogRow.append(incogInfo, incogToggle);
  summary.appendChild(incogRow);

  // Auto-clear toggle
  const clearRow = document.createElement('div'); clearRow.className = 'settings-row';
  const clearInfo = document.createElement('div'); clearInfo.className = 'settings-row-info';
  const clearLbl = document.createElement('span'); clearLbl.className = 'settings-row-label'; clearLbl.textContent = '🗑 Auto-Clear on Close';
  const clearDesc = document.createElement('span'); clearDesc.className = 'settings-row-desc'; clearDesc.textContent = 'Wipe session log & focus data when you close the tab';
  clearInfo.append(clearLbl, clearDesc);
  const clearToggle = document.createElement('button');
  clearToggle.className = 'settings-toggle' + (Privacy.isAutoClear() ? ' on' : '');
  clearToggle.addEventListener('click', () => {
    Privacy.setAutoClear(!Privacy.isAutoClear());
    clearToggle.classList.toggle('on', Privacy.isAutoClear());
    showToast(Privacy.isAutoClear() ? 'Auto-clear enabled' : 'Auto-clear disabled');
  });
  clearRow.append(clearInfo, clearToggle);
  summary.appendChild(clearRow);

  el.appendChild(summary);

  // Per-category breakdown
  const catTitle = document.createElement('div'); catTitle.className = 'settings-section-title';
  catTitle.textContent = 'Data Categories'; el.appendChild(catTitle);

  Privacy.DATA_CATEGORIES.forEach(cat => {
    const size = Privacy.getCategorySize(cat);
    const row = document.createElement('div'); row.className = 'data-cat-row';

    const left = document.createElement('div'); left.className = 'data-cat-info';
    const icon = document.createElement('span'); icon.className = 'data-cat-icon'; icon.textContent = cat.icon;
    const info = document.createElement('div');
    const name = document.createElement('span'); name.className = 'data-cat-name'; name.textContent = cat.label;
    const desc = document.createElement('span'); desc.className = 'data-cat-desc'; desc.textContent = cat.desc;
    if (cat.sensitive) {
      const badge = document.createElement('span'); badge.className = 'data-sensitive-badge'; badge.textContent = 'Personal';
      name.appendChild(badge);
    }
    info.append(name, desc);
    left.append(icon, info);

    const right = document.createElement('div'); right.className = 'data-cat-right';
    const sizeEl = document.createElement('span'); sizeEl.className = 'data-cat-size';
    sizeEl.textContent = size > 0 ? Privacy.formatBytes(size) : 'empty';
    const delBtn = document.createElement('button'); delBtn.className = 'data-del-btn';
    delBtn.textContent = 'Clear'; delBtn.disabled = size === 0;
    delBtn.addEventListener('click', () => {
      if (!confirm(`Clear "${cat.label}"? This cannot be undone.`)) return;
      Privacy.deleteCategory(cat);
      showToast(`${cat.icon} ${cat.label} cleared`);
      buildDataPanel(); // rebuild
    });
    right.append(sizeEl, delBtn);
    row.append(left, right);
    el.appendChild(row);
  });

  // Actions bar
  const actions = document.createElement('div'); actions.className = 'data-actions';
  const exportBtn = document.createElement('button'); exportBtn.className = 'btn btn-ghost';
  exportBtn.textContent = '⬇ Export All Data';
  exportBtn.addEventListener('click', () => { Privacy.exportAllData(); showToast('Data exported as JSON'); });

  const nukeBtn = document.createElement('button'); nukeBtn.className = 'btn btn-ghost data-nuke-btn';
  nukeBtn.textContent = '🗑 Delete Everything';
  nukeBtn.addEventListener('click', () => {
    if (!confirm('Delete ALL Session Clock data? This cannot be undone.')) return;
    Privacy.deleteAll();
    showToast('All data deleted');
    buildDataPanel();
  });

  actions.append(exportBtn, nukeBtn);
  el.appendChild(actions);
}

function toggleFocusLock() {
  focusLockEnabled = !focusLockEnabled;
  localStorage.setItem('sc_focus_lock', focusLockEnabled ? '1' : '0');
}

// ── Current theme ──────────────────────────────────────────────────────
let currentTheme: Theme = THEMES[0];
const root = document.documentElement;
const cssVar = (name: string, val: string) => root.style.setProperty(name, val);

function applyTheme(theme: Theme, instant = false) {
  // UI sound on theme switch (except initial load)
  if (currentTheme && currentTheme.id !== theme.id && !instant) {
    (window as any).__uiSounds?.themeSwitch();
    document.body.classList.add('theme-switching');
    setTimeout(() => document.body.classList.remove('theme-switching'), 350);
  }
  const doApply = () => {
    currentTheme = theme;
    invalidateCache(); // clear OffscreenCanvas cache — new theme needs fresh gradient
    buildParticles(theme);
    cssVar('--clr-text',    theme.text);
    cssVar('--clr-accent',  theme.accent);
    cssVar('--clr-accent2', theme.accent2);
    // Set RGB components for use in rgba() and animations
    const accentRgb = theme.accent.startsWith('#')
      ? theme.accent.slice(1).match(/.{2}/g)!.map(h => parseInt(h, 16)).join(',')
      : '110,231,183';
    cssVar('--clr-accent-rgb', accentRgb);
    cssVar('--clr-track',   theme.track);
    cssVar('--clr-btn-bg',  theme.btnBg);
    cssVar('--clr-btn-fg',  theme.btnFg);
    cssVar('--clr-pill',    theme.pill);
    cssVar('--clr-panel',   theme.panel);
    // Panel needs high opacity regardless of theme — derive a solid version
    // The floating theme panel uses this via the color-mix fallback @supports rule
    cssVar('--font-main',   theme.font);
    cssVar('--glow', theme.glow === 'none' ? 'none' : `0 0 45px ${theme.accent}44,0 0 100px ${theme.accent}18`);
    cssVar('--btn-radius',  theme.isMedia ? '3px' : '99px');
    cssVar('--lb-h', (theme.isMedia && theme.lb) ? '3.8vh' : '0px');

    // Light theme body class (Nordic, Lemon)
    document.body.classList.toggle('light-theme', !!theme.light);
    // Theme body class for CSS selectors (easter egg animations etc.)
    document.body.className = document.body.className
      .replace(/\btheme-\S+/g, '').trim();
    document.body.classList.add(`theme-${theme.id}`);

    $('overlay').style.background  = theme.overlay  === 'none' ? '' : theme.overlay;
    $('vignette').style.background = theme.vignette === 'none' ? '' : theme.vignette;
    ($('scanlines') as HTMLElement).style.opacity = theme.scanlines ? '1' : '0';
    const grainEl = $('grain');
    grainEl.style.opacity = theme.grain ? '0.25' : '0';
    if (theme.grain) grainEl.style.backgroundImage = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.12'/%3E%3C/svg%3E")`;
    const hdrEl = $('hdrBloom');
    if (theme.hdr) { hdrEl.style.background = `radial-gradient(ellipse at 50% 50%,${theme.accent}09 0%,transparent 65%)`; hdrEl.style.opacity = '1'; }
    else hdrEl.style.opacity = '0';

    // Show badge for media themes
    if (theme.isMedia && theme.tagline) { DOM.showBadge.textContent = theme.tagline; DOM.showBadge.classList.add('visible'); }
    else DOM.showBadge.classList.remove('visible');

    // Literary mode
    if (theme.id === 'literary') {
      DOM.quoteText.style.fontFamily = "'Lora',serif";
      DOM.quoteText.style.fontSize = 'clamp(.75rem,1.4vw,.95rem)';
      DOM.litMeta.style.display = 'block';
    } else {
      DOM.quoteText.style.fontFamily = DOM.quoteText.style.fontSize = '';
      DOM.litMeta.style.display = 'none';
      const qs = theme.quotes?.length ? theme.quotes : NAT_QUOTES;
      DOM.quoteText.style.opacity = '0';
      setTimeout(() => { DOM.quoteText.textContent = `"${qs[0]}"`; DOM.quoteText.style.opacity = '.38'; }, 420);
    }

    updateSyncDisplay(synced ? 'ok' : 'failed');
    document.querySelectorAll<HTMLElement>('.nat-btn,.media-card').forEach(b => b.classList.toggle('active', b.dataset.id === theme.id));
    lastQKey = '';
    localStorage.setItem('sc_last_theme', theme.id);
    bcBroadcast('theme', { id: theme.id });
    // Common Room: auto-start rain + fire
    if (theme.id === 'commonroom') setTimeout(() => Sound.autoStartCommonRoom(), 400);
    // Rebuild clock canvas so font/colours update for current theme
    updateClockCanvas();
  };

  if (instant || !theme.isMedia) { doApply(); if (!instant) flashTheme(); return; }
  runTransition(theme.transition ?? 'defaultFade', doApply);
}

// ── Sync UI ────────────────────────────────────────────────────────────
function updateSyncDisplay(state: 'syncing' | 'ok' | 'failed', rtt?: number) {
  if (!DOM.syncDot) return;
  if (state === 'syncing') {
    DOM.syncDot.style.background = '#f59e0b'; DOM.syncLabel.textContent = 'Syncing…';
  } else if (state === 'ok') {
    DOM.syncDot.style.background = currentTheme.accent;
    const ms = Math.abs(Math.round(clockOffset));
    DOM.syncLabel.textContent = `Synced · ±${ms}ms${rtt != null ? ` · ${Math.round(rtt)}ms RTT` : ''}`;
    Features.setSyncTrust('ntp');
  } else {
    DOM.syncDot.style.background = '#ef4444'; DOM.syncLabel.textContent = 'Local clock';
    Features.setSyncTrust('offline');
  }
}
setSyncHandler(updateSyncDisplay);

// ── Render loop ────────────────────────────────────────────────────────
let lastTs = 0, lastSec = -1, lastQKey = '', _rafSkip = 0;

function tickDigit(el: HTMLElement, val: string) {
  if (el.textContent === val) return;
  el.classList.remove('tick');
  void (el as HTMLElement).offsetWidth;
  el.textContent = val;
  el.classList.add('tick');
}

function renderFrame(ts: number) {
  // Tab hidden — full skip (handled in renderer but also skip UI work)
  if (!isTabVisible()) { requestAnimationFrame(renderFrame); return; }

  // LOW tier: throttle to ~20fps by skipping every 2nd frame
  const tier = getTier();
  if (tier === 'low') {
    _rafSkip = (_rafSkip + 1) % 3;
    if (_rafSkip !== 0) { requestAnimationFrame(renderFrame); return; }
  }

  requestAnimationFrame(renderFrame);
  const dt = Math.min((ts - lastTs) / 1000, 0.05); lastTs = ts;

  // FPS tracking + auto quality tier
  tickFps(ts);

  // Parallax — skip on LOW tier, reduce-motion, or user disabled
  const parallaxEnabled = localStorage.getItem('sc_parallax') !== '0' &&
    !document.body.classList.contains('reduced-motion');
  if (tier !== 'low' && parallaxEnabled) {
    parallaxX += (targetPX - parallaxX) * 0.06;
    parallaxY += (targetPY - parallaxY) * 0.06;
    setParallax(parallaxX, parallaxY);
  } else {
    setParallax(0, 0);
  }

  drawBg(dt, currentTheme, Intel.getFlowIntensity());

  // Tick flow intensity
  Intel.tickFlowIntensity(sessionRunning, dt);

  // Spatial audio tick — throttle on LOW
  if (tier !== 'low') Sound.tickSpatial(ts / 1000);

  const now = new Date(Date.now() + clockOffset);
  const ms = now.getMilliseconds(), sec = now.getSeconds(), min = now.getMinutes(), hr = now.getHours();
  const hr12 = hr % 12 || 12;
  const hrStr = p2(hr12), minStr = p2(min), secStr = p2(sec);

  // Route to correct clock renderer
  switch (clockMode) {
    case 'analogue':  renderAnalogue(hr, min, sec, ms);  break;
    case 'flip':      renderFlip(hrStr, minStr, secStr); break;
    case 'word':      renderWord(hr, min);               break;
    case 'minimal':   renderMinimal(hr12, hr);           break;
    case 'segment':   renderSegment(hrStr, minStr, secStr); break;
    default:
      tickDigit(DOM.digitHr, hrStr);
      tickDigit(DOM.digitMin, minStr);
      tickDigit(DOM.digitSec, secStr);
      DOM.ampmDis.textContent = hr >= 12 ? 'PM' : 'AM';
      // Clamp to 50ms steps — prevents layout thrash from 60fps ms updates
      DOM.secMs.textContent = '.' + p3(Math.floor(ms / 50) * 50);
  }

  // SMPTE: override seconds-ms display with frame counter
  if (currentTheme.id === 'smpte' && clockMode === 'digital') {
    const frame = Math.floor(ms / (1000 / 24)) % 24;
    DOM.secMs.textContent = ':' + p2(frame);
  }
  // Terminal: show 24hr time
  if (currentTheme.id === 'terminal' && clockMode === 'digital') {
    tickDigit(DOM.digitHr, p2(hr));
  }

  DOM.timeDis.textContent = `${hrStr}:${minStr}:${secStr}`;
  const dp = ((hr * 3600 + min * 60 + sec) * 1000 + ms) / 864e5 * 100;
  DOM.pFill.style.width = dp.toFixed(4) + '%';

  if (sessionRunning) {
    if (Pom.isActive()) Pom.tick(performance.now());
    else DOM.sTmr.textContent = fmtSession(performance.now() - sessionStart);
  }

  if (sec !== lastSec) {
    lastSec = sec;
    // Midnight confetti check
    (window as any).__checkMidnight?.();
    const uh = now.getUTCHours(), um = now.getUTCMinutes(), us = now.getUTCSeconds();
    // Sidereal time easter egg
    if (Easter.isSiderealMode()) {
      const lat = (window as any).__scLat ?? 0;
      DOM.utcPill.textContent = Easter.getSiderealTime(lat);
    } else {
      DOM.utcPill.textContent = Features.getTrustLabel();
    }
    DOM.utcPill.title = Features.getTrustTooltip();

    // Update status line
    if (sessionRunning && Pom.isActive()) {
      const phase = Pom.getPhase();
      const rem = Pom.getRemainingSeconds();
      Features.setStatusState('running', { pomEnabled: true, pomPhase: phase, remainingSecs: rem });
    }

    // Countdown tick
    Features.tickCountdown();

    // World clock tick
    Features.tickWorldClock();

    // Flow state + intensity UI update
    updateFlowState();
    updateFlowIntensityUI(Intel.getFlowIntensity());

    // Motivation milestone check
    checkMilestones();
    DOM.dateDis.textContent = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
    DOM.greeting.textContent = GREETS.find(([s, e]) => hr >= s && hr < e)?.[2] ?? '';
    DOM.dayPct.textContent = dp.toFixed(1) + '%';

    if (currentTheme.id === 'literary') {
      const key = p2(hr) + ':' + p2(Math.floor(min / 5) * 5);
      if (key !== lastQKey) {
        lastQKey = key;
        const entry = LIT_CLOCK[key];
        if (entry) {
          DOM.quoteText.style.opacity = '0';
          setTimeout(() => { DOM.quoteText.textContent = `"${entry.quote}"`; DOM.litMeta.textContent = entry.source; DOM.quoteText.style.opacity = '.55'; }, 400);
        }
      }
    } else {
      const qs = currentTheme.quotes?.length ? currentTheme.quotes : NAT_QUOTES;
      const qi = (((hr * 60 + min) / 5) | 0) % qs.length;
      const qKey = String(qi);
      if (qKey !== lastQKey) { lastQKey = qKey; DOM.quoteText.style.opacity = '0'; setTimeout(() => { DOM.quoteText.textContent = `"${qs[qi]}"`; DOM.quoteText.style.opacity = '.38'; }, 400); }
    }
  }
}

// ── Clock renderers ───────────────────────────────────────────────────

// ANALOGUE — SVG hands drawn into #analogueClock canvas element
function renderAnalogue(hr: number, min: number, sec: number, ms: number) {
  const el = document.getElementById('analogueClock') as HTMLCanvasElement | null;
  if (!el) return;
  const size = el.width; const cx = size / 2, cy = size / 2, R = size / 2 - 4;
  const ctx2 = el.getContext('2d')!;
  ctx2.clearRect(0, 0, size, size);
  const acc = currentTheme.accent;

  // Dial face
  ctx2.beginPath(); ctx2.arc(cx, cy, R, 0, Math.PI * 2);
  ctx2.strokeStyle = acc + '30'; ctx2.lineWidth = 1.5; ctx2.stroke();

  // Hour ticks
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const inner = i % 3 === 0 ? R * 0.82 : R * 0.88;
    ctx2.beginPath();
    ctx2.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx2.lineTo(cx + Math.cos(a) * R,     cy + Math.sin(a) * R);
    ctx2.strokeStyle = acc + (i % 3 === 0 ? 'cc' : '55');
    ctx2.lineWidth = i % 3 === 0 ? 2 : 1;
    ctx2.stroke();
  }

  // Smooth second hand — interpolate with ms
  const secAngle = ((sec + ms / 1000) / 60) * Math.PI * 2 - Math.PI / 2;
  const minAngle = ((min + sec / 60) / 60) * Math.PI * 2 - Math.PI / 2;
  const hrAngle  = (((hr % 12) + min / 60) / 12) * Math.PI * 2 - Math.PI / 2;

  const drawHand = (angle: number, length: number, width: number, color: string) => {
    ctx2.beginPath();
    ctx2.moveTo(cx - Math.cos(angle) * R * 0.12, cy - Math.sin(angle) * R * 0.12);
    ctx2.lineTo(cx + Math.cos(angle) * length,   cy + Math.sin(angle) * length);
    ctx2.strokeStyle = color; ctx2.lineWidth = width;
    ctx2.lineCap = 'round'; ctx2.stroke();
  };

  drawHand(hrAngle,  R * 0.55, 3.5, currentTheme.text);
  drawHand(minAngle, R * 0.78, 2.2, currentTheme.text);
  drawHand(secAngle, R * 0.88, 1.2, acc);

  // Centre dot
  ctx2.beginPath(); ctx2.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx2.fillStyle = acc; ctx2.fill();
}

// FLIP — CSS 3D card flip per digit group
let flipPrev = { hr: '', min: '', sec: '' };
function renderFlip(hr: string, min: string, sec: string) {
  const update = (id: string, val: string, prev: string) => {
    const el = document.getElementById(id);
    if (!el || val === prev) return;
    const top = el.querySelector<HTMLElement>('.flip-top');
    const bot = el.querySelector<HTMLElement>('.flip-bot');
    const topBack = el.querySelector<HTMLElement>('.flip-top-back');
    if (!top || !bot || !topBack) return;
    top.textContent = prev;
    bot.textContent = val;
    topBack.textContent = val;
    el.classList.remove('flipping');
    void el.offsetWidth;
    el.classList.add('flipping');
  };
  update('flipHr',  hr,  flipPrev.hr);
  update('flipMin', min, flipPrev.min);
  update('flipSec', sec, flipPrev.sec);
  flipPrev = { hr, min, sec };
}

// WORD CLOCK — 10×11 letter grid, lit words
const WORD_GRID = [
  'ITLISASTIME',
  'ACQUARTERDC',
  'TWENTYFIVEX',
  'HALFSTENFTO',
  'PASTERUNINE',
  'ONESIXTHREE',
  'FOURFIVETWO',
  'EIGHTELEVEN',
  'SEVENTWELVE',
  'TENSEOCLOCK',
];
// Word positions [row, colStart, colEnd] (inclusive)
const WORDS: Record<string, [number,number,number][]> = {
  IT:       [[0,0,1]], IS:      [[0,3,4]], A:   [[0,5,5]],
  QUARTER:  [[1,2,8]], TWENTY:  [[2,0,5]], FIVE:[[2,6,9]],
  HALF:     [[3,0,3]], TEN:     [[3,5,7]], TO:  [[3,9,10]],
  PAST:     [[4,0,3]],
  ONE:      [[5,0,2]], SIX:     [[5,3,5]], THREE:[[5,6,10]],
  FOUR:     [[6,0,3]], FIVE2:   [[6,4,7]], TWO: [[6,8,10]],
  EIGHT:    [[7,0,4]], ELEVEN:  [[7,5,10]],
  SEVEN:    [[8,0,4]], TWELVE:  [[8,5,10]],
  TEN2:     [[9,0,2]], OCLOCK:  [[9,4,9]],
};
const HOUR_WORDS = ['TWELVE','ONE','TWO','THREE','FOUR','FIVE2','SIX','SEVEN','EIGHT','NINE','TEN2','ELEVEN'];

function getWordClockWords(hr: number, min: number): Set<string> {
  const lit = new Set<string>(['IT','IS']);
  const m5 = Math.round(min / 5) * 5;
  if      (m5 === 0)  { lit.add('OCLOCK'); }
  else if (m5 === 5)  { lit.add('FIVE');  lit.add('PAST'); }
  else if (m5 === 10) { lit.add('TEN');   lit.add('PAST'); }
  else if (m5 === 15) { lit.add('A'); lit.add('QUARTER'); lit.add('PAST'); }
  else if (m5 === 20) { lit.add('TWENTY'); lit.add('PAST'); }
  else if (m5 === 25) { lit.add('TWENTY'); lit.add('FIVE'); lit.add('PAST'); }
  else if (m5 === 30) { lit.add('HALF'); lit.add('PAST'); }
  else if (m5 === 35) { lit.add('TWENTY'); lit.add('FIVE'); lit.add('TO'); }
  else if (m5 === 40) { lit.add('TWENTY'); lit.add('TO'); }
  else if (m5 === 45) { lit.add('A'); lit.add('QUARTER'); lit.add('TO'); }
  else if (m5 === 50) { lit.add('TEN'); lit.add('TO'); }
  else if (m5 === 55) { lit.add('FIVE'); lit.add('TO'); }
  const hIdx = (m5 >= 35 ? (hr % 12) + 1 : hr % 12) % 12;
  lit.add(HOUR_WORDS[hIdx]);
  return lit;
}

let wordPrevKey = '';
function renderWord(hr: number, min: number) {
  const key = `${hr}:${Math.floor(min / 5)}`;
  if (key === wordPrevKey) return;
  wordPrevKey = key;
  const lit = getWordClockWords(hr, min);
  const el = document.getElementById('wordClockGrid');
  if (!el) return;
  el.innerHTML = '';
  WORD_GRID.forEach((row, ri) => {
    [...row].forEach((ch, ci) => {
      const span = document.createElement('span');
      span.textContent = ch;
      span.className = 'wc-char';
      // Check if this char is part of a lit word
      let isLit = false;
      for (const [word, positions] of Object.entries(WORDS)) {
        if (!lit.has(word)) continue;
        for (const [r, cs, ce] of positions) {
          if (r === ri && ci >= cs && ci <= ce) { isLit = true; break; }
        }
        if (isLit) break;
      }
      span.classList.toggle('wc-lit', isLit);
      el.appendChild(span);
    });
  });
}

// MINIMAL — just the hour, enormous
function renderMinimal(hr12: number, hr: number) {
  const el = document.getElementById('minimalHr');
  const ap = document.getElementById('minimalAP');
  if (el) el.textContent = String(hr12);
  if (ap) ap.textContent = hr >= 12 ? 'PM' : 'AM';
}

// SEGMENT — 7-segment style per digit
const SEG_PATHS: Record<string, number[]> = {
  // Which of 7 segments [top,topR,botR,bot,botL,topL,mid] are ON per digit
  '0':[1,1,1,1,1,1,0], '1':[0,1,1,0,0,0,0], '2':[1,1,0,1,1,0,1],
  '3':[1,1,1,1,0,0,1], '4':[0,1,1,0,0,1,1], '5':[1,0,1,1,0,1,1],
  '6':[1,0,1,1,1,1,1], '7':[1,1,1,0,0,0,0], '8':[1,1,1,1,1,1,1],
  '9':[1,1,1,1,0,1,1],
};
function drawSegDigit(ctx2: CanvasRenderingContext2D, digit: string, x: number, y: number, w: number, h: number, color: string, dimColor: string) {
  const segs = SEG_PATHS[digit] ?? SEG_PATHS['8'];
  const t = 4, g = 3; // thickness, gap
  const iw = w - t * 2 - g * 2, ih = (h - t * 3 - g * 4) / 2;
  // top, topR, botR, bot, botL, topL, mid
  const drawSeg = (on: number, draw: () => void) => {
    ctx2.fillStyle = on ? color : dimColor; draw();
  };
  // top
  drawSeg(segs[0], () => { ctx2.fillRect(x + t + g, y, iw, t); });
  // topR
  drawSeg(segs[1], () => { ctx2.fillRect(x + w - t, y + t + g, t, ih); });
  // botR
  drawSeg(segs[2], () => { ctx2.fillRect(x + w - t, y + t * 2 + g * 3 + ih, t, ih); });
  // bot
  drawSeg(segs[3], () => { ctx2.fillRect(x + t + g, y + h - t, iw, t); });
  // botL
  drawSeg(segs[4], () => { ctx2.fillRect(x, y + t * 2 + g * 3 + ih, t, ih); });
  // topL
  drawSeg(segs[5], () => { ctx2.fillRect(x, y + t + g, t, ih); });
  // mid
  drawSeg(segs[6], () => { ctx2.fillRect(x + t + g, y + t + g * 3 + ih, iw, t); });
}

function renderSegment(hr: string, min: string, sec: string) {
  const el = document.getElementById('segmentClock') as HTMLCanvasElement | null;
  if (!el) return;
  const ctx2 = el.getContext('2d')!;
  ctx2.clearRect(0, 0, el.width, el.height);
  const acc = currentTheme.accent;
  const dim = acc + '18';
  const dw = 42, dh = 80, gap = 12, colonW = 18;
  const totalW = 6 * dw + 5 * gap + 2 * colonW;
  let ox = (el.width - totalW) / 2, oy = (el.height - dh) / 2;
  const digits = [hr[0], hr[1], min[0], min[1], sec[0], sec[1]];
  digits.forEach((d, i) => {
    if (i === 2 || i === 4) {
      // Colon
      ctx2.fillStyle = Math.floor(Date.now() / 500) % 2 === 0 ? acc : dim;
      ctx2.beginPath(); ctx2.arc(ox + colonW / 2, oy + dh * 0.33, 3, 0, Math.PI * 2); ctx2.fill();
      ctx2.beginPath(); ctx2.arc(ox + colonW / 2, oy + dh * 0.67, 3, 0, Math.PI * 2); ctx2.fill();
      ox += colonW + gap;
    }
    drawSegDigit(ctx2, d, ox, oy, dw, dh, acc, dim);
    ox += dw + gap;
  });
}

// Generate a tiny canvas logo for themes without a LOGOS entry (safe — no user data)
function makeFallbackLogo(t: Theme): SVGElement | HTMLElement {
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 22;
  const cx2 = cv.getContext('2d')!;
  cx2.fillStyle = t.baseBg[0]!; cx2.fillRect(0,0,32,22);
  cx2.fillStyle = t.accent; cx2.font = 'bold 8px system-ui';
  cx2.textAlign = 'center'; cx2.textBaseline = 'middle';
  cx2.fillText(t.name.slice(0,2).toUpperCase(), 16, 11);
  const img = document.createElement('img');
  img.src = cv.toDataURL(); img.style.cssText = 'width:32px;height:22px;display:block';
  return img;
}

function setLogoContent(logo: HTMLElement, svgStr: string | undefined, fallback: () => SVGElement | HTMLElement) {
  // Use DOMParser to safely parse developer-authored SVG strings.
  // This is never user-supplied content — all strings are compile-time constants in LOGOS.
  while (logo.firstChild) logo.removeChild(logo.firstChild);
  if (svgStr) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgStr, 'image/svg+xml');
    const el = doc.documentElement;
    if (el && el.tagName.toLowerCase() === 'svg') {
      logo.appendChild(el);
      return;
    }
  }
  logo.appendChild(fallback());
}

// ── Theme panel ────────────────────────────────────────────────────────
let activePanelTab = 'nat';

function buildPanel() {
  const panelRows = $('themePanelRows'); panelRows.innerHTML = '';
  const featBar   = $('featBar');       featBar.innerHTML   = '';

  // ── Tab bar ──────────────────────────────────────────────────────────
  const tabs = document.createElement('div');
  tabs.className = 'panel-tabs';
  const tabDefs: [string, string, string][] = [
    ['nat',       '🌿', 'Natural'],
    ['tv',        '📺', 'TV Shows'],
    ['movie',     '🎬', 'Movies'],
    ['animation', '🎨', 'Animation'],
    ['anime',     '⛩', 'Anime'],
    ['f1',        '🏎', 'F1 Teams'],
  ];
  const contents: Record<string, HTMLElement> = {};
  tabDefs.forEach(([id, icon, label]) => {
    const btn = document.createElement('button');
    btn.className = 'panel-tab' + (id === activePanelTab ? ' active' : '');
    btn.dataset.tab = id;
    const iconEl = document.createElement('span'); iconEl.className = 'tab-icon'; iconEl.textContent = icon;
    const lblEl  = document.createElement('span'); lblEl.className  = 'tab-label'; lblEl.textContent  = label;
    btn.append(iconEl, lblEl);
    btn.addEventListener('click', () => switchPanelTab(id));
    tabs.appendChild(btn);
  });
  panelRows.appendChild(tabs);

  // ── Tab contents ──────────────────────────────────────────────────────
  const makeNatBtn = (t: Theme) => {
    const btn = document.createElement('button');
    btn.className = 'nat-btn' + (t.id === currentTheme.id ? ' active' : '');
    btn.dataset.id = t.id; btn.title = t.name;
    btn.style.background = t.swatch ?? t.accent;
    const tip = document.createElement('span'); tip.className = 'nat-tip'; tip.textContent = t.name;
    btn.appendChild(tip);
    btn.addEventListener('click', () => applyTheme(t));
    return btn;
  };

  const makeCard = (t: Theme) => {
    const card = document.createElement('button');
    card.className = 'media-card' + (t.id === currentTheme.id ? ' active' : '');
    card.dataset.id = t.id;
    card.addEventListener('click', () => applyTheme(t));
    const logo = document.createElement('div'); logo.className = 'media-logo';
    setLogoContent(logo, LOGOS[t.id], () => makeFallbackLogo(t));
    const nm = document.createElement('div'); nm.className = 'media-name'; nm.textContent = t.name;
    const sb = document.createElement('div'); sb.className = 'media-sub'; sb.style.color = t.accent; sb.textContent = t.sub ?? '';
    const txt = document.createElement('div'); txt.className = 'media-card-text'; txt.append(nm, sb);


    card.append(logo, txt); return card;
  };

  // Natural tab
  const natContent = document.createElement('div');
  natContent.className = 'tab-content' + (activePanelTab === 'nat' ? ' active' : '');
  natContent.dataset.tab = 'nat';

  const pureNat = THEMES_BY_CAT.nat.filter(t => !['literary'].includes(t.id));
  const specialNat = THEMES_BY_CAT.nat.filter(t => ['literary'].includes(t.id));

  const natGrid = document.createElement('div'); natGrid.className = 'nat-grid';
  pureNat.forEach(t => natGrid.appendChild(makeNatBtn(t)));
  natContent.appendChild(natGrid);

  if (specialNat.length) {
    const specLabel = document.createElement('div'); specLabel.className = 'tab-sub-label'; specLabel.textContent = 'Special';
    const specRow = document.createElement('div'); specRow.className = 'media-grid';
    specialNat.forEach(t => specRow.appendChild(makeCard(t)));
    natContent.append(specLabel, specRow);
  }
  contents['nat'] = natContent;

  // TV, Movie, Anime, F1 tabs
  (['tv','movie','animation','anime','f1'] as const).forEach(cat => {
    const content = document.createElement('div');
    content.className = 'tab-content' + (activePanelTab === cat ? ' active' : '');
    content.dataset.tab = cat;
    const grid = document.createElement('div'); grid.className = 'media-grid';
    THEMES_BY_CAT[cat].forEach(t => grid.appendChild(makeCard(t)));
    content.appendChild(grid);
    contents[cat] = content;
  });

  Object.values(contents).forEach(c => panelRows.appendChild(c));

  // ── Feature bar — 5 essential actions ────────────────────────────────
  const featDefs: [string, string, string, () => void][] = [
    // [id, emoji, label, action]
    ['btnSound',   '🎵', 'Sound',    () => { buildSoundUI(); openModal('soundOverlay'); }],
    ['btnLog',     '📊', 'Log',      openLog],
    ['btnZen',     '🧘', 'Zen',      toggleZen],
    ['btnSettings','⚙️', 'Settings', openSettings],
  ];
  featDefs.forEach(([id, emoji, label, action]) => {
    const b = document.createElement('button');
    b.className = 'feat-btn'; b.id = id;
    const iconEl = document.createElement('span'); iconEl.className = 'feat-icon'; iconEl.textContent = emoji;
    const lblEl  = document.createElement('span'); lblEl.className  = 'feat-label';
    lblEl.textContent = label;
    b.append(iconEl, lblEl);
    b.addEventListener('click', action);
    featBar.appendChild(b);
  });
}

function switchPanelTab(id: string) {
  activePanelTab = id;
  document.querySelectorAll<HTMLElement>('.panel-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll<HTMLElement>('.tab-content').forEach(c => c.classList.toggle('active', c.dataset.tab === id));
}

// ── Modals ─────────────────────────────────────────────────────────────
const openModal  = (id: string) => $(id).classList.add('open');
const closeModal = (id: string) => $(id).classList.remove('open');
document.querySelectorAll('.sc-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) (el as HTMLElement).classList.remove('open'); });
});
(window as any).SC = { modals: { open: openModal, close: closeModal } };

// ── Keyboard shortcuts ─────────────────────────────────────────────────
const SHORTCUTS: [string, string, () => void][] = [
  ['Space', 'Start / Pause session timer', () => DOM.btnStart.click()],
  ['R',     'Reset timer',                  () => DOM.btnReset.click()],
  ['T',     'Cycle to next theme',          () => { const idx = THEMES.indexOf(currentTheme); applyTheme(THEMES[(idx+1)%THEMES.length]); }],
  ['Ctrl+K','Command palette',              () => Cmd.open()],
  ['/',     'Easter egg search',            () => Cmd.open('/')],
  ['F',     'Toggle fullscreen / kiosk',    toggleKiosk],
  ['P',     'Toggle Pomodoro mode',         () => $('btnPomToggle').click()],
  ['M',     'Open ambient sound mixer',     () => { buildSoundUI(); openModal('soundOverlay'); }],
  ['L',     'Open session focus log',       () => { Log.render($('logEntries')); openModal('logOverlay'); }],
  ['K',     'Collapse / expand panel',      () => { DOM.themePanel.classList.toggle('collapsed'); }],
  ['Z',     'Zen Mode — distraction-free study', () => toggleZen()],
  ['G',     'Open custom theme builder',    openThemeBuilder],
  ['?',     'Show shortcuts',               () => openModal('kbOverlay')],
  ['Escape','Close any open panel',         () => {
    if (zenOn) { toggleZen(); return; }
    document.querySelectorAll<HTMLElement>('.sc-overlay.open').forEach(el => el.classList.remove('open'));
  }],
];

// Build keyboard grid
const kbGrid = $('kbGrid'); kbGrid.innerHTML = '';
SHORTCUTS.forEach(([key, desc]) => {
  const k = document.createElement('kbd'); k.textContent = key;
  const d = document.createElement('span'); d.className = 'kb-desc'; d.textContent = desc;
  kbGrid.append(k, d);
});

document.addEventListener('keydown', e => {
  const tag = (document.activeElement as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') { if (e.key === 'Escape') (document.activeElement as HTMLElement).blur(); return; }
  const hasOpen = document.querySelector('.sc-overlay.open');
  if (hasOpen && e.key !== 'Escape') return;
  for (const [key, , action] of SHORTCUTS) {
    const ek = e.key.toLowerCase();
    const match =
      (key === 'Space'  && e.code === 'Space') ||
      (key === '?'      && (e.key === '?' || (e.code === 'Slash' && e.shiftKey))) ||
      (key === 'Escape' && e.key === 'Escape') ||
      (key.length === 1 && key.toLowerCase() === ek && key !== '?');
    if (match) { e.preventDefault(); action(); return; }
  }
});

// ── Display modes ──────────────────────────────────────────────────────
let kioskOn = false, presentOn = false;


function toggleKiosk() {
  kioskOn = !kioskOn;
  document.body.classList.toggle('kiosk', kioskOn);
  if (kioskOn) document.documentElement.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.().catch(() => {});
}
// Sync kioskOn if user exits fullscreen via browser Escape (bypasses toggleKiosk)
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && kioskOn) {
    kioskOn = false;
    document.body.classList.remove('kiosk');
  }
});
function togglePresent() {
  presentOn = !presentOn;
  document.body.classList.toggle('present', presentOn);
}

// ── Zen Mode — distraction-free study environment ─────────────────────
let zenOn = false;
let zenHintTimer: number | null = null;
let zenMouseTimer: number | null = null;

function toggleZen() {
  zenOn = !zenOn;
  document.body.classList.toggle('zen-mode', zenOn);
  if (zenOn) {
    showToast('🧘 Zen Mode — Press Esc to exit', 3000);
    // Hide cursor until mouse moves
    zenMouseTimer = window.setTimeout(() => {}, 0);
    // Wake on mouse move
    const onMove = () => {
      document.body.classList.add('zen-hinting');
      if (zenHintTimer) clearTimeout(zenHintTimer);
      zenHintTimer = window.setTimeout(() => {
        document.body.classList.remove('zen-hinting');
      }, 2500);
    };
    (window as any).__zenMoveHandler = onMove;
    window.addEventListener('mousemove', onMove, { passive: true });
  } else {
    document.body.classList.remove('zen-hinting');
    if (zenHintTimer) clearTimeout(zenHintTimer);
    const h = (window as any).__zenMoveHandler;
    if (h) window.removeEventListener('mousemove', h);
    delete (window as any).__zenMoveHandler;
  }
}

// ── Focus Lock Delay ──────────────────────────────────────────────────
// When Pomodoro work is active, intercept distracting UI with a 3s delay
let focusLockEnabled = localStorage.getItem('sc_focus_lock') === '1';
let focusLockTimer: number | null = null;
let focusLockBar: HTMLElement | null = null;

function isFocusLocked(): boolean {
  return focusLockEnabled && Pom.isActive() && sessionRunning;
}

function focusLockIntercept(action: () => void): void {
  if (!isFocusLocked()) { action(); return; }

  // Already counting down — cancel it (double-click = immediate)
  if (focusLockTimer !== null) {
    clearTimeout(focusLockTimer);
    focusLockTimer = null;
    if (focusLockBar) { focusLockBar.remove(); focusLockBar = null; }
    action();
    return;
  }

  // Create progress bar overlay
  const bar = document.createElement('div');
  bar.className = 'focus-lock-bar';
  const fill = document.createElement('div'); fill.className = 'focus-lock-fill';
  const lbl  = document.createElement('span'); lbl.className = 'focus-lock-label';
  lbl.textContent = 'Stay focused… click again to open';
  bar.append(fill, lbl);
  document.body.appendChild(bar);
  focusLockBar = bar;

  requestAnimationFrame(() => {
    fill.style.transition = 'width 3s linear'; fill.style.width = '100%';
  });

  focusLockTimer = window.setTimeout(() => {
    if (focusLockBar) { focusLockBar.remove(); focusLockBar = null; }
    focusLockTimer = null;
    action();
  }, 3000);
}


$('panelToggle').onclick = () => {
  focusLockIntercept(() => {
    DOM.themePanel.classList.toggle('collapsed');
  });
};

// ── Pomodoro UI ────────────────────────────────────────────────────────
Pom.init({
  isRunning: () => sessionRunning,
  getStart:  () => sessionStart,
  timer:     DOM.sTmr,
  arc:       DOM.pomRingArc as unknown as SVGCircleElement,
  ring:      DOM.pomRingSvg as unknown as SVGSVGElement,
  pill:      DOM.pomPill,
  label:     DOM.sessionLabel,
  onPhase: txt => {
    DOM.pomPill.textContent = txt;
    if (txt.includes('Work')) {
      Sound.adaptOnWorkStart();
      setBreathing(false);
      // Acquire wake lock when work starts
      APIs.acquireWakeLock();
      APIs.sendNotification('🍅 Work Session Started', 'Stay focused. You\'ve got this.', 'pom-work');
    } else {
      // Work phase just ended → award tokens
      Sound.adaptOnBreak();
      // Release wake lock on break
      APIs.releaseWakeLock();
      // Send notification
      const isLong = txt.includes('Long');
      const mins = isLong ? Pom.getSettings().longBreakMins : Pom.getSettings().breakMins;
      APIs.sendNotification(
        isLong ? '💤 Long Break Time!' : '☕ Break Time!',
        `Great work! Take a ${mins}-minute break. You earned it.`,
        'pom-break',
      );
      if (breathingBreakEnabled && !animedoroActive) {
        setBreathing(true);
        const s = Pom.getSettings();
        const dur = isLong ? s.longBreakMins : s.breakMins;
        setTimeout(() => setBreathing(false), dur * 60_000);
      }
      if (animedoroActive) {
        const s = Pom.getSettings();
        const dur = isLong ? s.longBreakMins : s.breakMins;
        triggerTheaterMode(dur);
      }
    }
  },
});

$('btnPomToggle').addEventListener('click', () => {
  Pom.toggle();
  buildPomUI();
  openModal('pomOverlay');
});

function buildPomUI() {
  const s = Pom.getSettings();
  const countEl = $('pomCountToday');
  if (countEl) countEl.textContent = String(Pom.todayCount());
  (['pomWorkBtns','pomBreakBtns','pomLongBtns'] as const).forEach((id, i) => {
    const el = $(id); if (!el) return; el.innerHTML = '';
    const opts = i===0?[15,20,25,30,45,60]:i===1?[5,10,15]:[3,4,5,6];
    const cur  = i===0?s.workMins:i===1?s.breakMins:s.longBreakAfter;
    opts.forEach(v => {
      const b = document.createElement('button');
      b.className = 'btn' + (cur===v?' active-btn':'');
      b.textContent = i<2?`${v}m`:`${v}`;
      b.onclick = () => {
        if (i===0) Pom.updateSettings({workMins:v});
        else if (i===1) Pom.updateSettings({breakMins:v});
        else Pom.updateSettings({longBreakAfter:v});
        buildPomUI();
      };
      el.appendChild(b);
    });
  });
}

// ── Sound UI ───────────────────────────────────────────────────────────
function makeSoundTrack(
  id: string, icon: string, name: string, desc: string,
  active: boolean, vol: number, isBinaural = false
): HTMLDivElement {
  const track = document.createElement('div');
  track.className = ['sound-track', isBinaural ? 'binaural-track' : '', active ? 'active' : ''].filter(Boolean).join(' ');

  const iconEl = document.createElement('div'); iconEl.className = 'sound-track-icon';
  iconEl.textContent = icon;

  const info = document.createElement('div'); info.className = 'sound-track-info';
  const nm = document.createElement('div'); nm.className = 'sound-track-name'; nm.textContent = name;
  const ds = document.createElement('div'); ds.className = 'sound-track-desc';  ds.textContent = desc;
  info.append(nm, ds);

  const toggle = document.createElement('button');
  toggle.className = 'track-toggle' + (active ? ' on' : '');
  toggle.dataset.id = id;
  toggle.title = active ? 'Stop' : 'Play';

  if (!isBinaural) {
    const volWrap = document.createElement('div'); volWrap.className = 'sound-track-vol';
    const slider = document.createElement('input') as HTMLInputElement;
    slider.type = 'range'; slider.className = 'track-vol-slider';
    slider.min = '0'; slider.max = '200'; slider.value = String(vol);
    slider.dataset.id = id;
    const pct = document.createElement('span'); pct.className = 'sound-vol-pct';
    pct.id = 'tvp_' + id; pct.textContent = vol + '%';
    slider.addEventListener('input', e => {
      const p = +(e.target as HTMLInputElement).value; // 0–200
      const v = p / 100;                               // 0.0–2.0
      Sound.setTrackVolume(id, v);
      pct.textContent = p + '%';
      pct.style.color = p > 100 ? 'var(--clr-accent)' : '';
    });
    volWrap.append(slider, pct);
    track.append(iconEl, info, volWrap, toggle);
    toggle.addEventListener('click', () => Sound.toggleTrack(id));
  } else {
    track.append(iconEl, info, toggle);
    toggle.addEventListener('click', () => Sound.toggleBinaural(id));
  }

  return track;
}

function buildSoundUI() {
  const container = $('soundGrid'); container.innerHTML = '';

  Sound.SOUNDS.forEach(s => {
    const vol = Math.round(Sound.getTrackVolume(s.id) * 100);
    container.appendChild(makeSoundTrack(s.id, s.icon, s.name, s.desc ?? '', Sound.isPlaying(s.id), vol));
  });

  // Binaural section header
  const binHeader = document.createElement('div'); binHeader.className = 'sound-section-header';
  const binTitle = document.createElement('span'); binTitle.className = 'sound-section-title'; binTitle.textContent = '🧠 Binaural Beats';
  const binNote  = document.createElement('span'); binNote.className  = 'sound-section-note';  binNote.textContent  = 'Requires headphones';
  binHeader.append(binTitle, binNote);
  container.appendChild(binHeader);

  Sound.BINAURAL_PRESETS.forEach(p => {
    container.appendChild(makeSoundTrack(p.id, p.icon, p.name, p.desc, Sound.binauralPresetId === p.id, 100, true));
  });

  // ── Sound Presets ─────────────────────────────────────────────────────
  const presetsSection = document.createElement('div'); presetsSection.className = 'sound-presets';

  const saveChip = document.createElement('button');
  saveChip.className = 'preset-chip save-btn'; saveChip.textContent = '+ Save Mix';
  saveChip.addEventListener('click', () => {
    const name = prompt('Name this preset (e.g. "Late Night"):');
    if (!name?.trim()) return;
    saveSoundPreset(name.trim());
    buildSoundUI(); // rebuilds presets row
    showToast(`Saved "${name.trim()}" mix`);
  });
  presetsSection.appendChild(saveChip);

  getSoundPresets().forEach(p => {
    const chip = document.createElement('button');
    chip.className = 'preset-chip'; chip.textContent = p.name;
    chip.title = 'Click to load, right-click to delete';
    chip.addEventListener('click',        () => { loadSoundPreset(p); showToast(`Loaded "${p.name}"`); });
    chip.addEventListener('contextmenu',  e  => {
      e.preventDefault();
      const presets = getSoundPresets().filter(pr => pr.name !== p.name);
      localStorage.setItem('sc_sound_presets', JSON.stringify(presets));
      buildSoundUI();
    });
    presetsSection.appendChild(chip);
  });
  container.appendChild(presetsSection);
}

Sound.setTrackChangeHandler(() => {
  buildSoundUI();
  // Update MediaSession when tracks change
  const playing = Sound.SOUNDS.filter(s => Sound.isPlaying(s.id)).map(s => s.name);
  if (playing.length > 0) {
    APIs.setupMediaSession(
      playing.join(' + '),
      () => playing.forEach(n => { const s = Sound.SOUNDS.find(x => x.name === n); if (s) Sound.playTrack(s.id); }),
      () => Sound.SOUNDS.forEach(s => { if (Sound.isPlaying(s.id)) Sound.stopTrack(s.id); }),
      () => Sound.SOUNDS.forEach(s => Sound.stopTrack(s.id)),
    );
    APIs.updateMediaState('playing');
  } else {
    APIs.clearMediaSession();
  }
});

($('volSlider') as HTMLInputElement).value = String(Math.round(Sound.getMasterVolume() * 100));
($('volLabel') as HTMLElement).textContent = Math.round(Sound.getMasterVolume() * 100) + '%';
($('volSlider') as HTMLInputElement).style.setProperty('--boost-pct', '50%');
($('volSlider') as HTMLInputElement).addEventListener('input', e => {
  const pct = +(e.target as HTMLInputElement).value; // 0–200
  const v   = pct / 100;                             // 0.0–2.0
  Sound.setMasterVolume(v);
  const label = $('volLabel');
  label.textContent = pct + '%';
  label.style.color = pct > 100 ? 'var(--clr-accent)' : '';
  label.title = pct > 100 ? 'Boosted — compressor prevents clipping' : '';
});
($('fadeSlider') as HTMLInputElement).addEventListener('input', e => {
  const v = +(e.target as HTMLInputElement).value;
  Sound.setFade(v);
  $('fadeLabel').textContent = v === 0 ? 'Off' : `${v}m`;
});

// ── Focus log UI ───────────────────────────────────────────────────────
let logView: 'list' | 'heatmap' = 'list';

function openLog() {
  renderLogView();
  openModal('logOverlay');
}

function renderLogView() {
  const listBtn = $('logTabList');
  const heatBtn = $('logTabHeat');
  const container = $('logEntries');
  if (listBtn) listBtn.classList.toggle('active', logView === 'list');
  if (heatBtn) heatBtn.classList.toggle('active', logView === 'heatmap');
  if (logView === 'heatmap') Log.renderHeatmap(container);
  else Log.render(container);
}


// Tab buttons wired via onclick in HTML — expose via SC
(window as any).SC = {
  ...(window as any).SC,
  focusLog: {
    exportCSV: Log.exportCSV,
    clear: () => { Log.clear(); renderLogView(); },
    switchTab: (tab: 'list' | 'heatmap') => { logView = tab; renderLogView(); },
  },
};

// ── Custom Theme Builder — full RGB/HSL palette ───────────────────────
const THEME_FIELDS = [
  { key: 'accent',  label: 'Main Accent',  icon: '✦', hint: 'Clock glow, highlights, active states' },
  { key: 'accent2', label: 'Accent 2',     icon: '◈', hint: 'Secondary highlights, pomodoro ring' },
  { key: 'text',    label: 'Text',         icon: 'T', hint: 'All readable text' },
  { key: 'btnFg',   label: 'Button Text',  icon: '▶', hint: 'Text on accent buttons' },
  { key: 'baseBg0', label: 'Background',   icon: '▪', hint: 'Base canvas background' },
  { key: 'panel',   label: 'Panel',        icon: '▭', hint: 'Cards, modals, panels' },
];
let draft: Record<string, string> = {
  text: '#e0f2fe', accent: '#6ee7b7', accent2: '#818cf8',
  btnFg: '#06030f', baseBg0: '#06030f', panel: 'rgba(4,3,18,.85)',
};
const rgbaToHex = (s: string): string => {
  const m = s.match(/[\d.]+/g);
  return m ? '#' + [m[0], m[1], m[2]].map(v => parseInt(v).toString(16).padStart(2,'0')).join('') : '#ffffff';
};
const hexToRgb = (h: string): [number,number,number] => {
  const v = parseInt(h.slice(1), 16);
  return [(v>>16)&255, (v>>8)&255, v&255];
};
const hexToHsl = (h: string): [number,number,number] => {
  const [r,g,b] = hexToRgb(h).map(v => v/255) as [number,number,number];
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const l = (max+min)/2;
  if (max === min) return [0, 0, Math.round(l*100)];
  const d = max - min;
  const s = l > 0.5 ? d/(2-max-min) : d/(max+min);
  let hue = 0;
  if (max===r) hue = ((g-b)/d + (g<b?6:0))/6;
  else if (max===g) hue = ((b-r)/d + 2)/6;
  else hue = ((r-g)/d + 4)/6;
  return [Math.round(hue*360), Math.round(s*100), Math.round(l*100)];
};
const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1-l);
  const f = (n: number) => { const k = (n+h/30)%12; const c = l - a*Math.max(Math.min(k-3,9-k,1),-1); return Math.round(255*c).toString(16).padStart(2,'0'); };
  return '#' + f(0) + f(8) + f(4);
};

// Currently active picker field
let _pickerField = 'accent';

function buildColorRows() {
  const container = $('colorRows'); if (!container) return;
  container.innerHTML = '';

  // Swatch bar — all fields as clickable pills
  const swatchBar = document.createElement('div');
  swatchBar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;padding:0 22px 16px;';
  THEME_FIELDS.forEach(f => {
    const raw = draft[f.key] ?? '#ffffff';
    const hex = raw.startsWith('r') ? rgbaToHex(raw) : raw;
    const pill = document.createElement('button');
    pill.className = 'color-swatch-pill' + (f.key === _pickerField ? ' active' : '');
    pill.dataset.key = f.key;
    const dot = document.createElement('span');
    dot.style.cssText = `width:14px;height:14px;border-radius:50%;background:${hex};flex-shrink:0;box-shadow:0 0 0 1.5px rgba(255,255,255,.15);`;
    const lbl = document.createElement('span'); lbl.style.cssText = 'font-size:.62rem;font-weight:600;'; lbl.textContent = f.label;
    pill.append(dot, lbl);
    pill.addEventListener('click', () => { _pickerField = f.key; buildColorRows(); });
    swatchBar.appendChild(pill);
  });
  container.appendChild(swatchBar);

  // Active field info
  const activeField = THEME_FIELDS.find(f => f.key === _pickerField)!;
  const activeRaw = draft[_pickerField] ?? '#6ee7b7';
  const activeHex = activeRaw.startsWith('r') ? rgbaToHex(activeRaw) : activeRaw;
  const [ah, as_, al] = hexToHsl(activeHex);
  const [ar, ag_, ab] = hexToRgb(activeHex);

  const pickerWrap = document.createElement('div');
  pickerWrap.style.cssText = 'padding:0 22px;';

  // Field label
  const fieldLabel = document.createElement('div');
  fieldLabel.style.cssText = 'font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;opacity:.45;margin-bottom:12px;';
  fieldLabel.textContent = `${activeField.icon} ${activeField.label} — ${activeField.hint}`;
  pickerWrap.appendChild(fieldLabel);

  // HSL canvas gradient picker (2D: X=saturation, Y=lightness)
  const canvasSize = Math.min(280, (window.innerWidth - 60));
  const gradCanvas = document.createElement('canvas');
  gradCanvas.width = canvasSize; gradCanvas.height = Math.floor(canvasSize * 0.55);
  gradCanvas.style.cssText = `width:100%;border-radius:10px;cursor:crosshair;display:block;margin-bottom:10px;touch-action:none;`;
  pickerWrap.appendChild(gradCanvas);

  const drawGradCanvas = (hue: number) => {
    const ctx = gradCanvas.getContext('2d')!;
    const W = gradCanvas.width, H = gradCanvas.height;
    // Saturation gradient (left=white, right=hue)
    const satGrad = ctx.createLinearGradient(0, 0, W, 0);
    satGrad.addColorStop(0, 'white');
    satGrad.addColorStop(1, `hsl(${hue},100%,50%)`);
    ctx.fillStyle = satGrad; ctx.fillRect(0, 0, W, H);
    // Lightness gradient (top=transparent, bottom=black)
    const litGrad = ctx.createLinearGradient(0, 0, 0, H);
    litGrad.addColorStop(0, 'transparent');
    litGrad.addColorStop(1, 'black');
    ctx.fillStyle = litGrad; ctx.fillRect(0, 0, W, H);
    // Draw current position cursor
    const cx = (as_ / 100) * W;
    const cy = (1 - al / 100) * H;
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI*2);
    ctx.strokeStyle = al > 50 ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.9)';
    ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI*2);
    ctx.fillStyle = activeHex; ctx.fill();
  };
  drawGradCanvas(ah);

  // Hue strip
  const hueCanvas = document.createElement('canvas');
  hueCanvas.width = canvasSize; hueCanvas.height = 18;
  hueCanvas.style.cssText = 'width:100%;border-radius:6px;cursor:crosshair;display:block;margin-bottom:10px;touch-action:none;';
  pickerWrap.appendChild(hueCanvas);
  const drawHueStrip = () => {
    const ctx = hueCanvas.getContext('2d')!;
    const W = hueCanvas.width, H = hueCanvas.height;
    const hueGrad = ctx.createLinearGradient(0, 0, W, 0);
    for (let i = 0; i <= 360; i += 30) hueGrad.addColorStop(i/360, `hsl(${i},100%,50%)`);
    ctx.fillStyle = hueGrad; ctx.fillRect(0, 0, W, H);
    // Cursor
    const cx = (ah / 360) * W;
    ctx.beginPath(); ctx.arc(cx, H/2, H/2 - 1, 0, Math.PI*2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  };
  drawHueStrip();

  // Canvas interaction helpers
  const updateFromGrad = (e: MouseEvent | Touch) => {
    const r = gradCanvas.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const yPct = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    const newS = Math.round(xPct * 100);
    const newL = Math.round((1 - yPct) * 100);
    const hex = hslToHex(ah, newS, newL);
    draft[_pickerField] = hex;
    updateAllInputs(hex); previewCustomTheme(); drawGradCanvas(ah); drawHueStrip();
  };
  const updateFromHue = (e: MouseEvent | Touch) => {
    const r = hueCanvas.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const newH = Math.round(xPct * 360);
    const hex = hslToHex(newH, as_, al);
    draft[_pickerField] = hex;
    updateAllInputs(hex); previewCustomTheme(); drawGradCanvas(newH); drawHueStrip();
  };
  let gradDragging = false, hueDragging = false;
  gradCanvas.addEventListener('mousedown', e => { gradDragging = true; updateFromGrad(e); });
  gradCanvas.addEventListener('touchstart', e => { gradDragging = true; updateFromGrad(e.touches[0]!); }, { passive: true });
  hueCanvas.addEventListener('mousedown', e => { hueDragging = true; updateFromHue(e); });
  hueCanvas.addEventListener('touchstart', e => { hueDragging = true; updateFromHue(e.touches[0]!); }, { passive: true });
  window.addEventListener('mousemove', e => {
    if (gradDragging) updateFromGrad(e);
    if (hueDragging) updateFromHue(e);
  });
  window.addEventListener('mouseup', () => { gradDragging = false; hueDragging = false; });
  window.addEventListener('touchend', () => { gradDragging = false; hueDragging = false; }, { passive: true });
  gradCanvas.addEventListener('touchmove', e => { if (gradDragging) updateFromGrad(e.touches[0]!); }, { passive: true });
  hueCanvas.addEventListener('touchmove', e => { if (hueDragging) updateFromHue(e.touches[0]!); }, { passive: true });

  // Hex / RGB / HSL text inputs
  const inputRow = document.createElement('div');
  inputRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px;';

  const makeValueInput = (label: string, id: string, value: string, onChange: (v: string) => void) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
    const lbl = document.createElement('label');
    lbl.style.cssText = 'font-size:.5rem;opacity:.4;letter-spacing:.08em;text-transform:uppercase;';
    lbl.textContent = label;
    const inp = document.createElement('input'); inp.id = id;
    inp.style.cssText = 'padding:6px 8px;border-radius:7px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:var(--clr-text);font-family:monospace;font-size:.68rem;width:100%;box-sizing:border-box;';
    inp.value = value;
    inp.addEventListener('change', () => onChange(inp.value.trim()));
    wrap.append(lbl, inp); return wrap;
  };

  const updateAllInputs = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    const [h, s, l] = hexToHsl(hex);
    const hexInp = document.getElementById('picker-hex') as HTMLInputElement | null;
    const rgbInp = document.getElementById('picker-rgb') as HTMLInputElement | null;
    const hslInp = document.getElementById('picker-hsl') as HTMLInputElement | null;
    if (hexInp) hexInp.value = hex;
    if (rgbInp) rgbInp.value = `${r}, ${g}, ${b}`;
    if (hslInp) hslInp.value = `${h}, ${s}%, ${l}%`;
    // Update swatch dot
    const pill = swatchBar.querySelector(`[data-key="${_pickerField}"] span`) as HTMLElement | null;
    if (pill) pill.style.background = hex;
  };

  inputRow.appendChild(makeValueInput('Hex', 'picker-hex', activeHex, v => {
    const clean = v.startsWith('#') ? v : '#' + v;
    if (/^#[0-9a-f]{6}$/i.test(clean)) { draft[_pickerField] = clean; updateAllInputs(clean); previewCustomTheme(); const [h] = hexToHsl(clean); drawGradCanvas(h); drawHueStrip(); }
  }));
  inputRow.appendChild(makeValueInput('RGB', 'picker-rgb', `${ar}, ${ag_}, ${ab}`, v => {
    const parts = v.split(',').map(s => parseInt(s.trim()));
    if (parts.length === 3 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
      const hex = '#' + parts.map(p => p.toString(16).padStart(2,'0')).join('');
      draft[_pickerField] = hex; updateAllInputs(hex); previewCustomTheme(); const [h] = hexToHsl(hex); drawGradCanvas(h); drawHueStrip();
    }
  }));
  inputRow.appendChild(makeValueInput('HSL', 'picker-hsl', `${ah}, ${as_}%, ${al}%`, v => {
    const parts = v.replace(/%/g,'').split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 3 && !parts.some(isNaN)) {
      const hex = hslToHex(parts[0]!, parts[1]!, parts[2]!);
      draft[_pickerField] = hex; updateAllInputs(hex); previewCustomTheme(); drawGradCanvas(parts[0]!); drawHueStrip();
    }
  }));
  pickerWrap.appendChild(inputRow);

  // Quick palette swatches — curated harmonious colours
  const paletteLabel = document.createElement('div');
  paletteLabel.style.cssText = 'font-size:.52rem;opacity:.35;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;';
  paletteLabel.textContent = 'Quick picks';
  pickerWrap.appendChild(paletteLabel);
  const palette = document.createElement('div');
  palette.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;';
  const QUICK = ['#6ee7b7','#818cf8','#f472b6','#fbbf24','#34d399','#60a5fa','#a78bfa',
                 '#fb923c','#e879f9','#00eeff','#ff0090','#ff6600','#22d3ee','#ffffff','#000000'];
  QUICK.forEach(c => {
    const dot = document.createElement('button');
    dot.style.cssText = `width:22px;height:22px;border-radius:50%;background:${c};border:2px solid rgba(255,255,255,.15);cursor:pointer;transition:transform .15s;flex-shrink:0;`;
    dot.title = c;
    dot.addEventListener('click', () => {
      draft[_pickerField] = c; updateAllInputs(c); previewCustomTheme();
      const [h] = hexToHsl(c); drawGradCanvas(h); drawHueStrip();
    });
    dot.addEventListener('mouseenter', () => { dot.style.transform = 'scale(1.3)'; });
    dot.addEventListener('mouseleave', () => { dot.style.transform = ''; });
    palette.appendChild(dot);
  });
  pickerWrap.appendChild(palette);

  container.appendChild(pickerWrap);
  renderSavedSwatches();
}

function previewCustomTheme() {
  cssVar('--clr-text', draft.text); cssVar('--clr-accent', draft.accent);
  cssVar('--clr-accent2', draft.accent2); cssVar('--clr-btn-fg', draft.btnFg);
  cssVar('--clr-panel', draft.panel);
}

function saveCustomTheme() {
  const saved: {id:string; name:string; draft:typeof draft}[] = JSON.parse(localStorage.getItem('sc_custom_themes')||'[]');
  saved.push({ id:'custom_'+Date.now(), name:'Custom '+saved.length, draft:{...draft} });
  if (saved.length > 10) saved.shift();
  localStorage.setItem('sc_custom_themes', JSON.stringify(saved));
  renderSavedSwatches(); showToast('🎨 Custom theme saved!');
}

function renderSavedSwatches() {
  const row = $('savedThemeRow'); if (!row) return;
  const saved: {id:string; name:string; draft:typeof draft}[] = JSON.parse(localStorage.getItem('sc_custom_themes')||'[]');
  row.innerHTML = '';
  if (!saved.length) {
    const msg = document.createElement('span');
    msg.style.cssText = 'font-size:.65rem;opacity:.3;color:var(--clr-text)';
    msg.textContent = 'No saved themes yet';
    row.appendChild(msg); return;
  }
  saved.forEach(item => {
    const sw = document.createElement('div'); sw.className = 'saved-swatch'; sw.style.background = item.draft.accent; sw.title = item.name;
    sw.onclick = () => { draft = {...item.draft}; previewCustomTheme(); buildColorRows(); };
    row.appendChild(sw);
  });
}

function openThemeBuilder() { buildColorRows(); openModal('themeBuilderOverlay'); }

(window as any).SC = { ...(window as any).SC, themeBuilder: { preview: previewCustomTheme, save: saveCustomTheme, reset: () => applyTheme(currentTheme, true), openBuilder: openThemeBuilder } };

// ── Settings modal ────────────────────────────────────────────────────
let _lastSettingsTab = 'general';
function openSettings() {
  buildSettingsUI(_lastSettingsTab);
  openModal('settingsOverlay');
}

function buildSettingsUI(activeTab = 'general') {
  const tabBarEl = $('settingsTabBar');
  const el       = $('settingsContent');
  if (!el || !tabBarEl) return;
  el.innerHTML = '';
  tabBarEl.innerHTML = '';

  // Animate content in
  el.style.animation = 'none';
  void el.offsetWidth; // reflow
  el.style.animation = 'paneFadeIn .18s ease';

  // ── Tab definitions ───────────────────────────────────────────────────
  const tabs = [
    { id: 'general',  icon: '✦',  label: 'General'  },
    { id: 'sound',    icon: '🎵', label: 'Sound'    },
    { id: 'focus',    icon: '⏱',  label: 'Focus'    },
    { id: 'display',  icon: '🎨', label: 'Display'  },
    { id: 'privacy',  icon: '🔒', label: 'Privacy'  },
  ];

  // Tab bar — written to #settingsTabBar (outside scroll container)
  const tabBar = document.createElement('div'); tabBar.className = 'settings-tab-bar';
  tabs.forEach(t => {
    const btn = document.createElement('button'); btn.className = 'settings-tab-btn' + (t.id === activeTab ? ' active' : '');
    btn.dataset.tab = t.id;
    const ic = document.createElement('span'); ic.className = 'stb-icon'; ic.textContent = t.icon;
    const lb = document.createElement('span'); lb.className = 'stb-label'; lb.textContent = t.label;
    btn.append(ic, lb);
    btn.addEventListener('click', () => { _lastSettingsTab = t.id; buildSettingsUI(t.id); });
    tabBar.appendChild(btn);
  });
  tabBarEl.appendChild(tabBar);

  // Pane container — scrollable body
  const paneWrap = el; // write directly to settingsContent

  const makeSection = (title: string) => {
    const s = document.createElement('div'); s.className = 'settings-section';
    const h = document.createElement('div'); h.className = 'settings-section-title'; h.textContent = title;
    s.appendChild(h); return s;
  };

  const makeRow = (lText: string, dText: string, btnId: string, on: boolean, badge?: string) => {
    const row = document.createElement('div'); row.className = 'settings-row';
    const info = document.createElement('div'); info.className = 'settings-row-info';
    const top  = document.createElement('div'); top.className  = 'settings-row-top';
    const lbl  = document.createElement('span'); lbl.className = 'settings-row-label'; lbl.textContent = lText;
    top.appendChild(lbl);
    if (badge) {
      const b = document.createElement('span'); b.className = 'settings-badge'; b.textContent = badge;
      top.appendChild(b);
    }
    const dsc  = document.createElement('span'); dsc.className = 'settings-row-desc'; dsc.textContent = dText;
    info.append(top, dsc);
    const tog  = document.createElement('button'); tog.className = 'settings-toggle' + (on ? ' on' : ''); tog.id = btnId;
    row.append(info, tog); return row;
  };

  const wireToggle = (id: string, fn: (on: boolean) => void) => {
    paneWrap.querySelector<HTMLButtonElement>('#' + id)?.addEventListener('click', e => {
      const btn = e.currentTarget as HTMLButtonElement;
      const wasOn = btn.classList.contains('on');
      btn.classList.toggle('on');
      // Ripple animation on enable
      if (!wasOn) {
        const rip = document.createElement('span'); rip.className = 'toggle-ripple';
        btn.appendChild(rip);
        setTimeout(() => rip.remove(), 600);
      }
      fn(!wasOn);
    });
  };

  // ══ GENERAL ════════════════════════════════════════════════════════════
  if (activeTab === 'general') {
    const clockModes: { mode: ClockMode; label: string; icon: string; desc: string }[] = [
      { mode: 'digital',  label: 'Digital',  icon: '🔢', desc: 'Classic digits'   },
      { mode: 'analogue', label: 'Analogue', icon: '🕐', desc: 'Sweep hands'      },
      { mode: 'flip',     label: 'Flip',     icon: '📅', desc: '3D card flip'     },
      { mode: 'word',     label: 'Word',     icon: '📝', desc: 'It is half past'  },
      { mode: 'minimal',  label: 'Minimal',  icon: '○',  desc: 'Hour only, huge'  },
      { mode: 'segment',  label: 'Segment',  icon: '📟', desc: 'LED 7-segment'    },
    ];
    const clockSec = makeSection('Clock Style');
    const grid = document.createElement('div'); grid.className = 'clock-mode-grid';
    clockModes.forEach(({ mode, label, icon, desc }) => {
      const btn = document.createElement('button');
      btn.className = 'clock-mode-btn' + (clockMode === mode ? ' active' : '');
      btn.dataset.mode = mode;
      const iEl = document.createElement('span'); iEl.className = 'cmb-icon';  iEl.textContent = icon;
      const lEl = document.createElement('span'); lEl.className = 'cmb-label'; lEl.textContent = label;
      const dEl = document.createElement('span'); dEl.className = 'cmb-desc';  dEl.textContent = desc;
      btn.append(iEl, lEl, dEl);
      btn.addEventListener('click', () => {
        setClockMode(mode); updateClockCanvas();
        grid.querySelectorAll('.clock-mode-btn').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.mode === mode));
      });
      grid.appendChild(btn);
    });
    clockSec.appendChild(grid);
    paneWrap.appendChild(clockSec);

    // Quick actions
    const actionSec = makeSection('Quick Actions');
    const actionGrid = document.createElement('div'); actionGrid.className = 'settings-action-grid';
    const quickActions = [
      { label: '🎨 Custom Theme', fn: () => { closeModal('settingsOverlay'); openThemeBuilder(); } },
      { label: '📱 QR Handoff',   fn: () => { closeModal('settingsOverlay'); openQRHandoff(); } },
      { label: '🎬 Animedoro',    fn: () => { closeModal('settingsOverlay'); startAnimedoro(); openModal('pomOverlay'); } },
      { label: '⛶ Kiosk Mode',   fn: () => { closeModal('settingsOverlay'); toggleKiosk(); } },
      { label: '📺 Present',      fn: () => { closeModal('settingsOverlay'); togglePresent(); } },
      { label: '🖼 Picture-in-Picture', fn: async () => {
          closeModal('settingsOverlay');
          if (APIs.isPiPActive()) { await APIs.exitPiP(); showToast('PiP closed'); }
          else { await APIs.enterPiP(document.getElementById('clock-block-wrap')!, { accent: currentTheme.accent, text: currentTheme.text, baseBg: currentTheme.baseBg }); showToast('Clock floating in PiP'); }
        }
      },
    ];
    quickActions.forEach(({ label, fn }) => {
      const btn = document.createElement('button'); btn.className = 'settings-action-btn';
      btn.textContent = label; btn.addEventListener('click', fn as () => void);
      actionGrid.appendChild(btn);
    });
    actionSec.appendChild(actionGrid);
    paneWrap.appendChild(actionSec);

    // Language
    const langSec = makeSection('Language');
    const langBtn = document.createElement('button');
    langBtn.className = 'settings-action-btn settings-action-btn--full';
    const curFlag = LOCALE_FLAGS[getLocale()];
    const curName = LOCALE_NAMES[getLocale()];
    langBtn.textContent = `${curFlag} ${curName} — Change language`;
    langBtn.addEventListener('click', () => {
      buildLanguageUI(document.getElementById('languageContent')!);
      openModal('languageOverlay');
    });
    langSec.appendChild(langBtn);
    paneWrap.appendChild(langSec);

    // Integrations shortcut
    const intSec = makeSection('Integrations');
    const intBtn = document.createElement('button');
    intBtn.className = 'settings-action-btn settings-action-btn--full';
    const connectedCount = Object.values(Integrations.getConnectionStatus()).filter(Boolean).length;
    intBtn.textContent = connectedCount > 0
      ? `🔗 ${connectedCount} integration${connectedCount > 1 ? 's' : ''} connected — Manage`
      : '🔗 Connect Spotify, Calendar, Notion, Todoist…';
    intBtn.addEventListener('click', () => { closeModal('settingsOverlay'); openIntegrations(); });
    intSec.appendChild(intBtn);
    paneWrap.appendChild(intSec);
  }
  else if (activeTab === 'sound') {
    const audioSec = makeSection('Audio');
    audioSec.appendChild(makeRow('3D Spatial Audio', 'Sounds pan independently — best with headphones', 'toggleSpatial', Sound.isSpatialEnabled(), 'ILD+ITD'));
    audioSec.appendChild(makeRow('Box Breathing on Break', 'Guided breathing overlay during Pomodoro breaks', 'toggleBreathing', breathingBreakEnabled));
    audioSec.appendChild(makeRow('UI Sound Effects', 'Subtle click, chime, and interaction sounds', 'toggleUiSounds', localStorage.getItem('sc_ui_sounds') !== '0'));
    paneWrap.appendChild(audioSec);

    const soundBtnSec = makeSection('Mixer');
    const openMixerBtn = document.createElement('button'); openMixerBtn.className = 'settings-action-btn settings-action-btn--full';
    openMixerBtn.textContent = '🎵 Open Sound Mixer';
    openMixerBtn.addEventListener('click', () => { closeModal('settingsOverlay'); buildSoundUI(); openModal('soundOverlay'); });
    soundBtnSec.appendChild(openMixerBtn);
    paneWrap.appendChild(soundBtnSec);

    wireToggle('toggleSpatial',   (on) => Sound.setSpatial(on));
    wireToggle('toggleBreathing', (on) => { breathingBreakEnabled = on; localStorage.setItem('sc_breathing_break', on ? '1' : '0'); });
    wireToggle('toggleUiSounds',  (on) => { localStorage.setItem('sc_ui_sounds', on ? '1' : '0'); showToast(on ? '🔔 UI sounds on' : '🔕 UI sounds off'); });
  }

  // ══ FOCUS ═════════════════════════════════════════════════════════════
  else if (activeTab === 'focus') {
    const focusSec = makeSection('Pomodoro & Sessions');
    focusSec.appendChild(makeRow('Focus Lock Delay', '3-second intentional friction before opening panels during Pomodoro', 'toggleFocusLockS', focusLockEnabled));
    focusSec.appendChild(makeRow('Smart Break Reminder', 'Gently pulses after 90 uninterrupted minutes', 'toggleSmartBreak', localStorage.getItem('sc_smart_break') !== '0'));
    paneWrap.appendChild(focusSec);

    const pomBtn = document.createElement('button'); pomBtn.className = 'settings-action-btn settings-action-btn--full';
    pomBtn.textContent = '⏱ Pomodoro Settings';
    pomBtn.addEventListener('click', () => { closeModal('settingsOverlay'); openModal('pomOverlay'); });
    const pomSec = makeSection('Timer'); pomSec.appendChild(pomBtn);
    paneWrap.appendChild(pomSec);

    wireToggle('toggleFocusLockS', () => toggleFocusLock());
    wireToggle('toggleSmartBreak', (on) => { localStorage.setItem('sc_smart_break', on ? '1' : '0'); });
  }

  // ══ DISPLAY ═══════════════════════════════════════════════════════════
  else if (activeTab === 'display') {
    // Clock position
    const layoutSec = makeSection('Layout');
    const clockPosRow = document.createElement('div'); clockPosRow.className = 'settings-row';
    const cpInfo = document.createElement('div'); cpInfo.className = 'settings-row-info';
    const cpTop = document.createElement('div'); cpTop.className = 'settings-row-top';
    const cpLbl = document.createElement('span'); cpLbl.className = 'settings-row-label'; cpLbl.textContent = 'Clock Position';
    cpTop.appendChild(cpLbl);
    const cpDesc = document.createElement('span'); cpDesc.className = 'settings-row-desc'; cpDesc.textContent = 'Top: classic layout. Centre: full-viewport clock.';
    cpInfo.append(cpTop, cpDesc);
    const cpSeg = document.createElement('div'); cpSeg.className = 'settings-seg';
    ['top','center'].forEach(pos => {
      const btn = document.createElement('button');
      btn.className = 'settings-seg-btn' + (clockPosition === pos ? ' active' : '');
      btn.textContent = pos === 'top' ? '⊟ Top' : '⊞ Centre';
      btn.addEventListener('click', () => {
        applyClockPosition(pos as 'top' | 'center');
        cpSeg.querySelectorAll('.settings-seg-btn').forEach((b, i) => b.classList.toggle('active', i === (pos === 'top' ? 0 : 1)));
      });
      cpSeg.appendChild(btn);
    });
    clockPosRow.append(cpInfo, cpSeg);
    layoutSec.appendChild(clockPosRow);

    paneWrap.appendChild(layoutSec);

    const animSec = makeSection('Motion & Animations');
    const reduceMotion = localStorage.getItem('sc_reduce_motion') === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    animSec.appendChild(makeRow('Reduce Motion', 'Simpler transitions, no parallax, no particle animations', 'toggleReduceMotion', reduceMotion));
    animSec.appendChild(makeRow('Parallax Depth', 'Canvas layers shift with mouse/gyroscope movement', 'toggleParallax', localStorage.getItem('sc_parallax') !== '0'));
    paneWrap.appendChild(animSec);

    const perfSec = makeSection('Performance');
    const qualityRow = document.createElement('div'); qualityRow.className = 'settings-row';
    const qualInfo = document.createElement('div'); qualInfo.className = 'settings-row-info';
    const qualTop  = document.createElement('div'); qualTop.className  = 'settings-row-top';
    const qualLbl  = document.createElement('span'); qualLbl.className = 'settings-row-label'; qualLbl.textContent = 'Render Quality';
    const fpsBadge = document.createElement('span'); fpsBadge.className = 'settings-badge'; fpsBadge.textContent = `${getFps()} fps`;
    qualTop.append(qualLbl, fpsBadge);
    const qualDesc = document.createElement('span'); qualDesc.className = 'settings-row-desc';
    qualDesc.textContent = `Auto-detected: ${getTier().toUpperCase()}`;
    qualInfo.append(qualTop, qualDesc);
    const qualSelect = document.createElement('select'); qualSelect.className = 'settings-select';
    (['auto','high','med','low'] as const).forEach(v => {
      const opt = document.createElement('option');
      opt.value = v === 'auto' ? '' : v; opt.textContent = v === 'auto' ? 'Auto' : v.charAt(0).toUpperCase() + v.slice(1);
      const stored = localStorage.getItem('sc_quality');
      if ((v === 'auto' && !stored) || stored === v) opt.selected = true;
      qualSelect.appendChild(opt);
    });
    qualSelect.addEventListener('change', () => {
      const val = qualSelect.value as QualityTier | '';
      if (val) setTier(val as QualityTier); else localStorage.removeItem('sc_quality');
      invalidateCache();
      qualDesc.textContent = `Quality: ${getTier().toUpperCase()}`;
      fpsBadge.textContent = `${getFps()} fps`;
      showToast(`Quality set to ${getTier().toUpperCase()}`);
    });
    qualityRow.append(qualInfo, qualSelect);
    perfSec.appendChild(qualityRow);
    paneWrap.appendChild(perfSec);

    wireToggle('toggleReduceMotion', (on) => {
      localStorage.setItem('sc_reduce_motion', on ? '1' : '0');
      document.body.classList.toggle('reduced-motion', on);
      showToast(on ? 'Reduced motion on' : 'Full animations on');
    });
    wireToggle('toggleParallax', (on) => {
      localStorage.setItem('sc_parallax', on ? '1' : '0');
      showToast(on ? 'Parallax on' : 'Parallax off');
    });
  }

  // ══ PRIVACY ══════════════════════════════════════════════════════════
  else if (activeTab === 'privacy') {
    const privSec = makeSection('Privacy Mode');
    privSec.appendChild(makeRow('Privacy Mode', 'Disables weather, time sync & Google Fonts — local only', 'togglePrivacyS', privacyMode, privacyMode ? 'On' : undefined));
    paneWrap.appendChild(privSec);

    const sessionSec = makeSection('Sessions');
    sessionSec.appendChild(makeRow('Incognito Sessions', 'Sessions run in memory — nothing written to storage', 'toggleIncognito', Privacy.isIncognito()));
    sessionSec.appendChild(makeRow('Auto-Clear on Close', 'Wipe session log & focus data when tab closes', 'toggleAutoClear', Privacy.isAutoClear()));
    paneWrap.appendChild(sessionSec);

    const dataBtnSec = makeSection('Data');
    const dataBtn = document.createElement('button'); dataBtn.className = 'settings-action-btn settings-action-btn--full';
    dataBtn.textContent = '🛡 View & Manage My Data';
    dataBtn.addEventListener('click', () => { closeModal('settingsOverlay'); openDataPanel(); });
    dataBtnSec.appendChild(dataBtn);
    paneWrap.appendChild(dataBtnSec);

    // Privacy mode toggle with lock animation
    wireToggle('togglePrivacyS', (on) => {
      togglePrivacy();
      // Lock-down animation
      if (on) {
        document.body.classList.add('privacy-activating');
        setTimeout(() => document.body.classList.remove('privacy-activating'), 800);
      }
    });
    wireToggle('toggleIncognito', (on) => { Privacy.setIncognito(on); showToast(on ? '🕵 Incognito on — sessions not saved' : 'Incognito off'); });
    wireToggle('toggleAutoClear', (on) => { Privacy.setAutoClear(on); showToast(on ? 'Auto-clear on close enabled' : 'Auto-clear disabled'); });
  }

  // Add bottom padding so last row isn't flush against modal edge
  const pad = document.createElement('div'); pad.style.height = '12px';
  el.appendChild(pad);
}





// ── QR Handoff ────────────────────────────────────────────────────────
function openQRHandoff() {
  const canvas = $<HTMLCanvasElement>('qrCanvas');
  const label  = $('qrLabel');
  const urlEl  = $('qrUrl');
  if (!canvas) return;

  // Build state URL
  const state: Record<string, string> = {
    theme: currentTheme.id,
    clock: clockMode,
  };
  if (sessionRunning) {
    state.ses = '1';
    state.elapsed = String(Math.round(performance.now() - sessionStart));
  }
  if (Pom.isActive()) {
    state.pom = '1';
    const s = Pom.getSettings();
    state.pw = String(s.workMins);
    state.pb = String(s.breakMins);
  }
  if (DOM.focusInput.value.trim()) {
    state.task = DOM.focusInput.value.trim().slice(0, 30);
  }

  const params = new URLSearchParams(state).toString();
  const url = `${location.origin}${location.pathname}?${params}`;

  if (urlEl) {
    urlEl.textContent = url.length > 60 ? url.slice(0, 57) + '…' : url;
  }

  // Draw QR using theme colours
  const fg = currentTheme.text;
  const bg = currentTheme.baseBg[1] ?? currentTheme.baseBg[0];
  drawQR(canvas, url, fg, bg);

  if (label) label.textContent = url.length > 77
    ? 'URL too long for QR — shorten task name'
    : 'Scan to continue this session on another device';

  openModal('qrOverlay');
}

// Read handoff state from URL on load
function applyHandoffState() {
  const p = new URLSearchParams(location.search);
  if (!p.has('theme') && !p.has('ses')) return;
  const themeId = p.get('theme');
  if (themeId && THEME_BY_ID[themeId]) applyTheme(THEME_BY_ID[themeId], true);
  const cm = p.get('clock') as ClockMode | null;
  if (cm) { setClockMode(cm); updateClockCanvas(); }
  const task = p.get('task');
  if (task) { DOM.focusInput.value = task; }
  if (p.get('ses') === '1') {
    const elapsed = parseInt(p.get('elapsed') ?? '0');
    sessionElapsed = elapsed;
    setTimeout(() => DOM.btnStart.click(), 800); // auto-resume
  }
  // Clean URL
  history.replaceState({}, '', location.pathname);
}

// ── Animedoro mode ────────────────────────────────────────────────────
let animedoroActive = false;
let theaterTimer: number | null = null;
let theaterRemainMs = 20 * 60_000;

function startAnimedoro() {
  // 50 min work / 20 min theater break variant
  Pom.updateSettings({ workMins: 50, breakMins: 20 });
  animedoroActive = true;
  if (!Pom.isActive()) {
    Pom.toggle();
    buildPomUI();
  }
}

function triggerTheaterMode(breakMins: number) {
  const overlay = document.getElementById('theaterOverlay');
  const timerEl = document.getElementById('theaterTimer');
  const minEl   = document.getElementById('theaterMinutes');
  if (!overlay) return;

  theaterRemainMs = breakMins * 60_000;
  if (minEl) minEl.textContent = String(breakMins);
  overlay.classList.add('visible');

  const tick = () => {
    theaterRemainMs -= 1000;
    if (timerEl) {
      const m = Math.floor(theaterRemainMs / 60000);
      const s = Math.floor((theaterRemainMs % 60000) / 1000);
      timerEl.textContent = `${p2(m)}:${p2(s)}`;
    }
    if (theaterRemainMs <= 0) {
      overlay.classList.remove('visible');
      if (theaterTimer) clearInterval(theaterTimer);
    }
  };
  if (theaterTimer) clearInterval(theaterTimer);
  theaterTimer = window.setInterval(tick, 1000);

  const skipBtn = document.getElementById('theaterSkip');
  if (skipBtn) skipBtn.onclick = () => {
    overlay.classList.remove('visible');
    if (theaterTimer) clearInterval(theaterTimer);
  };
}

function updatePanelHeight() {
  const panel = $('themePanel');
  if (!panel) return;
  const h = panel.offsetHeight;
  document.documentElement.style.setProperty('--panel-h', h + 'px');
}

// ── Info strip — intelligence-powered ────────────────────────────────
const BASE_INFO_ITEMS = [
  () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const weekNum = Math.ceil(dayOfYear / 7);
    return `Week ${weekNum} · Day ${dayOfYear} of ${now.getFullYear()}`;
  },
  () => {
    const now = new Date();
    const endOfYear = new Date(now.getFullYear(), 11, 31);
    const daysLeft = Math.ceil((endOfYear.getTime() - now.getTime()) / 86400000);
    return `${daysLeft} days left in ${now.getFullYear()}`;
  },
  () => {
    const now = new Date();
    const pct = ((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400 * 100).toFixed(1);
    return `${pct}% of today complete`;
  },
];

function getAllInfoItems(): Array<() => string> {
  return [...Intel.getIntelligenceInsights(), ...BASE_INFO_ITEMS];
}

let infoIdx = 0;
function rotateInfo() {
  const slide = DOM.infoSlide;
  const label = DOM.infoLabel;
  if (!slide || !label) return;
  slide.classList.add('leaving');
  setTimeout(() => {
    const items = getAllInfoItems();
    infoIdx = (infoIdx + 1) % items.length;
    label.textContent = items[infoIdx]();
    slide.classList.remove('leaving');
    slide.style.animation = 'none';
    void slide.offsetWidth;
    slide.style.animation = '';
  }, 420);
}

// ── Clock canvas/DOM manager ──────────────────────────────────────────
function updateClockCanvas() {
  const block = document.getElementById('clock-block-wrap');
  if (!block) return;
  block.dataset.mode = clockMode;

  // Remove all existing alt clock elements
  ['analogueClock','flipClockWrap','wordClockGrid','minimalClockWrap','segmentClock'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  // Show/hide digital clock row
  const digitalRow = document.querySelector<HTMLElement>('.clock-row');
  if (digitalRow) digitalRow.style.display = (clockMode === 'digital') ? '' : 'none';
  const ampmStack = document.querySelector<HTMLElement>('.ampm-stack');
  if (ampmStack) ampmStack.style.display = (clockMode === 'digital') ? '' : 'none';

  if (clockMode === 'analogue') {
    const canvas = document.createElement('canvas');
    canvas.id = 'analogueClock';
    const sz = Math.min(Math.min(window.innerWidth * 0.65, window.innerHeight * 0.38), 340);
    canvas.width = canvas.height = sz;
    block.appendChild(canvas);

  } else if (clockMode === 'flip') {
    const wrap = document.createElement('div');
    wrap.id = 'flipClockWrap'; wrap.className = 'flip-clock-wrap';
    ['Hr','Min','Sec'].forEach((part, i) => {
      if (i > 0) { const sep = document.createElement('span'); sep.className = 'flip-sep'; sep.textContent = ':'; wrap.appendChild(sep); }
      const card = document.createElement('div');
      card.id = `flip${part}`; card.className = 'flip-card';
      ['flip-top','flip-bot','flip-top-back'].forEach(cls => {
        const d = document.createElement('div'); d.className = cls; d.textContent = '00'; card.appendChild(d);
      });
      wrap.appendChild(card);
    });
    block.appendChild(wrap);

  } else if (clockMode === 'word') {
    const grid = document.createElement('div');
    grid.id = 'wordClockGrid'; grid.className = 'word-clock-grid';
    block.appendChild(grid);
    wordPrevKey = '';

  } else if (clockMode === 'minimal') {
    const wrap = document.createElement('div');
    wrap.id = 'minimalClockWrap'; wrap.className = 'minimal-clock-wrap';
    const hrSpan = document.createElement('span'); hrSpan.id = 'minimalHr'; hrSpan.className = 'minimal-hr'; hrSpan.textContent = '--';
    const apSpan = document.createElement('span'); apSpan.id = 'minimalAP'; apSpan.className = 'minimal-ap'; apSpan.textContent = 'AM';
    wrap.append(hrSpan, apSpan);
    block.appendChild(wrap);

  } else if (clockMode === 'segment') {
    const canvas = document.createElement('canvas');
    canvas.id = 'segmentClock';
    canvas.width = Math.min(window.innerWidth * 0.88, 520);
    canvas.height = 110;
    block.appendChild(canvas);
  }
}

function startInfoStrip() {
  const items0 = getAllInfoItems();
  if (DOM.infoLabel) DOM.infoLabel.textContent = items0[0]();
  setInterval(rotateInfo, 6000);
}

// ── Parallax depth ────────────────────────────────────────────────────
let parallaxX = 0, parallaxY = 0;
let targetPX = 0, targetPY = 0;
const PARALLAX_STRENGTH = 18; // max px offset

window.addEventListener('mousemove', e => {
  targetPX = (e.clientX / window.innerWidth  - 0.5) * PARALLAX_STRENGTH;
  targetPY = (e.clientY / window.innerHeight - 0.5) * PARALLAX_STRENGTH;
});

// Gyroscope for mobile
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    if (e.gamma != null && e.beta != null) {
      targetPX = Math.max(-PARALLAX_STRENGTH, Math.min(PARALLAX_STRENGTH, e.gamma / 2));
      targetPY = Math.max(-PARALLAX_STRENGTH, Math.min(PARALLAX_STRENGTH, (e.beta - 45) / 2));
    }
  });
}

// ── Cross-tab BroadcastChannel sync ───────────────────────────────────
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('sc_sync') : null;

function bcBroadcast(type: string, payload: Record<string, unknown> = {}) {
  bc?.postMessage({ type, ...payload });
}

if (bc) {
  bc.onmessage = (e) => {
    const { type } = e.data;
    if (type === 'theme')   applyTheme(THEME_BY_ID[e.data.id] ?? currentTheme, true);
    if (type === 'session') {
      if (e.data.running && !sessionRunning) DOM.btnStart.click();
      if (!e.data.running && sessionRunning)  DOM.btnStart.click();
    }
    if (type === 'pom_phase') {
      // Mirror phase label across tabs
      if (DOM.pomPill) DOM.pomPill.textContent = e.data.pill;
    }
  };
}

// ── Flow State UI ─────────────────────────────────────────────────────
let flowUIActive = false;
const FLOW_BADGE_ID = 'flowBadge';

// Create the flow bar element once
let _flowBar: HTMLElement | null = null;
function getFlowBar(): HTMLElement {
  if (!_flowBar) {
    _flowBar = document.createElement('div');
    _flowBar.id = 'flowBar';
    document.body.appendChild(_flowBar);
  }
  return _flowBar;
}

// Called every second from the render loop tick
function updateFlowIntensityUI(intensity: number) {
  const bar = getFlowBar();
  bar.style.width = `${(intensity * 100).toFixed(1)}%`;

  // Body class tiers: flow-deep at 60%, flow-peak at 90%
  document.body.classList.toggle('flow-deep', intensity >= 0.6);
  document.body.classList.toggle('flow-peak', intensity >= 0.9);

  // Update flow badge text with intensity milestone
  const badge = document.getElementById(FLOW_BADGE_ID);
  if (badge && badge.classList.contains('visible')) {
    const mins = Intel.getFlowDuration();
    if (intensity >= 0.9)      badge.textContent = `⚡ Peak Flow · ${mins}m`;
    else if (intensity >= 0.6) badge.textContent = `⚡ Deep Flow · ${mins}m`;
    else                        badge.textContent = `⚡ Flow State · ${mins}m`;
  }
}

function updateFlowState() {
  const isFlow = Intel.checkFlowState(sessionRunning);
  if (isFlow === flowUIActive) return;
  flowUIActive = isFlow;

  if (isFlow) {
    DOM.themePanel.classList.add('collapsed');
    document.body.classList.add('flow-state');
    let badge = document.getElementById(FLOW_BADGE_ID);
    if (!badge) {
      badge = document.createElement('div');
      badge.id = FLOW_BADGE_ID;
      badge.className = 'flow-badge';
      document.body.appendChild(badge);
    }
    badge.textContent = '⚡ Flow State';
    badge.classList.add('visible');
    showToast('⚡ Flow State — you\'re in the zone', 4000);
  } else {
    document.body.classList.remove('flow-state', 'flow-deep', 'flow-peak');
    const badge = document.getElementById(FLOW_BADGE_ID);
    if (badge) badge.classList.remove('visible');
  }
}

// Intercept theme panel open as flow interrupt
const _origFocusLockIntercept = focusLockIntercept;

// ── Motivation Booster ────────────────────────────────────────────────
const MOTIV_HALF = [
  ['Halfway there! 🔥', 'Keep the momentum'],
  ["You're 50% done!", 'The hardest part is behind you'],
  ['Half-time! ⚡', 'Stay locked in'],
  ['Midpoint reached 🎯', 'Finish strong'],
] as const;
const MOTIV_75 = [
  ['Almost there! 💪', "75% complete — don't stop now"],
  ['Final stretch! 🏁', "You've got this"],
  ['Three quarters done! ⚡', 'Push through'],
] as const;

let _lastMilestonePct = 0;

function fireMilestoneConfetti(count = 28) {
  const accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--clr-accent-rgb').trim() || '110,231,183';
  const colors = [
    `rgba(${accentRgb},0.85)`, 'rgba(255,200,80,0.85)',
    'rgba(255,100,180,0.85)', 'rgba(80,180,255,0.85)', 'rgba(255,255,255,0.7)',
  ];
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.className = 'confetti-dot';
    const w = 5 + Math.random() * 6, h = 5 + Math.random() * 6;
    dot.style.cssText = [
      `left:${20 + Math.random() * 60}vw`,
      `top:${8 + Math.random() * 28}vh`,
      `background:${colors[Math.floor(Math.random() * colors.length)]}`,
      `animation-delay:${(Math.random() * 0.5).toFixed(2)}s`,
      `animation-duration:${(1.8 + Math.random()).toFixed(2)}s`,
      `width:${w.toFixed(1)}px`, `height:${h.toFixed(1)}px`,
      `border-radius:${Math.random() > 0.5 ? '50%' : '2px'}`,
    ].join(';');
    document.body.appendChild(dot);
    setTimeout(() => { if (dot.parentNode) dot.remove(); }, 3800);
  }
}

function showMotivationWidget(headline: string, sub: string) {
  document.querySelectorAll('.motivation-widget,.milestone-bg').forEach(el => el.remove());

  // Ambient background pulse
  const bg = document.createElement('div');
  bg.className = 'milestone-bg';
  document.body.appendChild(bg);
  setTimeout(() => { if (bg.parentNode) bg.remove(); }, 3200);

  // Floating widget
  const w = document.createElement('div');
  w.className = 'motivation-widget';
  const big = document.createElement('span'); big.className = 'motivation-text'; big.textContent = headline;
  const sm  = document.createElement('span'); sm.className  = 'motivation-sub';  sm.textContent  = sub;
  w.append(big, sm);
  document.body.appendChild(w);

  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('visible')));
  setTimeout(() => {
    w.classList.add('hiding');
    setTimeout(() => { if (w.parentNode) w.remove(); }, 700);
  }, 3200);

  // Chime
  try { (window as any).__uiSounds?.sessionStart?.(); } catch { /**/ }
}

function checkMilestones() {
  if (!sessionRunning) return;
  const totalMs = Pom.isActive()
    ? Pom.getSettings().workMins * 60_000
    : 25 * 60_000; // default 25min if no pomodoro
  const elapsed = performance.now() - sessionStart;
  const pct = Math.min(1, elapsed / totalMs);

  if (pct >= 0.5 && _lastMilestonePct < 0.5) {
    _lastMilestonePct = 0.5;
    const [h, s] = MOTIV_HALF[Math.floor(Math.random() * MOTIV_HALF.length)]!;
    showMotivationWidget(h, s);
    fireMilestoneConfetti(28);
  } else if (pct >= 0.75 && _lastMilestonePct < 0.75) {
    _lastMilestonePct = 0.75;
    const [h, s] = MOTIV_75[Math.floor(Math.random() * MOTIV_75.length)]!;
    showMotivationWidget(h, s);
    fireMilestoneConfetti(16);
  }
}

function resetMilestones() {
  _lastMilestonePct = 0;
  document.querySelectorAll('.motivation-widget,.milestone-bg,.confetti-dot').forEach(el => el.remove());
}

// ── Smart Break Suggester ─────────────────────────────────────────────
let breakBadgeShown = false;

function checkSmartBreak() {
  if (!Intel.checkBreakNeeded(sessionRunning)) return;
  if (breakBadgeShown) return;
  breakBadgeShown = true;

  const pill = document.querySelector<HTMLElement>('.sync-pill');
  if (!pill) return;
  pill.classList.add('break-hint');
  pill.title = 'You\'ve been focused for 90+ minutes — consider a short break';
  setTimeout(() => { pill.classList.remove('break-hint'); breakBadgeShown = false; }, 30_000);
}

// ── Sound Preset Saving ───────────────────────────────────────────────
interface SoundPreset { name: string; tracks: Record<string, number>; master: number; }
const PRESETS_KEY = 'sc_sound_presets';

function getSoundPresets(): SoundPreset[] {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); } catch { return []; }
}

function saveSoundPreset(name: string) {
  const presets = getSoundPresets();
  const tracks: Record<string, number> = {};
  Sound.SOUNDS.forEach(s => { tracks[s.id] = Sound.getTrackVolume(s.id); });
  const preset: SoundPreset = { name, tracks, master: Sound.getMasterVolume() };
  // Replace existing with same name, otherwise add
  const idx = presets.findIndex(p => p.name === name);
  if (idx >= 0) presets[idx] = preset; else presets.push(preset);
  if (presets.length > 5) presets.shift();
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function loadSoundPreset(preset: SoundPreset) {
  Sound.setMasterVolume(preset.master);
  Sound.SOUNDS.forEach(s => {
    const vol = preset.tracks[s.id];
    if (vol !== undefined) Sound.setTrackVolume(s.id, vol);
  });
  buildSoundUI();
}

// ── Custom Wallpaper Theme ────────────────────────────────────────────
function initWallpaperDrop() {
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        // Sample 16×16 thumbnail for dominant colour
        const cv = document.createElement('canvas'); cv.width = cv.height = 16;
        const ctx = cv.getContext('2d')!;
        ctx.drawImage(img, 0, 0, 16, 16);
        const px = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < px.length; i += 4) {
          // Skip very dark or very bright pixels
          const luma = 0.299 * px[i]! + 0.587 * px[i+1]! + 0.114 * px[i+2]!;
          if (luma < 20 || luma > 235) continue;
          r += px[i]!; g += px[i+1]!; b += px[i+2]!; n++;
        }
        if (n === 0) return;
        r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
        const accent = `#${[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')}`;

        // Generate wallpaper-based theme
        const wallTheme = {
          ...currentTheme,
          id: 'wallpaper',
          name: 'Wallpaper',
          accent, accent2: lightenHex(accent, 0.3),
          btnBg: accent + '22', btnFg: '#ffffff',
          glow: `0 0 55px ${accent}44`,
          hdr: true,
          baseBg: [darkenHex2(accent, 0.9), darkenHex2(accent, 0.85), darkenHex2(accent, 0.92)],
        };

        // Set wallpaper as CSS background
        document.body.style.backgroundImage = `url('${ev.target?.result as string}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.getElementById('overlay')!.style.background = 'rgba(0,0,0,0.55)';

        applyTheme(wallTheme as typeof currentTheme, true);
        showToast('Wallpaper theme applied! Drop a new image to change.');
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function lightenHex(hex: string, amt: number): string {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 0xff) + 255 * amt));
  const g = Math.min(255, Math.round(((n >> 8)  & 0xff) + 255 * amt));
  const b = Math.min(255, Math.round(( n        & 0xff) + 255 * amt));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function darkenHex2(hex: string, amt: number): string {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amt)));
  const g = Math.max(0, Math.round(((n >> 8)  & 0xff) * (1 - amt)));
  const b = Math.max(0, Math.round(( n        & 0xff) * (1 - amt)));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ── Toast notifications ───────────────────────────────────────────────
function showToast(msg: string, duration = 3500) {
  const existing = document.getElementById('scToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'scToast'; toast.className = 'sc-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ── Share focus card ──────────────────────────────────────────────────
async function openShareCard() {
  const log = (() => { try { return JSON.parse(localStorage.getItem('sc_focus_log') || '[]'); } catch { return []; } })();
  const today = new Date().toDateString();
  const todayMs = (log as Array<{date:string;dur:number}>).filter(e => e.date === today).reduce((s, e) => s + e.dur, 0);
  const todayMins = Math.max(1, Math.floor(todayMs / 60000));
  const task = DOM.focusInput.value.trim();

  const cardOpts = {
    themeName:    currentTheme.name,
    accentColor:  currentTheme.accent,
    bgColor:      currentTheme.baseBg[0]!,
    textColor:    currentTheme.text,
    glow:         currentTheme.glow,
    focusMinutes: todayMins,
    taskName:     task,
    streakDays:   Intel.getStreak().current,
    date:         new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  };

  // Generate the real rendered canvas once (no download yet)
  const cv = generateShareCard(cardOpts, false);

  // 1. Try native share (mobile)
  if (APIs.canShare()) {
    try {
      const blob: Blob = await new Promise(res => cv.toBlob(b => res(b!), 'image/png', 0.95));
      const file = new File([blob], 'session-clock.png', { type: 'image/png' });
      await navigator.share({ files: [file], title: 'Session Clock', text: `${todayMins} minutes focused today` });
      showToast('Shared! 🎉');
      return;
    } catch { /* fall through */ }
  }

  // 2. Try clipboard API (desktop Chrome/Edge — requires user gesture)
  try {
    const blob: Blob = await new Promise(res => cv.toBlob(b => res(b!), 'image/png', 0.95));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    showToast('Focus card copied to clipboard! 📋');
    return;
  } catch { /* fall through */ }

  // 3. Try copying the data URL as text fallback
  try {
    await navigator.clipboard.writeText(cv.toDataURL('image/png', 0.95));
    showToast('Card data copied — paste into an image editor 📋');
    return;
  } catch { /* fall through */ }

  // 4. Download as final fallback — trigger download on the already-rendered canvas
  const link = document.createElement('a');
  link.download = `session-clock-${Date.now()}.png`;
  link.href = cv.toDataURL('image/png', 0.95);
  link.click();
  showToast('Focus card saved! 🖼');
}

// ── Service Worker registration ───────────────────────────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {/* silent */});
  }
}

// ── Theme flash on switch ─────────────────────────────────────────────
function flashTheme() {
  document.body.classList.remove('theme-flash');
  void document.body.offsetWidth;
  document.body.classList.add('theme-flash');
  setTimeout(() => document.body.classList.remove('theme-flash'), 500);
}

// ── Init ───────────────────────────────────────────────────────────────
// ── Command Palette registration ──────────────────────────────────────
function buildPaletteCommands() {
  const cmds: Palette.PaletteCommand[] = [];

  cmds.push(
    { id:'start',      icon:'▶',  label:'Start Session',        hint:'Space', group:'Session', action: () => { if (!sessionRunning) DOM.btnStart.click(); } },
    { id:'pause',      icon:'⏸',  label:'Pause Session',        hint:'Space', group:'Session', action: () => { if (sessionRunning)  DOM.btnStart.click(); } },
    { id:'reset',      icon:'↺',  label:'Reset Timer',          hint:'R',     group:'Session', action: () => DOM.btnReset.click() },
    { id:'pom',        icon:'🍅',  label:'Toggle Pomodoro',      hint:'P',     group:'Session', action: () => $('btnPomToggle').click() },
    { id:'animedoro',  icon:'🎬',  label:'Start Animedoro',                    group:'Session', action: () => { startAnimedoro(); openModal('pomOverlay'); } },
    { id:'pomsettings',icon:'⚙️', label:'Pomodoro Settings',                  group:'Session', action: () => openModal('pomOverlay') },
  );

  cmds.push(
    { id:'snd_mixer',  icon:'🎵',  label:'Open Sound Mixer',     hint:'M',     group:'Sound', action: () => { buildSoundUI(); openModal('soundOverlay'); } },
    { id:'snd_rain',   icon:'🌧',  label:'Toggle Rain',                        group:'Sound', action: () => Sound.toggleTrack('rain') },
    { id:'snd_brown',  icon:'📻',  label:'Toggle Brown Noise',                 group:'Sound', action: () => Sound.toggleTrack('brown') },
    { id:'snd_forest', icon:'🌲',  label:'Toggle Forest',                      group:'Sound', action: () => Sound.toggleTrack('forest') },
    { id:'snd_cafe',   icon:'☕',  label:'Toggle Café',                        group:'Sound', action: () => Sound.toggleTrack('cafe') },
    { id:'snd_ocean',  icon:'🌊',  label:'Toggle Ocean',                       group:'Sound', action: () => Sound.toggleTrack('ocean') },
    { id:'snd_fire',   icon:'🔥',  label:'Toggle Fireplace',                   group:'Sound', action: () => Sound.toggleTrack('fire') },
    { id:'snd_stop',   icon:'⏹',  label:'Stop All Sounds',                    group:'Sound', action: () => Sound.stop() },
    { id:'vol_up',     icon:'🔊',  label:'Volume Up (+10%)',                   group:'Sound', action: () => { const v = Math.min(2, Sound.getMasterVolume()+0.1); Sound.setMasterVolume(v); showToast(`Volume ${Math.round(v*100)}%`); } },
    { id:'vol_dn',     icon:'🔉',  label:'Volume Down (-10%)',                 group:'Sound', action: () => { const v = Math.max(0, Sound.getMasterVolume()-0.1); Sound.setMasterVolume(v); showToast(`Volume ${Math.round(v*100)}%`); } },
    { id:'vol_mute',   icon:'🔇',  label:'Mute / Unmute',                      group:'Sound', action: () => { const v = Sound.getMasterVolume()>0?0:0.7; Sound.setMasterVolume(v); showToast(v===0?'Muted':'Unmuted'); } },
  );

  THEMES.forEach(t => {
    const catLabel = t.cat === 'nat' ? 'Natural' : t.cat === 'tv' ? 'TV Shows' : t.cat === 'movie' ? 'Movies' : t.cat === 'animation' ? 'Animation' : t.cat === 'anime' ? 'Anime' : 'F1 Teams';
    cmds.push({
      id: `theme_${t.id}`, icon: t.cat === 'f1' ? '🏎' : t.cat === 'anime' ? '⛩' : t.cat === 'tv' ? '📺' : t.cat === 'movie' ? '🎬' : '🎨',
      label: `${t.name}`, hint: t.tagline?.slice(3) ?? t.sub ?? '',
      group: `Themes · ${catLabel}`, keywords: [t.id, t.sub ?? '', t.tagline ?? ''],
      badge: ['8bit','phoenix'].includes(t.id) ? 'secret' : undefined,
      action: () => applyTheme(t),
    });
  });

  (['digital','analogue','flip','word','minimal','segment'] as const).forEach(mode => {
    const labels: Record<string, string> = { digital:'Digital',analogue:'Analogue',flip:'Flip (3D)',word:'Word Clock',minimal:'Minimal',segment:'7-Segment LED' };
    const icons:  Record<string, string> = { digital:'🔢',analogue:'🕐',flip:'📅',word:'📝',minimal:'○',segment:'📟' };
    cmds.push({ id:`clock_${mode}`, icon:icons[mode]!, label:`${labels[mode]!} Clock`, group:'Clock Style', action: () => { setClockMode(mode); updateClockCanvas(); } });
  });

  cmds.push(
    { id:'open_log',       icon:'📋', label:'Focus Log',          hint:'L',  group:'Navigation', action: () => { renderLogView(); openModal('logOverlay'); } },
    { id:'open_settings',  icon:'⚙️', label:'Settings',                      group:'Navigation', action: openSettings },
    { id:'open_data',      icon:'🛡', label:'My Data & Privacy',             group:'Navigation', action: openDataPanel },
    { id:'open_custom',    icon:'🎨', label:'Custom Theme Builder', hint:'G', group:'Navigation', action: openThemeBuilder },
    { id:'open_qr',        icon:'📱', label:'QR Handoff',                    group:'Navigation', action: openQRHandoff },
    { id:'open_kb',        icon:'⌨',  label:'Keyboard Shortcuts',  hint:'?', group:'Navigation', action: () => openModal('kbOverlay') },
    { id:'share_card',     icon:'🖼',  label:'Share Focus Card',              group:'Navigation', action: () => { openShareCard(); } },
    { id:'pip_toggle',     icon:'🖥',  label:'Picture-in-Picture', badge:'new', group:'Navigation', action: async () => {
        if (APIs.isPiPActive()) { await APIs.exitPiP(); showToast('PiP closed'); }
        else { await APIs.enterPiP(document.getElementById('clock-block-wrap')!, { accent:currentTheme.accent, text:currentTheme.text, baseBg:currentTheme.baseBg }); showToast('Clock in PiP'); }
      }
    },
  );

  cmds.push(
    { id:'kiosk',         icon:'⛶',  label:'Toggle Kiosk',          hint:'F',  group:'Display', action: toggleKiosk },
    { id:'present',       icon:'📺',  label:'Toggle Present Mode',              group:'Display', action: togglePresent },
    { id:'privacy',       icon:'🔒',  label:'Toggle Privacy Mode',              group:'Display', action: togglePrivacy },
    { id:'wake_lock',     icon:'💡',  label:'Toggle Wake Lock',                 group:'Display', action: async () => { await APIs.setWakeLock(!APIs.isWakeLockEnabled()); showToast(APIs.isWakeLockEnabled()?'Screen stays on':'Wake lock off'); } },
    { id:'reduce_motion', icon:'✨',  label:'Toggle Reduce Motion',             group:'Display', action: () => { const on=!document.body.classList.contains('reduced-motion'); document.body.classList.toggle('reduced-motion',on); localStorage.setItem('sc_reduce_motion',on?'1':'0'); showToast(on?'Reduced motion on':'Full animations on'); } },
    { id:'next_theme',    icon:'🔀',  label:'Random Theme',                     group:'Display', action: () => { applyTheme(THEMES[Math.floor(Math.random()*THEMES.length)]!); } },
    { id:'cycle_theme',   icon:'➡',  label:'Next Theme',            hint:'T',  group:'Display', action: () => { const i=THEMES.indexOf(currentTheme); applyTheme(THEMES[(i+1)%THEMES.length]!); } },
  );

  // ── Easter Eggs — every one accessible directly ─────────────────────
  const eggs: [string, string, string, string, () => void][] = [
    ['egg_konami',      '👾', 'Konami Code → 8-Bit Theme',       '↑↑↓↓←→←→BA', () => showToast('👾 Type: ↑↑↓↓←→←→BA', 5000)],
    ['egg_hyperfocus',  '🧘', 'Hyperfocus Mode',                 'hold timer 3s', () => showToast('🧘 Hold the session timer for 3 seconds', 4000)],
    ['egg_devconsole',  '🖥',  'Dev Console',                    'triple-click clock', () => showToast('Triple-click the clock face', 3000)],
    ['egg_midnight',    '🎉', 'Midnight Confetti',               'fires at 00:00:00', () => { Easter.fireConfetti(); showToast('🎉 Confetti!', 3000); }],
    ['egg_shake',       '🎲', 'Random Theme (Device Shake)',     'shake phone', () => { (window as any).__scRandomTheme?.(); showToast('🎲 Theme shuffled!', 2500); }],
    ['egg_sidereal',    '🔭', 'Sidereal Time',                   'click UTC ×7', () => showToast('🔭 Click the UTC pill 7 times quickly', 4000)],
    ['egg_matrix',      '💊', 'Matrix Rain',                     'type "matrix"',     () => (window as any).__scTriggerKeyword?.('matrix')],
    ['egg_inception',   '🌀', 'Dream Spin',                      'type "inception"',  () => (window as any).__scTriggerKeyword?.('inception')],
    ['egg_heisenberg',  '⚗️', 'Heisenberg (Breaking Bad)',       'type "heisenberg"', () => (window as any).__scTriggerKeyword?.('heisenberg')],
    ['egg_winchester',  '🔥', 'The Road So Far (Supernatural)',  'type "winchester"', () => (window as any).__scTriggerKeyword?.('winchester')],
    ['egg_redjohn',     '🔴', 'Red John (The Mentalist)',        'type "redjohn"',    () => (window as any).__scTriggerKeyword?.('redjohn')],
    ['egg_badabing',    '🥃', 'Bada Bing! (Sopranos)',           'type "bada bing"',  () => (window as any).__scTriggerKeyword?.('bada bing')],
    ['egg_winden',      '⏳', 'Sic Mundus (Dark)',               'type "winden"',     () => (window as any).__scTriggerKeyword?.('winden')],
    ['egg_severance',   '🏢', 'Lumon Industries (Severance)',    'type "fncs"',       () => (window as any).__scTriggerKeyword?.('fncs')],
    ['egg_interstellar','🌌', 'Do Not Go Gentle (Interstellar)', 'type "interstellar"',() => (window as any).__scTriggerKeyword?.('interstellar')],
    ['egg_spice',       '🏜️','The Spice Must Flow (Dune)',      'type "spice"',      () => (window as any).__scTriggerKeyword?.('spice')],
    ['egg_godfather',   '🌹', 'The Offer (Godfather)',           'type "godfather"',  () => (window as any).__scTriggerKeyword?.('godfather')],
    ['egg_mrrobot',     '💻', 'Hello Friend (Mr. Robot)',        'type "mrrobot"',    () => (window as any).__scTriggerKeyword?.('mrrobot')],
    ['egg_fsociety',    '💻', 'We Are fsociety',                 'type "fsociety"',   () => (window as any).__scTriggerKeyword?.('fsociety')],
    ['egg_oppenheimer', '☢️', 'I Am Become Death',               'type "oppenheimer"',() => (window as any).__scTriggerKeyword?.('oppenheimer')],
    ['egg_thebear',     '🍳', 'Yes, Chef! (The Bear)',           'type "thebear"',    () => (window as any).__scTriggerKeyword?.('thebear')],
    ['egg_nightcity',   '🌆', 'Night City (Cyberpunk)',          'type "nightcity"',  () => (window as any).__scTriggerKeyword?.('nightcity')],
    ['egg_cyberglitch', '⚡', 'Cyberpunk Glitch Burst',          'type "samurai"',    () => (window as any).__scTriggerKeyword?.('samurai')],
    ['egg_hal',         '🔴', '"I\'m Sorry Dave" (2001)',        'type "hal"',        () => (window as any).__scTriggerKeyword?.('hal')],
    ['egg_daisy',       '🎵', 'HAL Sings Daisy',                'type "daisy"',      () => (window as any).__scTriggerKeyword?.('daisy')],
    ['egg_tenet',       '⏪', 'Clock Reverses (Tenet)',          'type "tenet"',      () => (window as any).__scTriggerKeyword?.('tenet')],
    ['egg_dracarys',    '🐉', 'Dracarys (House of Dragon)',      'type "dracarys"',   () => (window as any).__scTriggerKeyword?.('dracarys')],
    ['egg_khonshu',     '🌙', 'Fist of Khonshu (Moon Knight)',  'type "khonshu"',    () => (window as any).__scTriggerKeyword?.('khonshu')],
    ['egg_luffy',       '🏴‍☠️','King of the Pirates (One Piece)','type "luffy"',      () => (window as any).__scTriggerKeyword?.('luffy')],
    ['egg_onepiece',    '🏴‍☠️','One Piece Flash',               'type "onepiece"',   () => (window as any).__scTriggerKeyword?.('onepiece')],
    ['egg_dedicate',    '⚔️', 'Dedicate Your Heart! (AoT)',     'type "dedicate"',   () => (window as any).__scTriggerKeyword?.('dedicate')],
    ['egg_lightyagami', '📓', 'L Investigates You (Death Note)','type "lightyagami"',() => (window as any).__scTriggerKeyword?.('lightyagami')],
    ['egg_potatochip',  '🍟', 'Potato Chip (Death Note)',        'type "potato chip"',() => (window as any).__scTriggerKeyword?.('potato chip')],
  ];
  eggs.forEach(([id, icon, label, hint, action]) => {
    cmds.push({ id, icon, label, hint, group:'Easter Eggs 🥚', badge:'easter egg', keywords:['easter','egg','secret','hidden'], action });
  });

  Palette.registerCommands(cmds);
}

function init() {
  initPerf(); // detect device tier before anything else

  // Apply persisted motion/animation preferences
  const reduceMotion = localStorage.getItem('sc_reduce_motion') === '1' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) document.body.classList.add('reduced-motion');

  APIs.initBattery().then(() => {
    APIs.onBatteryChange((level, charging) => {
      // Auto-downgrade to LOW quality on low battery
      if (!charging && level < 0.2 && getTier() !== 'low') {
        setTier('low');
        showToast('🔋 Battery saver: quality reduced to Low');
      }
    });
  });
  // Acquire wake lock if previously enabled
  APIs.acquireWakeLock();
  resize();
  window.addEventListener('resize', () => { resize(); updatePanelHeight(); });
  applyClockPosition(clockPosition);
  buildPanel();
  updatePanelHeight();
  updateClockCanvas();
  startInfoStrip();
  initWallpaperDrop();
  // Easter eggs — init after theme is applied
  Easter.initEaster(
    (id) => { const t = THEME_BY_ID[id]; if (t) applyTheme(t); },
    showToast,
    () => Sound.playChime(),
  );

  // ── Command Palette ───────────────────────────────────────────────────
  Palette.initPalette();
  buildPaletteCommands();
  // Expose palette open for topbar button
  (window as any).__scPalette = Palette;
  // Expose helpers for easter.ts cross-module access
  (window as any).__scFps       = () => getFps();
  (window as any).__scTier      = () => getTier();
  (window as any).__scThemeCount= () => THEMES.length;
  (window as any).__scAudioNodes= () => {
    try { const a = new AudioContext(); const n = a.destination.channelCount; a.close(); return 'ok'; } catch { return '?'; }
  };
  (window as any).__scRandomTheme = () => {
    const idx = Math.floor(Math.random() * THEMES.length);
    applyTheme(THEMES[idx]!);
  };

  registerSW();
  // Expose incognito check for focuslog.ts (avoids circular import)
  (window as any).__scIncognito = Privacy.isIncognito;

  // Drag-over visual feedback
  document.addEventListener('dragenter', () => document.body.classList.add('drag-over'));
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('drag-over'); });
  document.addEventListener('drop', () => document.body.classList.remove('drag-over'));

  // PWA install prompt
  let deferredInstall: Event | null = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredInstall = e;
    const btn = document.createElement('button');
    btn.id = 'pwaInstallBtn'; btn.className = 'show';
    btn.textContent = '⬇ Install App';
    btn.addEventListener('click', () => {
      (deferredInstall as any)?.prompt?.();
      btn.remove(); deferredInstall = null;
    });
    document.body.appendChild(btn);
  });

  const kbBtn = $('btnKbShortcuts');
  if (kbBtn) kbBtn.addEventListener('click', () => openModal('kbOverlay'));

  const cmdBtn = $('btnCmdPalette');
  if (cmdBtn) cmdBtn.addEventListener('click', () => Cmd.open());

  // Clock position pill
  const posPill = $('clockPosPill');
  if (posPill) {
    posPill.addEventListener('click', () => {
      applyClockPosition(clockPosition === 'top' ? 'center' : 'top');
    });
    applyClockPosition(clockPosition);
  }

  // Ripple position tracking — track cursor for CSS ::after ripple
  document.addEventListener('mousedown', e => {
    const t = e.target as HTMLElement;
    const btn = t.closest('.btn, .btn-primary, .btn-ghost, .feat-btn, .template-card') as HTMLElement | null;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width * 100).toFixed(1);
    const y = ((e.clientY - r.top) / r.height * 100).toFixed(1);
    btn.style.setProperty('--rx', x + '%');
    btn.style.setProperty('--ry', y + '%');
  }, { passive: true });

  // ── UI sound system ─────────────────────────────────────────
  // Dialed-style: every interaction has a sound, optional
  let uiAudioCtx: AudioContext | null = null;
  const getUiCtx = () => {
    if (!uiAudioCtx) uiAudioCtx = new AudioContext();
    return uiAudioCtx;
  };

  const uiSounds = {
    click() {
      try {
        const ctx = getUiCtx(); if (ctx.state === 'suspended') ctx.resume();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.setValueAtTime(1200, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06);
        g.gain.setValueAtTime(0.06, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        o.type = 'sine'; o.start(); o.stop(ctx.currentTime + 0.08);
      } catch { /**/ }
    },
    toggle(on: boolean) {
      try {
        const ctx = getUiCtx(); if (ctx.state === 'suspended') ctx.resume();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.setValueAtTime(on ? 880 : 660, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(on ? 1200 : 440, ctx.currentTime + 0.1);
        g.gain.setValueAtTime(0.05, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        o.type = 'sine'; o.start(); o.stop(ctx.currentTime + 0.12);
      } catch { /**/ }
    },
    sessionStart() {
      try {
        const ctx = getUiCtx(); if (ctx.state === 'suspended') ctx.resume();
        [0, 0.12, 0.24].forEach((delay, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          const freqs = [523, 659, 784]; // C5 E5 G5
          o.frequency.value = freqs[i]!;
          g.gain.setValueAtTime(0, ctx.currentTime + delay);
          g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + delay + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
          o.type = 'sine'; o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.3);
        });
      } catch { /**/ }
    },
    sessionEnd() {
      try {
        const ctx = getUiCtx(); if (ctx.state === 'suspended') ctx.resume();
        [0, 0.15, 0.30, 0.45].forEach((delay, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          const freqs = [784, 659, 523, 392]; // G5 E5 C5 G4
          o.frequency.value = freqs[i]!;
          g.gain.setValueAtTime(0, ctx.currentTime + delay);
          g.gain.linearRampToValueAtTime(0.07, ctx.currentTime + delay + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35);
          o.type = 'sine'; o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.4);
        });
      } catch { /**/ }
    },
    themeSwitch() {
      try {
        const ctx = getUiCtx(); if (ctx.state === 'suspended') ctx.resume();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.setValueAtTime(400, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.15);
        g.gain.setValueAtTime(0.04, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        o.type = 'sine'; o.start(); o.stop(ctx.currentTime + 0.18);
      } catch { /**/ }
    },
    error() {
      try {
        const ctx = getUiCtx(); if (ctx.state === 'suspended') ctx.resume();
        [0, 0.1].forEach(delay => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = 180;
          g.gain.setValueAtTime(0.06, ctx.currentTime + delay);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.12);
          o.type = 'sawtooth'; o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.12);
        });
      } catch { /**/ }
    },
  };
  (window as any).__uiSounds = uiSounds;

  // Wire UI sounds to interactions
  document.addEventListener('click', e => {
    if (localStorage.getItem('sc_ui_sounds') === '0') return;
    const t = e.target as HTMLElement;
    if (t.closest('.feat-btn, .btn-ghost, .btn-icon, .nat-btn, .media-card, .panel-tab, .topbar-icon-btn, .modal-close, .cmd-item')) {
      uiSounds.click();
    }
    if (t.closest('.settings-toggle')) {
      const isOn = (t.closest('.settings-toggle') as HTMLElement).classList.contains('on');
      uiSounds.toggle(isOn);
    }
  }, { passive: true });
  const secretsBtn = $('cmdSecretsBtn');
  if (secretsBtn) secretsBtn.addEventListener('click', () => { Cmd.open('/'); });

  // Request notifications permission automatically (non-intrusive — deferred until first Pom start)
  // We'll request on first session start instead of on load

  const topbarThemesBtn = $('topbarThemesBtn');
  if (topbarThemesBtn) {
    topbarThemesBtn.addEventListener('click', () => {
      focusLockIntercept(() => {
        DOM.themePanel.classList.toggle('collapsed');
      });
    });
  }

  const lastId = localStorage.getItem('sc_last_theme');
  applyTheme(lastId && THEME_BY_ID[lastId] ? THEME_BY_ID[lastId] : THEMES[0], true);
  applyHandoffState();

  // Tab visibility for flow intensity
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Intel.onTabHidden();
    else Intel.onTabVisible();
  });

  // Themes pill — toggle floating panel
  const themesBtn = document.getElementById('btnThemes');
  if (themesBtn) {
    themesBtn.addEventListener('click', () => {
      DOM.themePanel.classList.toggle('collapsed');
    });
  }
  setInterval(() => {
    checkSmartBreak();
  }, 60_000);

  requestAnimationFrame(ts => { lastTs = ts; renderFrame(ts); });

  if (!privacyMode) {
    syncTime();
    initWeather($('weatherIcon'), $('weatherText'), $('weatherPill'), isPrivacyMode);
  } else {
    updateSyncDisplay('failed');
  }

  // ── Command Palette ────────────────────────────────────────────────
  Cmd.initPalette();
  buildCommandPalette();

  // ── Features init ─────────────────────────────────────────────────
  Features.initStatusLine((text) => {
    const el = document.getElementById('sessionStatusLine');
    if (el) el.textContent = text;
  });
  const todaySessions = JSON.parse(localStorage.getItem('sc_focus_log') || '[]').length;
  Features.setStatusState('idle', { todaySessions });
  Features.updateButtonLabels('idle', 'work', false, DOM.btnStart as HTMLButtonElement);

  // Distraction counter button
  const distractionBtn = document.getElementById('btnDistraction');
  if (distractionBtn) {
    distractionBtn.addEventListener('click', () => {
      Features.logDistraction();
      Features.updateDistractionUI(true);
      showToast('Distraction logged. Refocus.');
    });
  }

  // Session templates modal
  const templatesContent = document.getElementById('templatesContent');
  if (templatesContent) {
    Features.buildTemplatesUI(templatesContent, (t) => {
      // Apply template
      if (t.themeId) { const th = THEME_BY_ID[t.themeId]; if (th) applyTheme(th); }
      Pom.setWorkMins(t.durationMins);
      Pom.setBreakMins(t.breakMins);
      if (!Pom.isActive()) Pom.toggle();
      showToast(`📋 ${t.icon} ${t.name} — ${t.durationMins}min session ready`);
      document.getElementById('templatesOverlay')?.classList.remove('open');
    });
  }

  // Countdown modal
  const countdownContent = document.getElementById('countdownContent');
  if (countdownContent) {
    Features.buildCountdownUI(countdownContent, (label, target) => {
      Features.setCountdownTarget(label, target, (display, done) => {
        const pill = document.getElementById('utcPill');
        if (done) { showToast(`⏳ ${display}`, 5000); if (pill) pill.title = ''; return; }
        if (pill && !Easter.isSiderealMode()) pill.textContent = display;
      });
      showToast(`⏳ Counting down to ${label}`);
    });
  }

  // World clock modal
  const worldClockContent = document.getElementById('worldClockContent');
  if (worldClockContent) Features.buildWorldClockUI(worldClockContent);

  // Integrations modal
  const intContent = document.getElementById('integrationsContent');
  if (intContent) {
    Integrations.buildIntegrationsPanel(intContent, { showToast });
  }
  // Handle Spotify OAuth callback
  if (window.location.search.includes('code=')) {
    Integrations.spotifyHandleCallback().then(() => {
      showToast('🎵 Spotify connected!', 4000);
      if (intContent) Integrations.buildIntegrationsPanel(intContent, { showToast });
    });
  }

  // Language modal
  const langContent = document.getElementById('languageContent');
  if (langContent) buildLanguageUI(langContent);

  // Onboarding
  if (Features.shouldShowOnboarding()) {
    setTimeout(() => {
      Features.showOnboarding({
        setDuration: (mins) => { Pom.setWorkMins(mins); },
        applyThemeById: (id) => { if (id) { const t = THEME_BY_ID[id]; if (t) applyTheme(t); } },
        enableSound: (id) => { if (id) Sound.play(id); },
      });
    }, 800);
  } else {
    // Weather-aware + day/night theme suggestion (once per 3h)
    setTimeout(() => {
      // Weather takes priority over time-of-day
      const weatherSug = Features.getWeatherThemeSuggestion(isRaining(), isSnowing(), isClear());
      if (weatherSug && weatherSug.themeId !== currentTheme.id) {
        showToast(`💡 ${weatherSug.reason} — try ${weatherSug.themeId}?`, 8000);
        return;
      }
      if (Features.shouldSuggestDayNightTheme(currentTheme.id)) {
        const s = Features.getDayNightThemeSuggestion();
        if (s) showToast(`💡 ${s.reason} — or ignore!`, 8000);
      }
    }, 3000);

    // Lunar phase in UTC pill tooltip
    setTimeout(() => {
      const lunar = Features.getLunarPhase();
      const utcPill = $('utcPill');
      if (utcPill) {
        const existing = utcPill.title;
        if (!existing.includes(lunar.emoji)) {
          utcPill.title = `${existing ? existing + ' · ' : ''}${lunar.emoji} ${lunar.name} · ${lunar.illumination}% illuminated · ${Features.getDaysToNextFullMoon()}d to full moon`;
        }
      }
    }, 2000);
  }

  // Trust indicator — update when sync completes
  (window as any).__onSyncComplete = (rtt: number) => {
    Features.setSyncTrust('ntp');
  };
  (window as any).__onSyncFail = () => {
    Features.setSyncTrust('offline');
  };

  // Voice timer — initialise if browser supports it
  const voiceSupported = Features.initVoiceTimer(
    (cmd) => {
      switch (cmd.type) {
        case 'start':
          if (cmd.minutes) Pom.setWorkMins(cmd.minutes);
          if (!sessionRunning) startTimer();
          showToast(`🎙 ${cmd.minutes ? cmd.minutes + ' min session' : 'Session'} started`);
          break;
        case 'pause':
          if (sessionRunning) pauseTimer(); else if (sessionElapsed > 0) startTimer();
          showToast('🎙 ' + (sessionRunning ? 'Paused' : 'Resumed'));
          break;
        case 'reset':
          resetTimer(); showToast('🎙 Timer reset');
          break;
        case 'zen':
          toggleZen(); showToast('🎙 Zen Mode ' + (zenOn ? 'on' : 'off'));
          break;
        case 'theme': {
          const name = cmd.themeName?.toLowerCase() ?? '';
          const match = THEMES.find(t => t.name.toLowerCase().includes(name) || t.id.includes(name));
          if (match) { applyTheme(match); showToast(`🎙 Switched to ${match.name}`); }
          else showToast('🎙 Theme not found — try the command palette');
          break;
        }
        default:
          showToast(`🎙 Didn't catch that — try "start 25 minute session"`);
      }
    },
    (active) => {
      const btn = document.getElementById('voiceBtn');
      if (btn) btn.classList.toggle('active', active);
    }
  );

  // Add voice mic button to topbar if supported
  if (voiceSupported) {
    const voiceBtn = document.createElement('button');
    voiceBtn.id = 'voiceBtn';
    voiceBtn.className = 'topbar-icon-btn';
    voiceBtn.title = 'Voice command (🎙 say "start 25 minute session")';
    voiceBtn.setAttribute('aria-label', 'Voice timer');
    const micSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    micSvg.setAttribute('viewBox', '0 0 20 20'); micSvg.setAttribute('width', '15'); micSvg.setAttribute('height', '15');
    micSvg.setAttribute('fill', 'currentColor');
    const micPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    micPath.setAttribute('d', 'M10 12a3 3 0 003-3V5a3 3 0 00-6 0v4a3 3 0 003 3zm5-3a5 5 0 01-10 0H3a7 7 0 0014 0h-2zm-5 7v2m0 0H8m2 0h2');
    micSvg.appendChild(micPath);
    voiceBtn.appendChild(micSvg);
    voiceBtn.addEventListener('click', () => {
      if (Features.isVoiceActive()) Features.stopVoiceListening();
      else { Features.startVoiceListening(); showToast('🎙 Listening… say "start 25 minute session"', 3000); }
    });
    // Insert before the cmd palette button
    const cmdBtn = document.getElementById('btnCmdPalette');
    if (cmdBtn?.parentNode) cmdBtn.parentNode.insertBefore(voiceBtn, cmdBtn);
  }
}

function openIntegrations() {
  const el = document.getElementById('integrationsContent');
  if (el) Integrations.buildIntegrationsPanel(el, { showToast });
  openModal('integrationsOverlay');
}

function buildLanguageUI(container: HTMLElement) {
  while (container.firstChild) container.removeChild(container.firstChild);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:8px;';
  (Object.keys(LOCALE_NAMES) as Locale[]).forEach(locale => {
    const btn = document.createElement('button');
    btn.className = 'lang-btn' + (locale === getLocale() ? ' lang-btn--active' : '');
    const flag = document.createElement('span'); flag.className = 'lang-flag'; flag.textContent = LOCALE_FLAGS[locale];
    const nameWrap = document.createElement('div');
    const nm = document.createElement('div'); nm.className = 'lang-name'; nm.textContent = LOCALE_NAMES[locale];
    const lc = document.createElement('div'); lc.className = 'lang-code'; lc.textContent = locale.toUpperCase();
    nameWrap.append(nm, lc);
    if (locale === getLocale()) {
      const check = document.createElement('span'); check.className = 'lang-check'; check.textContent = '✓';
      btn.append(flag, nameWrap, check);
    } else {
      btn.append(flag, nameWrap);
    }
    btn.addEventListener('click', () => {
      setLocale(locale);
      buildLanguageUI(container);
      showToast(`${LOCALE_FLAGS[locale]} Language set to ${LOCALE_NAMES[locale]}`);
    });
    grid.appendChild(btn);
  });
  container.appendChild(grid);
  const note = document.createElement('p');
  note.className = 'lang-note';
  note.textContent = 'UI language only. Themes and content remain in English.';
  container.appendChild(note);
}

// ── Command Palette Registration ──────────────────────────────────────
function buildCommandPalette() {
  const items: Cmd.CmdItem[] = [];

  // ── Themes ──────────────────────────────────────────────────────────
  THEMES.forEach(t => {
    items.push({
      id:   `theme:${t.id}`,
      name: t.name,
      desc: t.tagline ?? t.sub ?? '',
      icon: LOGOS[t.id] ?? '',  // fallback logo SVG or empty string
      tag:  'theme',
      keywords: t.cat + ' ' + (t.sub ?? '') + ' ' + (t.quotes?.join(' ') ?? ''),
      action: () => applyTheme(t),
    });
  });

  // ── Easter Eggs — every entry shows its keyword trigger in the desc ──
  // Format: "[keyword trigger] → what happens"
  const eggs: { id:string; name:string; desc:string; icon:string; keywords?:string; action:()=>void }[] = [
    {
      id: 'konami', name: 'Konami Code — 8-BIT Mode',
      icon: '👾',
      desc: 'Press ↑↑↓↓←→←→BA on keyboard → unlocks retro 8-bit theme with chiptune',
      keywords: 'konami 8bit pixel retro chiptune',
      action: () => { applyTheme(THEME_BY_ID['8bit']!); showToast('👾 8-bit activated! Konami Code again to exit.'); Sound.playChime(); },
    },
    {
      id: 'matrix-rain', name: 'Matrix Rain',
      icon: '💊',
      desc: 'Type "matrix" anywhere → green rain cascade fills the screen for 5 seconds',
      keywords: 'matrix green rain cascade neo',
      action: () => Easter.triggerMatrixRain(),
    },
    {
      id: 'inception-spin', name: 'Inception Dream Spin',
      icon: '🌀',
      desc: 'Type "inception" → the entire UI spins 360°',
      keywords: 'inception spin dream rotate totem',
      action: () => {
        document.body.style.transition = 'transform 1.2s cubic-bezier(.65,0,.35,1)';
        document.body.style.transform  = 'rotate(360deg)';
        setTimeout(() => { document.body.style.transform = ''; setTimeout(() => document.body.style.transition = '', 1500); }, 1300);
        showToast('🌀 "You\'re waiting for a train…"', 5000);
      },
    },
    {
      id: 'midnight-confetti', name: 'Midnight Confetti',
      icon: '🎉',
      desc: 'Fires automatically at 00:00:00 every midnight · or trigger here',
      keywords: 'midnight confetti new day celebration fireworks',
      action: () => { Easter.fireConfetti(); showToast('✨ Happy New Day!', 4000); },
    },
    {
      id: 'dev-console', name: 'Developer Console',
      icon: '🖥',
      desc: 'Triple-click the clock · or activate here → FPS, tier, storage, session stats',
      keywords: 'dev console fps debug stats tier performance',
      action: () => {
        const existing = document.getElementById('devConsole');
        if (existing) { existing.remove(); return; }
        const fps = (window as any).__scFps?.() ?? 0;
        const tier = (window as any).__scTier?.() ?? '?';
        const lsSize = JSON.stringify(localStorage).length;
        const panel = document.createElement('div');
        panel.id = 'devConsole';
        panel.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:9000;background:rgba(0,0,0,.92);color:#00ff41;font-family:monospace;font-size:.65rem;padding:14px 18px;border-radius:10px;line-height:1.9;border:1px solid #00ff4133;backdrop-filter:blur(12px);animation:fadeUp .3s ease;min-width:220px;';
        const rows: [string, string | number][] = [
          ['🎯 Render tier', tier.toUpperCase()],
          ['📊 FPS', fps],
          ['💾 localStorage', `${(lsSize / 1024).toFixed(1)} KB`],
          ['🎨 Themes', (window as any).__scThemeCount?.() ?? '?'],
          ['📋 Sessions', JSON.parse(localStorage.getItem('sc_focus_log') || '[]').length],
          ['🔥 Streak', `${JSON.parse(localStorage.getItem('sc_streak') || '{"current":0}').current} days`],
        ];
        rows.forEach(([label, value]) => {
          const line = document.createElement('div'); line.style.cssText = 'display:flex;gap:8px;justify-content:space-between;min-width:200px;';
          const lbl = document.createElement('span'); lbl.style.opacity = '0.55'; lbl.textContent = String(label);
          const val = document.createElement('span'); val.style.color = '#00ff41'; val.textContent = String(value);
          line.append(lbl, val); panel.appendChild(line);
        });
        const hint = document.createElement('div'); hint.style.cssText = 'opacity:.35;font-size:.55rem;margin-top:6px;text-align:center;'; hint.textContent = 'click clock 3× or press Ctrl+K to close';
        panel.appendChild(hint);
        document.body.appendChild(panel);
      },
    },
    {
      id: 'hyperfocus', name: 'Hyperfocus Mode',
      icon: '🧘',
      desc: 'Hold the session timer 3 seconds · or activate here → UI fades, only clock remains · Esc to exit',
      keywords: 'hyperfocus focus zen minimal distraction',
      action: () => {
        const on = document.body.classList.toggle('hyperfocus');
        showToast(on ? '🧘 Hyperfocus — press Esc to exit' : 'Hyperfocus off', 3000);
      },
    },
    {
      id: 'device-shake', name: 'Shake to Shuffle Theme',
      icon: '🎲',
      desc: 'Shake your phone → random theme · or click here to shuffle now',
      keywords: 'shake random shuffle mobile phone theme',
      action: () => { const t = THEMES[Math.floor(Math.random() * THEMES.length)]!; applyTheme(t); showToast(`🎲 ${t.name}`); },
    },
    {
      id: 'sidereal-time', name: 'Local Sidereal Time',
      icon: '🔭',
      desc: 'Click the UTC pill 7× → switches display to astronomical sidereal time',
      keywords: 'sidereal time astronomy telescope UTC pill',
      action: () => showToast('🔭 Click the UTC pill 7 times to activate sidereal time mode', 5000),
    },
    {
      id: 'cyberpunk-samurai', name: 'Night City Glitch',
      icon: '🌆',
      desc: 'Type "nightcity" or "samurai" → Cyberpunk theme + RGB screen glitch burst',
      keywords: 'cyberpunk nightcity samurai glitch neon',
      action: () => { applyTheme(THEME_BY_ID['cyberpunk']!); showToast('🌆 Wake the f*** up, Samurai.', 4000); },
    },
    {
      id: 'hal-sorry', name: 'HAL 9000 — "I\'m Sorry, Dave"',
      icon: '🔴',
      desc: 'Type "hal" → full-screen HAL overlay · type "daisy" → HAL sings line by line',
      keywords: 'hal 9000 dave sorry pod bay doors kubrick 2001',
      action: () => {
        applyTheme(THEME_BY_ID['hal9000']!);
        const o = document.createElement('div');
        o.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;cursor:pointer;animation:halFadeIn .8s ease forwards;';
        const m = document.createElement('div'); m.style.cssText = 'color:#cc0000;font-family:Orbitron,monospace;font-size:clamp(1rem,3vw,2rem);font-weight:900;text-align:center;text-shadow:0 0 30px #cc0000;'; m.textContent = "I'm sorry, Dave.";
        const s = document.createElement('div'); s.style.cssText = 'color:#cc000088;font-family:Orbitron,monospace;font-size:clamp(.6rem,1.5vw,1rem);letter-spacing:.15em;'; s.textContent = "I'M AFRAID I CAN'T DO THAT.";
        o.append(m, s); document.body.appendChild(o);
        o.addEventListener('click', () => o.remove()); setTimeout(() => o.remove(), 5000);
      },
    },
    {
      id: 'tenet-reverse', name: 'Tenet — Time Reversal',
      icon: '⏪',
      desc: 'Type "tenet" or "dont try" → clock display mirrors and UI inverts for 5 seconds',
      keywords: 'tenet invert reverse time nolan palindrome',
      action: () => {
        applyTheme(THEME_BY_ID['tenet']!);
        document.body.classList.add('tenet-reverse');
        showToast('⏪ What\'s happened, happened.', 4000);
        setTimeout(() => document.body.classList.remove('tenet-reverse'), 5000);
      },
    },
    {
      id: 'dracarys', name: 'Dracarys — Dragon Fire',
      icon: '🐉',
      desc: 'Type "dracarys" or "targaryen" → House of the Dragon theme',
      keywords: 'dracarys targaryen dragon fire got hotd',
      action: () => { applyTheme(THEME_BY_ID['dragonfire']!); showToast('🐉 Dracarys.', 4000); },
    },
    {
      id: 'khonshu', name: 'Fist of Khonshu',
      icon: '🌙',
      desc: 'Type "khonshu" or "moonknight" → Moon Knight theme',
      keywords: 'khonshu moonknight moon knight marc spector',
      action: () => { applyTheme(THEME_BY_ID['moonknight']!); showToast('🌙 I am the Fist of Khonshu.', 4000); },
    },
    {
      id: 'luffy', name: 'King of the Pirates',
      icon: '🏴‍☠️',
      desc: 'Type "luffy" or "gomu gomu" → One Piece theme + gold flash',
      keywords: 'luffy onepiece gomu rubber pirate straw hat',
      action: () => {
        applyTheme(THEME_BY_ID['onepiece']!);
        const el = document.createElement('div'); el.style.cssText = 'position:fixed;inset:0;background:#ffcc00;z-index:9999;pointer-events:none;animation:eggFlash .6s ease forwards;';
        document.body.appendChild(el); setTimeout(() => el.remove(), 700);
        showToast('🏴‍☠️ "I\'m gonna be King of the Pirates!" — Luffy', 5000);
      },
    },
    {
      id: 'dedicate', name: 'Dedicate Your Heart',
      icon: '⚔️',
      desc: 'Type "dedicate" or "eren" → Attack on Titan theme + Survey Corps battle cry',
      keywords: 'dedicate heart eren titan aot survey corps',
      action: () => { applyTheme(THEME_BY_ID['attackontitan']!); showToast('⚔️ DEDICATE YOUR HEART!', 4000); },
    },
    {
      id: 'kira', name: 'I Am Kira',
      icon: '📓',
      desc: 'Type "kira" or "lightyagami" → Death Note theme · "lightyagami" triggers L\'s analysis',
      keywords: 'kira light yagami death note L shinigami justice',
      action: () => { applyTheme(THEME_BY_ID['deathnote']!); showToast('📓 I am justice. I am the god of the new world.', 4000); },
    },
    {
      id: 'potato-chip', name: 'Potato Chip Moment',
      icon: '🍟',
      desc: 'Type "potato chip" → Death Note theme + the iconic scene quote',
      keywords: 'potato chip eat death note light kira',
      action: () => { applyTheme(THEME_BY_ID['deathnote']!); showToast('📓 I\'ll take a potato chip… and eat it!', 5000); },
    },
    {
      id: 'heisenberg', name: 'Say My Name',
      icon: '⚗️',
      desc: 'Type "heisenberg" → Breaking Bad theme',
      keywords: 'heisenberg walter white breaking bad danger',
      action: () => { applyTheme(THEME_BY_ID['breakingbad']!); showToast('⚗️ You\'re goddamn right.', 4000); },
    },
    {
      id: 'winchester', name: 'The Road So Far',
      icon: '🔥',
      desc: 'Type "winchester" → Supernatural theme',
      keywords: 'winchester supernatural dean sam impala family business',
      action: () => { applyTheme(THEME_BY_ID['supernatural']!); showToast('🔥 The Road So Far…', 4000); },
    },
    {
      id: 'red-john', name: 'Red John Was Here',
      icon: '🔴',
      desc: 'Type "redjohn" → The Mentalist theme',
      keywords: 'redjohn mentalist jane red john smiley face',
      action: () => { applyTheme(THEME_BY_ID['mentalist']!); showToast('🔴 He\'s been here.', 4000); },
    },
    {
      id: 'bada-bing', name: 'Bada Bing',
      icon: '🥃',
      desc: 'Type "bada bing" → The Sopranos theme',
      keywords: 'bada bing sopranos tony soprano mafia',
      action: () => { applyTheme(THEME_BY_ID['sopranos']!); showToast('🥃 Bada bing.', 4000); },
    },
    {
      id: 'winden', name: 'Sic Mundus Creatus Est',
      icon: '⏳',
      desc: 'Type "winden" → Dark theme',
      keywords: 'winden dark sic mundus time loop knot',
      action: () => { applyTheme(THEME_BY_ID['dark']!); showToast('⏳ Sic Mundus Creatus Est.', 4000); },
    },
    {
      id: 'oppenheimer', name: 'Now I Am Become Death',
      icon: '☢️',
      desc: 'Type "oppenheimer" → Oppenheimer theme + atomic flash',
      keywords: 'oppenheimer trinity atomic bomb death destroyer worlds',
      action: () => { applyTheme(THEME_BY_ID['oppenheimer']!); showToast('☢️ Now I am become Death, the destroyer of worlds.', 5000); },
    },
    {
      id: 'phoenix-unlock', name: 'Phoenix Theme',
      icon: '🔥',
      desc: 'Complete 100 sessions to unlock · check progress here',
      keywords: 'phoenix unlock 100 sessions veteran fire rise',
      action: () => {
        const count = JSON.parse(localStorage.getItem('sc_focus_log') || '[]').length;
        if (Easter.isPhoenixUnlocked()) {
          applyTheme(THEME_BY_ID['phoenix']!); showToast('🔥 You rise.', 4000);
        } else {
          showToast(`🔥 ${count}/100 sessions to unlock Phoenix theme`, 4000);
        }
      },
    },
    {
      id: 'fsociety', name: 'fsociety — Hello, Friend',
      icon: '💻',
      desc: 'Type "mrrobot" or "fsociety" → Mr. Robot theme',
      keywords: 'fsociety mrrobot hello friend hacker elliot',
      action: () => { applyTheme(THEME_BY_ID['mrrobot']!); showToast('💻 Hello, friend.', 4000); },
    },
    {
      id: 'spice', name: 'The Spice Must Flow',
      icon: '🏜️',
      desc: 'Type "spice" → Dune theme',
      keywords: 'spice dune arrakis melange paul atreides',
      action: () => { applyTheme(THEME_BY_ID['dune']!); showToast('🏜️ The spice must flow.', 4000); },
    },
    {
      id: 'hailmary-egg', name: 'Project Hail Mary',
      icon: '🌟',
      desc: 'Type "hailmary" or "ryland" → bioluminescent space theme',
      keywords: 'hailmary ryland grace rocky astrophage tau ceti andy weir',
      action: () => { applyTheme(THEME_BY_ID['hailmary']!); showToast('🌟 I\'m not dead. That\'s a good start.', 4000); },
    },
    {
      id: 'evangelion-egg', name: 'Evangelion — Pattern Blue',
      icon: '⚠️',
      desc: 'Type "nerv" → NERV alert screen · "shinji" → theme switch',
      keywords: 'evangelion nerv shinji unit01 rei asuka get in the robot',
      action: () => {
        applyTheme(THEME_BY_ID['evangelion']!);
        // Trigger the alert effect
        Easter.initEaster((id) => { const t = THEME_BY_ID[id]; if (t) applyTheme(t); }, showToast, () => Sound.playChime());
        showToast('⚠️ Pattern Blue detected.', 4000);
      },
    },
    {
      id: 'akira-egg', name: 'Akira — Neo-Tokyo',
      icon: '🏍',
      desc: 'Type "kaneda" or "tetsuo" → psychic blast effect',
      keywords: 'akira kaneda tetsuo neo tokyo anime 1988 manga',
      action: () => { applyTheme(THEME_BY_ID['akira']!); showToast('🏍 Neo-Tokyo, 2019.', 4000); },
    },
  ];

  eggs.forEach(e => items.push({ ...e, tag: 'egg' }));

  // ── Actions ──────────────────────────────────────────────────────────
  const actions: [string, string, string, string, () => void][] = [
    ['sound',        '🎵', 'Open Sound Mixer',          'Ambient sounds, binaural beats',            () => { buildSoundUI(); openModal('soundOverlay'); }],
    ['pom',          '⏱', 'Pomodoro Settings',          'Configure work/break cycles',               () => openModal('pomOverlay')],
    ['templates',    '📋', 'Session Templates',          'Study, coding, deep work, reading…',        () => openModal('templatesOverlay')],
    ['countdown',    '⏳', 'Deadline Countdown',         'Count down to an exam, meeting, or event',  () => openModal('countdownOverlay')],
    ['worldclock',   '🌍', 'World Clock',                'Compare times across timezones',             () => openModal('worldClockOverlay')],
    ['log',          '📊', 'Focus Log',                  'View session history & heatmap',            () => openLog()],
    ['share',        '🖼', 'Share Focus Card',           'Download PNG of today\'s focus',             () => { openShareCard(); }],
    ['settings',     '⚙️', 'Settings',                  'Clock, sound, focus, privacy',              () => openSettings()],
    ['theme-builder','🎨', 'Custom Theme Builder',       'Build your own colour theme',               () => openThemeBuilder()],
    ['qr',           '📱', 'QR Handoff',                 'Resume session on another device',          () => openQRHandoff()],
    ['animedoro',    '🎬', 'Animedoro Mode',             '50 min focus / 20 min theater break',      () => { startAnimedoro(); openModal('pomOverlay'); }],
    ['kiosk',        '⛶', 'Kiosk / Fullscreen',         'Hide all UI, clock only',                  () => toggleKiosk()],
    ['zen',          '🧘', 'Zen Mode',                   'Distraction-free — clock + task only',      () => toggleZen()],
    ['present',      '📺', 'Presentation Mode',          'Ultra-minimal display',                     () => togglePresent()],
    ['pip',          '⧉', 'Picture-in-Picture Clock',   'Float clock above other apps',              () => APIs.enterPiP(document.getElementById('clock-block-wrap')!,{accent:currentTheme.accent,text:currentTheme.text,baseBg:currentTheme.baseBg}).then(()=>showToast('Clock in PiP'))],
    ['data',         '🛡', 'My Data',                    'View, export, or delete your data',         () => openDataPanel()],
    ['privacy',      '🔒', 'Toggle Privacy Mode',        'Disable weather, sync & fonts',             () => togglePrivacy()],
    ['language',     '🌐', 'Language',                   'Change UI language (8 languages)',           () => { buildLanguageUI(document.getElementById('languageContent')!); openModal('languageOverlay'); }],
    ['random',       '🎲', 'Random Theme',               'Shuffle to a random theme',                 () => { const t=THEMES[Math.floor(Math.random()*THEMES.length)]!; applyTheme(t); showToast(`🎲 ${t.name}`); }],
    ['next-theme',   '▶', 'Next Theme',                  'Cycle to next theme',                      () => { const i=THEMES.indexOf(currentTheme); applyTheme(THEMES[(i+1)%THEMES.length]!); }],
  ];
  actions.forEach(([id, icon, name, desc, action]) => {
    items.push({ id: `action:${id}`, name, desc, icon, tag: 'action', action });
  });

  // ── Session Templates as direct commands ────────────────────────────
  Features.SESSION_TEMPLATES.forEach(t => {
    items.push({
      id: `template:${t.id}`,
      name: `${t.icon} ${t.name}`,
      desc: `${t.durationMins}min session · ${t.desc}`,
      icon: t.icon,
      tag: 'action' as const,
      keywords: `template session ${t.name} ${t.desc}`,
      action: () => {
        if (t.themeId) { const th = THEME_BY_ID[t.themeId]; if (th) applyTheme(th); }
        Pom.setWorkMins(t.durationMins);
        Pom.setBreakMins(t.breakMins);
        if (!Pom.isActive()) Pom.toggle();
        if (t.soundId) Sound.play(t.soundId);
        showToast(`${t.icon} ${t.name} — ${t.durationMins}min session ready`);
      },
    });
  });

  // ── Settings toggles ─────────────────────────────────────────────────
  const settingsList: [string, string, string, () => void][] = [
    ['quality-high',  '⚡ High Quality',    'Max particles, all effects',    () => { setTier('high'); invalidateCache(); showToast('Quality: HIGH'); }],
    ['quality-med',   '⚡ Medium Quality',  'Balanced performance',           () => { setTier('med');  invalidateCache(); showToast('Quality: MED'); }],
    ['quality-low',   '⚡ Low Quality',     'Minimal effects for slow devices',() => { setTier('low'); invalidateCache(); showToast('Quality: LOW'); }],
    ['reduce-motion', '✦ Toggle Reduce Motion', 'Disable animations',        () => { document.body.classList.toggle('reduced-motion'); const on=document.body.classList.contains('reduced-motion'); localStorage.setItem('sc_reduce_motion',on?'1':'0'); showToast(on?'Reduce motion on':'Full animations on'); }],
    ['incognito',     '🕵 Incognito Sessions', 'Sessions not saved',         () => { Privacy.setIncognito(!Privacy.isIncognito()); showToast(Privacy.isIncognito()?'🕵 Incognito on':'Incognito off'); }],
    ['wake-lock',     '🔆 Toggle Wake Lock',  'Keep screen on during sessions',() => APIs.setWakeLock(!APIs.isWakeLockEnabled()).then(()=>showToast(APIs.isWakeLockEnabled()?'Screen stays on':'Wake lock off'))],
  ];
  settingsList.forEach(([id, name, desc, action]) => {
    items.push({ id: `setting:${id}`, name, desc, icon: '⚙️', tag: 'setting', action });
  });

  Cmd.registerItems(items);
}

init();