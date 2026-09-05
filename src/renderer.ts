import type { Theme } from './types';
import { rnd, rndpm, easeIO, MAT_CHARS } from './utils';
import { getAudioLevel, getBassLevel } from './sound';
import { getCircadianWarmth, getSunTimes } from './weather';
import { getTier, shouldRenderFull, shouldSampleAudio, shouldDrawGlow, maxParticles, particleStepSize, isTabVisible } from './perf';

// Parallax offset — set by main.ts via mouse/gyro
let _parallaxX = 0, _parallaxY = 0;
export function setParallax(x: number, y: number) { _parallaxX = x; _parallaxY = y; }

// ── Cached DOM refs (avoid getElementById in hot path) ────────────────
const grainEl = document.getElementById('grain') as HTMLElement;

// ── Gradient cache — recomputed only on theme/resize change ──────────
interface GradCache { bg: CanvasGradient | null; bloom: CanvasGradient | null; themeId: string; w: number; h: number; }
const gradCache: GradCache = { bg: null, bloom: null, themeId: '', w: 0, h: 0 };
let lastAccent = '';
let lastBloomR = 0;

function getBgGrad(bg: string[], pad: number): CanvasGradient {
  if (gradCache.themeId && gradCache.w === W && gradCache.h === H && gradCache.bg) {
    // Check if theme changed
    if (gradCache.themeId === bg.join(',')) return gradCache.bg;
  }
  const gr = c.createLinearGradient(-pad, -pad, W + pad, H + pad);
  gr.addColorStop(0, bg[0]!); gr.addColorStop(0.5, bg[1] ?? bg[0]!); gr.addColorStop(1, bg[2] ?? bg[0]!);
  gradCache.bg = gr;
  gradCache.themeId = bg.join(',');
  gradCache.w = W; gradCache.h = H;
  return gr;
}

// Invalidate gradient cache on resize
let transitioning = false;

export function invalidateCache() {
  gradCache.bg = null; gradCache.bloom = null;
  gradCache.themeId = ''; gradCache.w = 0; gradCache.h = 0;
  offBgTheme = ''; // also invalidate offscreen bg
}

// ── SMPTE focus-log cache — avoid localStorage every frame ─────────────
let smpteCachedClips: Array<{startPct:number;durPct:number;lane:number;task:string}> = [];
let smpteLastCacheTs = 0;

function getSMPTEClips(today: string) {
  const now = Date.now();
  if (now - smpteLastCacheTs < 30_000) return smpteCachedClips; // 30s cache
  try {
    const entries = JSON.parse(localStorage.getItem('sc_focus_log') || '[]');
    smpteCachedClips = entries
      .filter((e: {date:string}) => e.date === today)
      .map((e: {time:number;dur:number;task:string}, idx: number) => {
        const d = new Date(e.time);
        return {
          startPct: (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400,
          durPct: Math.min(e.dur / 86400000, 0.15),
          lane: idx % 4,
          task: (e.task ?? '').slice(0, 12),
        };
      });
    smpteLastCacheTs = now;
  } catch { smpteCachedClips = []; }
  return smpteCachedClips;
}

// ── Severance number cache — don't call Math.random() 12×/frame ────────
const sevClusterNums: number[] = Array.from({length: 12}, () => Math.floor(Math.random() * 10));
let sevNumTimer = 0;

// ── Particle pool (SoA Float32Array) ────────────────────────────────────
const PSTRIDE = 6; // x, y, vx, vy, size, alpha
const MAX_PARTICLES = 400;
let pool = new Float32Array(MAX_PARTICLES * PSTRIDE);
let poolN = 0;

export let W = 0, H = 0;
export let tick = 0;

const bgCanvas = document.getElementById('bgCanvas') as HTMLCanvasElement;
const tCanvas  = document.getElementById('transCanvas') as HTMLCanvasElement;
const c  = bgCanvas.getContext('2d', { alpha: false })!;
const tc = tCanvas.getContext('2d')!;

// Offscreen canvas — static bg gradient painted once, composited each frame
let offBg: OffscreenCanvas | null = null;
let offBgCtx: OffscreenCanvasRenderingContext2D | null = null;
let offBgTheme = '';
let offBgSupported = typeof OffscreenCanvas !== 'undefined';

function getOffscreenBg(theme: Theme): OffscreenCanvas | null {
  if (!offBgSupported) return null;
  const key = theme.id + W + H;
  if (offBgTheme === key && offBg) return offBg;
  try {
    offBg = new OffscreenCanvas(W, H);
    offBgCtx = offBg.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (!offBgCtx) { offBgSupported = false; return null; } // Firefox in some contexts
    offBgTheme = key;
    const bg = theme.baseBg;
    const gr = offBgCtx.createLinearGradient(0, 0, W * 0.4, H);
    gr.addColorStop(0, bg[0]!);
    gr.addColorStop(0.5, bg[1] ?? bg[0]!);
    gr.addColorStop(1, bg[2] ?? bg[0]!);
    offBgCtx.fillStyle = gr;
    offBgCtx.fillRect(0, 0, W, H);
    return offBg;
  } catch {
    offBgSupported = false; // disable permanently on this browser/device
    return null;
  }
}

// ── Breathing mode ────────────────────────────────────────────────────
let breathingActive = false;
let breathingStart  = 0;
const BREATH_PHASE_SEC = 4; // 4s per phase (inhale/hold/exhale/hold)

export function setBreathing(active: boolean) {
  breathingActive = active;
  breathingStart  = active ? performance.now() / 1000 : 0;
}

export function resize() {
  W = bgCanvas.width  = tCanvas.width  = window.innerWidth;
  H = bgCanvas.height = tCanvas.height = window.innerHeight;
  invalidateCache();
}

// ── Particle initialisation ───────────────────────────────────────────
export function buildParticles(theme: Theme) {
  const bt = theme.bgType;
  const base = bt === 'aurora' ? 280 : bt === 'matrix' || bt === 'strangerthings' ? 220 : 180;
  poolN = Math.min(maxParticles(base), MAX_PARTICLES);
  const p = pool;
  for (let i = 0; i < poolN; i++) {
    const o = i * PSTRIDE;
    p[o]   = rnd(W); p[o+1] = rnd(H);
    p[o+2] = rndpm(0.6); p[o+3] = rndpm(0.6);
    p[o+4] = rnd(2.5) + 0.5; p[o+5] = rnd(0.6) + 0.1;
  }
}

// ── Cached circadian warmth — recomputed once per second ──────────────
let _lastCircadianSec = -1;
let _cachedWarmth = 0;

// ── Main draw dispatcher ──────────────────────────────────────────────
// Current flow intensity — 0 (just started) to 1 (deep focus, 45+ min)
let _flowIntensity = 0;
export function getRendererFlowIntensity() { return _flowIntensity; }

export function drawBg(dt: number, theme: Theme, flowIntensity = 0) {
  _flowIntensity = flowIntensity;
  // Tab hidden — skip all rendering
  if (!isTabVisible()) return;

  tick += dt;
  const bt = theme.bgType;
  const bg = theme.baseBg;

  // Apply parallax via canvas transform
  c.save();
  c.translate(_parallaxX * 0.4, _parallaxY * 0.4);

  // Paint background — use cached offscreen bitmap when available (major perf win)
  const cached = getOffscreenBg(theme);
  if (cached) {
    c.drawImage(cached, -_parallaxX * 0.4 - 20, -_parallaxY * 0.4 - 20, W + 40, H + 40);
  } else {
    const pad = 20;
    c.fillStyle = getBgGrad(bg, pad);
    c.fillRect(-pad, -pad, W + pad * 2, H + pad * 2);
  }
  (DRAW[bt] ?? drawParticles)(dt, theme);
  c.restore();

  // ── Circadian warm overlay — cached per second ───────────────────────
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec !== _lastCircadianSec) {
    const st = getSunTimes();
    _cachedWarmth = st ? getCircadianWarmth(st) : 0;
    _lastCircadianSec = nowSec;
  }
  if (_cachedWarmth > 0.01) {
    c.fillStyle = `rgba(200,100,20,${(_cachedWarmth * 0.18).toFixed(3)})`;
    c.fillRect(0, 0, W, H);
  }

  // ── Flow Intensity overlay — universal, all themes ───────────────────
  // As focus deepens the theme quietly intensifies: accent vignette grows,
  // corners deepen, the world contracts around the clock.
  if (_flowIntensity > 0.05 && shouldDrawGlow()) {
    // Subtle accent bloom at centre that grows with focus
    const fr = Math.min(W, H) * (0.3 + _flowIntensity * 0.5);
    const fg = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, fr);
    const fa = (_flowIntensity * 0.06).toFixed(3);
    fg.addColorStop(0, `${theme.accent}${Math.round(_flowIntensity * 22).toString(16).padStart(2,'0')}`);
    fg.addColorStop(1, 'transparent');
    c.fillStyle = fg; c.fillRect(0, 0, W, H);

    // Corner vignette deepens — world closes in
    if (_flowIntensity > 0.3) {
      const vg = c.createRadialGradient(W/2, H/2, H * 0.2, W/2, H/2, Math.max(W,H));
      vg.addColorStop(0, 'transparent');
      vg.addColorStop(1, `rgba(0,0,0,${((_flowIntensity - 0.3) * 0.35).toFixed(3)})`);
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
    }
  }

  // ── Audio-reactive bloom — skip frames on LOW tier ───────────────────
  if (shouldSampleAudio()) {
    const audioLvl = getAudioLevel();
    const bassLvl  = getBassLevel();
    if (audioLvl > 0.02 && shouldDrawGlow()) {
      const bloomR = Math.min(W, H) * (0.38 + bassLvl * 0.28);
      // Only recreate gradient if bloom radius changed significantly
      if (Math.abs(bloomR - lastBloomR) > 4 || lastAccent !== theme.accent) {
        lastBloomR = bloomR; lastAccent = theme.accent;
        gradCache.bloom = c.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, bloomR);
        const hex = Math.round(audioLvl * 0.12 * 255).toString(16).padStart(2, '0');
        gradCache.bloom.addColorStop(0, `${theme.accent}${hex}`);
        gradCache.bloom.addColorStop(1, 'transparent');
      }
      if (gradCache.bloom) {
        c.fillStyle = gradCache.bloom; c.fillRect(0, 0, W, H);
      }

      // Update grain opacity — avoid DOM write every frame with threshold
      if (grainEl && theme.grain) {
        const cur = parseFloat(grainEl.style.opacity || '0');
        const target = Math.min(0.4, 0.2 + bassLvl * 0.3);
        const next = cur + (target - cur) * 0.12;
        if (Math.abs(next - cur) > 0.005) grainEl.style.opacity = next.toFixed(3);
      }
    }
  }

  // ── Box breathing overlay ─────────────────────────────────────────────
  if (breathingActive) drawBreathing();
}

// ── Per-theme draw functions ──────────────────────────────────────────
const DRAW: Record<string, (dt: number, theme: Theme) => void> = {
  aurora(dt, t)  { drawAurora(t); drawParticles(dt, t); },
  sunrise(dt, t) { drawSunrise(t); drawParticles(dt, t); },
  forest(dt, t)  { drawForest(t); drawParticles(dt, t); },
  ocean(dt, t)   { drawOcean(t); drawParticles(dt, t); },
  candy(dt, t)   { drawCandy(t); drawParticles(dt, t); },
  nordic(dt, t)  { drawNordic(); },
  midnight(dt,t) { drawMidnight(dt, t); drawParticles(dt, t); },
  lemon(dt, t)   { drawLemon(); },
  blueprint(dt,t){ drawBlueprint(t); },
  commonroom(dt,t){ drawCommonRoom(t); },
  severance(dt,t) { drawSeverance(dt, t); },
  terminal(dt,t) { drawTerminal(dt, t); },
  literary(dt,t) { drawLiterary(t); drawParticles(dt, t); },
  supernatural(dt,t){ drawMediaBg(t); drawSymbol('supernatural', t); },
  mentalist(dt,t)   { drawMediaBg(t); drawSymbol('mentalist', t); },
  sopranos(dt,t)    { drawMediaBg(t); drawSymbol('sopranos', t); },
  dark(dt,t)        { drawMediaBg(t); drawSymbol('dark', t); },
  breakingbad(dt,t) { drawMediaBg(t); drawSymbol('breakingbad', t); },
  strangerthings(dt,t){ drawMediaBg(t); drawParticles(dt, t); drawSymbol('strangerthings', t); },
  interstellar(dt,t){ drawInterstellar(dt, t); drawSymbol('interstellar', t); },
  dune(dt,t)        { drawMediaBg(t); drawParticles(dt, t); drawSymbol('dune', t); },
  matrix(dt,t)      { drawMatrix(t); drawSymbol('matrix', t); },
  bladerunner(dt,t) { drawMediaBg(t); drawSymbol('bladerunner', t); },
  inception(dt,t)   { drawMediaBg(t); drawSymbol('inception', t); },
  godfather(dt,t)   { drawMediaBg(t); drawSymbol('godfather', t); },
  redbull(dt,t)     { drawF1Bg(t,'redbull'); },
  ferrari(dt,t)     { drawF1Bg(t,'ferrari'); },
  mercedes(dt,t)    { drawF1Bg(t,'mercedes'); },
  mclaren(dt,t)     { drawF1Bg(t,'mclaren'); },
  astonmartin(dt,t) { drawF1Bg(t,'astonmartin'); },
  gameoflife(dt,t)  { drawGameOfLife(dt, t); },
  mrrobot(dt,t)     { drawMrRobot(dt, t); },
  oppenheimer(dt,t) { drawOppenheimer(dt, t); },
  thebear(dt,t)     { drawTheBear(dt, t); },
  '8bit'(dt,t)      { draw8Bit(dt, t); },
  phoenix(dt,t)     { drawPhoenix(dt, t); },
  cyberpunk(dt,t)   { drawCyberpunk(dt, t); },
  hal9000(dt,t)     { drawHAL9000(dt, t); },
  tenet(dt,t)       { drawTenet(dt, t); },
  dragonfire(dt,t)  { drawDragonFire(dt, t); },
  moonknight(dt,t)  { drawMoonKnight(dt, t); },
  onepiece(dt,t)    { drawOnePiece(dt, t); },
  attackontitan(dt,t){ drawAttackOnTitan(dt, t); },
  deathnote(dt,t)   { drawDeathNote(dt, t); },
  hailmary(dt,t)    { drawHailMary(dt, t); },
  evangelion(dt,t)  { drawEvangelion(dt, t); },
  akira(dt,t)            { drawAkira(dt, t); },
  bettercallsaul(dt,t)  { drawBetterCallSaul(dt, t); },
  peakyblinders(dt,t)   { drawPeakyBlinders(dt, t); },
  thewire(dt,t)         { drawTheWire(dt, t); },
  succession(dt,t)      { drawSuccession(dt, t); },
  lost(dt,t)            { drawLost(dt, t); },
  shogun(dt,t)          { drawShogun(dt, t); },
  fallout(dt,t)          { drawFallout(dt, t); },
  futurama(dt,t)        { drawFuturama(dt, t); },
  familyguy(dt,t)       { drawFamilyGuy(dt, t); },
  rickmorty(dt,t)       { drawRickMorty(dt, t); },
  simpsons(dt,t)        { drawSimpsons(dt, t); },
  southpark(dt,t)       { drawSouthPark(dt, t); },
  boondocks(dt,t)       { drawBoondocks(dt, t); },
  archer(dt,t)          { drawArcher(dt, t); },
  bobsburgers(dt,t)     { drawBobsBurgers(dt, t); },

  // ── F1 teams (extended) ──
  alpine(dt,t)   { drawF1Bg(t,'alpine'); },
  rbf1(dt,t)     { drawF1Bg(t,'rbf1'); },
  williams(dt,t) { drawF1Bg(t,'williams'); },

  // ── Media themes (backed by generic vignette + bespoke symbol) ──
  adventuretime(dt,t) { drawMediaBg(t); drawParticles(dt, t); drawSymbol('adventuretime', t); },
  andor(dt,t)         { drawMediaBg(t); drawSymbol('andor', t); },
  chernobyl(dt,t)     { drawMediaBg(t); drawSymbol('chernobyl', t); },
  cowboybebop(dt,t)   { drawMediaBg(t); drawSymbol('cowboybebop', t); },
  drivemovie(dt,t)    { drawMediaBg(t); drawSymbol('drivemovie', t); },
  fargo(dt,t)         { drawMediaBg(t); drawSymbol('fargo', t); },
  ghostshell(dt,t)    { drawMediaBg(t); drawSymbol('ghostshell', t); },
  grandbudapest(dt,t) { drawMediaBg(t); drawSymbol('grandbudapest', t); },
  gravityfalls(dt,t)  { drawMediaBg(t); drawSymbol('gravityfalls', t); },
  jjk(dt,t)           { drawMediaBg(t); drawSymbol('jjk', t); },
  johnwick(dt,t)      { drawMediaBg(t); drawSymbol('johnwick', t); },
  madmen(dt,t)        { drawMediaBg(t); drawSymbol('madmen', t); },
  nocountry(dt,t)     { drawMediaBg(t); drawSymbol('nocountry', t); },
  se7en(dt,t)         { drawMediaBg(t); drawSymbol('se7en', t); },
  spiderverse(dt,t)   { drawMediaBg(t); drawSymbol('spiderverse', t); },
  thebatman(dt,t)     { drawMediaBg(t); drawSymbol('thebatman', t); },
  truedetective(dt,t) { drawMediaBg(t); drawSymbol('truedetective', t); },
  twinpeaks(dt,t)     { drawMediaBg(t); drawSymbol('twinpeaks', t); },
  vinlandsaga(dt,t)   { drawMediaBg(t); drawSymbol('vinlandsaga', t); },
  whiplash(dt,t)      { drawMediaBg(t); drawSymbol('whiplash', t); },
  yourname(dt,t)      { drawMediaBg(t); drawSymbol('yourname', t); },
  hannibal(dt,t)      { drawMediaBg(t); drawSymbol('hannibal', t); },
  slowhorses(dt,t)    { drawMediaBg(t); drawSymbol('slowhorses', t); },
  theboys(dt,t)       { drawMediaBg(t); drawSymbol('theboys', t); },
  tedlasso(dt,t)      { drawMediaBg(t); drawSymbol('tedlasso', t); },
  forallmankind(dt,t) { drawMediaBg(t); drawSymbol('forallmankind', t); },
  lanterns(dt,t)      { drawMediaBg(t); drawSymbol('lanterns', t); },
  you(dt,t)           { drawMediaBg(t); drawSymbol('you', t); },

  // ── Bespoke atmospheric scenes ──
  bioluminescence(dt,t) { drawBioluminescence(t); },
  cabinsnow(dt,t)       { drawCabinSnow(t); },
  coffeerain(dt,t)      { drawCoffeeRain(t); },
  ghibli(dt,t)           { drawGhibli(t); },
  greenhouse(dt,t)       { drawGreenhouse(t); },
  lavalamp(dt,t)         { drawLavaLamp(t); },
  midnightlibrary(dt,t)  { drawMidnightLibrary(t); },
  smpte(dt,t)            { drawSMPTE(t); },
  vinylwarmth(dt,t)      { drawVinylWarmth(t); },
  zengarden(dt,t)        { drawZenGarden(t); },
};

// ── Background animations ─────────────────────────────────────────────
// Cached accent style to avoid string building every particle
let _lastParticleAccent = '';
let _lastParticleAlphaBase = 0;

