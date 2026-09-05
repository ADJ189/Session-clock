// ── Platform & capability detection ─────────────────────────────────────
// One place to answer "what device/browser is this" and "can I actually
// use X here" so the rest of the app doesn't scatter UA sniffing or
// half-guarded feature calls across a dozen files. Applied once at boot
// as classes on <html> so CSS can react with zero JS in the render path;
// JS call sites use the exported CAPS/helpers instead of re-detecting.

export type OSFamily = 'ios' | 'ipados' | 'android' | 'macos' | 'windows' | 'linux' | 'other';
export type Engine = 'webkit' | 'blink' | 'gecko' | 'other';
export type Browser = 'safari' | 'chrome' | 'edge' | 'samsung' | 'opera' | 'firefox' | 'other';

function detectOS(): OSFamily {
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';
  // iPadOS 13+ identifies as "MacIntel" with no "iPad" in the UA string —
  // the only reliable tell left is a Mac platform that also reports touch.
  if (platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ipados';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Mac/.test(platform)) return 'macos';
  if (/Win/.test(platform)) return 'windows';
  if (/Linux/.test(platform)) return 'linux';
  return 'other';
}

function detectEngine(): Engine {
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return 'gecko';
  // Chrome/Edge/Opera/Samsung Internet UAs all also contain "Safari", so
  // Blink has to be checked before WebKit or every Chromium browser on iOS
  // (which itself is *forced* to use WebKit under the hood, App Store rule)
  // would misreport. On iOS this correctly still resolves to 'webkit'.
  if (/CriOS\/|Chrome\/|Chromium\/|Edg\/|OPR\/|SamsungBrowser\//.test(ua)) return 'blink';
  if (/Safari\//.test(ua) || /AppleWebKit\//.test(ua)) return 'webkit';
  return 'other';
}

// Distinct from Engine: several browsers share Blink/WebKit but still have
// their own UI chrome, update cadence and occasional per-browser bugs (e.g.
// Samsung Internet's own dark-mode auto-invert, Firefox Android's address
// bar behaving differently from desktop). Ordered so the more specific UA
// token is checked before the generic engine name it also contains.
function detectBrowser(): Browser {
  const ua = navigator.userAgent;
  if (/SamsungBrowser\//.test(ua)) return 'samsung';
  if (/Edg\//.test(ua)) return 'edge';
  if (/OPR\/|Opera/.test(ua)) return 'opera';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/CriOS\/|Chrome\/|Chromium\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua)) return 'safari';
  return 'other';
}

export const OS: OSFamily = detectOS();
export const ENGINE: Engine = detectEngine();
export const BROWSER: Browser = detectBrowser();
export const IS_APPLE = OS === 'ios' || OS === 'ipados' || OS === 'macos';
export const IS_TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
export const IS_STANDALONE =
  matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

/** Real feature probes (not UA sniffing) for the handful of CSS/JS features
 * that still vary enough across engines/versions to need a JS-level check
 * and a fallback path, rather than trusting a blanket "modern browser"
 * assumption. */
function detectFeatureFlags() {
  let backdropFilter = false;
  let dvh = false;
  try {
    backdropFilter = CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
  } catch { /* CSS.supports itself is missing on some very old engines */ }
  try {
    dvh = CSS.supports('height', '100dvh');
  } catch { /* same */ }
  return {
    backdropFilter,
    dvh,
    requestIdleCallback: 'requestIdleCallback' in window,
    hasSafeArea: CSS.supports?.('padding: env(safe-area-inset-top)') ?? false,
  };
}
export const FEATURES = detectFeatureFlags();

export const CAPS = {
  // Vibration API — Android Chrome/Firefox support it; iOS Safari (and thus
  // every browser on iOS, since they all run on WebKit) never has, by policy.
  vibration: 'vibrate' in navigator,
  // Document Picture-in-Picture — Chromium only. Used for the mini-clock
  // and music-dock pop-out; both already degrade gracefully, this just
  // lets CSS hide the trigger entirely instead of showing a dead button.
  documentPiP: 'documentPictureInPicture' in window,
  deviceOrientation: 'DeviceOrientationEvent' in window,
  deviceOrientationNeedsPermission:
    typeof (window as any).DeviceOrientationEvent?.requestPermission === 'function',
  webShare: typeof navigator.share === 'function',
};

/** Sets classes on <html> once at boot — call as early as possible. */
export function applyPlatformClasses(): void {
  const cl = document.documentElement.classList;
  cl.add(`platform-${OS}`, `engine-${ENGINE}`, `browser-${BROWSER}`);
  cl.toggle('is-apple', IS_APPLE);
  cl.toggle('is-touch', IS_TOUCH);
  cl.toggle('is-standalone', IS_STANDALONE);
  cl.toggle('no-vibration', !CAPS.vibration);
  cl.toggle('no-doc-pip', !CAPS.documentPiP);
  cl.toggle('no-backdrop-filter', !FEATURES.backdropFilter);
  cl.toggle('no-dvh', !FEATURES.dvh);
}

/** Small, human-readable summary for a Settings/diagnostics panel — lets
 * someone reporting a rendering bug see exactly what Session Clock detected
 * about their browser instead of guessing from a screenshot. */
export function platformSummary(): { label: string; value: string }[] {
  return [
    { label: 'OS',              value: OS },
    { label: 'Engine',          value: ENGINE },
    { label: 'Browser',         value: BROWSER },
    { label: 'Standalone/PWA',  value: IS_STANDALONE ? 'Yes' : 'No' },
    { label: 'Touch input',     value: IS_TOUCH ? 'Yes' : 'No' },
    { label: 'Backdrop blur',   value: FEATURES.backdropFilter ? 'Supported' : 'Unsupported (fallback active)' },
    { label: 'Dynamic viewport',value: FEATURES.dvh ? 'Supported' : 'Unsupported (100vh fallback)' },
    { label: 'Haptics',         value: CAPS.vibration ? 'Supported' : 'Unsupported (WebKit/iOS has none)' },
  ];
}

/**
 * Light haptic tick for meaningful moments (session start/complete, a
 * milestone, a mode switch). Silently no-ops anywhere the Vibration API
 * doesn't exist — notably all of iOS/iPadOS/macOS Safari — and respects
 * its own opt-out so it stays in line with the app's "opt-in rather than
 * always-on" stance rather than just following the OS default.
 */
export function haptic(pattern: number | number[] = 12): void {
  if (!CAPS.vibration) return;
  if (localStorage.getItem('sc_haptics') === '0') return;
  try { navigator.vibrate(pattern); } catch { /* some browsers throw outside a user gesture */ }
}

// ── Global tap haptics ───────────────────────────────────────────────
// Vibration API note: this is Android-only by platform design — no iOS
// browser engine (WebKit) has ever exposed navigator.vibrate, in Safari
// or in any other iOS browser, standalone PWA or not, since they're all
// required to run on WebKit. There is no web API workaround; genuine iOS
// haptics (UIImpactFeedbackGenerator) only exist behind a native shell
// (e.g. Capacitor's Haptics plugin or a Tauri iOS build), which this repo
// doesn't have. CAPS.vibration is false on iOS, so haptic() already
// silently no-ops there — this delegate just rides the same guard so
// Android gets full coverage for free without misleading iOS.
//
// Rather than hand-wiring haptic() into every button/toggle/slider call
// site individually (easy to miss new ones), one delegated listener on
// <html> covers the whole app: any tap on an interactive control gets a
// light tick, any drag-grab of a slider gets one too. Call once at boot.
const HAPTIC_TAP_SELECTOR = [
  'button', '.btn', '.scene-btn', '.pill', '.pill-group button',
  '.track-toggle', '.mixer-night-toggle', '.modal-close', '.theme-card',
  '.tab-btn', '.kb-item', '.sc-tab', '[role="button"]', '.saved-theme-chip',
  'input[type="range"]', 'input[type="checkbox"]',
].join(', ');

let globalHapticsBound = false;
export function bindGlobalHaptics(): void {
  if (globalHapticsBound || !CAPS.vibration) return;
  globalHapticsBound = true;
  document.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target || !target.closest) return;
    const el = target.closest<HTMLElement>(HAPTIC_TAP_SELECTOR);
    if (!el || (el as HTMLButtonElement).disabled) return;
    haptic(6);
  }, { passive: true, capture: true });
}

