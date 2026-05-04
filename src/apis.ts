// ── Browser API integrations ──────────────────────────────────────────
// Notifications, MediaSession, Wake Lock, PiP, Web Share, Clipboard, Battery

// ── Notifications ─────────────────────────────────────────────────────
let notifEnabled = false;

export async function requestNotifications(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') { notifEnabled = true; return true; }
  if (Notification.permission === 'denied')  return false;
  const perm = await Notification.requestPermission();
  notifEnabled = perm === 'granted';
  return notifEnabled;
}

export function isNotifEnabled() {
  return notifEnabled && Notification.permission === 'granted';
}

export function sendNotification(title: string, body: string, tag = 'sc') {
  if (!isNotifEnabled()) return;
  const n = new Notification(title, {
    body,
    tag,                          // prevents duplicate stacking
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    silent: false,
    requireInteraction: false,
  });
  // Auto-close after 6 seconds
  setTimeout(() => n.close(), 6000);
}

// ── MediaSession ──────────────────────────────────────────────────────
let _mediaSessionActive = false;
let _onMediaPlay:  (() => void) | null = null;
let _onMediaPause: (() => void) | null = null;
let _onMediaStop:  (() => void) | null = null;

export function setupMediaSession(
  trackName: string,
  onPlay:  () => void,
  onPause: () => void,
  onStop:  () => void,
) {
  if (!('mediaSession' in navigator)) return;
  _onMediaPlay  = onPlay;
  _onMediaPause = onPause;
  _onMediaStop  = onStop;

  navigator.mediaSession.metadata = new MediaMetadata({
    title:  trackName || 'Ambient Sounds',
    artist: 'Session Clock',
    album:  'Focus Mode',
    artwork: [
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
  });

  navigator.mediaSession.setActionHandler('play',  () => { _onMediaPlay?.();  updateMediaState('playing'); });
  navigator.mediaSession.setActionHandler('pause', () => { _onMediaPause?.(); updateMediaState('paused'); });
  navigator.mediaSession.setActionHandler('stop',  () => { _onMediaStop?.();  updateMediaState('none'); });

  _mediaSessionActive = true;
}

export function updateMediaState(state: 'playing' | 'paused' | 'none') {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.playbackState = state;
}

export function updateMediaSessionTrack(name: string) {
  if (!('mediaSession' in navigator) || !_mediaSessionActive) return;
  if (navigator.mediaSession.metadata) {
    navigator.mediaSession.metadata.title = name || 'Ambient Sounds';
  }
}

export function clearMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = 'none';
  _mediaSessionActive = false;
}

// ── Wake Lock ─────────────────────────────────────────────────────────
let wakeLock: WakeLockSentinel | null = null;
let _wakeLockEnabled = localStorage.getItem('sc_wake_lock') === '1';

export function isWakeLockEnabled() { return _wakeLockEnabled; }

export async function setWakeLock(enable: boolean): Promise<void> {
  _wakeLockEnabled = enable;
  localStorage.setItem('sc_wake_lock', enable ? '1' : '0');
  if (enable) {
    await acquireWakeLock();
  } else {
    await releaseWakeLock();
  }
}

export async function acquireWakeLock(): Promise<void> {
  if (!_wakeLockEnabled || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* permission denied or not supported */ }
}

export async function releaseWakeLock(): Promise<void> {
  try { await wakeLock?.release(); } catch {}
  wakeLock = null;
}

// Re-acquire after tab becomes visible (wake lock releases on tab hide)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && _wakeLockEnabled && !wakeLock) {
    acquireWakeLock();
  }
});

// ── Picture-in-Picture ────────────────────────────────────────────────
let _pipWindow: Window | null = null;
let _pipVideo: HTMLVideoElement | null = null;
let _pipCanvas: HTMLCanvasElement | null = null;
let _pipCtx: CanvasRenderingContext2D | null = null;
let _pipRafId = 0;

export function isPiPActive() {
  return _pipWindow !== null || document.pictureInPictureElement !== null;
}

export async function enterPiP(
  clockEl: HTMLElement,
  theme: { accent: string; text: string; baseBg: string[] },
): Promise<void> {
  // Try Document PiP first (Chrome 116+), fall back to canvas→video PiP
  if ('documentPictureInPicture' in window) {
    await enterDocumentPiP(clockEl, theme);
  } else {
    await enterCanvasPiP(theme);
  }
}