function drawParticles(dt: number, t: Theme) {
  if (!shouldRenderFull()) return; // skip on low-tier frames
  const p = pool;
  const step = particleStepSize();
  const accent = t.accent;

  // Batch by alpha to reduce state changes
  c.fillStyle = accent;
  for (let i = 0; i < poolN; i += step) {
    const o = i * PSTRIDE;
    p[o]   += p[o+2] * step;
    p[o+1] += p[o+3] * step;
    if (p[o]   < -5) p[o]   = W + 5; else if (p[o]   > W + 5) p[o]   = -5;
    if (p[o+1] < -5) p[o+1] = H + 5; else if (p[o+1] > H + 5) p[o+1] = -5;
    c.globalAlpha = p[o+5]! * 0.45;
    c.beginPath(); c.arc(p[o]!, p[o+1]!, p[o+4]!, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
}

function drawAurora(t: Theme) {
  if (!shouldRenderFull()) return;
  const cols = t.bgColors as string[] ?? [t.accent, t.accent2];
  for (let i = 0; i < 4; i++) {
    const y = H * (0.15 + i * 0.18) + Math.sin(tick * 0.4 + i) * H * 0.06;
    const g = c.createLinearGradient(0, y - 80, 0, y + 80);
    g.addColorStop(0, 'transparent'); g.addColorStop(0.5, cols[i % cols.length] + '22'); g.addColorStop(1, 'transparent');
    c.fillStyle = g; c.fillRect(0, y - 80, W, 160);
  }
}

function drawSunrise(t: Theme) {
  if (!shouldDrawGlow()) return;
  const cy = H * 0.65;
  const g = c.createRadialGradient(W/2, cy, 0, W/2, cy, W * 0.7);
  g.addColorStop(0, t.accent + '44'); g.addColorStop(1, 'transparent');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

function drawForest(t: Theme) {
  if (!shouldDrawGlow()) return;
  const breath = 0.04 + 0.02 * Math.sin(tick * 0.3);
  const g = c.createRadialGradient(W/2, 0, 0, W/2, 0, H);
  g.addColorStop(0, t.accent + Math.round(breath * 255).toString(16).padStart(2,'0'));
  g.addColorStop(1, 'transparent');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

function drawOcean(t: Theme) {
  const waves = 3;
  for (let w = 0; w < waves; w++) {
    c.beginPath();
    const yBase = H * (0.6 + w * 0.1);
    c.moveTo(0, yBase);
    for (let x = 0; x <= W; x += 4) {
      c.lineTo(x, yBase + Math.sin(x * 0.008 + tick * (0.8 + w * 0.2)) * 18);
    }
    c.lineTo(W, H); c.lineTo(0, H); c.closePath();
    c.fillStyle = t.accent + (w === 0 ? '18' : w === 1 ? '0e' : '08');
    c.fill();
  }
}

function drawCandy(t: Theme) {
  const g = c.createRadialGradient(W*0.3, H*0.3, 0, W*0.5, H*0.5, W*0.7);
  g.addColorStop(0, t.accent + '22'); g.addColorStop(0.5, t.accent2 + '11'); g.addColorStop(1, 'transparent');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

function drawNordic() { /* clean white/grey — baseBg is enough */ }
function drawLemon()  { /* yellow baseBg is enough */ }

// ── Deep Bioluminescence — drifting glowing motes ───────────────────────
function drawBioluminescence(t: Theme) {
  if (!shouldDrawGlow()) return;
  const p = pool;
  for (let i = 0; i < poolN; i += 2) {
    const o = i * PSTRIDE;
    const glow = .3 + .25 * Math.sin(tick * 1.2 + i);
    const g = c.createRadialGradient(p[o]!, p[o+1]!, 0, p[o]!, p[o+1]!, p[o+4]! * 4);
    g.addColorStop(0, `${t.accent}${Math.round(glow*80).toString(16).padStart(2,'0')}`);
    g.addColorStop(1, 'transparent');
    c.fillStyle = g; c.beginPath(); c.arc(p[o]!, p[o+1]!, p[o+4]! * 4, 0, Math.PI * 2); c.fill();
  }
}

// ── Northern Cabin — falling snow + warm window glow ─────────────────────
function drawCabinSnow(t: Theme) {
  const p = pool;
  c.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < poolN; i++) {
    const o = i * PSTRIDE;
    p[o+1] += 0.4 + p[o+4]! * 0.3;
    p[o] += Math.sin(tick * 0.6 + i) * 0.2;
    if (p[o+1] > H + 5) { p[o+1] = -5; p[o] = rnd(W); }
    c.globalAlpha = p[o+5]! * 0.5; c.beginPath(); c.arc(p[o]!, p[o+1]!, p[o+4]! * 0.6, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  if (shouldDrawGlow()) {
    const g = c.createRadialGradient(W*.78, H*.72, 0, W*.78, H*.72, W*.22);
    g.addColorStop(0, `${t.accent}1c`); g.addColorStop(1, 'transparent');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
}

// ── Coffee Shop Rain — droplets on glass ─────────────────────────────────
function drawCoffeeRain(t: Theme) {
  const p = pool;
  c.strokeStyle = t.accent2 ?? t.accent; c.lineWidth = 1;
  for (let i = 0; i < poolN; i++) {
    const o = i * PSTRIDE;
    p[o+1] += 2.2 + p[o+4]! * 0.6;
    if (p[o+1] > H + 5) { p[o+1] = -5; p[o] = rnd(W); }
    c.globalAlpha = p[o+5]! * 0.3;
    c.beginPath(); c.moveTo(p[o]!, p[o+1]!); c.lineTo(p[o]!, p[o+1]! + 8); c.stroke();
  }
  c.globalAlpha = 1;
}

// ── Studio Ghibli — drifting soot-sprite motes ───────────────────────────
function drawGhibli(t: Theme) {
  const p = pool;
  for (let i = 0; i < poolN; i += 2) {
    const o = i * PSTRIDE;
    p[o+1] -= 0.15; p[o] += Math.sin(tick * 0.5 + i) * 0.3;
    if (p[o+1] < -5) { p[o+1] = H + 5; p[o] = rnd(W); }
    c.fillStyle = t.accent2 ?? t.accent; c.globalAlpha = p[o+5]! * 0.4;
    c.beginPath(); c.arc(p[o]!, p[o+1]!, p[o+4]! * 0.7, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
}

// ── Greenhouse — swaying leaf silhouettes ────────────────────────────────
function drawGreenhouse(t: Theme) {
  if (!shouldDrawGlow()) return;
  c.save(); c.globalAlpha = .08; c.fillStyle = t.accent;
  for (let i = 0; i < 6; i++) {
    const x = (i / 6) * W + Math.sin(tick * 0.3 + i) * 12, y = H * 0.15 + (i % 2) * H * 0.1;
    c.save(); c.translate(x, y); c.rotate(Math.sin(tick * 0.3 + i) * 0.15);
    c.beginPath(); c.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }
  c.restore();
}

// ── Lava Lamp — rising blobs ──────────────────────────────────────────
function drawLavaLamp(t: Theme) {
  const p = pool;
  for (let i = 0; i < poolN; i += 2) {
    const o = i * PSTRIDE;
    p[o+1] -= 0.5 + Math.sin(tick * 0.4 + i) * 0.3;
    p[o] += Math.sin(tick * 0.25 + i * 1.7) * 0.5;
    if (p[o+1] < -20) { p[o+1] = H + 20; p[o] = rnd(W); }
    const r = p[o+4]! * 2.6;
    const g = c.createRadialGradient(p[o]!, p[o+1]!, 0, p[o]!, p[o+1]!, r);
    g.addColorStop(0, `${t.accent}55`); g.addColorStop(1, 'transparent');
    c.fillStyle = g; c.beginPath(); c.arc(p[o]!, p[o+1]!, r, 0, Math.PI * 2); c.fill();
  }
}

// ── Midnight Library — drifting pages ────────────────────────────────────
function drawMidnightLibrary(t: Theme) {
  const p = pool;
  for (let i = 0; i < poolN; i += 3) {
    const o = i * PSTRIDE;
    p[o+1] -= 0.2; p[o] += Math.sin(tick * 0.4 + i) * 0.25;
    if (p[o+1] < -10) { p[o+1] = H + 10; p[o] = rnd(W); }
    c.save(); c.translate(p[o]!, p[o+1]!); c.rotate(Math.sin(tick * 0.3 + i) * 0.3);
    c.fillStyle = t.accent; c.globalAlpha = p[o+5]! * 0.3;
    c.fillRect(-4, -5, 8, 10);
    c.restore();
  }
  c.globalAlpha = 1;
}

// ── Vinyl Warmth — spinning record grooves ───────────────────────────────
function drawVinylWarmth(t: Theme) {
  if (!shouldDrawGlow()) return;
  const cx = W * .5, cy = H * .5, R = Math.min(W, H) * .32;
  c.save(); c.translate(cx, cy); c.rotate(tick * .15);
  c.strokeStyle = t.accent; c.lineWidth = 1;
  for (let r = R * .3; r < R; r += R * .06) { c.globalAlpha = .05; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); }
  c.restore();
}

// ── Zen Garden — raked sand lines ────────────────────────────────────────
function drawZenGarden(t: Theme) {
  if (!shouldDrawGlow()) return;
  const cx = W * .5, cy = H * .58;
  c.save(); c.strokeStyle = t.accent; c.lineWidth = 1;
  for (let r = 20; r < Math.min(W, H) * .45; r += 14) {
    c.globalAlpha = .07; c.beginPath();
    c.arc(cx, cy, r, Math.PI * .1 + Math.sin(tick * .05) * .02, Math.PI * .9 + Math.sin(tick * .05) * .02);
    c.stroke();
  }
  c.restore();
}

// ── Midnight — deep purple glow + shooting stars ──────────────────────
interface ShootingStar { x: number; y: number; len: number; speed: number; angle: number; alpha: number; life: number; maxLife: number; }
const shootingStars: ShootingStar[] = [];
let shootingStarTimer = 0;

function spawnShootingStar() {
  shootingStars.push({
    x: rnd(W), y: rnd(H * 0.5),
    len: 80 + rnd(140), speed: 6 + rnd(10),
    angle: Math.PI * 0.15 + rnd(Math.PI * 0.12),
    alpha: 1, life: 0, maxLife: 40 + rnd(30),
  });
}

function drawMidnight(dt: number, t: Theme) {
  // Glow
  if (shouldDrawGlow()) {
    const g = c.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.6);
    g.addColorStop(0, t.accent + '18'); g.addColorStop(1, 'transparent');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  // Shooting stars
  shootingStarTimer += dt;
  if (shootingStarTimer > (2.5 + rnd(4))) {
    spawnShootingStar();
    shootingStarTimer = 0;
  }
  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const s = shootingStars[i]!;
    s.life++;
    s.alpha = Math.max(0, 1 - s.life / s.maxLife);
    const ex = s.x + Math.cos(s.angle) * s.len;
    const ey = s.y + Math.sin(s.angle) * s.len;
    const grad = c.createLinearGradient(s.x, s.y, ex, ey);
    grad.addColorStop(0, `rgba(255,255,255,0)`);
    grad.addColorStop(0.4, `rgba(255,255,255,${s.alpha * 0.9})`);
    grad.addColorStop(1, `rgba(255,255,255,0)`);
    c.strokeStyle = grad; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(ex, ey); c.stroke();
    s.x += Math.cos(s.angle) * s.speed * 0.7;
    s.y += Math.sin(s.angle) * s.speed * 0.7;
    if (s.life >= s.maxLife || s.x > W + 50 || s.y > H + 50) shootingStars.splice(i, 1);
  }
}

function drawLiterary(t: Theme) {
  const g = c.createRadialGradient(W/2, H*0.3, 0, W/2, H*0.5, W*0.6);
  g.addColorStop(0, t.accent + '14'); g.addColorStop(1, 'transparent');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

// ── Severance — Lumon Industries ──────────────────────────────────────
const SEV_NUMBERS: string[] = [];
let sevLastTick = 0;
const SEV_COLS = 30;

function drawSeverance(dt: number, t: Theme) {
  // Slowly scroll numbers up like the MDR refinement screen
  sevLastTick += dt;
  if (sevLastTick > 0.18) {
    sevLastTick = 0;
    SEV_NUMBERS.unshift(
      Array.from({length: SEV_COLS}, () => Math.floor(Math.random() * 10)).join('  ')
    );
    if (SEV_NUMBERS.length > Math.ceil(H / 20) + 2) SEV_NUMBERS.length = Math.ceil(H / 20) + 2;
  }

  const fontSize = Math.max(11, Math.min(15, W / SEV_COLS));
  c.font = `300 ${fontSize}px 'Josefin Sans', sans-serif`;
  c.textAlign = 'center';

  // Draw number grid fading from bottom
  SEV_NUMBERS.forEach((line, i) => {
    const y = H * 0.55 - i * (fontSize + 6);
    if (y < 0 || y > H) return;
    const fade = Math.max(0, 1 - i / SEV_NUMBERS.length);
    // Some numbers "chosen" — brighter
    const chars = line.split('');
    let cx2 = (W - chars.length * (fontSize * 0.62)) / 2;
    chars.forEach(ch => {
      if (ch === ' ') { cx2 += fontSize * 0.3; return; }
      const bright = Math.random() < 0.03; // 3% chance bright
      c.fillStyle = bright
        ? `rgba(0,200,255,${fade * 0.85})`
        : `rgba(0,100,180,${fade * 0.22})`;
      c.fillText(ch, cx2, y);
      cx2 += fontSize * 0.62;
    });
  });

  // The "selected" cluster — a few numbers brighter in a small region near centre
  // The "selected" cluster — use cached numbers, refresh every ~2s
  sevNumTimer += dt;
  if (sevNumTimer > 2.1) {
    for (let i = 0; i < 12; i++) sevClusterNums[i] = Math.floor(Math.random() * 10);
    sevNumTimer = 0;
  }
  if (shouldDrawGlow()) {
    c.font = `400 ${fontSize + 2}px 'Josefin Sans', sans-serif`;
    const selX = W * 0.5 + Math.sin(tick * 0.4) * W * 0.08;
    const selY = H * 0.44 + Math.cos(tick * 0.3) * H * 0.04;
    for (let i = 0; i < 12; i++) {
      const ox = (i % 4 - 1.5) * (fontSize + 4);
      const oy = (Math.floor(i / 4) - 1) * (fontSize + 6);
      c.fillStyle = `rgba(0,180,255,${0.55 + Math.sin(tick * 1.2 + i) * 0.25})`;
      c.fillText(String(sevClusterNums[i] ?? 0), selX + ox, selY + oy);
    }
  }

  // Lumon logo-esque horizontal line
  c.globalAlpha = 0.12;
  c.fillStyle = t.accent;
  c.fillRect(W * 0.3, H * 0.62, W * 0.4, 1);
  c.globalAlpha = 1;

  // Soft centre glow
  const grd = c.createRadialGradient(W/2, H*0.45, 0, W/2, H*0.45, W*0.35);
  grd.addColorStop(0, `${t.accent}0a`);
  grd.addColorStop(1, 'transparent');
  c.fillStyle = grd; c.fillRect(0, 0, W, H);
  c.textAlign = 'left';
}

// ── SMPTE Timeline background ─────────────────────────────────────────
function drawSMPTE(t: Theme) {
  // Dark base already drawn; add track lanes
  const laneH = 22, laneY = H * 0.72;
  const trackColors = [t.accent, t.accent2, '#4488ff', '#ff8844', '#44ffaa'];

  // Track header area
  c.fillStyle = 'rgba(255,255,255,.04)';
  c.fillRect(0, laneY - 10, W, laneH * 5 + 20);

  // Lane lines
  for (let i = 0; i <= 5; i++) {
    c.fillStyle = 'rgba(255,255,255,.07)';
    c.fillRect(0, laneY + i * laneH, W, 1);
  }

  // Timecode ruler ticks at top of tracks
  const marks = 24;
  for (let m = 0; m <= marks; m++) {
    const x = (m / marks) * W;
    c.fillStyle = m % 6 === 0 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.12)';
    c.fillRect(x, laneY - 10, 1, m % 6 === 0 ? 10 : 5);
    if (m % 6 === 0) {
      const hrs = Math.floor(m / marks * 24);
      c.font = '9px monospace'; c.fillStyle = 'rgba(255,255,255,.28)';
      c.textAlign = 'center'; c.fillText(`${String(hrs).padStart(2,'0')}:00`, x, laneY - 14);
    }
  }
  c.textAlign = 'left';

  // Playhead — moves with day progress
  const now = new Date();
  const dayPct = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
  const phX = dayPct * W;
  // Playhead line
  c.fillStyle = t.accent;
  c.fillRect(phX - 1, laneY - 14, 2, laneH * 5 + 14);
  // Playhead head
  c.beginPath();
  c.moveTo(phX - 7, laneY - 14);
  c.lineTo(phX + 7, laneY - 14);
  c.lineTo(phX + 7, laneY - 6);
  c.lineTo(phX, laneY);
  c.lineTo(phX - 7, laneY - 6);
  c.closePath();
  c.fillStyle = t.accent; c.fill();

  // Focus log clips — cached, not read from localStorage every frame
  const today = new Date().toDateString();
  const clips = getSMPTEClips(today);
  c.font = '9px Inter, sans-serif';
  clips.forEach(clip => {
    const clipX = clip.startPct * W;
    const clipW = Math.max(clip.durPct * W, 6);
    c.fillStyle = (trackColors[clip.lane % trackColors.length] ?? t.accent) + 'cc';
    c.fillRect(clipX, laneY + clip.lane * laneH + 2, clipW, laneH - 4);
    if (clipW > 30 && clip.task) {
      c.fillStyle = 'rgba(0,0,0,.65)';
      c.fillText(clip.task, clipX + 4, laneY + clip.lane * laneH + 14);
    }
  });

  // Subtle glow above tracks
  if (shouldDrawGlow()) {
    const tg = c.createLinearGradient(0, laneY - 40, 0, laneY);
    tg.addColorStop(0, 'transparent');
    tg.addColorStop(1, t.accent + '12');
    c.fillStyle = tg; c.fillRect(0, laneY - 40, W, 40);
  }
}

// ── Air-Gapped Terminal background ────────────────────────────────────
const TERMINAL_LINES: string[] = [];
let termLastTick = 0;
const HEX_CHARS = '0123456789ABCDEF';
function termGenLine(): string {
  const addr = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4,'0');
  const bytes = Array.from({length: 16}, () => HEX_CHARS[Math.floor(Math.random()*16)] + HEX_CHARS[Math.floor(Math.random()*16)]).join(' ');
  const ascii = Array.from({length: 16}, () => {
    const c2 = Math.floor(Math.random() * 94) + 33;
    return String.fromCharCode(c2);
  }).join('');
  return `${addr}  ${bytes}  |${ascii}|`;
}

function drawTerminal(dt: number, t: Theme) {
  // Scroll new hex lines
  termLastTick += dt;
  if (termLastTick > 0.08) {
    termLastTick = 0;
    TERMINAL_LINES.unshift(termGenLine());
    const maxLines = Math.ceil(H / 16) + 2;
    if (TERMINAL_LINES.length > maxLines) TERMINAL_LINES.length = maxLines;
  }

  // Draw hex lines
  c.font = `${Math.max(10, Math.min(13, W / 80))}px monospace`;
  c.textAlign = 'left';
  TERMINAL_LINES.forEach((line, i) => {
    const alpha = Math.max(0, 1 - i / TERMINAL_LINES.length) * 0.35;
    c.fillStyle = `rgba(0,255,65,${alpha})`;
    c.fillText(line, 16, H * 0.88 - i * 16);
  });

  // CRT curve vignette
  const vg = c.createRadialGradient(W/2, H/2, Math.min(W,H)*0.3, W/2, H/2, Math.max(W,H)*0.75);
  vg.addColorStop(0, 'transparent');
  vg.addColorStop(1, 'rgba(0,0,0,0.72)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);

  // Scanline-style horizontal bars (supplement CSS scanlines)
  c.globalAlpha = 0.04;
  c.fillStyle = '#000';
  for (let y = 0; y < H; y += 4) { c.fillRect(0, y, W, 2); }
  c.globalAlpha = 1;
}

function drawBlueprint(t: Theme) {
  // Technical grid lines — major and minor
  const gridSm = 28, gridLg = 140;
  c.globalAlpha = 0.06;
  c.strokeStyle = t.accent;
  c.lineWidth = 0.5;
  for (let x = 0; x < W; x += gridSm) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y < H; y += gridSm) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.globalAlpha = 0.14;
  c.lineWidth = 0.9;
  for (let x = 0; x < W; x += gridLg) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y < H; y += gridLg) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.globalAlpha = 1;
  // Animated crosshair at centre
  const cx = W/2, cy = H/2, cs = 22 + Math.sin(tick*1.2)*4;
  c.globalAlpha = 0.22 + 0.08*Math.sin(tick*1.8);
  c.strokeStyle = t.accent; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(cx-cs,cy); c.lineTo(cx+cs,cy); c.stroke();
  c.beginPath(); c.moveTo(cx,cy-cs); c.lineTo(cx,cy+cs); c.stroke();
  c.beginPath(); c.arc(cx, cy, cs*0.5, 0, Math.PI*2); c.stroke();
  c.globalAlpha = 1;
  // Subtle radial glow
  const g2 = c.createRadialGradient(cx, cy, 0, cx, cy, W*0.5);
  g2.addColorStop(0, t.accent + '0c'); g2.addColorStop(1, 'transparent');
  c.fillStyle = g2; c.fillRect(0, 0, W, H);
  // Animated scan line
  const scanY = ((tick * 38) % (H + 60)) - 30;
  const sg = c.createLinearGradient(0, scanY-16, 0, scanY+16);
  sg.addColorStop(0, 'transparent'); sg.addColorStop(0.5, t.accent + '18'); sg.addColorStop(1, 'transparent');
  c.fillStyle = sg; c.fillRect(0, scanY-16, W, 32);
}

function drawCommonRoom(t: Theme) {
  // Warm ember glow from bottom — like a fireplace
  const g = c.createRadialGradient(W*0.5, H*1.05, 0, W*0.5, H*0.7, W*0.65);
  const flicker = 0.12 + 0.06*Math.sin(tick*3.1) + 0.03*Math.sin(tick*7.3);
  g.addColorStop(0, `rgba(220,80,10,${flicker})`);
  g.addColorStop(0.4, `rgba(160,45,5,${flicker*0.5})`);
  g.addColorStop(1, 'transparent');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // Secondary amber warmth at mid
  const g2 = c.createRadialGradient(W*0.5, H*0.6, 0, W*0.5, H*0.6, W*0.4);
  g2.addColorStop(0, `rgba(200,120,20,${flicker*0.4})`); g2.addColorStop(1, 'transparent');
  c.fillStyle = g2; c.fillRect(0, 0, W, H);
  // Floating ember particles
  for (let i = 0; i < poolN; i++) {
    const o = i * PSTRIDE;
    pool[o] += pool[o+2] * 0.4 + Math.sin(tick*0.8 + i)*0.3;
    pool[o+1] -= 0.6 + pool[o+4]*0.3;
    if (pool[o+1] < -8) { pool[o+1] = H + 8; pool[o] = rnd(W); }
    if (pool[o] < -8) pool[o] = W+8; if (pool[o] > W+8) pool[o] = -8;
    const alpha = pool[o+5] * 0.55 * Math.max(0, 1 - pool[o+1]/H);
    c.beginPath(); c.arc(pool[o], pool[o+1], pool[o+4]*0.7, 0, Math.PI*2);
    c.fillStyle = `rgba(255,${140 + (i%40)*2},20,${alpha})`; c.globalAlpha = alpha; c.fill();
  }
  c.globalAlpha = 1;
}

// ── Conway's Game of Life ─────────────────────────────────────────────
const GOL_CELL_BASE = 8; // px per cell at HIGH tier

function getGolCell(): number {
  const t = getTier();
  return t === 'low' ? 14 : t === 'med' ? 10 : GOL_CELL_BASE;
}

function getGolInterval(): number {
  const t = getTier();
  return t === 'low' ? 0.22 : t === 'med' ? 0.15 : 0.11;
}
let golCols = 0, golRows = 0;
let golGrid: Uint8Array = new Uint8Array(0);
let golNext: Uint8Array = new Uint8Array(0);
let golLastTick = 0;
let golAccTheme = '';

function golResize(t: Theme) {
  const cell = getGolCell();
  golCols = Math.ceil(W / cell) + 2;
  golRows = Math.ceil(H / cell) + 2;
  const size = golCols * golRows;
  golGrid = new Uint8Array(size);
  golNext = new Uint8Array(size);
  for (let i = 0; i < size; i++) golGrid[i] = Math.random() < 0.28 ? 1 : 0;
  golAccTheme = t.id;
}

function drawGameOfLife(dt: number, t: Theme) {
  const cell = getGolCell();
  if (golAccTheme !== t.id || golGrid.length !== (Math.ceil(W/cell)+2) * (Math.ceil(H/cell)+2)) {
    golResize(t);
  }
  golLastTick += dt;
  if (golLastTick > getGolInterval()) { golStep(); golLastTick = 0; }

  const acc = t.accent;
  let r = 110, g2 = 231, b = 183;
  if (acc.startsWith('#') && acc.length >= 7) {
    r = parseInt(acc.slice(1,3),16);
    g2 = parseInt(acc.slice(3,5),16);
    b = parseInt(acc.slice(5,7),16);
  }

  const cellSz = cell - 1;
  for (let row = 0; row < golRows; row++) {
    for (let col = 0; col < golCols; col++) {
      if (!golGrid[row * golCols + col]) continue;
      c.fillStyle = `rgba(${r},${g2},${b},0.55)`;
      c.fillRect(col * cell, row * cell, cellSz, cellSz);
    }
  }
  if (shouldDrawGlow()) {
    const vg = c.createRadialGradient(W/2,H/2,W*0.2,W/2,H/2,W*0.7);
    vg.addColorStop(0,'transparent'); vg.addColorStop(1,'rgba(0,0,0,0.55)');
    c.fillStyle = vg; c.fillRect(0,0,W,H);
  }
}

function golStep() {
  const { golGrid: g, golNext: n, golCols: C, golRows: R } = { golGrid, golNext, golCols, golRows };
  for (let r = 0; r < R; r++) {
    for (let col = 0; col < C; col++) {
      const i = r * C + col;
      let nb = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = (r + dr + R) % R, nc = (col + dc + C) % C;
          nb += g[nr * C + nc];
        }
      }
      const alive = g[i];
      n[i] = (alive && (nb === 2 || nb === 3)) || (!alive && nb === 3) ? 1 : 0;
    }
  }
  // Swap buffers
  const tmp = golGrid; golGrid = golNext; golNext = tmp;
}

function drawMediaBg(t: Theme) {
  // Just a subtle radial accent vignette — overlay CSS handles the rest
  const g = c.createRadialGradient(W/2, H*0.5, 0, W/2, H*0.5, W*0.55);
  g.addColorStop(0, t.accent + '0a'); g.addColorStop(1, 'transparent');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

function drawMatrix(t: Theme) {
  // Flow: rain fades trail less (faster, denser) and brightens
  const trailAlpha = Math.max(0.025, 0.06 - _flowIntensity * 0.03);
  c.fillStyle = `rgba(0,10,0,${trailAlpha})`;
  c.fillRect(0, 0, W, H);
  const cols = (W / 14) | 0;
  c.font = '13px monospace';
  const speedBoost = 1 + _flowIntensity * 1.5; // up to 2.5× faster at full flow
  for (let i = 0; i < poolN; i++) {
    const o = i * PSTRIDE;
    pool[o+1] += (3 + pool[o+4]!) * speedBoost;
    if (pool[o+1] > H + 200) pool[o+1] = 0;
    const brightness = Math.round((230 + _flowIntensity * 25)); // 230→255
    const a = pool[o+5]! * Math.min(1, tick);
    c.fillStyle = `rgba(0,${brightness},0,${a})`; c.globalAlpha = a;
    c.fillText(MAT_CHARS[(Math.random() * MAT_CHARS.length) | 0], (i % cols) * 14, pool[o+1]!);
  }
  c.globalAlpha = 1;
}

function drawF1Bg(t: Theme, teamId: string) {
  drawMediaBg(t);
  const fns: Record<string, () => void> = {
    redbull:     () => drawF1Streaks(t, 1),
    ferrari:     () => drawF1Streaks(t, 0.8),
    mercedes:    () => drawF1Streaks(t, 1),
    mclaren:     () => drawF1Streaks(t, 1.2),
    astonmartin: () => drawF1Streaks(t, 0.7),
    alpine:      () => drawF1Streaks(t, 0.9),
    rbf1:        () => drawF1Streaks(t, 1.1),
    williams:    () => drawF1Streaks(t, 0.85),
  };
  fns[teamId]?.();
  drawF1Symbol(teamId);
}

function drawF1Streaks(t: Theme, speedMult: number) {
  const p = pool;
  for (let i = 0; i < poolN; i++) {
    const o = i * PSTRIDE;
    p[o] += p[o+2] * speedMult * 1.8;
    p[o+1] += p[o+3] * 0.3;
    if (p[o] > W + 20) { p[o] = -20; p[o+1] = rnd(H); }
    const len = p[o+4] * 22;
    const gr = c.createLinearGradient(p[o]-len, 0, p[o], 0);
    gr.addColorStop(0, 'transparent'); gr.addColorStop(1, t.accent);
    c.beginPath(); c.moveTo(p[o], p[o+1]); c.lineTo(p[o]-len, p[o+1]);
    c.strokeStyle = gr; c.globalAlpha = p[o+5]*0.5; c.lineWidth = p[o+4]*0.5; c.stroke();
  }
  c.globalAlpha = 1;
}

// ── Theme symbols ─────────────────────────────────────────────────────
function drawSymbol(id: string, t: Theme) {
  const fn = SYMBOLS[id];
  if (fn) fn(t);
}

const SYMBOLS: Record<string, (t: Theme) => void> = {
  supernatural(t) {
    const cx=W*.5,cy=H*.58,R=Math.min(W,H)*.16,breath=.042+.014*Math.sin(tick*.55);
    c.save(); c.translate(cx,cy);
    const h=c.createRadialGradient(0,0,R*.7,0,0,R*1.5);
    h.addColorStop(0,`rgba(200,60,0,${breath*.22})`); h.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=h; c.beginPath(); c.arc(0,0,R*1.5,0,Math.PI*2); c.fill();
    c.strokeStyle='rgba(180,40,0,1)'; c.lineWidth=1.4; c.globalAlpha=breath*1.1;
    c.beginPath(); c.arc(0,0,R,0,Math.PI*2); c.stroke();
    const pts=[...Array(5)].map((_,i)=>{const a=(i*2/5-.5)*Math.PI*2;return[Math.cos(a)*R,Math.sin(a)*R];});
    c.beginPath(); c.globalAlpha=breath; c.strokeStyle='rgba(200,45,0,1)'; c.lineWidth=1.1;
    [0,2,4,1,3,0].forEach((pi,i)=>i===0?c.moveTo(pts[pi][0],pts[pi][1]):c.lineTo(pts[pi][0],pts[pi][1]));
    c.stroke(); c.restore();
  },
  mentalist(t) {
    const cx=W*.5,cy=H*.52,R=Math.min(W,H)*.13,breath=.07+.022*Math.sin(tick*.5);
    c.save(); c.translate(cx,cy);
    c.strokeStyle='rgba(160,8,8,1)'; c.lineWidth=2.8; c.globalAlpha=breath*1.15;
    c.beginPath();
    for(let i=0;i<=60;i++){const a=(i/60)*Math.PI*2,w=1+.032*Math.sin(i*3.7+tick*.08),px=Math.cos(a)*R*w,py=Math.sin(a)*R*w;i===0?c.moveTo(px,py):c.lineTo(px,py);}
    c.closePath(); c.stroke(); c.restore();
  },
  dark(t) {
    const cx=W*.5,cy=H*.56,R=Math.min(W,H)*.14,breath=.038+.012*Math.sin(tick*.42);
    c.save(); c.translate(cx,cy); c.rotate(tick*.014);
    c.strokeStyle='rgba(68,136,204,1)'; c.lineWidth=1.5;
    for(let i=0;i<3;i++){const a=(i/3)*Math.PI*2-Math.PI/2,ox=Math.cos(a)*R*.5,oy=Math.sin(a)*R*.5;c.globalAlpha=breath*(1.4-i*.2);c.beginPath();c.arc(ox,oy,R,a+Math.PI*.42+Math.PI/2,a-Math.PI*.42+Math.PI/2+Math.PI*2);c.stroke();}
    c.restore();
  },
  breakingbad(t) {
    const cx=W*.5,cy=H*.56,R=Math.min(W,H)*.1,breath=.05+.016*Math.sin(tick*.55);
    c.save(); c.translate(cx,cy);
    [{sym:'Br',num:'35',wt:'79.9',x:-R*1.22},{sym:'Ba',num:'56',wt:'137.3',x:R*.12}].forEach(({sym,num,wt,x})=>{
      const hi=sym==='Br'?'#7ec800':'#b8f040'; c.save(); c.translate(x,0);
      c.strokeStyle=hi; c.lineWidth=1.1; c.globalAlpha=breath;
      c.strokeRect(-R*.55,-R*.65,R*1.1,R*1.3);
      c.font=`bold ${R*.72}px 'Bebas Neue',sans-serif`; c.textAlign='center'; c.textBaseline='middle';
      c.fillStyle=hi; c.globalAlpha=breath*1.1; c.fillText(sym,0,0); c.restore();
    });
    c.restore();
  },
  strangerthings(t) {
    const cx=W*.5,cy=H*.55,R=Math.min(W,H)*.13,openAmt=.45+.45*Math.sin(tick*.38),breath=.045+.013*Math.sin(tick*.65);
    c.save(); c.translate(cx,cy);
    for(let i=0;i<5;i++){const pa=(i/5)*Math.PI*2-Math.PI/2,ext=openAmt*R*.58,pw=R*(.36+openAmt*.08);
      c.save(); c.rotate(pa); c.beginPath(); c.moveTo(0,R*.12); c.bezierCurveTo(-pw*.7,R*.18+ext*.25,-pw*.55,R*.15+ext*.8,0,R*.18+ext); c.bezierCurveTo(pw*.55,R*.15+ext*.8,pw*.7,R*.18+ext*.25,0,R*.12); c.closePath();
      c.fillStyle=`rgba(60,0,100,${breath*1.4})`; c.fill(); c.restore();}
    c.restore();
  },
  interstellar(t) {
    const cx=W*.5,cy=H*.54,R=Math.min(W,H)*.15,breath=.032+.01*Math.sin(tick*.55);
    c.save(); c.translate(cx,cy);
    for(let l=3;l>=0;l--){const lr=R*(1+l*.18);c.beginPath();c.ellipse(0,0,lr,lr*.22,tick*.038+l*.15,0,Math.PI*2);c.strokeStyle='rgba(120,190,255,1)';c.globalAlpha=breath*[.12,.085,.055,.03][l]*20;c.lineWidth=l===0?3:l===1?1.8:1;c.stroke();}
    c.beginPath();c.arc(0,0,R*.52,0,Math.PI*2);c.fillStyle='rgba(0,0,0,1)';c.globalAlpha=.97;c.fill();
    c.restore();
  },
  dune(t) {
    const cx=W*.5,cy=H*.55,R=Math.min(W,H)*.1,breath=.04+.012*Math.sin(tick*.5),sb=.4+.6*Math.abs(Math.sin(tick*.18));
    c.save(); c.translate(cx,cy);
    [-R*.5,R*.5].forEach(ex=>{c.save();c.translate(ex,0);c.beginPath();c.ellipse(0,0,R*.38,R*.24,0,0,Math.PI*2);c.fillStyle=`rgba(${(180+sb*40)|0},${(160+sb*60)|0},${(80+sb*160)|0},1)`;c.globalAlpha=breath*1.1;c.fill();c.restore();});
    c.restore();
  },
  matrix(t) {
    const cx=W*.5,cy=H*.64,R=Math.min(W,H)*.044,fl=Math.sin(tick*.5)*R*.18,breath=.06+.018*Math.sin(tick*.6);
    c.save(); c.translate(cx,cy+fl);
    c.font=`bold ${Math.max(9,R*1.1)}px monospace`; c.fillStyle='rgba(0,230,0,1)'; c.textAlign='center'; c.textBaseline='bottom'; c.globalAlpha=breath*1.2;
    c.fillText('CHOOSE',0,-R*1.6);
    [[-.28,'rgba(190,15,15,1)',-2.1],[.28,'rgba(20,75,210,1)',2.1]].forEach(([rot,col,bx])=>{c.save();c.rotate(rot as number);c.beginPath();c.ellipse(bx as number,0,R*1.1,R*.44,0,0,Math.PI*2);c.fillStyle=col as string;c.globalAlpha=breath*1.1;c.fill();c.restore();});
    c.restore();
  },
  bladerunner(t) {
    const cx=W*.5,cy=H*.38,R=Math.min(W,H)*.1,blink=(tick*.14)%Math.PI,openness=Math.max(.05,Math.abs(Math.sin(blink))),breath=.042+.012*Math.sin(tick*.5);
    c.save(); c.translate(cx,cy); c.beginPath(); c.ellipse(0,0,R*1.9,R*openness*.7+R*.03,0,0,Math.PI*2);
    c.fillStyle='rgba(30,12,0,1)'; c.globalAlpha=.85; c.fill();
    c.strokeStyle='rgba(180,120,50,1)'; c.globalAlpha=breath*.9; c.lineWidth=1; c.stroke(); c.restore();
  },
  inception(t) {
    const cx=W*.5,cy=H*.57,R=Math.min(W,H)*.1,wobble=Math.sin(tick*.11)*.07,breath=.042+.012*Math.sin(tick*.65);
    c.save(); c.translate(cx,cy); c.rotate(wobble);
    const tw=R*.52,bw=R*.18,th=R*1.3;
    const bg=c.createLinearGradient(-tw,0,tw,0); bg.addColorStop(.5,`rgba(140,140,220,${breath*1.1})`);
    c.beginPath(); c.moveTo(-tw,-th*.45); c.lineTo(tw,-th*.45); c.lineTo(bw,th*.55); c.lineTo(-bw,th*.55); c.closePath();
    c.fillStyle=bg; c.globalAlpha=.82; c.fill();
    c.strokeStyle='rgba(160,160,230,1)'; c.globalAlpha=breath; c.lineWidth=.9; c.stroke(); c.restore();
  },
  godfather(t) {
    const cx=W*.42,cy=H*.6,R=Math.min(W,H)*.1,bloom=.55+.4*Math.sin(tick*.18),breath=.032+.01*Math.sin(tick*.4);
    c.save(); c.translate(cx,cy);
    for(let i=13;i>=0;i--){const fr=i/14,a=fr*Math.PI*2*2.5+tick*.035,pr=R*(.04+fr*.62*bloom),ps=R*(.1+fr*.28),px=Math.cos(a)*pr,py=Math.sin(a)*pr*.72;c.save();c.translate(px,py);c.rotate(a+.9);c.beginPath();c.ellipse(0,0,ps*.75,ps*.52,0,0,Math.PI*2);c.fillStyle=`rgba(${(80+fr*70)|0},3,8,1)`;c.globalAlpha=breath*(.55+fr*.35);c.fill();c.restore();}
    c.restore();
  },
  sopranos(t) {
    const cx=W*.5,cy=H*.5,R=Math.min(W,H)*.18,breath=.025+.008*Math.sin(tick*.3);
    c.save(); c.translate(cx,cy);
    const g=c.createRadialGradient(0,0,0,0,0,R); g.addColorStop(0,`rgba(120,88,0,${breath})`); g.addColorStop(1,'transparent');
    c.fillStyle=g; c.beginPath(); c.arc(0,0,R,0,Math.PI*2); c.fill(); c.restore();
  },
  adventuretime(t) {
    const cx=W*.5,cy=H*.6,R=Math.min(W,H)*.15,breath=.05+.015*Math.sin(tick*.7);
    c.save(); c.translate(cx,cy);
    c.strokeStyle=t.accent; c.lineWidth=1.6; c.globalAlpha=breath*1.1;
    c.beginPath(); c.moveTo(-R,R*.4); c.lineTo(-R*.3,-R*.7); c.lineTo(R*.3,-R*.3); c.lineTo(R,R*.4); c.stroke();
    c.restore();
  },
  andor(t) {
    const cx=W*.5,cy=H*.4,R=Math.min(W,H)*.5,sweep=(Math.sin(tick*.12)*.5+.5);
    c.save();
    const g=c.createRadialGradient(cx-R+sweep*R*2,cy,0,cx-R+sweep*R*2,cy,R*.35);
    g.addColorStop(0,`${t.accent}14`); g.addColorStop(1,'transparent');
    c.fillStyle=g; c.fillRect(0,0,W,H); c.restore();
  },
  chernobyl(t) {
    const cx=W*.5,cy=H*.52,R=Math.min(W,H)*.13,breath=.045+.018*Math.sin(tick*.45);
    c.save(); c.translate(cx,cy); c.rotate(tick*.03);
    c.fillStyle=t.accent; c.globalAlpha=breath;
    for(let i=0;i<3;i++){const a=(i/3)*Math.PI*2;c.save();c.rotate(a);c.beginPath();c.moveTo(0,0);c.arc(0,0,R,-.32,.32);c.closePath();c.fill();c.restore();}
    c.restore();
  },
  cowboybebop(t) {
    const cx=W*.6,cy=H*.55,breath=.05+.015*Math.sin(tick*.4);
    c.save(); c.translate(cx,cy); c.globalAlpha=breath; c.strokeStyle=t.accent; c.lineWidth=1.4;
    for(let i=0;i<4;i++){const r=(Math.min(W,H)*.05)+i*Math.min(W,H)*.035+((tick*8)%(Math.min(W,H)*.035));c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.globalAlpha=breath*(1-i*.2);c.stroke();}
    c.restore();
  },
  drivemovie(t) {
    const y=H*.7,breath=.06+.02*Math.sin(tick*.6);
    c.save(); c.strokeStyle=t.accent; c.lineWidth=2; c.globalAlpha=breath;
    c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke();
    c.globalAlpha=breath*.6; c.strokeStyle=t.accent2 ?? t.accent;
    c.beginPath(); c.moveTo(0,y+3); c.lineTo(W,y+3); c.stroke();
    c.restore();
  },
  fargo(t) {
    const cx=W*.5,cy=H*.65,R=Math.min(W,H)*.09,breath=.05+.015*Math.sin(tick*.35);
    c.save(); c.translate(cx,cy);
    c.fillStyle=t.accent2 ?? '#c0392b'; c.globalAlpha=breath*.9;
    c.beginPath(); c.arc(0,0,R*.18,0,Math.PI*2); c.fill();
    c.restore();
  },
  ghostshell(t) {
    if (!shouldDrawGlow()) return;
    const cols = 12; c.save(); c.globalAlpha=.05+.02*Math.sin(tick*.5);
    c.strokeStyle=t.accent; c.lineWidth=1;
    for(let i=0;i<cols;i++){const x=(i/cols)*W;c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}
    c.restore();
  },
  grandbudapest(t) {
    const cx=W*.5,cy=H*.42,R=Math.min(W,H)*.28,breath=.05+.015*Math.sin(tick*.3);
    c.save(); c.translate(cx,cy); c.strokeStyle=t.accent; c.lineWidth=1.3; c.globalAlpha=breath;
    c.strokeRect(-R,-R*.6,R*2,R*1.2);
    for(let i=1;i<4;i++){c.beginPath();c.moveTo(-R+i*R*.5,-R*.6);c.lineTo(-R+i*R*.5,R*.6);c.stroke();}
    c.restore();
  },
  gravityfalls(t) {
    const cx=W*.5,cy=H*.5,R=Math.min(W,H)*.13,breath=.05+.018*Math.sin(tick*.5);
    c.save(); c.translate(cx,cy);
    c.strokeStyle=t.accent; c.lineWidth=1.5; c.globalAlpha=breath*1.1;
    c.beginPath(); c.moveTo(0,-R); c.lineTo(R*.87,R*.5); c.lineTo(-R*.87,R*.5); c.closePath(); c.stroke();
    c.beginPath(); c.arc(0,-R*.05,R*.16,0,Math.PI*2); c.globalAlpha=breath*.8; c.fillStyle=t.accent; c.fill();
    c.restore();
  },
  jjk(t) {
    const cx=W*.5,cy=H*.5,R=Math.min(W,H)*.16,breath=.05+.02*Math.sin(tick*.9);
    c.save(); c.translate(cx,cy); c.strokeStyle=t.accent; c.lineWidth=1.3;
    for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2+tick*.2,len=R*(.5+.5*Math.sin(tick*1.3+i));c.beginPath();c.moveTo(Math.cos(a)*R*.3,Math.sin(a)*R*.3);c.lineTo(Math.cos(a)*len,Math.sin(a)*len);c.globalAlpha=breath;c.stroke();}
    c.restore();
  },
  johnwick(t) {
    const cx=W*.55,cy=H*.55,R=Math.min(W,H)*.06,spin=tick*1.1,breath=.5+.5*Math.sin(tick*.8);
    c.save(); c.translate(cx,cy); c.rotate(spin); c.scale(Math.cos(spin)*.4+.6,1);
    c.fillStyle=t.accent; c.globalAlpha=.05+breath*.06;
    c.beginPath(); c.arc(0,0,R,0,Math.PI*2); c.fill(); c.restore();
  },
  madmen(t) {
    if (!shouldDrawGlow()) return;
    c.save(); c.globalAlpha=.02+Math.random()*.02;
    c.fillStyle='#ffffff';
    for(let i=0;i<80;i++){c.fillRect(Math.random()*W,Math.random()*H,1,1);}
    c.restore();
  },
  nocountry(t) {
    const cx=W*.4,cy=H*.62,R=Math.min(W,H)*.045,breath=.04+.015*Math.sin(tick*.4);
    c.save(); c.translate(cx,cy); c.strokeStyle=t.accent2 ?? t.accent; c.lineWidth=1; c.globalAlpha=breath;
    c.beginPath(); c.arc(0,0,R,0,Math.PI*2); c.stroke(); c.restore();
  },
  se7en(t) {
    const cx=W*.5,cy=H*.6,R=Math.min(W,H)*.14,breath=.045+.015*Math.sin(tick*.3);
    c.save(); c.translate(cx,cy); c.strokeStyle=t.accent; c.lineWidth=1.4; c.globalAlpha=breath;
    c.strokeRect(-R*.7,-R*.7,R*1.4,R*1.4); c.restore();
  },
  spiderverse(t) {
    if (!shouldDrawGlow()) return;
    c.save(); c.globalAlpha=.06;
    const step=14;
    for(let y=0;y<H;y+=step){for(let x=(y/step)%2===0?0:step/2;x<W;x+=step){c.fillStyle=(x+y)%(step*2)===0?t.accent:(t.accent2??t.accent);c.beginPath();c.arc(x,y,1.3,0,Math.PI*2);c.fill();}}
    c.restore();
  },
  thebatman(t) {
    const sweep=(Math.sin(tick*.15)*.5+.5),cx=W*(.2+sweep*.6),cy=H*.15;
    c.save();
    const g=c.createRadialGradient(cx,cy,0,cx,H*1.1,H*.9);
    g.addColorStop(0,`${t.accent}12`); g.addColorStop(1,'transparent');
    c.fillStyle=g; c.fillRect(0,0,W,H); c.restore();
  },
  truedetective(t) {
    const cx=W*.5,cy=H*.5,breath=.05+.015*Math.sin(tick*.35);
    c.save(); c.translate(cx,cy); c.strokeStyle=t.accent; c.lineWidth=1.2; c.globalAlpha=breath;
    c.beginPath();
    for(let a=0;a<Math.PI*6;a+=.1){const r=a*3;c.lineTo(Math.cos(a+tick*.05)*r,Math.sin(a+tick*.05)*r);}
    c.stroke(); c.restore();
  },
  twinpeaks(t) {
    const breath=.06+.02*Math.sin(tick*.3);
    c.save(); c.globalAlpha=breath; c.fillStyle=t.accent;
    for(let i=0;i<7;i++){const x=(i/7)*W,w=W/7*.55,fold=Math.sin(tick*.4+i)*6;c.beginPath();c.moveTo(x+fold,0);c.lineTo(x+w+fold,0);c.lineTo(x+w*.7+fold,H);c.lineTo(x+w*.3+fold,H);c.closePath();c.fill();}
    c.restore();
  },
  vinlandsaga(t) {
    const cx=W*.55,cy=H*.68,breath=.05+.015*Math.sin(tick*.3);
    c.save(); c.translate(cx,cy); c.strokeStyle=t.accent; c.lineWidth=1.4; c.globalAlpha=breath;
    c.beginPath(); c.moveTo(-W*.18,0); c.quadraticCurveTo(0,-H*.03,W*.18,0); c.stroke();
    c.beginPath(); c.moveTo(0,0); c.lineTo(0,-H*.1); c.stroke();
    c.restore();
  },
  whiplash(t) {
    const cx=W*.5,cy=H*.5,R=Math.min(W,H)*.16,hit=(Math.sin(tick*2.2)*.5+.5);
    c.save(); c.translate(cx,cy); c.strokeStyle=t.accent2 ?? t.accent; c.lineWidth=1.2;
    for(let i=0;i<3;i++){c.beginPath();c.arc(0,0,R*(.5+i*.25)+hit*4,0,Math.PI*2);c.globalAlpha=(.05+hit*.05)*(1-i*.25);c.stroke();}
    c.restore();
  },
  yourname(t) {
    const cx=(Math.sin(tick*.08)*.5+.5)*W,cy=H*.18+Math.cos(tick*.08)*20;
    c.save(); c.strokeStyle=t.accent; c.lineWidth=1.6; c.globalAlpha=.12;
    c.beginPath(); c.moveTo(cx-W*.16,cy-40); c.lineTo(cx,cy); c.stroke();
    c.fillStyle=t.accent; c.beginPath(); c.arc(cx,cy,2.4,0,Math.PI*2); c.fill();
    c.restore();
  },
  hannibal(t) {
    // A single antler-like fork, breathing slowly — elegant and restrained.
    const cx=W*.5,cy=H*.6,R=Math.min(W,H)*.16,breath=.05+.015*Math.sin(tick*.28);
    c.save(); c.translate(cx,cy); c.strokeStyle=t.accent2 ?? t.accent; c.lineWidth=1.2; c.globalAlpha=breath;
    [-1,1].forEach(side=>{
      c.beginPath(); c.moveTo(0,0); c.lineTo(side*R*.4,-R*.9);
      c.moveTo(side*R*.18,-R*.45); c.lineTo(side*R*.55,-R*.75);
      c.moveTo(side*R*.28,-R*.7); c.lineTo(side*R*.6,-R*.95);
      c.stroke();
    });
    c.restore();
  },
  slowhorses(t) {
    // Low London fog drifting across, muted and unglamorous.
    const breath=.05+.018*Math.sin(tick*.22);
    c.save(); c.globalAlpha=breath; c.fillStyle=t.accent;
    for(let i=0;i<3;i++){
      const y=H*(.55+i*.12), x=((tick*6+i*80)%(W+200))-100;
      c.beginPath(); c.ellipse(x,y,W*.22,H*.03,0,0,Math.PI*2); c.fill();
    }
    c.restore();
  },
  theboys(t) {
    // A cracked star-badge flash — satirical, blunt.
    const cx=W*.72,cy=H*.28,R=Math.min(W,H)*.07,hit=(Math.sin(tick*1.6)*.5+.5);
    c.save(); c.translate(cx,cy); c.rotate(tick*.05); c.strokeStyle=t.accent; c.lineWidth=1.4; c.globalAlpha=.06+hit*.06;
    c.beginPath();
    for(let i=0;i<5;i++){const a=(i/5)*Math.PI*2-Math.PI/2;const x=Math.cos(a)*R,y=Math.sin(a)*R;i===0?c.moveTo(x,y):c.lineTo(x,y);}
    c.closePath(); c.stroke();
    c.restore();
  },
  tedlasso(t) {
    // A simple soccer ball outline, warm and unhurried.
    const cx=W*.28,cy=H*.68,R=Math.min(W,H)*.06,breath=.06+.02*Math.sin(tick*.4);
    c.save(); c.translate(cx,cy); c.strokeStyle=t.accent2 ?? t.accent; c.lineWidth=1.2; c.globalAlpha=breath;
    c.beginPath(); c.arc(0,0,R,0,Math.PI*2); c.stroke();
    for(let i=0;i<5;i++){const a=(i/5)*Math.PI*2;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*R*.6,Math.sin(a)*R*.6);c.stroke();}
    c.restore();
  },
  forallmankind(t) {
    // A satellite tracing a slow, quiet orbit.
    const cx=W*.5,cy=H*.42,R=Math.min(W,H)*.22,a=tick*.12;
    c.save(); c.strokeStyle=t.accent; c.lineWidth=.9; c.globalAlpha=.08;
    c.beginPath(); c.ellipse(cx,cy,R,R*.32,0,0,Math.PI*2); c.stroke();
    const px=cx+Math.cos(a)*R,py=cy+Math.sin(a)*R*.32;
    c.fillStyle=t.accent2 ?? t.accent; c.globalAlpha=.5; c.beginPath(); c.arc(px,py,1.8,0,Math.PI*2); c.fill();
    c.restore();
  },
  lanterns(t) {
    // A power-ring lantern symbol — a faceted glowing icon pulsing like an
    // oath being recharged, plus a slow drift of faint construct sparks.
    const cx=W*.5,cy=H*.4,R=Math.min(W,H)*.09,pulse=.55+.25*Math.sin(tick*.9);
    c.save(); c.translate(cx,cy);
    c.shadowColor=t.accent; c.shadowBlur=14*pulse;
    c.strokeStyle=t.accent; c.lineWidth=1.6; c.globalAlpha=.16+pulse*.12;
    c.beginPath();
    for(let i=0;i<7;i++){const a=(i/7)*Math.PI*2-Math.PI/2;const x=Math.cos(a)*R,y=Math.sin(a)*R;i===0?c.moveTo(x,y):c.lineTo(x,y);}
    c.closePath(); c.stroke();
    c.shadowBlur=0;
    c.restore();
    c.save(); c.fillStyle=t.accent; c.globalAlpha=.1;
    for(let i=0;i<3;i++){
      const a=tick*.25+i*2.1, d=R*2.4+i*10;
      const sx=cx+Math.cos(a)*d, sy=cy+Math.sin(a)*d*.6;
      c.beginPath(); c.arc(sx,sy,1.4,0,Math.PI*2); c.fill();
    }
    c.restore();
  },
  you(t) {
    // A single unblinking watching eye — small, off-centre, unsettling by
    // restraint rather than spectacle, with a slow drifting gaze.
    const cx=W*.68,cy=H*.3,rw=Math.min(W,H)*.05,blink=Math.max(0,Math.sin(tick*.18));
    const lookX=Math.sin(tick*.07)*rw*.3, lookY=Math.cos(tick*.05)*rw*.15;
    c.save(); c.translate(cx,cy); c.globalAlpha=.09+blink*.04;
    c.strokeStyle=t.accent; c.lineWidth=1;
    c.beginPath(); c.ellipse(0,0,rw,rw*.55,0,0,Math.PI*2); c.stroke();
    c.fillStyle=t.accent2 ?? t.accent; c.globalAlpha=.14;
    c.beginPath(); c.arc(lookX,lookY,rw*.32,0,Math.PI*2); c.fill();
    c.restore();
  },
};

// ── F1 animated symbol overlays ───────────────────────────────────────
function drawF1Symbol(teamId: string) {
  const fns: Record<string, () => void> = {
    redbull() {
      const cx=W*.5,cy=H*.52,R=Math.min(W,H)*.12,breath=.04+.012*Math.sin(tick*.6);
      c.save(); c.translate(cx,cy); c.strokeStyle='rgba(232,0,45,1)'; c.lineWidth=1.5; c.globalAlpha=breath*1.1;
      c.strokeRect(-R*.35,-R*.425,R*.7,R*.85);
      c.font=`bold ${R*.88}px 'Orbitron',monospace`; c.textAlign='center'; c.textBaseline='middle';
      c.fillStyle='rgba(232,0,45,1)'; c.globalAlpha=breath; c.fillText('1',0,0); c.restore();
    },
    ferrari() {
      const cx=W*.5,cy=H*.54,R=Math.min(W,H)*.13,breath=.042+.012*Math.sin(tick*.5);
      c.save(); c.translate(cx,cy);
      const msg='FORZA FERRARI'; c.font=`${Math.max(6,R*.16)}px 'Cinzel',serif`; c.fillStyle='rgba(255,237,0,1)'; c.textAlign='center'; c.textBaseline='middle';
      for(let i=0;i<msg.length;i++){const a=-Math.PI/2-.5+(i/msg.length)*Math.PI;c.save();c.translate(Math.cos(a)*R*1.35,Math.sin(a)*R*1.35);c.rotate(a+Math.PI/2);c.globalAlpha=breath*1.1;c.fillText(msg[i],0,0);c.restore();}
      c.restore();
    },
    mercedes() {
      const cx=W*.5,cy=H*.53,R=Math.min(W,H)*.13,breath=.038+.01*Math.sin(tick*.5);
      c.save(); c.translate(cx,cy); c.save(); c.rotate(tick*.02);
      c.strokeStyle='rgba(0,210,190,1)'; c.lineWidth=1.4; c.globalAlpha=breath*1.1;
      c.beginPath(); c.arc(0,0,R*.85,0,Math.PI*2); c.stroke();
      for(let i=0;i<3;i++){const a=(i/3)*Math.PI*2-Math.PI/2;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*R*.85,Math.sin(a)*R*.85);c.stroke();}
      c.restore(); c.restore();
    },
    mclaren() {
      const cx=W*.5,cy=H*.53,R=Math.min(W,H)*.13,breath=.042+.012*Math.sin(tick*.55);
      c.save(); c.translate(cx,cy); c.globalAlpha=breath*.9; c.strokeStyle='rgba(255,128,0,1)'; c.lineWidth=2;
      c.beginPath(); c.moveTo(-R*.9,R*.25); c.bezierCurveTo(-R*.6,-R*.35,0,-R*.7,R*.9,R*.25); c.stroke();
      c.restore();
    },
    astonmartin() {
      const cx=W*.5,cy=H*.53,R=Math.min(W,H)*.13,breath=.038+.01*Math.sin(tick*.5);
      c.save(); c.translate(cx,cy); c.strokeStyle='rgba(206,220,0,1)'; c.lineWidth=1.1;
      for(let i=0;i<5;i++){const y=-R*.12+i*R*.06;[[- R*.9+i*R*.05,-R*.22],[R*.9-i*R*.05,R*.22]].forEach(([x1,x2])=>{c.beginPath();c.moveTo(x1,y);c.quadraticCurveTo((x1+x2)/2,-R*.3,x2,-R*.05);c.globalAlpha=breath*(.9-i*.08);c.stroke();});}
      c.restore();
    },
    alpine() {
      const cx=W*.5,cy=H*.53,R=Math.min(W,H)*.13,breath=.04+.012*Math.sin(tick*.55);
      c.save(); c.translate(cx,cy); c.strokeStyle='rgba(255,45,138,1)'; c.lineWidth=1.6; c.globalAlpha=breath*1.1;
      c.beginPath(); c.moveTo(-R*.8,R*.1); c.lineTo(0,-R*.6); c.lineTo(R*.8,R*.1); c.stroke();
      c.restore();
    },
    rbf1() {
      const cx=W*.5,cy=H*.53,R=Math.min(W,H)*.12,breath=.04+.012*Math.sin(tick*.5);
      c.save(); c.translate(cx,cy); c.strokeStyle='rgba(232,16,42,1)'; c.lineWidth=1.4; c.globalAlpha=breath;
      c.strokeRect(-R*.55,-R*.4,R*1.1,R*.8);
      c.restore();
    },
    williams() {
      const cx=W*.5,cy=H*.53,R=Math.min(W,H)*.12,breath=.04+.012*Math.sin(tick*.6);
      c.save(); c.translate(cx,cy); c.strokeStyle='rgba(0,160,224,1)'; c.lineWidth=1.4; c.globalAlpha=breath*1.05;
      c.beginPath(); c.arc(0,0,R*.75,0,Math.PI*2); c.stroke();
      c.restore();
    },
  };
  fns[teamId]?.();
}

// ── Box Breathing Overlay ─────────────────────────────────────────────
function drawBreathing() {
  const now   = performance.now() / 1000;
  const elapsed = now - breathingStart;
  const phase = Math.floor(elapsed / BREATH_PHASE_SEC) % 4;
  // 0=inhale 1=hold 2=exhale 3=hold
  const phaseT = (elapsed % BREATH_PHASE_SEC) / BREATH_PHASE_SEC; // 0..1 within phase

  // Scale factor: inhale→expand, hold→full, exhale→contract, hold→contracted
  let scale: number;
  if      (phase === 0) scale = easeIO(phaseT);          // 0→1
  else if (phase === 1) scale = 1;                        // hold full
  else if (phase === 2) scale = 1 - easeIO(phaseT);       // 1→0
  else                  scale = 0;                        // hold contracted

  const cx = W * 0.5, cy = H * 0.5;
  const minR = Math.min(W, H) * 0.08;
  const maxR = Math.min(W, H) * 0.22;
  const r    = minR + (maxR - minR) * scale;

  // Dark backdrop that dims the rest of the UI during breathing
  c.fillStyle = `rgba(0,0,0,${0.55 + scale * 0.1})`;
  c.fillRect(0, 0, W, H);

  // Outer glow rings — 3 rings that fade out
  for (let i = 2; i >= 0; i--) {
    const ringR = r + i * 18 * (1 - scale * 0.3);
    const ringA = (0.12 - i * 0.035) * scale;
    c.beginPath(); c.arc(cx, cy, ringR, 0, Math.PI * 2);
    c.strokeStyle = `rgba(120,200,255,${ringA})`; c.lineWidth = 1.5; c.stroke();
  }

  // Main breathing circle
  const grad = c.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0,   `rgba(180,230,255,${0.22 + scale * 0.08})`);
  grad.addColorStop(0.7, `rgba(80,160,220,${0.12 + scale * 0.06})`);
  grad.addColorStop(1,   `rgba(40,100,180,0)`);
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fillStyle = grad; c.fill();

  // Phase label
  const labels = ['Inhale', 'Hold', 'Exhale', 'Hold'];
  const countDown = Math.ceil(BREATH_PHASE_SEC - (elapsed % BREATH_PHASE_SEC));
  c.save();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = `rgba(200,235,255,${0.7 + scale * 0.2})`;
  c.font = `300 ${Math.round(Math.min(W, H) * 0.028)}px Inter, sans-serif`;
  c.fillText(labels[phase], cx, cy);
  c.font = `200 ${Math.round(Math.min(W, H) * 0.018)}px Inter, sans-serif`;
  c.fillStyle = `rgba(160,210,255,0.5)`;
  c.fillText(String(countDown), cx, cy + Math.min(W, H) * 0.036);
  c.restore();
}

