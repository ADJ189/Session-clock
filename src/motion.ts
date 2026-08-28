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

/** Elastic "pop" — used when a theme swatch/card becomes the active one. */
export async function popIn(el: Element | null | undefined): Promise<void> {
  if (!el) return;
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
  if (!container) return;
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
  if (!el) return;
  await ensureAnime();
  if (!_animate) return;
  _animate(el, {
    translateY: [16, 0],
    scale: [0.94, 1],
    duration: 480,
    ease: 'outBack(1.4)',
  });
}