async function enterDocumentPiP(
  clockEl: HTMLElement,
  theme: { accent: string; text: string; baseBg: string[] },
): Promise<void> {
  try {
    const api = (window as any).documentPictureInPicture;
    _pipWindow = await api.requestWindow({ width: 320, height: 180 });
    if (!_pipWindow) return;

    // Copy theme CSS variables into PiP window
    const style = _pipWindow.document.createElement('style');
    style.textContent = `
      * { margin:0; padding:0; box-sizing:border-box; }
      body {
        background: ${theme.baseBg[0]};
        display: flex; align-items: center; justify-content: center;
        height: 100vh; overflow: hidden;
        font-family: 'Inter', system-ui, sans-serif;
        --clr-accent: ${theme.accent}; --clr-text: ${theme.text};
      }
      #pip-clock {
        font-size: 3.2rem; font-weight: 900; letter-spacing: -.03em;
        color: ${theme.text}; font-variant-numeric: tabular-nums;
        text-shadow: 0 0 30px ${theme.accent}55;
      }
      #pip-label {
        font-size: .6rem; letter-spacing: .2em; text-transform: uppercase;
        color: ${theme.accent}; opacity: .7; margin-top: 4px; text-align: center;
      }
      #pip-pom {
        font-size: .7rem; color: ${theme.accent}; opacity: .8;
        letter-spacing: .1em; margin-top: 6px; text-align: center;
      }
      .pip-wrap { display:flex; flex-direction:column; align-items:center; }
    `;
    _pipWindow.document.head.appendChild(style);

    const wrap  = _pipWindow.document.createElement('div'); wrap.className = 'pip-wrap';
    const clock = _pipWindow.document.createElement('div'); clock.id = 'pip-clock';
    const label = _pipWindow.document.createElement('div'); label.id = 'pip-label'; label.textContent = 'Session Clock';
    const pom   = _pipWindow.document.createElement('div'); pom.id   = 'pip-pom';
    wrap.append(clock, label, pom);
    _pipWindow.document.body.appendChild(wrap);

    // Drive PiP clock from main window
    function updatePip() {
      if (!_pipWindow || _pipWindow.closed) { cancelAnimationFrame(_pipRafId); _pipWindow = null; return; }
      const t = new Date(); const h = t.getHours() % 12 || 12;
      const m = String(t.getMinutes()).padStart(2,'0');
      const s = String(t.getSeconds()).padStart(2,'0');
      clock.textContent = `${h}:${m}:${s}`;
      // Show Pomodoro timer if running
      const sesEl = document.getElementById('sessionTimer');
      if (sesEl && sesEl.textContent !== '00:00:00') {
        pom.textContent = `⏱ ${sesEl.textContent}`;
      } else {
        pom.textContent = '';
      }
      _pipRafId = requestAnimationFrame(updatePip);
    }
    _pipRafId = requestAnimationFrame(updatePip);

    _pipWindow.addEventListener('pagehide', () => {
      cancelAnimationFrame(_pipRafId); _pipWindow = null;
    });
  } catch (e) {
    // Fall back to canvas PiP
    await enterCanvasPiP(theme);
  }
}