// ── Mr. Robot — green terminal glitch ─────────────────────────────────
const mrGlitchLines: Array<{y:number; w:number; h:number; life:number; col:string}> = [];
let mrGlitchTimer = 0;

function drawMrRobot(dt: number, t: Theme) {
  // Scanline base
  c.fillStyle = 'rgba(0,180,60,.015)';
  for (let y = 0; y < H; y += 2) c.fillRect(0, y, W, 1);

  // Glitch artifacts
  mrGlitchTimer += dt;
  if (mrGlitchTimer > 0.08 + rnd(0.35)) {
    mrGlitchTimer = 0;
    if (mrGlitchLines.length < 6) {
      mrGlitchLines.push({
        y: rnd(H), w: 40 + rnd(W * 0.5),
        h: 2 + rnd(6),
        life: 0.08 + rnd(0.2),
        col: Math.random() > 0.7 ? '#00ff66' : Math.random() > 0.5 ? '#ffffff' : '#ff0066',
      });
    }
  }
  for (let i = mrGlitchLines.length - 1; i >= 0; i--) {
    const g = mrGlitchLines[i]!;
    g.life -= dt;
    if (g.life <= 0) { mrGlitchLines.splice(i, 1); continue; }
    c.fillStyle = g.col + '44';
    c.fillRect(rnd(W * 0.3), g.y, g.w, g.h);
  }

  // Vignette pulse
  if (shouldDrawGlow()) {
    const vg = c.createRadialGradient(W/2, H/2, W*0.08, W/2, H/2, W*0.65);
    vg.addColorStop(0, 'transparent');
    vg.addColorStop(1, `rgba(0,${Math.floor(6 + Math.sin(tick*0.8)*3)},0,.88)`);
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }
}