let motionGranted = !CAPS.deviceOrientationNeedsPermission;
/**
 * Must be called from inside a user gesture (a click handler) on iOS —
 * the OS silently ignores the permission prompt otherwise. Returns true
 * once orientation events are safe to rely on; false if unsupported or
 * declined, letting the caller fall back to mouse-only behaviour.
 */
export async function requestMotionPermission(): Promise<boolean> {
  if (!CAPS.deviceOrientation) return false;
  if (motionGranted) return true;
  try {
    const result = await (window as any).DeviceOrientationEvent.requestPermission();
    motionGranted = result === 'granted';
  } catch {
    motionGranted = false;
  }
  return motionGranted;
}

// ── Shared device-orientation subscription ───────────────────────────
// Both the background parallax effect and head-tracked spatial audio
// need live gyroscope readings. Rather than each feature attaching its
// own 'deviceorientation' listener (duplicate work on every device tilt,
// and duplicate iOS-permission bookkeeping), they subscribe here — the
// real browser listener is attached lazily, once, on first subscriber.
export interface OrientationSample { alpha: number | null; beta: number | null; gamma: number | null; }
type OrientationCB = (o: OrientationSample) => void;
const orientationSubs = new Set<OrientationCB>();
let orientationAttached = false;
function attachOrientationListener(): void {
  if (orientationAttached || !CAPS.deviceOrientation) return;
  orientationAttached = true;
  window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
    if (orientationSubs.size === 0) return;
    const sample: OrientationSample = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
    orientationSubs.forEach(cb => cb(sample));
  });
}
/**
 * Subscribe to raw device-orientation samples. Caller must have already
 * obtained permission via requestMotionPermission() where required (iOS).
 * Returns an unsubscribe function.
 */
export function subscribeOrientation(cb: OrientationCB): () => void {
  attachOrientationListener();
  orientationSubs.add(cb);
  return () => orientationSubs.delete(cb);
}
