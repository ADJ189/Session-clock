// ── Performance & Adaptive Quality System ────────────────────────────
// Detects device capability at startup and adapts rendering quality.
// Tiers: LOW (weak device) | MED (average) | HIGH (powerful)
// Can be overridden by user in settings.

export type QualityTier = 'low' | 'med' | 'high';

let tier: QualityTier = 'high';
let frameCount = 0;
let fps = 60;
let lastFpsTs = performance.now();
let frameTimes: number[] = [];
let tabVisible = true;

// ── Tier detection ────────────────────────────────────────────────────
function detectTier(): QualityTier {
  // Check localStorage override first
  const override = localStorage.getItem('sc_quality') as QualityTier | null;
  if (override === 'low' || override === 'med' || override === 'high') return override;

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };

  // Signals: RAM, CPU cores, connection, device pixel ratio
  const ram   = nav.deviceMemory ?? 4;          // GB; undefined = assume 4
  const cores = nav.hardwareConcurrency ?? 4;
  const conn  = (navigator as any).connection?.effectiveType ?? '4g';
  const dpr   = window.devicePixelRatio ?? 1;
  const touch = navigator.maxTouchPoints > 0;   // mobile proxy

  let score = 0;
  if (ram >= 8)    score += 2; else if (ram >= 4) score += 1;
  if (cores >= 8)  score += 2; else if (cores >= 4) score += 1;
  if (conn === '4g' || conn === 'wifi') score += 1;
  if (dpr <= 1.5)  score += 1; // high-DPR = mobile = less GPU budget
  if (touch)       score -= 1; // mobile proxy

  if (score >= 5) return 'high';
  if (score >= 3) return 'med';
  return 'low';
}

export function initPerf(): QualityTier {
  tier = detectTier();
  setupVisibilityAPI();
  return tier;
}

export function getTier(): QualityTier { return tier; }
export function setTier(t: QualityTier) { tier = t; localStorage.setItem('sc_quality', t); }
export function isTabVisible() { return tabVisible; }

// ── Frame rate adaptation ─────────────────────────────────────────────
// Called every frame. Returns true if this frame should do expensive work.
let frameSkipCounter = 0;
export function shouldRenderFull(): boolean {
  if (!tabVisible) return false;
  frameSkipCounter++;
  if (tier === 'high') return true;
  if (tier === 'med')  return frameSkipCounter % 2 === 0; // 30fps for expensive ops
  return frameSkipCounter % 3 === 0;                      // 20fps on LOW
}

// Separate skip for audio analysis (slightly less aggressive)
export function shouldSampleAudio(): boolean {
  if (!tabVisible) return false;
  if (tier === 'high') return true;
  return frameSkipCounter % 2 === 0;
}

// ── FPS tracking ──────────────────────────────────────────────────────
export function tickFps(now: number): number {
  frameCount++;
  frameTimes.push(now);
  // Keep last 60 samples
  if (frameTimes.length > 60) frameTimes.shift();
  if (now - lastFpsTs >= 2000) {
    const span = frameTimes[frameTimes.length - 1]! - frameTimes[0]!;
    fps = span > 0 ? Math.round(frameTimes.length / (span / 1000)) : 60;
    lastFpsTs = now;
    // Auto-downgrade if sustained low FPS
    if (fps < 24 && tier === 'high') { tier = 'med'; }
    else if (fps < 16 && tier === 'med') { tier = 'low'; }
    // Auto-upgrade if FPS recovered (hysteresis: 5s at good FPS)
    else if (fps > 55 && tier === 'low' && frameCount > 300) { tier = 'med'; }
  }
  return fps;
}

export function getFps() { return fps; }

// ── Visibility API ────────────────────────────────────────────────────
function setupVisibilityAPI() {
  document.addEventListener('visibilitychange', () => {
    tabVisible = !document.hidden;
  });
}

// ── Quality-gated canvas helpers ──────────────────────────────────────
// Max particles per tier
export function maxParticles(base: number): number {
  if (tier === 'high') return base;
  if (tier === 'med')  return Math.round(base * 0.55);
  return Math.round(base * 0.25);
}

// Should draw expensive backdrop (radial gradients etc)?
export function shouldDrawGlow(): boolean {
  return tier !== 'low';
}

// Particle update step multiplier — LOW skips physics frames
export function particleStepSize(): number {
  return tier === 'low' ? 3 : tier === 'med' ? 2 : 1;
}
