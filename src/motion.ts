// ── Micro-interactions (anime.js) ───────────────────────────────────────
// A handful of small, tasteful motion touches layered on top of the
// existing CSS spring transitions — never replacing them. anime.js is
// dynamically imported on first use so its ~8kB never sits in the
// critical-path bundle for people who never trigger one of these moments.
// Every export is safe to call even if the import fails (offline, blocked
// CDN, etc.) — animation is decorative and must never block the real UI
// action it's attached to.

type AnimateFn = typeof import('animejs')['animate'];
type StaggerFn = typeof import('animejs')['stagger'];

let _animate: AnimateFn | null = null;
let _stagger: StaggerFn | null = null;
let _loading: Promise<void> | null = null;

function ensureAnime(): Promise<void> {
  if (_animate) return Promise.resolve();
  if (_loading) return _loading;
  _loading = import('animejs')
    .then(mod => { _animate = mod.animate; _stagger = mod.stagger; })
    .catch(() => { /* animations are optional — fail silently */ });
  return _loading;
}

/** Mirrors the app's own reduce-motion setting (Settings toggle + OS preference). */
export function reducedMotion(): boolean {
  return localStorage.getItem('sc_reduce_motion') === '1' ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** Elastic "pop" — used when a theme swatch/card becomes the active one. */
export async function popIn(el: Element | null | undefined): Promise<void> {
  if (!el || reducedMotion()) return;
  await ensureAnime();
  if (!_animate) return;
  _animate(el, {
    scale: [0.86, 1],
    duration: 560,
    ease: 'outElastic(1, .6)',
  });
}

/** Staggered fade + rise — used when a settings pane / modal body is rebuilt. */
export async function staggerIn(container: Element | null | undefined, selector: string): Promise<void> {
  if (!container || reducedMotion()) return;
  await ensureAnime();
  if (!_animate || !_stagger) return;
  const items = container.querySelectorAll(selector);
  if (!items.length) return;
  _animate(items, {
    opacity: [0, 1],
    translateY: [10, 0],
    delay: _stagger(26, { start: 30 }),
    duration: 360,
    ease: 'outQuad',
  });
}

/** Soft spring bounce — used for toast entrances. */
export async function bounceIn(el: Element | null | undefined): Promise<void> {
  if (!el || reducedMotion()) return;
  await ensureAnime();
  if (!_animate) return;
  _animate(el, {
    translateY: [16, 0],
    scale: [0.94, 1],
    duration: 480,
    ease: 'outBack(1.4)',
  });
}

/**
 * Splash-screen exit — a calmer, more deliberate dismissal than a flat
 * opacity fade: the mark eases up and out while the whole screen
 * scales down a hair and softens, Apple-style. Falls back to the plain
 * CSS opacity transition already on #splashScreen (via splash-hide) if
 * anime.js fails to load or reduce-motion is on — this only enhances it.
 */
export async function splashExit(screenEl: Element | null | undefined, markEl: Element | null | undefined): Promise<void> {
  if (!screenEl || reducedMotion()) return;
  await ensureAnime();
  if (!_animate) return;
  // Hand full control to anime.js — avoid the CSS opacity transition on
  // #splashScreen (from .splash-hide) fighting this JS-driven one.
  (screenEl as HTMLElement).style.transition = 'none';
  if (markEl) {
    _animate(markEl, {
      translateY: [0, -14],
      scale: [1, 0.92],
      opacity: [1, 0],
      duration: 420,
      ease: 'inQuad',
    });
  }
  _animate(screenEl, {
    scale: [1, 1.04],
    filter: ['blur(0px)', 'blur(6px)'],
    opacity: [1, 0],
    duration: 460,
    delay: 60,
    ease: 'outQuad',
  });
}

/**
 * GitHub "star us" celebration — fired once when the star-support modal
 * opens. Two anime.js-driven touches, layered on top of the existing
 * canvas confetti (`Easter.fireConfetti`), which is left untouched:
 *  1. The avatar ring draws itself in (stroke-dashoffset sweep).
 *  2. A dozen small star shapes burst outward from the avatar and tumble
 *     away, fading out — a nod to "starring" the repo, distinct from the
 *     generic confetti rectangles used elsewhere in the app.
 * Both are skipped entirely under reduce-motion, same as every other
 * Motion export.
 */
export async function githubCelebration(anchorEl: Element | null | undefined): Promise<void> {
  if (!anchorEl || reducedMotion()) return;
  await ensureAnime();
  if (!_animate || !_stagger) return;

  // 1. Avatar ring sweep
  const ring = document.querySelector<SVGCircleElement>('.gh-avatar-ring circle');
  if (ring) {
    const len = ring.getTotalLength ? ring.getTotalLength() : 289; // r=46 circumference fallback
    ring.style.strokeDasharray = `${len}`;
    ring.style.strokeDashoffset = `${len}`;
    _animate(ring, {
      strokeDashoffset: [len, 0],
      duration: 900,
      delay: 120,
      ease: 'outCubic',
    });
  }

  // 2. Star burst from the avatar's centre
  const rect = anchorEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const layer = document.createElement('div');
  layer.className = 'gh-star-burst-layer';
  layer.style.cssText = 'position:fixed;inset:0;z-index:9500;pointer-events:none;';
  document.body.appendChild(layer);

  const STAR_PATH = 'M12 2.5l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.7l7.1-.6z';
  const stars: SVGSVGElement[] = [];
  const count = 12;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist = 90 + Math.random() * 70;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', STAR_PATH);
    path.setAttribute('fill', i % 2 === 0 ? '#f8d34a' : '#ffffff');
    svg.appendChild(path);
    svg.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);opacity:0;`;
    (svg as any)._angle = angle; (svg as any)._dist = dist;
    layer.appendChild(svg);
    stars.push(svg);
  }

  _animate(stars, {
    left: (target: unknown) => `${cx + Math.cos((target as any)._angle) * (target as any)._dist}px`,
    top:  (target: unknown) => `${cy + Math.sin((target as any)._angle) * (target as any)._dist}px`,
    opacity: [{ to: 1, duration: 180 }, { to: 0, duration: 500, delay: 500 }],
    rotate: () => (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 180),
    scale: [{ from: 0.3, to: 1.2, duration: 300 }, { to: 0.6, duration: 500 }],
    duration: 1000,
    delay: _stagger(18),
    ease: 'outCubic',
    onComplete: () => layer.remove(),
  });
}


/**
 * Spotlight-style modal pop — blur+scale entrance used by the command
 * palette; reused here for the redone GitHub support box so it reads as
 * one deliberate "surface arriving," Apple-style, instead of individual
 * elements fading up on separate CSS delays. Call once when the overlay
 * gains `.open`; safe to layer on top of the existing CSS keyframes
 * already on the card (they simply run underneath/alongside).
 */
export async function modalSpotlightIn(modalEl: Element | null | undefined): Promise<void> {
  if (!modalEl || reducedMotion()) return;
  await ensureAnime();
  if (!_animate) return;
  _animate(modalEl, {
    scale: [0.92, 1],
    filter: ['blur(6px)', 'blur(0px)'],
    opacity: [0, 1],
    duration: 420,
    ease: 'outCubic',
  });
}

/**
 * Count up a stat number from 0 to a target integer — used for the
 * GitHub support box's live star/fork counts so they feel freshly
 * fetched rather than just appearing. Writes the rounded value into the
 * element's text content on every tick; safe to call with `to: 0`.
 */
export async function countUp(el: Element | null | undefined, to: number): Promise<void> {
  if (!el) return;
  if (reducedMotion()) { el.textContent = String(to); return; }
  await ensureAnime();
  if (!_animate) { el.textContent = String(to); return; }
  const obj = { n: 0 };
  _animate(obj, {
    n: to,
    duration: 900,
    ease: 'outExpo',
    onUpdate: () => { el.textContent = String(Math.round(obj.n)); },
  });
}

/**
 * Press-and-hold-to-confirm for destructive actions — replaces a native
 * confirm() dialog (jarring, and trivially misclicked through) with a
 * deliberate hold gesture: a fill sweeps across the button while held,
 * and only a *completed* hold fires the action. Releasing early cancels
 * cleanly with a quick snap-back. Inspired by Kokonut UI's HoldButton
 * pattern. The hold timing itself is plain rAF, not anime.js — it must
 * keep working even if anime.js never loads; anime.js only adds the
 * spring-eased cancel snap-back. Expects the button to contain a
 * `.hold-confirm-fill` element.
 */
export function bindHoldToConfirm(
  btn: HTMLElement,
  onConfirm: () => void,
  opts: { duration?: number; onStart?: () => void; onCancel?: () => void } = {},
): void {
  const duration = opts.duration ?? 800;
  const fill = btn.querySelector<HTMLElement>('.hold-confirm-fill');
  if (!fill) return;
  let raf = 0, startT = 0, curP = 0, active = false;

  const setFill = (p: number) => { curP = p; fill.style.transform = `scaleX(${Math.max(0, Math.min(1, p))})`; };

  const finish = () => {
    active = false;
    btn.classList.remove('holding');
    btn.classList.add('hold-confirmed');
    setTimeout(() => { btn.classList.remove('hold-confirmed'); setFill(0); }, 300);
    onConfirm();
  };

  const step = (ts: number) => {
    if (!active) return;
    const p = (ts - startT) / duration;
    setFill(p);
    if (p >= 1) { finish(); return; }
    raf = requestAnimationFrame(step);
  };

  const cancel = () => {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    btn.classList.remove('holding');
    const from = curP;
    setFill(0);
    void ensureAnime().then(() => {
      if (!_animate) return;
      _animate(fill, { scaleX: [from, 0], duration: 260, ease: 'outQuad' });
    });
    opts.onCancel?.();
  };

  const start = (e: PointerEvent) => {
    if (active || (btn as HTMLButtonElement).disabled) return;
    e.preventDefault();
    active = true;
    btn.classList.add('holding');
    startT = performance.now();
    opts.onStart?.();
    raf = requestAnimationFrame(step);
  };

  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);
  btn.addEventListener('pointercancel', cancel);
  // Suppress the synthetic click most browsers fire after pointerup so a
  // completed or cancelled hold never *also* triggers a plain onclick
  // handler wired to the same button elsewhere.
  btn.addEventListener('click', (e) => e.preventDefault());
}
