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
function reducedMotion(): boolean {
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