// ── Oppenheimer — sepia atomic flash ──────────────────────────────────
let opFlashAlpha = 0;
let opFlashTimer = 0;

function drawOppenheimer(dt: number, t: Theme) {
  opFlashTimer += dt;
  // Hourly flash (or every 5 min for demo — check seconds == 0 of each 5-min mark)
  const now = new Date();
  if (now.getSeconds() === 0 && now.getMinutes() % 5 === 0 && opFlashTimer > 10) {
    opFlashAlpha = 1; opFlashTimer = 0;
  }
  if (opFlashAlpha > 0) {
    c.fillStyle = `rgba(255,220,150,${opFlashAlpha * 0.85})`;
    c.fillRect(0, 0, W, H);
    opFlashAlpha = Math.max(0, opFlashAlpha - dt * 1.8);
  }

  // Atomic wire-sphere
  if (shouldDrawGlow()) {
    const cx = W * 0.5, cy = H * 0.45;
    const r = Math.min(W, H) * 0.22;
    const phase = tick * 0.3;
    c.strokeStyle = t.accent + '30'; c.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + phase;
      const rx = Math.cos(a) * r, ry = Math.sin(a) * r * 0.38;
      c.beginPath(); c.ellipse(cx, cy, Math.abs(rx), Math.abs(ry) + 4, 0, 0, Math.PI*2); c.stroke();
    }
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI*2);
    c.strokeStyle = t.accent + '18'; c.lineWidth = 1.5; c.stroke();
    // Core glow
    const cg = c.createRadialGradient(cx, cy, 0, cx, cy, r * 0.4);
    cg.addColorStop(0, t.accent + '22'); cg.addColorStop(1, 'transparent');
    c.fillStyle = cg; c.fillRect(0, 0, W, H);
  }
}

// ── The Bear — kitchen aesthetic ──────────────────────────────────────
function drawTheBear(dt: number, t: Theme) {
  // Subtle warm vignette from top (kitchen light)
  if (shouldDrawGlow()) {
    const tg = c.createLinearGradient(0, 0, 0, H * 0.5);
    tg.addColorStop(0, 'rgba(255,200,80,.04)'); tg.addColorStop(1, 'transparent');
    c.fillStyle = tg; c.fillRect(0, 0, W, H);
  }
  // Ticket print lines — subtle horizontal rules
  c.strokeStyle = 'rgba(255,255,255,.03)';
  c.lineWidth = 1;
  for (let y = H * 0.6; y < H * 0.9; y += 18) {
    c.beginPath(); c.moveTo(W * 0.05, y); c.lineTo(W * 0.95, y); c.stroke();
  }
}

// ── 8-bit — CGA pixel grid ────────────────────────────────────────────
const CGA = ['#000000','#0000aa','#00aa00','#00aaaa','#aa0000','#aa00aa','#aa5500','#aaaaaa','#555555','#5555ff','#55ff55','#55ffff','#ff5555','#ff55ff','#ffff55','#ffffff'];
let bitGlitchTimer = 0;

function draw8Bit(dt: number, t: Theme) {
  // CGA pixel grid overlay
  if (getTier() === 'low') return;
  bitGlitchTimer += dt;
  if (bitGlitchTimer > 0.5) {
    bitGlitchTimer = 0;
    // Scatter a few CGA-coloured pixels
    const num = 30;
    for (let i = 0; i < num; i++) {
      const x = Math.floor(rnd(W / 8)) * 8;
      const y = Math.floor(rnd(H / 8)) * 8;
      c.fillStyle = CGA[Math.floor(rnd(CGA.length))]!;
      c.fillRect(x, y, 8, 8);
    }
  }
  // "INSERT COIN" blink
  if (Math.floor(tick * 1.5) % 2 === 0) {
    c.font = `bold clamp(10px,1.6vw,18px) 'Press Start 2P',monospace`;
    c.fillStyle = '#ffffff';
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.fillText('INSERT COIN', W / 2, H * 0.88);
    c.textAlign = 'left';
  }
}

// ── Phoenix — rising fire ─────────────────────────────────────────────
interface Ember { x:number; y:number; vx:number; vy:number; size:number; alpha:number; col:string; }
const embers: Ember[] = [];
let emberTimer = 0;

function drawPhoenix(dt: number, t: Theme) {
  emberTimer += dt;
  // Spawn embers from base
  if (emberTimer > 0.04) {
    emberTimer = 0;
    for (let i = 0; i < 3; i++) {
      embers.push({
        x: W * 0.3 + rnd(W * 0.4),
        y: H * 0.75 + rnd(H * 0.15),
        vx: rndpm(1.2), vy: -(1.5 + rnd(3.5)),
        size: 1.5 + rnd(4), alpha: 0.8 + rnd(0.2),
        col: Math.random() > 0.4 ? '#ff6600' : Math.random() > 0.5 ? '#ffcc00' : '#ff2200',
      });
    }
  }
  // Draw and age embers
  for (let i = embers.length - 1; i >= 0; i--) {
    const e = embers[i]!;
    e.x += e.vx; e.y += e.vy; e.vy -= 0.04;
    e.alpha -= 0.008;
    if (e.alpha <= 0 || e.y < -20) { embers.splice(i, 1); continue; }
    c.beginPath(); c.arc(e.x, e.y, e.size, 0, Math.PI*2);
    c.fillStyle = e.col + Math.round(e.alpha * 255).toString(16).padStart(2,'0');
    c.fill();
  }
  if (embers.length > 400) embers.splice(0, embers.length - 400);

  // Rising glow
  const rg = c.createLinearGradient(0, H, 0, H * 0.3);
  rg.addColorStop(0, `rgba(255,80,0,${0.12 + Math.sin(tick * 0.8) * 0.04})`);
  rg.addColorStop(1, 'transparent');
  c.fillStyle = rg; c.fillRect(0, 0, W, H);
}

// ── Interstellar — wormhole ring ──────────────────────────────────────
let wormholeAngle = 0;

function drawInterstellar(dt: number, t: Theme) {
  drawMediaBg(t);
  wormholeAngle += dt * 0.15;

  if (!shouldDrawGlow()) return;
  const cx = W * 0.5, cy = H * 0.42;
  const baseR = Math.min(W, H) * 0.18;

  // Accretion disk rings
  for (let i = 0; i < 5; i++) {
    const r = baseR * (1 + i * 0.22);
    const opacity = (0.22 - i * 0.04) * (0.8 + Math.sin(tick * 0.5 + i) * 0.2);
    c.beginPath(); c.ellipse(cx, cy, r, r * 0.28, wormholeAngle + i * 0.15, 0, Math.PI*2);
    c.strokeStyle = `rgba(68,153,238,${opacity})`; c.lineWidth = 2 - i * 0.3;
    c.stroke();
  }
  // Core glow
  const cg = c.createRadialGradient(cx, cy, 0, cx, cy, baseR);
  cg.addColorStop(0, 'rgba(200,230,255,.12)'); cg.addColorStop(0.4, 'rgba(68,153,238,.06)'); cg.addColorStop(1, 'transparent');
  c.fillStyle = cg; c.fillRect(0, 0, W, H);
}

// ── CYBERPUNK 2077 ─────────────────────────────────────────────────────
// Rain streaks + neon city skyline silhouette + HUD grid
interface CyberRainDrop { x: number; y: number; len: number; speed: number; alpha: number; col: string; }
const cyberRain: CyberRainDrop[] = [];
const CYBER_COLS = ['#ff0090','#00eeff','#ff0090','#ffffff','#00eeff'];
let cyberRainInit = false;

function initCyberRain() {
  if (cyberRainInit) return; cyberRainInit = true;
  for (let i = 0; i < 120; i++) {
    cyberRain.push({
      x: rnd(W), y: rnd(H), len: 40 + rnd(120), speed: 4 + rnd(12),
      alpha: 0.15 + rnd(0.45),
      col: CYBER_COLS[Math.floor(rnd(CYBER_COLS.length))]!,
    });
  }
}

function drawCyberpunk(dt: number, t: Theme) {
  if (W === 0) return;
  if (!cyberRainInit || cyberRain[0]?.y === undefined) { cyberRainInit = false; initCyberRain(); }

  // Rain
  if (shouldRenderFull()) {
    cyberRain.forEach(d => {
      d.y += d.speed;
      if (d.y - d.len > H) { d.y = -d.len; d.x = rnd(W); }
      const g = c.createLinearGradient(d.x, d.y - d.len, d.x, d.y);
      g.addColorStop(0, 'transparent');
      g.addColorStop(1, d.col + Math.round(d.alpha * 255).toString(16).padStart(2,'0'));
      c.strokeStyle = g; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(d.x, d.y - d.len); c.lineTo(d.x, d.y); c.stroke();
    });
  }

  // City skyline silhouette
  const skyH = H * 0.72;
  c.fillStyle = 'rgba(0,0,0,.85)';
  c.beginPath(); c.moveTo(0, H);
  const bldW = W / 18;
  for (let i = 0; i <= 18; i++) {
    const bx = i * bldW;
    const bh = skyH - (H * 0.1 + Math.sin(i * 1.7 + 2) * H * 0.08 + Math.cos(i * 3.1) * H * 0.06);
    if (i === 0) { c.lineTo(bx, bh); } else {
      c.lineTo(bx - bldW * 0.05, bh);
      c.lineTo(bx - bldW * 0.05, bh - rnd(H * 0.04));
      c.lineTo(bx + bldW * 0.95, bh - rnd(H * 0.04));
      c.lineTo(bx + bldW * 0.95, bh);
    }
  }
  c.lineTo(W, H); c.closePath(); c.fill();

  // Neon window lights on buildings — intensity scales with flow
  if (shouldDrawGlow()) {
    const t60 = Math.floor(tick * 0.5);
    // Flow intensity: more windows lit up, brighter, more flicker
    const flowLights = Math.round(28 + _flowIntensity * 40); // 28→68 lights
    const flowBrightness = (0x88 + Math.round(_flowIntensity * 0x55)).toString(16).padStart(2,'0');
    for (let i = 0; i < flowLights; i++) {
      const wx = ((i * 137 + t60 * 31) % W);
      const wy = H * 0.73 + ((i * 73 + t60 * 17) % (H * 0.22));
      const colIdx = (i + t60) % CYBER_COLS.length;
      c.fillStyle = (CYBER_COLS[colIdx] ?? '#ff0090') + flowBrightness;
      c.fillRect(wx, wy, 3 + (i % 5), 2 + (i % 3));
    }

    // HUD grid — becomes more visible at high flow
    const gridAlpha = 0.04 + _flowIntensity * 0.06 + Math.sin(tick * 0.4) * 0.01;
    c.strokeStyle = `rgba(0,238,255,${gridAlpha})`;
    c.lineWidth = 0.5;
    const gridSz = Math.floor(H / 14);
    for (let y = 0; y < H; y += gridSz) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }
    for (let x = 0; x < W; x += gridSz * 1.6) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
    }

    // RGB aberration — more frequent at high flow intensity
    const aberChance = 0.04 + _flowIntensity * 0.12;
    if (Math.random() < aberChance) {
      const ay = rnd(H * 0.6);
      const ab = 0.06 + _flowIntensity * 0.1;
      c.fillStyle = `rgba(255,0,144,${ab})`; c.fillRect(2, ay, W, 2);
      c.fillStyle = `rgba(0,238,255,${ab})`; c.fillRect(-2, ay + 1, W, 2);
    }

    // At high flow: neon bloom across entire skyline
    if (_flowIntensity > 0.6) {
      const bloom = c.createLinearGradient(0, H * 0.65, 0, H);
      bloom.addColorStop(0, `rgba(255,0,144,${(_flowIntensity - 0.6) * 0.15})`);
      bloom.addColorStop(1, 'transparent');
      c.fillStyle = bloom; c.fillRect(0, 0, W, H);
    }
  }
}

// ── 2001: A SPACE ODYSSEY ─────────────────────────────────────────────
// Starfield stored in Float32Array: [x, y, r, twinkle] × 280
const STAR_COUNT = 280;
const starPool = new Float32Array(STAR_COUNT * 4);
let stars2001Init = false;