async function enterCanvasPiP(
  theme: { accent: string; text: string; baseBg: string[] },
): Promise<void> {
  // Canvas→MediaStream→Video PiP (works in all browsers)
  _pipCanvas = document.createElement('canvas');
  _pipCanvas.width = 320; _pipCanvas.height = 180;
  _pipCtx = _pipCanvas.getContext('2d')!;

  const stream = _pipCanvas.captureStream(30);
  _pipVideo = document.createElement('video');
  _pipVideo.srcObject = stream;
  _pipVideo.muted = true;
  await _pipVideo.play();

  function drawPip() {
    if (!_pipCtx || !_pipCanvas) return;
    const W = _pipCanvas.width, H = _pipCanvas.height;
    _pipCtx.fillStyle = theme.baseBg[0]; _pipCtx.fillRect(0, 0, W, H);

    const t = new Date(); const h = t.getHours() % 12 || 12;
    const m = String(t.getMinutes()).padStart(2,'0');
    const s = String(t.getSeconds()).padStart(2,'0');
    const timeStr = `${h}:${m}:${s}`;

    _pipCtx.fillStyle = theme.text;
    _pipCtx.font = 'bold 52px Inter, system-ui';
    _pipCtx.textAlign = 'center'; _pipCtx.textBaseline = 'middle';
    _pipCtx.shadowColor = theme.accent; _pipCtx.shadowBlur = 20;
    _pipCtx.fillText(timeStr, W / 2, H / 2 - 10);
    _pipCtx.shadowBlur = 0;

    _pipCtx.font = '11px Inter, system-ui';
    _pipCtx.fillStyle = theme.accent;
    _pipCtx.globalAlpha = 0.65;
    _pipCtx.fillText('SESSION CLOCK', W / 2, H / 2 + 35);
    _pipCtx.globalAlpha = 1;

    const sesEl = document.getElementById('sessionTimer');
    if (sesEl && sesEl.textContent !== '00:00:00') {
      _pipCtx.font = '13px Inter, system-ui';
      _pipCtx.fillStyle = theme.accent;
      _pipCtx.fillText('⏱ ' + sesEl.textContent, W / 2, H / 2 + 54);
    }

    _pipRafId = requestAnimationFrame(drawPip);
  }
  _pipRafId = requestAnimationFrame(drawPip);

  try {
    await _pipVideo.requestPictureInPicture();
    _pipVideo.addEventListener('leavepictureinpicture', () => {
      cancelAnimationFrame(_pipRafId);
      _pipVideo?.remove(); _pipVideo = null;
      _pipCanvas = null; _pipCtx = null;
    });
  } catch {
    cancelAnimationFrame(_pipRafId);
    _pipVideo = null; _pipCanvas = null; _pipCtx = null;
  }
}

export async function exitPiP(): Promise<void> {
  cancelAnimationFrame(_pipRafId);
  if (_pipWindow && !(_pipWindow as any).closed) {
    try { _pipWindow.close(); } catch {}
  }
  _pipWindow = null;
  if (document.pictureInPictureElement) {
    try { await document.exitPictureInPicture(); } catch {}
  }
  _pipVideo = null; _pipCanvas = null; _pipCtx = null;
}

// ── Web Share ─────────────────────────────────────────────────────────
export function canShare() {
  return 'share' in navigator;
}

export async function shareCard(canvas: HTMLCanvasElement, task: string, minutes: number): Promise<boolean> {
  const title = `${minutes}m focused${task ? ` on ${task}` : ''} — Session Clock`;
  const text  = `I just finished a ${minutes}-minute deep focus session${task ? ` on "${task}"` : ''}.`;

  if (canShare()) {
    try {
      // Try sharing as file (mobile)
      const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/png', 0.92));
      const file = new File([blob], 'session-clock-focus.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        return true;
      }
      // Fallback: share URL only
      await navigator.share({ title, text, url: window.location.href });
      return true;
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') throw e;
      return false; // user cancelled
    }
  }
  return false; // not supported
}

// ── Clipboard ─────────────────────────────────────────────────────────
export async function copyCardToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/png', 0.92));
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}

// ── Battery Status ────────────────────────────────────────────────────
let _batteryLevel = 1;
let _onBattery = false;
let _batteryInitialised = false;
type BatteryCb = (level: number, charging: boolean) => void;
let _batteryCb: BatteryCb | null = null;

export function onBatteryChange(cb: BatteryCb) { _batteryCb = cb; }
export function getBatteryLevel() { return _batteryLevel; }
export function isOnBattery() { return _onBattery; }

export async function initBattery(): Promise<void> {
  if (_batteryInitialised || !('getBattery' in navigator)) return;
  _batteryInitialised = true;
  try {
    const bat = await (navigator as any).getBattery();
    const update = () => {
      _batteryLevel = bat.level;
      _onBattery    = !bat.charging;
      _batteryCb?.(_batteryLevel, bat.charging);
    };
    bat.addEventListener('levelchange',   update);
    bat.addEventListener('chargingchange',update);
    update();
  } catch { /* battery API not available */ }
}