function drawHAL9000(dt: number, t: Theme) {
  if (!stars2001Init) {
    stars2001Init = true;
    for (let i = 0; i < STAR_COUNT; i++) {
      const o = i * 4;
      starPool[o]   = rnd(W); starPool[o+1] = rnd(H);
      starPool[o+2] = rnd(1.5) + 0.2; starPool[o+3] = rnd(Math.PI * 2);
    }
  }

  // Starfield
  c.fillStyle = '#ffffff';
  for (let i = 0; i < STAR_COUNT; i++) {
    const o = i * 4;
    starPool[o+3] += dt * (0.4 + starPool[o+2] * 0.3);
    const a = 0.5 + Math.sin(starPool[o+3]) * 0.4;
    c.globalAlpha = a;
    c.beginPath(); c.arc(starPool[o]!, starPool[o+1]!, starPool[o+2]!, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;

  // HAL 9000 eye — pulsing red circle at centre
  if (shouldDrawGlow()) {
    const cx = W * 0.5, cy = H * 0.42;
    const baseR = Math.min(W, H) * 0.09;
    const pulse = 0.85 + Math.sin(tick * 1.2) * 0.15;

    // Outer glow rings
    for (let i = 3; i > 0; i--) {
      const rg = c.createRadialGradient(cx, cy, 0, cx, cy, baseR * pulse * (1 + i * 0.5));
      rg.addColorStop(0, `rgba(200,0,0,${0.08 / i})`);
      rg.addColorStop(1, 'transparent');
      c.fillStyle = rg; c.fillRect(0, 0, W, H);
    }
    // Iris layers
    const iris = c.createRadialGradient(cx, cy, 0, cx, cy, baseR * pulse);
    iris.addColorStop(0, '#ff0000');
    iris.addColorStop(0.3, '#cc0000');
    iris.addColorStop(0.7, '#880000');
    iris.addColorStop(1, '#330000');
    c.fillStyle = iris;
    c.beginPath(); c.arc(cx, cy, baseR * pulse, 0, Math.PI * 2); c.fill();

    // Lens reflections
    c.fillStyle = 'rgba(255,180,180,.12)';
    c.beginPath(); c.arc(cx - baseR * 0.22, cy - baseR * 0.22, baseR * 0.18, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,180,180,.06)';
    c.beginPath(); c.arc(cx + baseR * 0.3, cy + baseR * 0.3, baseR * 0.1, 0, Math.PI * 2); c.fill();

    // Monolith silhouette at bottom
    const mw = Math.min(W * 0.04, 40), mh = mw * 2.35;
    const mx = W * 0.5 - mw / 2, my = H * 0.74;
    c.fillStyle = 'rgba(0,0,0,.95)';
    c.fillRect(mx, my, mw, mh);
    // Thin gold edge on monolith
    c.strokeStyle = 'rgba(255,220,100,.1)'; c.lineWidth = 0.5;
    c.strokeRect(mx, my, mw, mh);
  }
}

// ── TENET ─────────────────────────────────────────────────────────────
// Time-reversed particles + entropy visual + palindrome clock
interface TenetParticle { x: number; y: number; vx: number; vy: number; alpha: number; r: number; reversed: boolean; }
const tenetParticles: TenetParticle[] = [];
let tenetInit = false;

function drawTenet(dt: number, t: Theme) {
  if (!tenetInit) {
    tenetInit = true;
    for (let i = 0; i < 80; i++) {
      const reversed = i < 40;
      tenetParticles.push({
        x: rnd(W), y: rnd(H),
        vx: (reversed ? -1 : 1) * (0.3 + rnd(1.2)),
        vy: (Math.random() - 0.5) * 0.8,
        alpha: 0.3 + rnd(0.5),
        r: 1 + rnd(2.5),
        reversed,
      });
    }
  }

  if (!shouldRenderFull()) return;

  tenetParticles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    // Wrap
    if (p.x < -5) p.x = W + 5;
    if (p.x > W + 5) p.x = -5;
    if (p.y < -5) p.y = H + 5;
    if (p.y > H + 5) p.y = -5;
    // Forward = blue trail, reversed = orange trail
    const col = p.reversed ? '#ff8800' : '#8888ff';
    c.globalAlpha = p.alpha * 0.6;
    c.fillStyle = col;
    c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
    // Short trail
    c.globalAlpha = p.alpha * 0.2;
    c.strokeStyle = col; c.lineWidth = p.r * 0.8;
    c.beginPath();
    c.moveTo(p.x - p.vx * 8, p.y - p.vy * 8);
    c.lineTo(p.x, p.y);
    c.stroke();
  });
  c.globalAlpha = 1;

  // Dividing entropy line — blurred horizontal centre line
  if (shouldDrawGlow()) {
    const ey = H * 0.5 + Math.sin(tick * 0.15) * H * 0.06;
    const lg = c.createLinearGradient(0, ey - 1, 0, ey + 1);
    lg.addColorStop(0, 'rgba(140,140,255,.0)');
    lg.addColorStop(0.5, `rgba(140,140,255,${0.15 + Math.sin(tick * 0.4) * 0.05})`);
    lg.addColorStop(1, 'rgba(140,140,255,.0)');
    c.fillStyle = lg; c.fillRect(0, ey - 20, W, 40);

    // TENET palindrome watermark
    c.font = `bold clamp(8px,1.2vw,14px) 'Josefin Sans',sans-serif`;
    c.fillStyle = `rgba(200,200,255,${0.04 + Math.sin(tick * 0.3) * 0.02})`;
    c.textAlign = 'center';
    c.fillText('TENET', W / 2, H * 0.5 + 5);
    c.textAlign = 'left';
  }
}

// ── HOUSE OF THE DRAGON / GOT ─────────────────────────────────────────
// Dragon fire particles + Targaryen sigil embers + smoke
interface DragonFlame { x: number; y: number; vx: number; vy: number; size: number; alpha: number; col: string; }
const dragonFlames: DragonFlame[] = [];
const dragonSmoke: DragonFlame[] = [];
let dragonTimer = 0;

const FLAME_COLS = ['#ff2200','#ff6600','#ff9900','#ffcc00','#ff4400'];

function drawDragonFire(dt: number, t: Theme) {
  dragonTimer += dt;

  // Spawn flames from upper area (dragon breathing from above)
  if (dragonTimer > 0.025) {
    dragonTimer = 0;
    const spread = W * 0.55;
    for (let i = 0; i < 4; i++) {
      const fx = W * 0.225 + rnd(spread);
      dragonFlames.push({
        x: fx, y: H * 0.05 + rnd(H * 0.08),
        vx: (Math.random() - 0.5) * 2.5,
        vy: 1.2 + rnd(3.5),
        size: 3 + rnd(10), alpha: 0.6 + rnd(0.4),
        col: FLAME_COLS[Math.floor(rnd(FLAME_COLS.length))]!,
      });
    }
    // Smoke from dying flames
    if (dragonSmoke.length < 60) {
      dragonSmoke.push({
        x: W * 0.3 + rnd(W * 0.4), y: H * 0.4 + rnd(H * 0.15),
        vx: (Math.random() - 0.5) * 0.8, vy: -(0.4 + rnd(0.8)),
        size: 8 + rnd(25), alpha: 0.08 + rnd(0.08),
        col: '#888888',
      });
    }
  }

  // Draw smoke first (behind flames)
  for (let i = dragonSmoke.length - 1; i >= 0; i--) {
    const s = dragonSmoke[i]!;
    s.x += s.vx; s.y += s.vy; s.size += 0.4; s.alpha -= 0.001;
    if (s.alpha <= 0) { dragonSmoke.splice(i, 1); continue; }
    c.beginPath(); c.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    c.fillStyle = `rgba(80,80,80,${s.alpha})`; c.fill();
  }

  // Draw flames
  for (let i = dragonFlames.length - 1; i >= 0; i--) {
    const f = dragonFlames[i]!;
    f.x += f.vx; f.y += f.vy;
    f.vy += 0.06; // gravity pull
    f.size *= 0.97; f.alpha -= 0.018;
    if (f.alpha <= 0 || f.size < 0.5 || f.y > H * 0.88) { dragonFlames.splice(i, 1); continue; }
    const hex = Math.round(f.alpha * 255).toString(16).padStart(2, '0');
    c.beginPath(); c.arc(f.x, f.y, f.size, 0, Math.PI * 2);
    c.fillStyle = f.col + hex; c.fill();
  }
  if (dragonFlames.length > 350) dragonFlames.splice(0, dragonFlames.length - 350);

  // Targaryen three-headed dragon silhouette — drawn in embers glow
  if (shouldDrawGlow()) {
    const cx = W * 0.5, cy = H * 0.72;
    const scale = Math.min(W, H) * 0.12;
    const pulse = 0.4 + Math.sin(tick * 0.5) * 0.08;
    c.fillStyle = `rgba(255,100,0,${pulse * 0.12})`;
    // Simple dragon head silhouette: three arcs suggesting three heads
    [-0.38, 0, 0.38].forEach((offset, i) => {
      const hx = cx + offset * scale * 1.8;
      const hy = cy - scale * (i === 1 ? 0.5 : 0.2);
      c.beginPath(); c.arc(hx, hy, scale * 0.3, 0, Math.PI * 2); c.fill();
      // Neck
      c.beginPath();
      c.moveTo(cx, cy);
      c.quadraticCurveTo(cx + offset * scale, cy - scale * 0.3, hx, hy + scale * 0.2);
      c.lineWidth = scale * 0.08; c.strokeStyle = `rgba(255,80,0,${pulse * 0.15})`; c.stroke();
    });
  }
}

// ── MOON KNIGHT ──────────────────────────────────────────────────────
// Crescent moon + Egyptian scrolling hieroglyphs + silver sand particles
interface MoonParticle { x: number; y: number; vx: number; vy: number; alpha: number; r: number; }
const moonDust: MoonParticle[] = [];
let moonDustInit = false;
let moonPhase = 0;

// Simple hieroglyph-like chars (using Unicode Egyptian block approximations)
const HIERO = ['𓀀','𓀁','𓂀','𓂋','𓃭','𓄿','𓅓','𓇋','𓈖','𓉐','𓊹','𓋹','𓌳','𓍝','𓎛','𓏏','𓐍'];
interface HieroChar { x: number; y: number; vy: number; char: string; alpha: number; }
const hieroChars: HieroChar[] = [];
let hieroTimer = 0;

function drawMoonKnight(dt: number, t: Theme) {
  if (!moonDustInit) {
    moonDustInit = true;
    for (let i = 0; i < 100; i++) {
      moonDust.push({
        x: rnd(W), y: rnd(H),
        vx: (Math.random() - 0.5) * 0.5, vy: -(0.2 + rnd(0.6)),
        alpha: 0.15 + rnd(0.4), r: 0.5 + rnd(1.5),
      });
    }
  }

  moonPhase += dt * 0.02;

  // Silver sand/dust particles rising
  if (shouldRenderFull()) {
    moonDust.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.y < -5) { p.y = H + 5; p.x = rnd(W); }
      c.globalAlpha = p.alpha;
      c.fillStyle = '#c8d8ff';
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
    });
    c.globalAlpha = 1;
  }

  // Hieroglyphs scrolling up on left side
  hieroTimer += dt;
  if (hieroTimer > 0.3 && hieroChars.length < 24) {
    hieroTimer = 0;
    hieroChars.push({
      x: W * 0.06 + rnd(W * 0.08),
      y: H + 20,
      vy: -(0.4 + rnd(0.6)),
      char: HIERO[Math.floor(rnd(HIERO.length))]!,
      alpha: 0.18 + rnd(0.18),
    });
  }
  c.font = `clamp(14px,2.2vw,22px) serif`;
  c.fillStyle = t.accent2; // gold
  for (let i = hieroChars.length - 1; i >= 0; i--) {
    const h = hieroChars[i]!;
    h.y += h.vy; h.alpha -= 0.001;
    if (h.y < -30 || h.alpha <= 0) { hieroChars.splice(i, 1); continue; }
    c.globalAlpha = h.alpha;
    c.fillText(h.char, h.x, h.y);
  }
  c.globalAlpha = 1;

  // Crescent moon
  if (shouldDrawGlow()) {
    const mx = W * 0.78, my = H * 0.18;
    const mr = Math.min(W, H) * 0.1;
    const crescent = 0.35 + Math.abs(Math.sin(moonPhase)) * 0.2; // phase shift

    // Moon glow
    const mg = c.createRadialGradient(mx, my, 0, mx, my, mr * 2.5);
    mg.addColorStop(0, 'rgba(200,220,255,.08)');
    mg.addColorStop(1, 'transparent');
    c.fillStyle = mg; c.fillRect(0, 0, W, H);

    // Full moon circle
    c.fillStyle = '#c8d8ff';
    c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fill();

    // Crescent cutout (shadow)
    c.fillStyle = t.baseBg[0];
    c.beginPath(); c.arc(mx + mr * crescent * 0.9, my, mr * 0.88, 0, Math.PI * 2); c.fill();

    // Khonshu ankh symbol below moon (very faint)
    c.strokeStyle = `rgba(200,216,255,${0.06 + Math.sin(tick * 0.4) * 0.02})`;
    c.lineWidth = 1.5;
    const ax = mx, ay = my + mr * 1.8, ah = mr * 0.55;
    // Vertical line
    c.beginPath(); c.moveTo(ax, ay - ah * 0.5); c.lineTo(ax, ay + ah); c.stroke();
    // Horizontal line
    c.beginPath(); c.moveTo(ax - ah * 0.35, ay - ah * 0.1); c.lineTo(ax + ah * 0.35, ay - ah * 0.1); c.stroke();
    // Loop top
    c.beginPath(); c.arc(ax, ay - ah * 0.22, ah * 0.28, 0, Math.PI * 2); c.stroke();
  }
}

// ── ONE PIECE — ocean + Thousand Sunny + Jolly Roger ──────────────────
interface OPWave { period: number; phase: number; amp: number; freq: number; col: string; }
const opWaves: OPWave[] = [
  { period: 6.3, phase: 0,    amp: 0.04, freq: 0.022, col: '#003d8f' },
  { period: 4.1, phase: 1.2,  amp: 0.03, freq: 0.035, col: '#00539f' },
  { period: 8.7, phase: 2.8,  amp: 0.05, freq: 0.016, col: '#0066bb' },
];

// Seagull particles
interface Seagull { x: number; y: number; vx: number; vy: number; phase: number; size: number; }
const seagulls: Seagull[] = [];
let opInit = false;

function drawOnePiece(dt: number, t: Theme) {
  if (!opInit) {
    opInit = true;
    for (let i = 0; i < 12; i++) {
      seagulls.push({
        x: rnd(W), y: H * 0.05 + rnd(H * 0.35),
        vx: 0.4 + rnd(0.8), vy: 0,
        phase: rnd(Math.PI * 2), size: 4 + rnd(6),
      });
    }
  }

  // Ocean waves
  opWaves.forEach((w, wi) => {
    c.beginPath();
    const baseY = H * (0.62 + wi * 0.08);
    for (let x = 0; x <= W; x += 3) {
      const y = baseY + Math.sin(x * w.freq + tick / w.period + w.phase) * H * w.amp;
      x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.lineTo(W, H); c.lineTo(0, H); c.closePath();
    c.fillStyle = w.col + 'cc'; c.fill();
  });

  // Sun at horizon — large warm circle
  if (shouldDrawGlow()) {
    const sx = W * 0.72, sy = H * 0.38;
    const sunR = Math.min(W, H) * 0.09;
    const sunG = c.createRadialGradient(sx, sy, 0, sx, sy, sunR * 2.5);
    sunG.addColorStop(0, 'rgba(255,220,80,.55)');
    sunG.addColorStop(0.4, 'rgba(255,180,30,.2)');
    sunG.addColorStop(1, 'transparent');
    c.fillStyle = sunG; c.fillRect(0, 0, W, H);

    c.fillStyle = '#ffe040';
    c.beginPath(); c.arc(sx, sy, sunR, 0, Math.PI * 2); c.fill();
  }

  // Seagulls soaring
  if (shouldRenderFull()) {
    seagulls.forEach(s => {
      s.x += s.vx;
      s.phase += dt * 2.5;
      s.vy = Math.sin(s.phase) * 0.4;
      s.y += s.vy;
      if (s.x > W + 20) s.x = -20;
      // Simple M-shape wing
      const wb = s.size;
      c.strokeStyle = 'rgba(255,248,230,.55)'; c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(s.x - wb, s.y + Math.sin(s.phase) * wb * 0.4);
      c.quadraticCurveTo(s.x - wb * 0.4, s.y - wb * 0.5, s.x, s.y);
      c.quadraticCurveTo(s.x + wb * 0.4, s.y - wb * 0.5, s.x + wb, s.y + Math.sin(s.phase) * wb * 0.4);
      c.stroke();
    });
  }

  // Jolly Roger (Straw Hat crew skull) — faint watermark at lower centre
  if (shouldDrawGlow()) {
    const jx = W * 0.5, jy = H * 0.58;
    const jr = Math.min(W, H) * 0.055;
    c.globalAlpha = 0.07 + Math.sin(tick * 0.3) * 0.02;
    c.fillStyle = '#ffcc00';
    // Skull circle
    c.beginPath(); c.arc(jx, jy, jr, 0, Math.PI * 2); c.fill();
    // Crossbones suggestion — two diagonal lines
    c.strokeStyle = t.baseBg[0]; c.lineWidth = jr * 0.35;
    c.beginPath(); c.moveTo(jx - jr * 1.4, jy + jr * 0.8); c.lineTo(jx + jr * 1.4, jy - jr * 0.8); c.stroke();
    c.beginPath(); c.moveTo(jx + jr * 1.4, jy + jr * 0.8); c.lineTo(jx - jr * 1.4, jy - jr * 0.8); c.stroke();
    c.globalAlpha = 1;
  }
}

// ── ATTACK ON TITAN — Survey Corps wings + titan silhouette ───────────
interface AOTDust { x: number; y: number; vx: number; vy: number; alpha: number; r: number; }
const aotDust: AOTDust[] = [];
let aotInit = false;

function drawAttackOnTitan(dt: number, t: Theme) {
  if (!aotInit) {
    aotInit = true;
    for (let i = 0; i < 60; i++) {
      aotDust.push({ x: rnd(W), y: H * 0.3 + rnd(H * 0.6), vx: 1 + rnd(3), vy: -(rnd(1)), alpha: 0.2 + rnd(0.4), r: 1 + rnd(3) });
    }
  }

  // Dust particles blowing right (battlefield atmosphere)
  if (shouldRenderFull()) {
    aotDust.forEach(d => {
      d.x += d.vx; d.y += d.vy;
      if (d.x > W + 5) { d.x = -5; d.y = H * 0.3 + rnd(H * 0.6); }
      c.globalAlpha = d.alpha * 0.5;
      c.fillStyle = '#c8a870';
      c.beginPath(); c.arc(d.x, d.y, d.r, 0, Math.PI * 2); c.fill();
    });
    c.globalAlpha = 1;
  }

  if (shouldDrawGlow()) {
    // Titan silhouette — abstract giant humanoid shadow at bottom
    const tx = W * 0.78, ty = H;
    const ts = Math.min(W, H) * 0.22;
    c.fillStyle = 'rgba(0,0,0,.65)';
    // Body
    c.beginPath(); c.ellipse(tx, ty - ts * 0.5, ts * 0.25, ts * 0.6, 0, 0, Math.PI * 2); c.fill();
    // Head
    c.beginPath(); c.arc(tx, ty - ts * 1.15, ts * 0.18, 0, Math.PI * 2); c.fill();
    // Arms
    c.lineWidth = ts * 0.12; c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineCap = 'round';
    c.beginPath(); c.moveTo(tx - ts * 0.25, ty - ts * 0.7); c.lineTo(tx - ts * 0.7, ty - ts * 0.3); c.stroke();
    c.beginPath(); c.moveTo(tx + ts * 0.25, ty - ts * 0.7); c.lineTo(tx + ts * 0.65, ty - ts * 0.2); c.stroke();

    // Wings of Freedom emblem (simplified) — faint at lower-left
    const wx = W * 0.15, wy = H * 0.68;
    const wr = Math.min(W, H) * 0.06;
    c.globalAlpha = 0.06 + Math.sin(tick * 0.4) * 0.02;
    c.strokeStyle = '#c8a000'; c.lineWidth = wr * 0.12;
    // Two wing arcs
    c.beginPath(); c.arc(wx - wr * 0.3, wy, wr, -Math.PI * 0.9, -Math.PI * 0.1); c.stroke();
    c.beginPath(); c.arc(wx + wr * 0.3, wy, wr, -Math.PI * 0.9, -Math.PI * 0.1, true); c.stroke();
    c.globalAlpha = 1;
  }
}

// ── DEATH NOTE — falling letters + shinigami shadow ────────────────────
interface DNLetter { x: number; y: number; vy: number; char: string; alpha: number; col: string; }
const dnLetters: DNLetter[] = [];
let dnTimer = 0;
const DN_CHARS = 'LIGHT YAGAMI L KIRA JUSTICE DEATH NOTE 死 神 夜神月'.split(' ');

function drawDeathNote(dt: number, t: Theme) {
  dnTimer += dt;
  if (dnTimer > 0.18 && dnLetters.length < 35) {
    dnTimer = 0;
    const word = DN_CHARS[Math.floor(rnd(DN_CHARS.length))]!;
    dnLetters.push({
      x: rnd(W * 0.85) + W * 0.05,
      y: -20,
      vy: 0.5 + rnd(1.2),
      char: word,
      alpha: 0.12 + rnd(0.15),
      col: Math.random() > 0.6 ? '#cc00cc' : '#880088',
    });
  }

  // Draw falling words
  c.font = `italic bold clamp(9px,1.4vw,14px) 'Playfair Display',serif`;
  for (let i = dnLetters.length - 1; i >= 0; i--) {
    const d = dnLetters[i]!;
    d.y += d.vy;
    d.alpha -= 0.0008;
    if (d.y > H + 20 || d.alpha <= 0) { dnLetters.splice(i, 1); continue; }
    c.globalAlpha = d.alpha;
    c.fillStyle = d.col;
    c.fillText(d.char, d.x, d.y);
  }
  c.globalAlpha = 1;

  // Shinigami shadow — abstract winged silhouette top-right
  if (shouldDrawGlow()) {
    const sx = W * 0.78, sy = H * 0.22;
    const sr = Math.min(W, H) * 0.12;
    const pulse = 0.05 + Math.sin(tick * 0.5) * 0.02;
    c.globalAlpha = pulse;
    c.fillStyle = '#330033';
    // Body blob
    c.beginPath(); c.ellipse(sx, sy, sr * 0.35, sr * 0.55, 0, 0, Math.PI * 2); c.fill();
    // Wings
    c.beginPath(); c.moveTo(sx, sy - sr * 0.2);
    c.bezierCurveTo(sx - sr * 1.2, sy - sr * 0.8, sx - sr * 1.5, sy + sr * 0.3, sx - sr * 0.8, sy + sr * 0.2);
    c.bezierCurveTo(sx - sr * 0.5, sy + sr * 0.15, sx - sr * 0.2, sy + sr * 0.05, sx, sy); c.fill();
    c.beginPath(); c.moveTo(sx, sy - sr * 0.2);
    c.bezierCurveTo(sx + sr * 1.2, sy - sr * 0.8, sx + sr * 1.5, sy + sr * 0.3, sx + sr * 0.8, sy + sr * 0.2);
    c.bezierCurveTo(sx + sr * 0.5, sy + sr * 0.15, sx + sr * 0.2, sy + sr * 0.05, sx, sy); c.fill();
    // Glowing eyes
    c.globalAlpha = 0.7;
    c.fillStyle = '#ff0000';
    c.beginPath(); c.arc(sx - sr * 0.12, sy - sr * 0.08, sr * 0.04, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + sr * 0.12, sy - sr * 0.08, sr * 0.04, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  }
}

// ── PROJECT HAIL MARY — bioluminescent astrophage + starfield ────────
const HM_STAR_COUNT = 320;
const hmStars = new Float32Array(HM_STAR_COUNT * 4); // x,y,r,phase
let hmInit = false;
interface Astrophage { x: number; y: number; r: number; phase: number; drift: number; }
const astrophages: Astrophage[] = [];

function drawHailMary(dt: number, t: Theme) {
  if (!hmInit) {
    hmInit = true;
    for (let i = 0; i < HM_STAR_COUNT; i++) {
      const o = i * 4;
      hmStars[o] = rnd(W); hmStars[o+1] = rnd(H);
      hmStars[o+2] = rnd(1.8) + 0.2; hmStars[o+3] = rnd(Math.PI * 2);
    }
    // Astrophage organisms — glowing green-teal blobs
    for (let i = 0; i < 18; i++) {
      astrophages.push({
        x: rnd(W), y: rnd(H), r: 4 + rnd(12),
        phase: rnd(Math.PI * 2), drift: (Math.random() - 0.5) * 0.4,
      });
    }
  }

  // Stars
  for (let i = 0; i < HM_STAR_COUNT; i++) {
    const o = i * 4;
    hmStars[o+3] += dt * 0.5;
    const a = 0.4 + Math.sin(hmStars[o+3]!) * 0.45;
    c.globalAlpha = a;
    c.fillStyle = '#c8fff0';
    c.beginPath(); c.arc(hmStars[o]!, hmStars[o+1]!, hmStars[o+2]!, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;

  // Astrophage bioluminescent organisms
  if (shouldDrawGlow()) {
    astrophages.forEach(a => {
      a.phase += dt * 0.8;
      a.x += a.drift;
      if (a.x < -20) a.x = W + 20;
      if (a.x > W + 20) a.x = -20;
      const pulse = 0.6 + Math.sin(a.phase) * 0.35;
      const ag = c.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r * 3);
      ag.addColorStop(0, `rgba(0,230,160,${pulse * 0.5})`);
      ag.addColorStop(0.4, `rgba(0,180,120,${pulse * 0.18})`);
      ag.addColorStop(1, 'transparent');
      c.fillStyle = ag; c.fillRect(0, 0, W, H);
      // Core
      c.fillStyle = `rgba(0,255,180,${pulse * 0.7})`;
      c.beginPath(); c.arc(a.x, a.y, a.r * pulse * 0.4, 0, Math.PI * 2); c.fill();
    });

    // Tau Ceti — distant star glow top-right
    const sg = c.createRadialGradient(W * 0.82, H * 0.12, 0, W * 0.82, H * 0.12, W * 0.18);
    sg.addColorStop(0, 'rgba(255,240,180,.12)'); sg.addColorStop(1, 'transparent');
    c.fillStyle = sg; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,230,160,.7)';
    c.beginPath(); c.arc(W * 0.82, H * 0.12, 4, 0, Math.PI * 2); c.fill();
  }
}

// ── EVANGELION — AT Field hexagons + NERV UI + orange sky ────────────
let evaHexPhase = 0;

function drawEvangelion(dt: number, t: Theme) {
  evaHexPhase += dt * 0.4;

  // AT Field hex grid — faint, rotates slowly
  if (shouldDrawGlow()) {
    const size = Math.min(W, H) * 0.08;
    const cols = Math.ceil(W / (size * 1.73)) + 2;
    const rows = Math.ceil(H / (size * 1.5)) + 2;
    c.strokeStyle = `rgba(255,68,0,${0.04 + Math.sin(evaHexPhase * 0.3) * 0.02})`;
    c.lineWidth = 0.8;
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const hx = col * size * 1.73 + (row % 2) * size * 0.865;
        const hy = row * size * 1.5;
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 6 + evaHexPhase * 0.05;
          const px = hx + Math.cos(a) * size;
          const py = hy + Math.sin(a) * size;
          i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
        }
        c.closePath(); c.stroke();
      }
    }

    // NERV-style scan line overlay
    c.strokeStyle = `rgba(255,68,0,${0.06 + Math.sin(evaHexPhase * 1.5) * 0.03})`;
    c.lineWidth = 1;
    const scanY = (tick * 80) % H;
    c.beginPath(); c.moveTo(0, scanY); c.lineTo(W, scanY); c.stroke();

    // Core warning glow at bottom
    const wg = c.createLinearGradient(0, H * 0.6, 0, H);
    wg.addColorStop(0, 'transparent');
    wg.addColorStop(1, `rgba(255,60,0,${0.1 + Math.sin(evaHexPhase * 2) * 0.05})`);
    c.fillStyle = wg; c.fillRect(0, 0, W, H);
  }
}

// ── AKIRA — Neo-Tokyo rain + psychic energy rings ────────────────────
interface AkiraRing { x: number; y: number; r: number; maxR: number; alpha: number; }
const akiraRings: AkiraRing[] = [];
let akiraRingTimer = 0;
interface AkiraRainDrop { x: number; y: number; len: number; speed: number; }
const akiraRain: AkiraRainDrop[] = [];
let akiraRainInit = false;

function drawAkira(dt: number, t: Theme) {
  if (!akiraRainInit) {
    akiraRainInit = true;
    for (let i = 0; i < 80; i++) {
      akiraRain.push({ x: rnd(W), y: rnd(H), len: 15 + rnd(45), speed: 8 + rnd(16) });
    }
  }

  // Night rain
  if (shouldRenderFull()) {
    c.strokeStyle = 'rgba(80,80,160,.25)'; c.lineWidth = 0.8;
    akiraRain.forEach(d => {
      d.y += d.speed;
      if (d.y > H + d.len) { d.y = -d.len; d.x = rnd(W); }
      c.beginPath(); c.moveTo(d.x, d.y - d.len); c.lineTo(d.x + d.len * 0.15, d.y); c.stroke();
    });
  }

  // Psychic energy rings expanding from centre
  akiraRingTimer += dt;
  if (akiraRingTimer > 1.8 && akiraRings.length < 5) {
    akiraRingTimer = 0;
    akiraRings.push({ x: W * 0.5, y: H * 0.45, r: 0, maxR: Math.min(W, H) * 0.55, alpha: 0.6 });
  }
  for (let i = akiraRings.length - 1; i >= 0; i--) {
    const ring = akiraRings[i]!;
    ring.r += dt * 120;
    ring.alpha = Math.max(0, 0.6 * (1 - ring.r / ring.maxR));
    if (ring.alpha <= 0) { akiraRings.splice(i, 1); continue; }
    c.strokeStyle = `rgba(238,0,68,${ring.alpha})`;
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2); c.stroke();
    // Inner ring
    if (ring.r > 20) {
      c.strokeStyle = `rgba(0,68,238,${ring.alpha * 0.4})`;
      c.beginPath(); c.arc(ring.x, ring.y, ring.r * 0.7, 0, Math.PI * 2); c.stroke();
    }
  }

  // City silhouette at bottom
  if (shouldDrawGlow()) {
    c.fillStyle = 'rgba(0,0,8,.9)';
    c.beginPath(); c.moveTo(0, H);
    const bw = W / 24;
    for (let i = 0; i <= 24; i++) {
      const bx = i * bw;
      const bh = H * 0.65 - Math.abs(Math.sin(i * 2.1 + 1.3)) * H * 0.12 - rnd(H * 0.04);
      i === 0 ? c.lineTo(bx, bh) : c.lineTo(bx, bh);
    }
    c.lineTo(W, H); c.closePath(); c.fill();
  }
}

// ── BETTER CALL SAUL — desert heat shimmer + golden hour dust ────────
let bcsInit = false; const bcsDust = new Float32Array(120 * 4); // x,y,vx,alpha
function drawBetterCallSaul(dt: number, t: Theme) {
  if (!bcsInit) {
    bcsInit = true;
    for (let i = 0; i < 120; i++) {
      const o = i*4;
      bcsDust[o]=rnd(W); bcsDust[o+1]=rnd(H);
      bcsDust[o+2]=rnd(0.3)-0.15; bcsDust[o+3]=rnd(0.4)+0.1;
    }
  }
  // Heat shimmer distortion lines at horizon
  if (shouldDrawGlow()) {
    const horizon = H * 0.62;
    c.strokeStyle = `rgba(200,160,0,0.04)`; c.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const y = horizon + Math.sin(tick * 0.8 + i * 0.7) * 8;
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }
    // Golden gradient at horizon
    const hg = c.createLinearGradient(0, horizon - 40, 0, horizon + 40);
    hg.addColorStop(0, 'transparent');
    hg.addColorStop(0.5, `rgba(200,155,0,0.07)`);
    hg.addColorStop(1, 'transparent');
    c.fillStyle = hg; c.fillRect(0, 0, W, H);
  }
  // Floating desert dust motes
  c.fillStyle = `rgba(210,170,40,0.55)`;
  for (let i = 0; i < 120; i++) {
    const o = i*4;
    bcsDust[o] += bcsDust[o+2]; bcsDust[o+1] -= dt * 8;
    if (bcsDust[o+1] < -4) { bcsDust[o+1] = H+4; bcsDust[o] = rnd(W); }
    c.globalAlpha = bcsDust[o+3]! * 0.5;
    c.fillRect(bcsDust[o]!, bcsDust[o+1]!, 1.5, 1.5);
  }
  c.globalAlpha = 1;
}

// ── PEAKY BLINDERS — industrial Birmingham smoke + razor light ────────
let pbSmoke = 0;
function drawPeakyBlinders(dt: number, t: Theme) {
  pbSmoke += dt * 0.4;
  if (shouldDrawGlow()) {
    // Industrial smoke columns rising
    for (let i = 0; i < 4; i++) {
      const sx = W * (0.2 + i * 0.22);
      const sg = c.createRadialGradient(sx, H, 0, sx, H * 0.3, W * 0.18);
      sg.addColorStop(0, `rgba(40,28,0,${0.12 + Math.sin(pbSmoke + i) * 0.04})`);
      sg.addColorStop(1, 'transparent');
      c.fillStyle = sg; c.fillRect(0, 0, W, H);
    }
    // Razor blade glint — occasional flash
    if (Math.sin(pbSmoke * 3.1) > 0.92) {
      const gx = W * 0.5, gy = H * 0.4;
      const rg = c.createRadialGradient(gx, gy, 0, gx, gy, 80);
      rg.addColorStop(0, `rgba(255,200,80,0.22)`);
      rg.addColorStop(1, 'transparent');
      c.fillStyle = rg; c.fillRect(0, 0, W, H);
    }
  }
  // Ground-level amber light
  const ag = c.createLinearGradient(0, H * 0.8, 0, H);
  ag.addColorStop(0, 'transparent');
  ag.addColorStop(1, `rgba(180,95,0,0.1)`);
  c.fillStyle = ag; c.fillRect(0, 0, W, H);
}

// ── THE WIRE — Baltimore streetlight + rain ───────────────────────────
const wireRain = new Float32Array(60 * 3); // x,y,speed
let wireInit = false;
function drawTheWire(dt: number, t: Theme) {
  if (!wireInit) {
    wireInit = true;
    for (let i = 0; i < 60; i++) {
      const o = i*3;
      wireRain[o]=rnd(W); wireRain[o+1]=rnd(H); wireRain[o+2]=4+rnd(8);
    }
  }
  // Light drizzle
  if (shouldRenderFull()) {
    c.strokeStyle = 'rgba(136,153,68,0.15)'; c.lineWidth = 0.8;
    for (let i = 0; i < 60; i++) {
      const o = i*3;
      wireRain[o+1] += wireRain[o+2]!;
      if (wireRain[o+1] > H) { wireRain[o+1] = -10; wireRain[o] = rnd(W); }
      c.beginPath(); c.moveTo(wireRain[o]!, wireRain[o+1]!);
      c.lineTo(wireRain[o]! + 1, wireRain[o+1]! + 8); c.stroke();
    }
  }
  // Distant orange streetlight glow
  if (shouldDrawGlow()) {
    const slg = c.createRadialGradient(W*0.7, H*0.3, 0, W*0.7, H*0.3, W*0.25);
    slg.addColorStop(0, 'rgba(180,170,80,0.06)');
    slg.addColorStop(1, 'transparent');
    c.fillStyle = slg; c.fillRect(0,0,W,H);
  }
}

// ── SUCCESSION — corporate marble + subtle light ──────────────────────
let succTick = 0;
function drawSuccession(dt: number, t: Theme) {
  succTick += dt;
  if (!shouldDrawGlow()) return;
  // Very subtle marble vein — two slow diagonal lines
  for (let i = 0; i < 3; i++) {
    const x0 = W * (0.2 + i * 0.3) + Math.sin(succTick * 0.1 + i) * 20;
    const ag = c.createLinearGradient(x0, 0, x0 + W * 0.08, H);
    ag.addColorStop(0, 'transparent');
    ag.addColorStop(0.5, `rgba(180,155,90,0.025)`);
    ag.addColorStop(1, 'transparent');
    c.fillStyle = ag; c.fillRect(0,0,W,H);
  }
  // Top-right window light
  const wg = c.createRadialGradient(W*0.85, 0, 0, W*0.85, 0, H*0.5);
  wg.addColorStop(0, 'rgba(200,180,110,0.06)');
  wg.addColorStop(1, 'transparent');
  c.fillStyle = wg; c.fillRect(0,0,W,H);
}

// ── LOST — ocean depth + jungle light shafts ─────────────────────────
let lostTick = 0;
const lostShafts = [0.2, 0.4, 0.6, 0.75, 0.88];
function drawLost(dt: number, t: Theme) {
  lostTick += dt;
  if (!shouldDrawGlow()) return;
  // Underwater light shafts
  lostShafts.forEach((xPct, i) => {
    const x = W * xPct;
    const alpha = 0.04 + Math.sin(lostTick * 0.6 + i * 1.2) * 0.025;
    const sg = c.createLinearGradient(x - 30, 0, x + 30, H);
    sg.addColorStop(0, `rgba(34,136,204,${alpha})`);
    sg.addColorStop(0.5, `rgba(34,136,204,${alpha * 0.5})`);
    sg.addColorStop(1, 'transparent');
    c.fillStyle = sg; c.fillRect(0,0,W,H);
  });
  // Deep ocean vignette pulse
  const oa = 0.06 + Math.sin(lostTick * 0.3) * 0.02;
  const og = c.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.8);
  og.addColorStop(0,'transparent');
  og.addColorStop(1,`rgba(0,30,80,${oa})`);
  c.fillStyle = og; c.fillRect(0,0,W,H);
}

// ── SHŌGUN — Japanese ink wash + sakura petals ────────────────────────
interface SakuraPetal { x:number; y:number; vx:number; vy:number; r:number; rot:number; vrot:number; }
const sakuraPetals: SakuraPetal[] = [];
let shogunInit = false;
function drawShogun(dt: number, t: Theme) {
  if (!shogunInit) {
    shogunInit = true;
    for (let i = 0; i < 18; i++) {
      sakuraPetals.push({ x:rnd(W), y:rnd(H), vx:rnd(0.6)-0.3, vy:0.4+rnd(0.8),
        r:3+rnd(5), rot:rnd(Math.PI*2), vrot:(rnd(1)-0.5)*0.04 });
    }
  }
  if (shouldDrawGlow()) {
    // Red sun glow top-right
    const sg = c.createRadialGradient(W*0.78, H*0.18, 0, W*0.78, H*0.18, W*0.2);
    sg.addColorStop(0, 'rgba(200,30,0,0.12)');
    sg.addColorStop(1, 'transparent');
    c.fillStyle = sg; c.fillRect(0,0,W,H);
  }
  // Sakura petals
  c.fillStyle = 'rgba(240,150,160,0.55)';
  sakuraPetals.forEach(p => {
    p.x += p.vx + Math.sin(tick * 0.4 + p.rot) * 0.3;
    p.y += p.vy; p.rot += p.vrot;
    if (p.y > H + 10) { p.y = -10; p.x = rnd(W); }
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
    c.globalAlpha = 0.5;
    c.beginPath(); c.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, Math.PI*2); c.fill();
    c.restore();
  });
  c.globalAlpha = 1;
}

// ── FALLOUT — wasteland green phosphor + radiation pulse ──────────────
let falloutTick = 0;
function drawFallout(dt: number, t: Theme) {
  falloutTick += dt;
  if (shouldDrawGlow()) {
    // Pip-Boy green scan line
    const scanY = ((falloutTick * 60) % (H + 40)) - 20;
    const sl = c.createLinearGradient(0, scanY - 15, 0, scanY + 15);
    sl.addColorStop(0, 'transparent');
    sl.addColorStop(0.5, 'rgba(136,200,0,0.08)');
    sl.addColorStop(1, 'transparent');
    c.fillStyle = sl; c.fillRect(0, 0, W, H);
    // Radiation pulse rings from centre
    const pulseR = ((falloutTick * 0.4) % 1) * Math.min(W,H) * 0.5;
    const pa = Math.max(0, 0.1 * (1 - pulseR / (Math.min(W,H)*0.5)));
    c.strokeStyle = `rgba(136,200,0,${pa})`;
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(W/2, H/2, pulseR, 0, Math.PI*2); c.stroke();
  }
  // Static noise on LOW
  if (!shouldRenderFull()) return;
  c.fillStyle = 'rgba(136,200,0,0.015)';
  for (let i = 0; i < 20; i++) {
    const nx = rnd(W), ny = rnd(H);
    c.fillRect(nx, ny, rnd(4)+1, 1);
  }
}

// ── FUTURAMA — space city skyline + warp stars ───────────────────────
const futStars = new Float32Array(200 * 3); // x,y,speed
let futInit = false;
function drawFuturama(dt: number, t: Theme) {
  if (!futInit) {
    futInit = true;
    for (let i = 0; i < 200; i++) {
      const o = i * 3;
      futStars[o] = rnd(W); futStars[o+1] = rnd(H); futStars[o+2] = rnd(2) + 0.5;
    }
  }
  // Warp stars
  for (let i = 0; i < 200; i++) {
    const o = i * 3;
    futStars[o+1] += futStars[o+2]! * (1 + getRendererFlowIntensity() * 3);
    if (futStars[o+1]! > H) { futStars[o+1] = 0; futStars[o] = rnd(W); }
    const a = futStars[o+2]! / 2.5;
    c.fillStyle = `rgba(180,220,255,${a})`;
    c.fillRect(futStars[o]!, futStars[o+1]!, 1.5, futStars[o+2]! * 2);
  }
  if (!shouldDrawGlow()) return;
  // New New York skyline — deterministic building silhouettes
  c.fillStyle = 'rgba(0,20,60,0.85)';
  c.beginPath(); c.moveTo(0, H);
  const bCount = 18;
  for (let i = 0; i <= bCount; i++) {
    const x = i * W / bCount;
    const h = H * 0.55 - Math.abs(Math.sin(i * 1.7)) * H * 0.18;
    c.lineTo(x, h);
  }
  c.lineTo(W, H); c.closePath(); c.fill();
  // Planet in background — large teal orb
  if (shouldDrawGlow()) {
    const pg = c.createRadialGradient(W*0.75, H*0.22, 0, W*0.75, H*0.22, W*0.14);
    pg.addColorStop(0, 'rgba(0,160,230,0.18)');
    pg.addColorStop(0.6, 'rgba(0,80,180,0.08)');
    pg.addColorStop(1, 'transparent');
    c.fillStyle = pg; c.fillRect(0, 0, W, H);
  }
}

// ── FAMILY GUY — Quahog night + Drunken Clam neon ───────────────────
let fgTick = 0;
function drawFamilyGuy(dt: number, t: Theme) {
  fgTick += dt;
  if (!shouldDrawGlow()) return;
  // Warm house window lights — deterministic
  for (let i = 0; i < 12; i++) {
    const wx = W * (0.05 + (i % 6) * 0.18);
    const wy = H * (0.5 + Math.floor(i / 6) * 0.2);
    const on = Math.sin(fgTick * 0.3 + i * 2.1) > 0;
    if (!on) continue;
    c.fillStyle = `rgba(255,200,80,0.12)`;
    c.fillRect(wx, wy, 18, 12);
  }
  // Drunken Clam neon sign — orange pulse
  const neonA = 0.12 + Math.sin(fgTick * 2) * 0.06;
  const ng = c.createRadialGradient(W*0.3, H*0.42, 0, W*0.3, H*0.42, W*0.1);
  ng.addColorStop(0, `rgba(255,130,0,${neonA})`);
  ng.addColorStop(1, 'transparent');
  c.fillStyle = ng; c.fillRect(0, 0, W, H);
  // Ground amber ambience
  const gg = c.createLinearGradient(0, H*0.75, 0, H);
  gg.addColorStop(0, 'transparent'); gg.addColorStop(1, 'rgba(180,80,0,0.08)');
  c.fillStyle = gg; c.fillRect(0, 0, W, H);
}

// ── RICK AND MORTY — portal green + space particles ──────────────────
let rmPortalAngle = 0;
const rmParticles = new Float32Array(60 * 4); // x,y,vx,vy
let rmInit = false;
function drawRickMorty(dt: number, t: Theme) {
  if (!rmInit) {
    rmInit = true;
    for (let i = 0; i < 60; i++) {
      const o = i * 4;
      rmParticles[o] = rnd(W); rmParticles[o+1] = rnd(H);
      rmParticles[o+2] = (rnd(1) - 0.5) * 0.8; rmParticles[o+3] = (rnd(1) - 0.5) * 0.8;
    }
  }
  rmPortalAngle += dt * 1.2;
  // Rotating portal rings
  if (shouldDrawGlow()) {
    const cx2 = W * 0.5, cy2 = H * 0.42;
    const fr = 40 + Math.sin(rmPortalAngle * 0.5) * 8;
    for (let ring = 0; ring < 5; ring++) {
      const r = fr + ring * 18;
      const a = Math.max(0, 0.18 - ring * 0.03);
      c.strokeStyle = `rgba(0,255,136,${a})`;
      c.lineWidth = 2.5 - ring * 0.4;
      c.save(); c.translate(cx2, cy2); c.rotate(rmPortalAngle * (ring % 2 === 0 ? 1 : -1) * 0.3);
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
      c.restore();
    }
    // Portal glow core
    const pg = c.createRadialGradient(cx2, cy2, 0, cx2, cy2, fr + 20);
    pg.addColorStop(0, `rgba(0,255,136,0.15)`); pg.addColorStop(1, 'transparent');
    c.fillStyle = pg; c.fillRect(0, 0, W, H);
  }
  // Green space particles
  c.fillStyle = 'rgba(0,230,100,0.4)';
  for (let i = 0; i < 60; i++) {
    const o = i * 4;
    rmParticles[o] += rmParticles[o+2]!; rmParticles[o+1] += rmParticles[o+3]!;
    if (rmParticles[o]! < 0 || rmParticles[o]! > W) rmParticles[o+2] = rmParticles[o+2]! * -1;
    if (rmParticles[o+1]! < 0 || rmParticles[o+1]! > H) rmParticles[o+3] = rmParticles[o+3]! * -1;
    if (rmParticles[o]! < 0) rmParticles[o] = W;
    if (rmParticles[o]! > W) rmParticles[o] = 0;
    if (rmParticles[o+1]! < 0) rmParticles[o+1] = H;
    if (rmParticles[o+1]! > H) rmParticles[o+1] = 0;
    c.fillRect(rmParticles[o]!, rmParticles[o+1]!, 1.5, 1.5);
  }
}

// ── THE SIMPSONS — Springfield sky + yellow glow ─────────────────────
let simpTick = 0;
function drawSimpsons(dt: number, t: Theme) {
  simpTick += dt;
  if (!shouldDrawGlow()) return;
  // Clouds slowly drifting — Springfield daytime feel
  for (let i = 0; i < 4; i++) {
    const cx2 = ((W * (0.15 + i * 0.28) + simpTick * (8 + i * 3)) % (W + 160)) - 80;
    const cy2 = H * (0.12 + i * 0.06);
    const cg = c.createRadialGradient(cx2, cy2, 0, cx2, cy2, 60 + i * 20);
    cg.addColorStop(0, 'rgba(255,250,220,0.08)');
    cg.addColorStop(1, 'transparent');
    c.fillStyle = cg; c.fillRect(0, 0, W, H);
  }
  // Springfield Power Plant glow — bottom left
  const ppg = c.createRadialGradient(W*0.12, H*0.85, 0, W*0.12, H*0.85, W*0.15);
  ppg.addColorStop(0, `rgba(255,220,0,${0.06 + Math.sin(simpTick * 0.8) * 0.02})`);
  ppg.addColorStop(1, 'transparent');
  c.fillStyle = ppg; c.fillRect(0, 0, W, H);
  // Homer donut glow — amber warmth at centre bottom
  const dg = c.createLinearGradient(0, H * 0.7, 0, H);
  dg.addColorStop(0, 'transparent');
  dg.addColorStop(1, 'rgba(255,190,0,0.07)');
  c.fillStyle = dg; c.fillRect(0, 0, W, H);
}

// ── SOUTH PARK — Colorado blizzard + snow drift ───────────────────────
const spSnow = new Float32Array(150 * 3); // x,y,speed
let spInit = false;
function drawSouthPark(dt: number, t: Theme) {
  if (!spInit) {
    spInit = true;
    for (let i = 0; i < 150; i++) {
      const o = i * 3;
      spSnow[o] = rnd(W); spSnow[o+1] = rnd(H); spSnow[o+2] = rnd(2) + 0.5;
    }
  }
  // Snowflakes
  c.fillStyle = 'rgba(200,220,255,0.55)';
  for (let i = 0; i < 150; i++) {
    const o = i * 3;
    spSnow[o+1] += spSnow[o+2]!;
    spSnow[o] += Math.sin(tick + i) * 0.4;
    if (spSnow[o+1]! > H) { spSnow[o+1] = -4; spSnow[o] = rnd(W); }
    c.beginPath(); c.arc(spSnow[o]!, spSnow[o+1]!, spSnow[o+2]! * 0.7, 0, Math.PI * 2); c.fill();
  }
  if (!shouldDrawGlow()) return;
  // Mountain ridge silhouette — Colorado Rockies
  c.fillStyle = 'rgba(0,10,30,0.8)';
  c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W; x += W / 8) {
    const y = H * 0.6 - Math.abs(Math.sin(x / W * Math.PI * 3)) * H * 0.25;
    c.lineTo(x, y);
  }
  c.lineTo(W, H); c.closePath(); c.fill();
}

// ── THE BOONDOCKS — golden hour suburbs + warm glow ──────────────────
let bdTick = 0;
function drawBoondocks(dt: number, t: Theme) {
  bdTick += dt;
  if (!shouldDrawGlow()) return;
  // Suburban tree line silhouette
  c.fillStyle = 'rgba(10,4,0,0.75)';
  c.beginPath(); c.moveTo(0, H);
  for (let i = 0; i <= 20; i++) {
    const x = i * W / 20;
    const treeH = H * 0.55 + Math.sin(i * 2.3) * H * 0.12 + Math.cos(i * 1.1) * H * 0.06;
    c.lineTo(x, treeH);
  }
  c.lineTo(W, H); c.closePath(); c.fill();
  // Setting sun warm glow
  const sunG = c.createRadialGradient(W*0.6, H*0.3, 0, W*0.6, H*0.3, W*0.25);
  sunG.addColorStop(0, `rgba(220,110,0,${0.1 + Math.sin(bdTick * 0.2) * 0.02})`);
  sunG.addColorStop(1, 'transparent');
  c.fillStyle = sunG; c.fillRect(0, 0, W, H);
}

// ── ARCHER — ISIS office + purple glass ──────────────────────────────
let arTick = 0;
function drawArcher(dt: number, t: Theme) {
  arTick += dt;
  if (!shouldDrawGlow()) return;
  // Office building glass — horizontal venetian blind lines
  const lineAlpha = 0.035 + Math.sin(arTick * 0.4) * 0.01;
  c.strokeStyle = `rgba(160,100,255,${lineAlpha})`;
  c.lineWidth = 1;
  for (let y = 0; y < H; y += 22) {
    c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
  }
  // Desk lamp cone — soft purple spotlight
  const lg = c.createRadialGradient(W*0.5, H*0.6, 0, W*0.5, H*0.6, W*0.3);
  lg.addColorStop(0, 'rgba(140,80,230,0.08)');
  lg.addColorStop(1, 'transparent');
  c.fillStyle = lg; c.fillRect(0, 0, W, H);
  // Occasional "Lana" flash — subtle top flicker
  if (Math.sin(arTick * 7.3) > 0.96) {
    c.fillStyle = 'rgba(200,150,255,0.04)';
    c.fillRect(0, 0, W, H * 0.15);
  }
}

// ── BOB'S BURGERS — Ocean Avenue + teal warmth ───────────────────────
let bbTick = 0;
function drawBobsBurgers(dt: number, t: Theme) {
  bbTick += dt;
  if (!shouldDrawGlow()) return;
  // Gentle ocean waves at bottom
  for (let i = 0; i < 3; i++) {
    const waveY = H * 0.82 + Math.sin(bbTick * 0.6 + i * 1.2) * 6;
    const wg = c.createLinearGradient(0, waveY - 12, 0, waveY + 12);
    wg.addColorStop(0, 'transparent');
    wg.addColorStop(0.5, `rgba(0,180,180,${0.07 - i * 0.015})`);
    wg.addColorStop(1, 'transparent');
    c.fillStyle = wg; c.fillRect(0, 0, W, H);
  }
  // "Bob's Burgers" sign warm neon glow
  const sg = c.createRadialGradient(W*0.5, H*0.4, 0, W*0.5, H*0.4, W*0.18);
  sg.addColorStop(0, `rgba(0,200,200,${0.07 + Math.sin(bbTick) * 0.02})`);
  sg.addColorStop(0.5, 'rgba(255,100,100,0.03)');
  sg.addColorStop(1, 'transparent');
  c.fillStyle = sg; c.fillRect(0, 0, W, H);
  // Street lamp warmth at bottom corners
  ['rgba(255,190,80,0.06)', 'rgba(255,190,80,0.04)'].forEach((col, i) => {
    const lampG = c.createRadialGradient(W * (i === 0 ? 0.15 : 0.85), H * 0.65, 0,
                                          W * (i === 0 ? 0.15 : 0.85), H * 0.65, W * 0.12);
    lampG.addColorStop(0, col); lampG.addColorStop(1, 'transparent');
    c.fillStyle = lampG; c.fillRect(0, 0, W, H);
  });
}

// ── Transitions ───────────────────────────────────────────────────────
export function runTransition(type: string, cb: () => void) {
  if (transitioning) { cb(); return; }
  transitioning = true;
  tCanvas.style.display = 'block';
  const fn = TRANS[type] ?? TRANS.defaultFade;
  fn(cb);
}

function finishTrans() {
  let f = 1;
  const step = () => {
    f -= 0.02; tc.clearRect(0, 0, W, H);
    if (f > 0) { tc.fillStyle = `rgba(0,0,0,${f})`; tc.fillRect(0,0,W,H); requestAnimationFrame(step); }
    else { tCanvas.style.display = 'none'; transitioning = false; }
  };
  requestAnimationFrame(step);
}

const TRANS: Record<string, (cb: () => void) => void> = {
  defaultFade(cb) {
    let p = 0, called = false;
    const go = () => { p += 0.015; tc.fillStyle=`rgba(0,0,0,${Math.min(1,p*1.5)})`; tc.fillRect(0,0,W,H); if(!called&&p>=.5){called=true;cb();} p<1?requestAnimationFrame(go):finishTrans(); };
    requestAnimationFrame(go);
  },
  fire(cb) {
    let p=0,called=false;
    const go=()=>{p+=.01;tc.clearRect(0,0,W,H);tc.fillStyle=`rgba(0,0,0,${Math.min(.88,p*1.4)})`;tc.fillRect(0,0,W,H);for(let x=0;x<W;x+=3){const h=(Math.sin(x*.017+p*3.5)*.5+.5)*(Math.sin(x*.034-p*2.5)*.5+.5)*Math.min(1,p*1.8)*H*.9;const gf=tc.createLinearGradient(0,H,0,H-h);gf.addColorStop(0,'rgba(255,120,0,.95)');gf.addColorStop(.3,'rgba(220,50,0,.8)');gf.addColorStop(1,'rgba(80,0,0,0)');tc.fillStyle=gf;tc.fillRect(x,H-h,3,h);}if(!called&&p>=.54){called=true;cb();}p<1.1?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  redblood(cb) {
    let p=0,called=false;const dr=[...Array(28)].map((_,i)=>({x:(i/28)*W+Math.sin(i*2.5)*20,spd:.5+rnd(.5),w:rnd(4)+2}));
    const go=()=>{p+=.009;tc.clearRect(0,0,W,H);tc.fillStyle=`rgba(0,0,0,${Math.min(.92,p*1.5)})`;tc.fillRect(0,0,W,H);dr.forEach(d=>{const drip=Math.min(H,p*d.spd*H*2.2);const gr=tc.createLinearGradient(0,0,0,drip);gr.addColorStop(0,'rgba(160,0,0,.95)');gr.addColorStop(1,'rgba(80,0,0,.25)');tc.fillStyle=gr;tc.fillRect(d.x,0,d.w,drip);});if(!called&&p>=.5){called=true;cb();}p<1.1?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  smoke(cb) {
    let p=0,called=false;const ws=[...Array(18)].map(()=>({x:rnd(W),y:rnd(H),r:rnd(60)+20,vx:rndpm(.3),vy:-(rnd(.4)+.1)}));
    const go=()=>{p+=.008;tc.clearRect(0,0,W,H);tc.fillStyle=`rgba(5,4,0,${Math.min(.96,p*1.35)})`;tc.fillRect(0,0,W,H);ws.forEach(w=>{w.x+=w.vx;w.y+=w.vy;w.r+=.45;const wg=tc.createRadialGradient(w.x,w.y,0,w.x,w.y,w.r);wg.addColorStop(0,`rgba(80,65,30,${Math.max(0,.07-p*.04)})`);wg.addColorStop(1,'transparent');tc.fillStyle=wg;tc.fillRect(0,0,W,H);});if(!called&&p>=.54){called=true;cb();}p<1.15?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  timeloop(cb) {
    let p=0,called=false;
    const go=()=>{p+=.009;tc.fillStyle='rgba(0,0,6,.1)';tc.fillRect(0,0,W,H);tc.save();tc.translate(W*.5,H*.5);const mx=Math.sqrt(W*W+H*H)*.55;for(let r=mx*(1-Math.min(1,p*1.8));r>4;r-=2.5){const a=r*.065+p*6;tc.beginPath();tc.arc(Math.cos(a)*r*.008,Math.sin(a)*r*.008,r,0,Math.PI*2);tc.strokeStyle=`hsla(${220+r*.1},70%,60%,.016)`;tc.lineWidth=1.2;tc.stroke();}tc.restore();if(!called&&p>=.52){called=true;cb();}p<1.15?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  chemical(cb) {
    let p=0,called=false;const bs=[...Array(20)].map(()=>({x:W*.5+rndpm(100),y:H*.5+rndpm(80),r:0,maxR:rnd(28)+8,spd:rnd(.02)+.01}));
    const go=()=>{p+=.01;tc.clearRect(0,0,W,H);const R=p*Math.sqrt(W*W+H*H)*.58;const cg=tc.createRadialGradient(W*.5,H*.5,0,W*.5,H*.5,R);cg.addColorStop(0,'rgba(0,0,0,.97)');cg.addColorStop(.88,`rgba(${(55*p)|0},${(175*p)|0},0,.5)`);cg.addColorStop(1,'rgba(0,0,0,0)');tc.fillStyle=cg;tc.fillRect(0,0,W,H);bs.forEach(b=>{b.r=Math.min(b.maxR,b.r+b.spd*R*.06);const bx=b.x+Math.cos(p*3+b.r)*R*.4,by=b.y+Math.sin(p*2+b.r)*R*.35;tc.beginPath();tc.arc(bx,by,b.r,0,Math.PI*2);tc.strokeStyle=`rgba(60,220,0,${Math.min(.7,p*1.5)})`;tc.lineWidth=1.5;tc.stroke();});if(!called&&p>=.52){called=true;cb();}p<1.1?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  updown(cb) {
    let p=0,called=false;
    const go=()=>{p+=.01;tc.clearRect(0,0,W,H);const slide=easeIO(Math.min(1,p*1.6))*H*.5;tc.fillStyle=`rgba(5,0,15,${Math.min(.97,p*1.5)})`;tc.fillRect(0,0,W,H*.5+slide);tc.fillRect(0,H-(H*.5+slide),W,H*.5+slide);if(!called&&p>=.52){called=true;cb();}p<1.1?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  warp(cb) {
    let p=0,called=false;const stars=[...Array(200)].map(()=>({a:rnd(Math.PI*2),d:rnd(Math.sqrt(W*W+H*H)*.5)}));
    const go=()=>{p+=.009;tc.fillStyle=`rgba(0,3,10,${.1+p*.08})`;tc.fillRect(0,0,W,H);tc.save();tc.translate(W*.5,H*.5);stars.forEach(s=>{const sp=easeIO(Math.min(1,p*1.5)),len=sp*42+2,d=s.d*(1-sp*.6);tc.beginPath();tc.moveTo(Math.cos(s.a)*(d-len),Math.sin(s.a)*(d-len));tc.lineTo(Math.cos(s.a)*d,Math.sin(s.a)*d);tc.strokeStyle=`rgba(150,210,255,${Math.min(1,p*2)*.8})`;tc.lineWidth=Math.max(.5,sp*2);tc.stroke();});tc.restore();if(!called&&p>=.52){called=true;cb();}p<1.1?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  sandstorm(cb) {
    let p=0,called=false;const gr=[...Array(300)].map(()=>({x:rnd(W),y:rnd(H),vx:3+rnd(5),vy:rndpm(.7),a:rnd(.4)+.1}));
    const go=()=>{p+=.009;tc.fillStyle=`rgba(20,12,0,${Math.min(.94,p*1.35)})`;tc.fillRect(0,0,W,H);gr.forEach(g=>{g.x+=g.vx*(1+p*2);g.y+=g.vy;if(g.x>W+5){g.x=-5;g.y=rnd(H);}tc.beginPath();tc.arc(g.x,g.y,.8,0,Math.PI*2);tc.fillStyle='rgba(200,155,60,1)';tc.globalAlpha=g.a*Math.min(1,p*2);tc.fill();tc.globalAlpha=1;});if(!called&&p>=.52){called=true;cb();}p<1.1?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  matrixrain(cb) {
    let p=0,called=false;const cols2=(W/14)|0;const drops=[...Array(cols2)].map(()=>({y:rnd(H*.5),spd:3+rnd(5)}));
    const go=()=>{p+=.008;tc.fillStyle=`rgba(0,${(16*p)|0},0,${Math.min(.95,p*1.4)})`;tc.fillRect(0,0,W,H);tc.font='13px monospace';drops.forEach((d,i)=>{d.y+=d.spd;const x=i*14;for(let j=0;j<22;j++){const y=d.y-j*14;if(y<-14||y>H+14)continue;const fa=j===0?.95:Math.max(0,.6-j*.026);tc.fillStyle=j===0?`rgba(180,255,180,${fa})`:`rgba(0,${178-j*6},0,${fa*Math.min(1,p*2)})`;tc.fillText(MAT_CHARS[(Math.random()*MAT_CHARS.length)|0],x,y);}if(d.y>H+200)d.y=0;});if(!called&&p>=.54){called=true;cb();}p<1.1?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  neon_rain(cb) {
    let p=0,called=false;const drops=[...Array(110)].map(()=>({x:rnd(W),y:rnd(H*.3),vy:3+rnd(4),len:20+rnd(48),hue:rnd(1)<.6?25:200}));
    const go=()=>{p+=.009;tc.fillStyle=`rgba(4,2,0,${Math.min(.96,p*1.35)})`;tc.fillRect(0,0,W,H);drops.forEach(d=>{d.y+=d.vy;if(d.y>H+60){d.y=-60;d.x=rnd(W);}const dg=tc.createLinearGradient(d.x,d.y-d.len,d.x,d.y);dg.addColorStop(0,'transparent');dg.addColorStop(1,`hsla(${d.hue},90%,60%,${.42*Math.min(1,p*2)})`);tc.strokeStyle=dg;tc.beginPath();tc.moveTo(d.x,d.y-d.len);tc.lineTo(d.x,d.y);tc.lineWidth=.8;tc.stroke();});if(!called&&p>=.52){called=true;cb();}p<1.1?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  dream(cb) {
    let p=0,called=false;
    const go=()=>{p+=.008;tc.fillStyle=`rgba(3,3,6,${Math.min(.95,p*1.35)})`;tc.fillRect(0,0,W,H);tc.save();tc.translate(W*.5,H*.5);for(let i=0;i<6;i++){const a=i/6*Math.PI*2+p*(.05+i*.007),r=W*.3*Math.sin(p*Math.PI*.85)*Math.max(.1,1-i*.12);tc.save();tc.rotate(a);tc.fillStyle=`rgba(70,70,180,${(.038-i*.005)*Math.min(1,p*2)})`;tc.fillRect(-W*.5,-r*.1,W,r*.2);tc.restore();}tc.restore();if(!called&&p>=.52){called=true;cb();}p<1.1?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  rose(cb) {
    let p=0,called=false;const pts=[...Array(22)].map(()=>({x:W*.5+rndpm(W*.4),y:-(rnd(H*.3)),r:rnd(14)+6,vy:1.5+rnd(2),vx:rndpm(.45),rot:rnd(Math.PI*2),rv:rndpm(.018)}));
    const go=()=>{p+=.008;tc.fillStyle=`rgba(1,1,0,${Math.min(.96,p*1.35)})`;tc.fillRect(0,0,W,H);pts.forEach(pt=>{pt.y+=pt.vy;pt.x+=pt.vx;pt.rot+=pt.rv;tc.save();tc.translate(pt.x,pt.y);tc.rotate(pt.rot);tc.beginPath();tc.ellipse(0,0,pt.r*.6,pt.r,0,0,Math.PI*2);tc.fillStyle=`rgba(128,10,10,${.58*Math.min(1,p*2)})`;tc.fill();tc.restore();});if(!called&&p>=.52){called=true;cb();}p<1.1?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  f1_launch(cb) {
    const LP=[0.2,0.35,0.5,0.65,0.8];const LR=Math.min(W,H)*.042;let elapsed=0,lastT=0,called=false;const totalDur=3500;
    const go=(ts:number)=>{if(!lastT)lastT=ts;elapsed+=ts-lastT;lastT=ts;const p=elapsed/totalDur;tc.clearRect(0,0,W,H);tc.fillStyle=`rgba(0,0,0,${Math.min(.96,p*2.2)})`;tc.fillRect(0,0,W,H);LP.forEach((lx,i)=>{const lx2=W*lx,ly=H*.34,onAt=.15+(i/(LP.length-1))*.4,isOn=p>=onAt&&p<.72+i*.055;if(p>.05){tc.beginPath();tc.arc(lx2,ly,LR*1.2,0,Math.PI*2);tc.fillStyle='rgba(12,12,15,.92)';tc.fill();}if(p>=onAt&&isOn){const inner=tc.createRadialGradient(lx2,ly,0,lx2,ly,LR);inner.addColorStop(0,'rgba(255,160,100,.98)');inner.addColorStop(1,'rgba(80,0,0,.3)');tc.fillStyle=inner;tc.beginPath();tc.arc(lx2,ly,LR,0,Math.PI*2);tc.fill();}});if(p>.72){const loA=Math.min(1,(p-.72)/.07),loF=Math.min(1,(.97-p)/.09);if(loA*loF>.05){tc.font=`bold ${Math.min(W*.07,56)}px 'Orbitron',monospace`;tc.textAlign='center';tc.textBaseline='middle';tc.fillStyle=`rgba(255,255,255,${loA*loF})`;tc.fillText('LIGHTS OUT',W*.5,H*.55);}}tc.globalAlpha=1;if(!called&&p>=.74){called=true;cb();}p<1.0?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  f1_burnout(cb) {
    const sm=[...Array(48)].map(()=>({x:W*(.28+Math.random()*.44),y:H*(.68+Math.random()*.12),r:Math.random()*22+12,maxR:Math.random()*160+90,vx:(Math.random()-.5)*.9,vy:-(Math.random()*.7+.25),alpha:Math.random()*.18+.08,grey:Math.floor(Math.random()*40+130),delay:Math.random()*.28}));
    let elapsed=0,lastT=0,called=false;const totalDur=3400;
    const go=(ts:number)=>{if(!lastT)lastT=ts;elapsed+=ts-lastT;lastT=ts;const p=Math.min(1,elapsed/totalDur);tc.clearRect(0,0,W,H);tc.fillStyle=`rgba(0,0,0,${Math.min(.92,p*1.1)})`;tc.fillRect(0,0,W,H);if(p>.04){const sp=(p-.04)/.96;sm.forEach(s=>{if(sp<s.delay)return;const lp=Math.min(1,(sp-s.delay)/(1-s.delay)),cx=s.x+s.vx*lp*180,cy=s.y+s.vy*lp*220;s.r=Math.min(s.maxR,s.r+(s.maxR-s.r)*.008);const la=s.alpha*Math.min(1,lp*4)*Math.max(0,1-lp*.5);const sg=tc.createRadialGradient(cx,cy,0,cx,cy,s.r);sg.addColorStop(0,`rgba(${s.grey},${s.grey-8},${s.grey-12},${la*1.1})`);sg.addColorStop(1,'rgba(0,0,0,0)');tc.fillStyle=sg;tc.beginPath();tc.arc(cx,cy,s.r,0,Math.PI*2);tc.fill();});}tc.globalAlpha=1;if(!called&&p>=.52){called=true;cb();}p<1.0?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  flash(cb) {
    // Oppenheimer white flash
    let p=0,called=false;
    const go=()=>{p+=.04;const a=p<.5?p*2:Math.max(0,2-p*2);tc.fillStyle=`rgba(255,240,200,${a*.95})`;tc.fillRect(0,0,W,H);if(!called&&p>=.5){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  glitch(cb) {
    // Mr Robot glitch transition
    let p=0,called=false;
    const go=()=>{p+=.025;const lines=Math.floor(8+p*12);tc.fillStyle=`rgba(0,0,0,${Math.min(.9,p*1.4)})`;tc.fillRect(0,0,W,H);for(let i=0;i<lines;i++){const y=Math.random()*H,h=1+Math.random()*8,shift=(Math.random()-.5)*40*(1-p);tc.fillStyle=`rgba(0,${Math.floor(200+Math.random()*55)},60,${.08+Math.random()*.12})`;tc.fillRect(shift,y,W,h);}if(!called&&p>=.5){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  slowzoom(cb) {
    // 2001 — slow creeping black zoom
    let p=0,called=false;
    const go=()=>{p+=.012;tc.clearRect(0,0,W,H);tc.save();const s=1+p*0.08;tc.translate(W/2,H/2);tc.scale(s,s);tc.translate(-W/2,-H/2);tc.fillStyle=`rgba(0,0,4,${Math.min(.95,p*1.8)})`;tc.fillRect(0,0,W,H);tc.restore();if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  tenet_invert(cb) {
    // Blue forward wave meets orange reverse wave
    let p=0,called=false;
    const go=()=>{p+=.018;const split=Math.max(0,Math.min(W,p*W*2));tc.fillStyle=`rgba(0,0,8,${Math.min(.92,p*1.6)})`;tc.fillRect(0,0,W,H);if(split>0){const wg=tc.createLinearGradient(split-30,0,split,0);wg.addColorStop(0,'rgba(100,100,255,.18)');wg.addColorStop(1,'transparent');tc.fillStyle=wg;tc.fillRect(split-30,0,30,H);}const rsplit=Math.max(0,W-split);if(rsplit<W){const wg2=tc.createLinearGradient(rsplit,0,rsplit+30,0);wg2.addColorStop(0,'transparent');wg2.addColorStop(1,'rgba(255,136,0,.18)');tc.fillStyle=wg2;tc.fillRect(rsplit,0,30,H);}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  dragonfire(cb) {
    // Fire particles rain down from top
    const flameCols=['#ff2200','#ff6600','#ff9900','#ffcc00','#ff4400'];
    const pts=[...Array(60)].map(()=>({x:rnd(W),y:0,vy:8+rnd(12),size:6+rnd(18),col:flameCols[Math.floor(rnd(flameCols.length))]??'#ff4400'}));
    let p=0,called=false;
    const go=()=>{p+=.016;tc.fillStyle=`rgba(0,0,0,${Math.min(.92,p*1.2)})`;tc.fillRect(0,0,W,H);pts.forEach(pt=>{pt.y+=pt.vy;const a=Math.max(0,.8-pt.y/H);if(a>0){tc.beginPath();tc.arc(pt.x,pt.y,pt.size*(1-pt.y/H*.5),0,Math.PI*2);tc.fillStyle=pt.col+(Math.round(a*255).toString(16).padStart(2,'0'));tc.fill();}});if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  moonrise(cb) {
    // Silver moon rises from bottom
    let p=0,called=false;
    const go=()=>{p+=.016;const cy=H*(1.1-p*1.2);const r=Math.min(W,H)*(.06+p*.12);tc.fillStyle=`rgba(2,3,10,${Math.min(.94,p*1.3)})`;tc.fillRect(0,0,W,H);if(p>.05){const mg=tc.createRadialGradient(W/2,cy,0,W/2,cy,r*3);mg.addColorStop(0,`rgba(200,220,255,${Math.min(.18,p*.25)})`);mg.addColorStop(1,'transparent');tc.fillStyle=mg;tc.fillRect(0,0,W,H);tc.fillStyle=`rgba(200,216,255,${Math.min(.9,p*1.4)})`;tc.beginPath();tc.arc(W/2,cy,r,0,Math.PI*2);tc.fill();}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  onepiece_sail(cb) {
    // Sun rises over ocean horizon
    let p=0,called=false;
    const go=()=>{p+=.014;const sy=H*(1.0-p*1.3);tc.clearRect(0,0,W,H);tc.fillStyle=`rgba(0,10,24,${Math.min(.92,p*1.2)})`;tc.fillRect(0,0,W,H);if(p>.08){const sg=tc.createRadialGradient(W*.72,sy,0,W*.72,sy,W*.3);sg.addColorStop(0,`rgba(255,220,60,${Math.min(.8,p*1.5)})`);sg.addColorStop(1,'transparent');tc.fillStyle=sg;tc.fillRect(0,0,W,H);tc.fillStyle=`rgba(255,210,30,${Math.min(.9,p*1.4)})`;tc.beginPath();tc.arc(W*.72,sy,W*.06,0,Math.PI*2);tc.fill();}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  aot_charge(cb) {
    // Horizontal dust charge wipe
    let p=0,called=false;const particles=[...Array(40)].map(()=>({x:0,y:rnd(H),vx:12+rnd(18),r:2+rnd(6),a:0.3+rnd(0.4)}));
    const go=()=>{p+=.02;tc.fillStyle=`rgba(6,5,0,${Math.min(.92,p*1.4)})`;tc.fillRect(0,0,W,H);particles.forEach(pt=>{pt.x+=pt.vx;if(pt.x<W){tc.beginPath();tc.arc(pt.x,pt.y,pt.r,0,Math.PI*2);tc.fillStyle=`rgba(200,168,112,${pt.a*(1-p*.5)})`;tc.fill();}});if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  deathnote_write(cb) {
    let p=0,called=false;
    const go=()=>{p+=.016;const r=Math.min(W,H)*(p*0.9);tc.fillStyle=`rgba(4,0,6,${Math.min(.95,p*1.6)})`;tc.fillRect(0,0,W,H);if(r>10){const ig=tc.createRadialGradient(W/2,H/2,0,W/2,H/2,r);ig.addColorStop(0,`rgba(100,0,100,${Math.min(.3,p*.4)})`);ig.addColorStop(1,'transparent');tc.fillStyle=ig;tc.fillRect(0,0,W,H);}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  hailmary_warp(cb) {
    // Bioluminescent warp — teal streaks converge
    let p=0,called=false;const streaks=[...Array(30)].map((_,i)=>({a:i/30*Math.PI*2,r:0}));
    const go=()=>{p+=.018;tc.fillStyle=`rgba(0,8,14,${Math.min(.92,p*1.3)})`;tc.fillRect(0,0,W,H);streaks.forEach(s=>{s.r=p*Math.min(W,H)*.8;const x=W/2+Math.cos(s.a)*s.r,y=H/2+Math.sin(s.a)*s.r;const sg=tc.createLinearGradient(W/2,H/2,x,y);sg.addColorStop(0,'transparent');sg.addColorStop(1,`rgba(0,220,160,${Math.max(0,.4-p*.3)})`);tc.strokeStyle=sg;tc.lineWidth=1;tc.beginPath();tc.moveTo(W/2,H/2);tc.lineTo(x,y);tc.stroke();});if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  eva_alert(cb) {
    // NERV alert — red flicker then black
    let p=0,called=false;let flash=0;
    const go=()=>{p+=.02;flash=Math.sin(p*Math.PI*8)>.3?1:0;tc.fillStyle=flash&&p<.6?`rgba(200,0,0,${.15*Math.min(1,p*3)})`:`rgba(6,2,0,${Math.min(.94,p*1.4)})`;tc.fillRect(0,0,W,H);if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  akira_blast(cb) {
    let p=0,called=false;
    const go=()=>{p+=.02;tc.fillStyle=`rgba(0,0,8,${Math.min(.94,p*1.4)})`;tc.fillRect(0,0,W,H);for(let i=0;i<3;i++){const r=p*Math.min(W,H)*(0.4+i*.25);const a=Math.max(0,.5-p*.6);tc.strokeStyle=i%2===0?`rgba(238,0,68,${a})`:`rgba(0,68,238,${a*.5})`;tc.lineWidth=1.5;tc.beginPath();tc.arc(W/2,H*.45,r,0,Math.PI*2);tc.stroke();}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  dust(cb) {
    // BCS: sandy dust sweep left to right
    let p=0,called=false;
    const go=()=>{p+=.018;tc.fillStyle=`rgba(12,9,0,${Math.min(.92,p*1.3)})`;tc.fillRect(0,0,W,H);if(shouldDrawGlow()){const dg=tc.createLinearGradient(p*W*1.4-W*.3,0,p*W*1.4,H);dg.addColorStop(0,'transparent');dg.addColorStop(0.5,`rgba(200,160,40,${0.12*(1-p)})`);dg.addColorStop(1,'transparent');tc.fillStyle=dg;tc.fillRect(0,0,W,H);}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  oceanic(cb) {
    // Lost: ocean wave wipe
    let p=0,called=false;
    const go=()=>{p+=.016;tc.fillStyle=`rgba(0,4,10,${Math.min(.93,p*1.35)})`;tc.fillRect(0,0,W,H);for(let i=0;i<3;i++){const waveY=H*(1.1-p*1.2)+Math.sin(p*8+i*2)*12;const wg=tc.createLinearGradient(0,waveY-20,0,waveY+20);wg.addColorStop(0,'transparent');wg.addColorStop(0.5,`rgba(30,100,180,${0.18*(1-p)})`);wg.addColorStop(1,'transparent');tc.fillStyle=wg;tc.fillRect(0,0,W,H);}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  sakura(cb) {
    // Shōgun: sakura petals fall across
    let p=0,called=false;
    const petals=[...Array(20)].map(()=>({x:rnd(W),y:-20-rnd(H),vx:rnd(2)-1,vy:3+rnd(3)}));
    const go=()=>{p+=.016;tc.fillStyle=`rgba(6,2,0,${Math.min(.93,p*1.35)})`;tc.fillRect(0,0,W,H);petals.forEach(pt=>{pt.x+=pt.vx;pt.y+=pt.vy;tc.fillStyle=`rgba(240,150,160,${0.5*(1-p*.7)})`;tc.beginPath();tc.ellipse(pt.x,pt.y,4,2.5,p*4,0,Math.PI*2);tc.fill();});if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  vault(cb) {
    // Fallout: vault door iris-close
    let p=0,called=false;
    const go=()=>{p+=.02;tc.fillStyle=`rgba(6,8,0,${Math.min(.94,p*1.3)})`;tc.fillRect(0,0,W,H);const r=Math.max(0,Math.min(W,H)*0.6*(1-p*1.4));if(r>0){tc.save();tc.globalCompositeOperation='destination-out';tc.beginPath();tc.arc(W/2,H/2,r,0,Math.PI*2);tc.fill();tc.restore();}if(shouldDrawGlow()){tc.strokeStyle=`rgba(136,200,0,${0.3*(1-p)})`;tc.lineWidth=3;tc.beginPath();tc.arc(W/2,H/2,r+4,0,Math.PI*2);tc.stroke();}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);  },
  // Rick and Morty: portal spin
  portal(cb) {
    let p=0,called=false,angle=0;
    const go=()=>{p+=.018;angle+=.15;tc.fillStyle=`rgba(2,10,0,${Math.min(.93,p*1.3)})`;tc.fillRect(0,0,W,H);const r=Math.max(0,(1-p*1.3)*Math.min(W,H)*0.35);if(r>4){for(let i=0;i<4;i++){tc.strokeStyle=`rgba(0,255,136,${0.35-i*.07})`;tc.lineWidth=3-i*.5;tc.save();tc.translate(W/2,H/2);tc.rotate(angle*(i%2===0?1:-1));tc.beginPath();tc.arc(0,0,r+i*14,0,Math.PI*2);tc.stroke();tc.restore();}}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  // Family Guy: quick iris out (Quahog style)
  quahog(cb) {
    let p=0,called=false;
    const go=()=>{p+=.022;tc.fillStyle=`rgba(8,3,0,${Math.min(.93,p*1.35)})`;tc.fillRect(0,0,W,H);const r=Math.max(0,(1-p*1.4)*Math.min(W,H)*0.5);if(r>2){tc.save();tc.globalCompositeOperation='destination-out';tc.beginPath();tc.arc(W/2,H/2,r,0,Math.PI*2);tc.fill();tc.restore();}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  // South Park: blizzard white-out
  blizzard(cb) {
    let p=0,called=false;
    const go=()=>{p+=.018;tc.fillStyle=`rgba(200,220,255,${Math.min(.06,p*.08)})`;tc.fillRect(0,0,W,H);tc.fillStyle=`rgba(0,8,20,${Math.min(.93,p*1.3)})`;tc.fillRect(0,0,W,H);if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  // Simpsons: couch zoom
  couch(cb) {
    let p=0,called=false;
    const go=()=>{p+=.02;const s=1+p*.5;tc.clearRect(0,0,W,H);tc.fillStyle=`rgba(0,14,26,${Math.min(.93,p*1.3)})`;tc.fillRect(0,0,W,H);tc.save();tc.translate(W/2,H/2);tc.scale(s,s);tc.fillStyle=`rgba(255,220,0,${Math.max(0,.12-p*.12)})`;tc.beginPath();tc.arc(0,0,60,0,Math.PI*2);tc.fill();tc.restore();if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  fargoSnow(cb) {
    let p=0,called=false;const flakes=[...Array(80)].map(()=>({x:rnd(W),y:rnd(H),vy:1+rnd(2),vx:rndpm(.5),r:rnd(2)+1}));
    const go=()=>{p+=.014;tc.fillStyle=`rgba(235,240,250,${Math.min(.9,p*1.3)})`;tc.fillRect(0,0,W,H);flakes.forEach(f=>{f.y+=f.vy;f.x+=f.vx;tc.beginPath();tc.arc(f.x,f.y,f.r,0,Math.PI*2);tc.fillStyle='rgba(255,255,255,.9)';tc.fill();});if(p>.4){const r=Math.min(30,(p-.4)*90);tc.beginPath();tc.arc(W*.5,H*.55,r,0,Math.PI*2);tc.fillStyle='rgba(140,0,0,.85)';tc.fill();}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  madmenStatic(cb) {
    let p=0,called=false;
    const go=()=>{p+=.02;tc.clearRect(0,0,W,H);for(let y=0;y<H;y+=2){const n=Math.random();tc.fillStyle=`rgba(${200+n*40|0},${170+n*30|0},${100+n*20|0},${.5*(1-p)})`;tc.fillRect(0,y,W,1);}tc.fillStyle=`rgba(20,12,2,${Math.min(.9,p*1.3)})`;tc.fillRect(0,0,W,H);if(!called&&p>=.52){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  flatcircle(cb) {
    let p=0,called=false;
    const go=()=>{p+=.012;tc.fillStyle='rgba(6,10,4,.12)';tc.fillRect(0,0,W,H);tc.save();tc.translate(W*.5,H*.5);const mx=Math.sqrt(W*W+H*H)*.5;for(let r=mx*(1-Math.min(1,p*1.7));r>4;r-=3){const a=r*.05+p*5;tc.beginPath();tc.arc(Math.cos(a)*r*.01,Math.sin(a)*r*.01,r,0,Math.PI*2);tc.strokeStyle='hsla(85,40%,35%,.03)';tc.lineWidth=1.4;tc.stroke();}tc.restore();if(!called&&p>=.55){called=true;cb();}p<1.15?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  radglow(cb) {
    let p=0,called=false;let flash=0;const dots=[...Array(24)].map(()=>({x:rnd(W),y:rnd(H)}));
    const go=()=>{p+=.02;flash=Math.sin(p*Math.PI*10)>.5?1:0;tc.fillStyle=`rgba(3,10,4,${Math.min(.93,p*1.3)})`;tc.fillRect(0,0,W,H);dots.forEach(d=>{if(Math.random()<.3*p){tc.beginPath();tc.arc(d.x,d.y,2,0,Math.PI*2);tc.fillStyle=`rgba(140,255,0,${.6*Math.random()})`;tc.fill();}});if(flash&&p<.5){tc.fillStyle=`rgba(120,255,60,${.06*Math.min(1,p*3)})`;tc.fillRect(0,0,W,H);}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  curtain(cb) {
    let p=0,called=false;
    const go=()=>{p+=.02;tc.clearRect(0,0,W,H);const cov=Math.min(1,p*1.8)*W*.52;tc.fillStyle='rgba(70,4,4,.97)';tc.fillRect(0,0,cov,H);tc.fillRect(W-cov,0,cov,H);if(!called&&p>=.52){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  budapestZoom(cb) {
    let p=0,called=false;
    const go=()=>{p+=.02;tc.fillStyle=`rgba(30,10,20,${Math.min(.9,p*1.3)})`;tc.fillRect(0,0,W,H);const r=Math.max(0,(1-p*1.5)*Math.min(W,H)*.55);if(r>2){tc.save();tc.globalCompositeOperation='destination-out';tc.beginPath();tc.arc(W/2,H/2,r,0,Math.PI*2);tc.fill();tc.restore();}tc.strokeStyle=`rgba(233,147,168,${.5*(1-p)})`;tc.lineWidth=3;tc.beginPath();tc.arc(W/2,H/2,r,0,Math.PI*2);tc.stroke();if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  cymbal(cb) {
    let p=0,called=false;
    const go=()=>{p+=.03;const strobe=Math.sin(p*Math.PI*14)>.2?1:0;tc.fillStyle=strobe?`rgba(200,10,20,${.5*Math.min(1,p*2)})`:`rgba(5,0,0,${Math.min(.9,p*1.3)})`;tc.fillRect(0,0,W,H);if(!called&&p>=.5){called=true;cb();}p<1.0?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  batsignal(cb) {
    let p=0,called=false;
    const go=()=>{p+=.016;tc.fillStyle=`rgba(2,2,4,${Math.min(.94,p*1.3)})`;tc.fillRect(0,0,W,H);const ang=-1.2+p*1.6;tc.save();tc.translate(W*.5,H*1.1);tc.rotate(ang);const bg=tc.createLinearGradient(0,0,0,-H*1.3);bg.addColorStop(0,`rgba(180,20,20,${.16*(1-p*.6)})`);bg.addColorStop(1,'transparent');tc.fillStyle=bg;tc.beginPath();tc.moveTo(0,0);tc.lineTo(-W*.18,-H*1.3);tc.lineTo(W*.18,-H*1.3);tc.closePath();tc.fill();tc.restore();if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  goldflash(cb) {
    let p=0,called=false;const streaks=[...Array(16)].map(()=>({a:rnd(Math.PI*2),len:0}));
    const go=()=>{p+=.02;tc.fillStyle=`rgba(4,2,6,${Math.min(.93,p*1.3)})`;tc.fillRect(0,0,W,H);streaks.forEach(s=>{s.len=p*Math.min(W,H)*.5;const x=W/2+Math.cos(s.a)*s.len,y=H/2+Math.sin(s.a)*s.len;tc.strokeStyle=`rgba(212,175,55,${Math.max(0,.6-p*.6)})`;tc.lineWidth=1.5;tc.beginPath();tc.moveTo(W/2,H/2);tc.lineTo(x,y);tc.stroke();});if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  bebopSmoke(cb) {
    let p=0,called=false;const ws=[...Array(14)].map(()=>({x:rnd(W),y:H*.6+rnd(H*.4),r:rnd(40)+15,vx:rndpm(.25),vy:-(rnd(.35)+.1)}));
    const go=()=>{p+=.012;tc.fillStyle=`rgba(10,5,0,${Math.min(.93,p*1.3)})`;tc.fillRect(0,0,W,H);ws.forEach(w=>{w.x+=w.vx;w.y+=w.vy;w.r+=.4;const wg=tc.createRadialGradient(w.x,w.y,0,w.x,w.y,w.r);wg.addColorStop(0,`rgba(232,120,28,${Math.max(0,.1-p*.05)})`);wg.addColorStop(1,'transparent');tc.fillStyle=wg;tc.fillRect(0,0,W,H);});if(!called&&p>=.54){called=true;cb();}p<1.1?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  ghostrain(cb) {
    let p=0,called=false;const drops=[...Array(90)].map(()=>({x:rnd(W),y:rnd(H*.3),vy:4+rnd(5),hue:Math.random()<.5?180:310}));
    const go=()=>{p+=.014;tc.fillStyle=`rgba(0,3,4,${Math.min(.94,p*1.3)})`;tc.fillRect(0,0,W,H);drops.forEach(d=>{d.y+=d.vy;if(d.y>H+40){d.y=-40;d.x=rnd(W);}tc.strokeStyle=`hsla(${d.hue},95%,55%,${.5*Math.min(1,p*2)})`;tc.lineWidth=1;tc.beginPath();tc.moveTo(d.x,d.y-18);tc.lineTo(d.x,d.y);tc.stroke();});if(!called&&p>=.52){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  comet(cb) {
    let p=0,called=false;
    const go=()=>{p+=.014;tc.fillStyle=`rgba(10,6,22,${Math.min(.9,p*1.3)})`;tc.fillRect(0,0,W,H);const cx2=W*(1-p*1.3),cy2=H*.25+p*H*.3;const tail=tc.createLinearGradient(cx2+W*.3,cy2-H*.15,cx2,cy2);tail.addColorStop(0,'transparent');tail.addColorStop(1,`rgba(255,180,220,${.7*Math.min(1,p*2)})`);tc.strokeStyle=tail;tc.lineWidth=3;tc.beginPath();tc.moveTo(cx2+W*.3,cy2-H*.15);tc.lineTo(cx2,cy2);tc.stroke();tc.beginPath();tc.arc(cx2,cy2,4,0,Math.PI*2);tc.fillStyle='rgba(255,220,240,.9)';tc.fill();if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  vikingmist(cb) {
    let p=0,called=false;const fog=[...Array(10)].map(()=>({x:rnd(W),y:rnd(H),r:rnd(80)+40,vx:rndpm(.2)}));
    const go=()=>{p+=.014;tc.fillStyle=`rgba(4,8,10,${Math.min(.92,p*1.3)})`;tc.fillRect(0,0,W,H);fog.forEach(f=>{f.x+=f.vx;const fg=tc.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r);fg.addColorStop(0,`rgba(140,170,190,${.08*(1-p*.4)})`);fg.addColorStop(1,'transparent');tc.fillStyle=fg;tc.fillRect(0,0,W,H);});if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  cursedburst(cb) {
    let p=0,called=false;
    const go=()=>{p+=.02;tc.fillStyle=`rgba(4,2,10,${Math.min(.94,p*1.4)})`;tc.fillRect(0,0,W,H);for(let i=0;i<3;i++){const r=p*Math.min(W,H)*(0.35+i*.22);const a=Math.max(0,.55-p*.6);tc.strokeStyle=i%2===0?`rgba(122,58,240,${a})`:`rgba(232,232,240,${a*.5})`;tc.lineWidth=1.6;tc.beginPath();tc.arc(W/2,H*.45,r,0,Math.PI*2);tc.stroke();}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  mysteryfog(cb) {
    let p=0,called=false;const fog=[...Array(12)].map(()=>({x:rnd(W),y:rnd(H),r:rnd(60)+30,vx:rndpm(.3),vy:rndpm(.15)}));
    const go=()=>{p+=.013;tc.fillStyle=`rgba(10,6,2,${Math.min(.92,p*1.3)})`;tc.fillRect(0,0,W,H);fog.forEach(f=>{f.x+=f.vx;f.y+=f.vy;const fg=tc.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r);fg.addColorStop(0,`rgba(232,138,42,${.09*(1-p*.4)})`);fg.addColorStop(1,'transparent');tc.fillStyle=fg;tc.fillRect(0,0,W,H);});if(Math.random()<.06){tc.strokeStyle=`rgba(106,58,138,${.4*Math.random()})`;tc.lineWidth=1.5;tc.beginPath();tc.moveTo(W*.5,H*.3);tc.lineTo(W*.42,H*.55);tc.lineTo(W*.58,H*.55);tc.closePath();tc.stroke();}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  candyswirl(cb) {
    let p=0,called=false;
    const go=()=>{p+=.016;tc.fillStyle=`rgba(2,14,12,${Math.min(.92,p*1.3)})`;tc.fillRect(0,0,W,H);tc.save();tc.translate(W*.5,H*.5);for(let i=0;i<5;i++){const a=i/5*Math.PI*2+p*4;tc.rotate(a*.15);tc.beginPath();tc.arc(0,0,p*Math.min(W,H)*.4,a,a+.6);tc.strokeStyle=i%2===0?`rgba(74,224,192,${.5*(1-p)})`:`rgba(255,106,176,${.5*(1-p)})`;tc.lineWidth=6;tc.stroke();}tc.restore();if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  halftone(cb) {
    let p=0,called=false;const dots=[...Array(120)].map(()=>({x:rnd(W),y:rnd(H),r:rnd(6)+2,hue:Math.random()<.5?330:200}));
    const go=()=>{p+=.02;tc.fillStyle=`rgba(6,2,10,${Math.min(.9,p*1.3)})`;tc.fillRect(0,0,W,H);dots.forEach(d=>{if(Math.random()<p){tc.beginPath();tc.arc(d.x,d.y,d.r*p,0,Math.PI*2);tc.fillStyle=`hsla(${d.hue},90%,60%,${.5*p})`;tc.fill();}});if(!called&&p>=.5){called=true;cb();}p<1.0?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  sandrake(cb) {
    let p=0,called=false;
    const go=()=>{p+=.014;tc.fillStyle=`rgba(232,224,204,${Math.min(.94,p*1.3)})`;tc.fillRect(0,0,W,H);tc.strokeStyle=`rgba(140,122,74,${.25*(1-p*.5)})`;tc.lineWidth=1.2;for(let y=0;y<H;y+=10){const off=Math.sin(y*.05+p*6)*8*p;tc.beginPath();tc.moveTo(0,y+off);tc.lineTo(W,y+off);tc.stroke();}if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  windowrain(cb) {
    let p=0,called=false;const drops=[...Array(60)].map(()=>({x:rnd(W),y:rnd(H*.5),vy:2+rnd(3)}));
    const go=()=>{p+=.014;tc.fillStyle=`rgba(14,10,6,${Math.min(.9,p*1.3)})`;tc.fillRect(0,0,W,H);drops.forEach(d=>{d.y+=d.vy;if(d.y>H){d.y=0;d.x=rnd(W);}tc.strokeStyle=`rgba(200,135,58,${.35*Math.min(1,p*2)})`;tc.lineWidth=1;tc.beginPath();tc.moveTo(d.x,d.y-14);tc.lineTo(d.x,d.y);tc.stroke();});if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  vinylspin(cb) {
    let p=0,called=false;let ang=0;
    const go=()=>{p+=.018;ang+=.2;tc.fillStyle=`rgba(10,6,2,${Math.min(.93,p*1.3)})`;tc.fillRect(0,0,W,H);const r=Math.min(W,H)*.32*Math.min(1,p*1.6);tc.save();tc.translate(W/2,H/2);tc.rotate(ang);tc.strokeStyle=`rgba(212,146,58,${.4*(1-p*.4)})`;tc.lineWidth=1.5;for(let i=1;i<=4;i++){tc.beginPath();tc.arc(0,0,r*i/4,0,Math.PI*2);tc.stroke();}tc.restore();if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  pageturn(cb) {
    let p=0,called=false;
    const go=()=>{p+=.02;tc.fillStyle=`rgba(6,4,2,${Math.min(.93,p*1.3)})`;tc.fillRect(0,0,W,H);const x=W*(1-Math.min(1,p*1.6));const pg=tc.createLinearGradient(x-40,0,x+40,0);pg.addColorStop(0,'transparent');pg.addColorStop(.5,`rgba(200,160,80,${.3*(1-p*.5)})`);pg.addColorStop(1,'transparent');tc.fillStyle=pg;tc.fillRect(0,0,W,H);if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  leafgrow(cb) {
    let p=0,called=false;
    const go=()=>{p+=.016;tc.fillStyle=`rgba(2,10,4,${Math.min(.9,p*1.3)})`;tc.fillRect(0,0,W,H);const h=Math.min(1,p*1.6)*H;const lg=tc.createLinearGradient(0,H,0,H-h);lg.addColorStop(0,'rgba(90,201,106,.5)');lg.addColorStop(1,'rgba(20,60,20,0)');tc.fillStyle=lg;tc.fillRect(0,H-h,W,h);if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  lavablob(cb) {
    let p=0,called=false;const blobs=[...Array(6)].map(()=>({x:rnd(W),y:rnd(H),r:rnd(30)+20,vx:rndpm(.3),vy:rndpm(.3)}));
    const go=()=>{p+=.016;tc.fillStyle=`rgba(10,4,16,${Math.min(.92,p*1.3)})`;tc.fillRect(0,0,W,H);blobs.forEach((b,i)=>{b.x+=b.vx;b.y+=b.vy;b.r=Math.min(b.r+.6,90);const bg=tc.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r);bg.addColorStop(0,i%2===0?`rgba(255,106,42,${.35*(1-p*.4)})`:`rgba(168,58,240,${.3*(1-p*.4)})`);bg.addColorStop(1,'transparent');tc.fillStyle=bg;tc.fillRect(0,0,W,H);});if(!called&&p>=.55){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  // Lanterns — a power ring charging up: a bright green ring contracts
  // inward while a faint construct-lattice sweeps past behind it.
  ringcharge(cb) {
    let p=0,called=false;
    const go=()=>{p+=.017;tc.fillStyle=`rgba(1,8,5,${Math.min(.94,p*1.3)})`;tc.fillRect(0,0,W,H);const R=Math.min(W,H)*.42*(1-Math.min(1,p*1.5));tc.save();tc.translate(W*.5,H*.5);tc.beginPath();tc.arc(0,0,Math.max(2,R),0,Math.PI*2);tc.strokeStyle=`rgba(0,232,122,${.85*(1-p*.3)})`;tc.lineWidth=4;tc.shadowColor='rgba(0,232,122,.9)';tc.shadowBlur=18;tc.stroke();tc.shadowBlur=0;for(let i=0;i<6;i++){const a=i/6*Math.PI*2+p*3;tc.beginPath();tc.moveTo(Math.cos(a)*R*.5,Math.sin(a)*R*.5);tc.lineTo(Math.cos(a)*R,Math.sin(a)*R);tc.strokeStyle=`rgba(0,232,122,${.3*(1-p)})`;tc.lineWidth=1;tc.stroke();}tc.restore();if(!called&&p>=.52){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
  // YOU — a slow, quiet iris-close, like being watched through a narrowing
  // gap; deliberately understated rather than flashy, to match the show's tone.
  whisperfade(cb) {
    let p=0,called=false;
    const go=()=>{p+=.011;const R=Math.sqrt(W*W+H*H)*.6*(1-easeIO(Math.min(1,p*1.3)));tc.clearRect(0,0,W,H);tc.fillStyle='rgba(2,2,2,.97)';tc.beginPath();tc.rect(0,0,W,H);tc.arc(W*.5,H*.5,Math.max(0,R),0,Math.PI*2,true);tc.fill('evenodd');if(!called&&p>=.5){called=true;cb();}p<1.05?requestAnimationFrame(go):finishTrans();};requestAnimationFrame(go);
  },
};
