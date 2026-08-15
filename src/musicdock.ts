// ── Music Dock ───────────────────────────────────────────────────────
// Real in-page audio playback + a floating, poppable "dock" UI that
// sits next to the clock. Built on Spotify's official Web Playback
// SDK — the browser tab becomes a real Spotify Connect device, so
// audio plays natively (no iframes, no stream scraping). Requires the
// user to have Spotify Premium and to already be connected via the
// existing PKCE flow in integrations.ts.
//
// Deliberately does NOT attempt YouTube Music audio-only playback.
// YouTube has no official audio-only/PIP-friendly SDK; the only
// ToS-compliant path is the standard IFrame Player API, which YouTube
// requires to stay visible. See nowplaying.ts for why this project
// already treats YouTube Music as "manual now-playing only".
//
// Pops out via the Document Picture-in-Picture API (same API this
// project already uses for the mini clock) so it survives tab
// switches and sits above other windows.

import * as Integrations from './integrations';
import * as Pom from './pomodoro';

let sdkReady: Promise<void> | null = null;
let player: any = null;
let deviceId: string | null = null;
let pipWindow: Window | null = null;
let dockEl: HTMLElement | null = null;
let pollTimer: number | null = null;

interface DockState {
  title: string;
  artist: string;
  artUrl: string;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
}

const state: DockState = { title: '', artist: '', artUrl: '', isPlaying: false, progressMs: 0, durationMs: 0 };

// ─────────────────────────────────────────────────────────────────────
// SDK bootstrap — loads Spotify's script once, resolves when the
// player object is ready to receive a token.
// ─────────────────────────────────────────────────────────────────────
function loadSpotifySdk(): Promise<void> {
  if (sdkReady) return sdkReady;
  sdkReady = new Promise((resolve) => {
    (window as any).onSpotifyWebPlaybackSDKReady = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.async = true;
    document.head.appendChild(s);
  });
  return sdkReady;
}

// Exposed so this stays decoupled from integrations.ts internals — it
// asks for a fresh token the same way the rest of the app does.
async function getSpotifyToken(): Promise<string | null> {
  return Integrations.ensureFreshToken('spotify');
}

/**
 * Call once, after the user has connected Spotify (or on startup if
 * already connected). Safe to call multiple times — no-ops if already
 * initialized or not connected.
 */
export async function initSpotifyPlayback(): Promise<boolean> {
  if (!Integrations.isSpotifyConnected()) return false;
  if (player) return true;

  await loadSpotifySdk();

  player = new (window as any).Spotify.Player({
    name: 'Session Clock',
    getOAuthToken: async (cb: (t: string) => void) => {
      const t = await getSpotifyToken();
      if (t) cb(t);
    },
    volume: 0.7,
  });

  player.addListener('ready', ({ device_id }: { device_id: string }) => { deviceId = device_id; });
  player.addListener('not_ready', () => { deviceId = null; });
  player.addListener('player_state_changed', (s: any) => {
    if (!s) return;
    const track = s.track_window?.current_track;
    state.title = track?.name ?? '';
    state.artist = (track?.artists ?? []).map((a: any) => a.name).join(', ');
    state.artUrl = track?.album?.images?.[0]?.url ?? '';
    state.isPlaying = !s.paused;
    state.progressMs = s.position ?? 0;
    state.durationMs = s.duration ?? 0;
    renderDock();
  });

  const connected = await player.connect();
  return !!connected;
}

async function transferPlaybackHere(): Promise<void> {
  if (!deviceId) return;
  const token = await getSpotifyToken();
  if (!token) return;
  await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play: true }),
  });
}

// ─────────────────────────────────────────────────────────────────────
// Transport controls — thin wrappers so the dock UI stays dumb.
// ─────────────────────────────────────────────────────────────────────
export async function togglePlay(): Promise<void> {
  if (!player) return;
  if (!deviceId) return;
  await player.togglePlay();
}
export async function next(): Promise<void> { if (player) await player.nextTrack(); }
export async function prev(): Promise<void> { if (player) await player.previousTrack(); }
export async function seek(ms: number): Promise<void> { if (player) await player.seek(ms); }

// ─────────────────────────────────────────────────────────────────────
// Focus-session sync — call from pomodoro.ts on phase changes.
// Deliberately opt-in: only acts if the user has connected Spotify AND
// enabled "auto-play with focus sessions" (persisted flag below).
// ─────────────────────────────────────────────────────────────────────
const AUTOSYNC_KEY = 'sc_music_autosync';
export function isAutoSyncEnabled(): boolean { return localStorage.getItem(AUTOSYNC_KEY) === '1'; }
export function setAutoSyncEnabled(v: boolean): void { localStorage.setItem(AUTOSYNC_KEY, v ? '1' : '0'); }

export async function notifyFocusPhase(phase: 'work' | 'break' | 'idle', active: boolean): Promise<void> {
  if (!isAutoSyncEnabled() || !player) return;
  if (phase === 'work' && active) {
    if (!deviceId) return;
    await transferPlaybackHere();
    await player.resume();
  } else if (!active || phase === 'break') {
    await player.pause();
  }
}

// ─────────────────────────────────────────────────────────────────────
// Dock UI — a small draggable card docked near the clock, with an
// optional pop-out into a real OS-level Picture-in-Picture window via
// the Document Picture-in-Picture API (Chromium-based browsers; falls
// back to staying docked everywhere else).
// ─────────────────────────────────────────────────────────────────────
export function mountDock(container: HTMLElement): void {
  dockEl = document.createElement('div');
  dockEl.className = 'sc-music-dock';
  dockEl.innerHTML = dockMarkup();
  container.appendChild(dockEl);
  wireDockEvents(dockEl);
  renderDock();

  if (pollTimer) clearInterval(pollTimer);
  let lastPhase = Pom.getPhase();
  let lastActive = Pom.isActive();
  pollTimer = window.setInterval(() => {
    if (state.isPlaying) { state.progressMs = Math.min(state.progressMs + 1000, state.durationMs); renderDock(); }

    // No event bus in pomodoro.ts — cheap polling here keeps this
    // self-contained instead of threading a dependency through the
    // (very large) main.ts tick loop.
    const phase = Pom.getPhase();
    const active = Pom.isActive();
    if (phase !== lastPhase || active !== lastActive) {
      lastPhase = phase; lastActive = active;
      notifyFocusPhase(phase === 'work' ? 'work' : 'break', active);
    }
  }, 1000);
}

function dockMarkup(): string {
  return `
    <div class="sc-dock-tabs">
      <button data-role="tab-spotify" class="active">Spotify</button>
      <button data-role="tab-youtube">YouTube</button>
    </div>
    <div data-role="pane-spotify" class="sc-dock-pane">
      <div class="sc-dock-row">
        <div class="sc-dock-art" data-role="art"></div>
        <div class="sc-dock-info">
          <div class="sc-dock-title" data-role="title">Not connected</div>
          <div class="sc-dock-artist" data-role="artist">Connect Spotify in settings</div>
          <div class="sc-dock-bar"><div class="sc-dock-bar-fill" data-role="fill"></div></div>
        </div>
        <div class="sc-dock-controls">
          <button data-role="prev" aria-label="Previous">⏮</button>
          <button data-role="play" aria-label="Play/Pause">▶</button>
          <button data-role="next" aria-label="Next">⏭</button>
          <button data-role="autosync" aria-label="Auto-play with focus sessions" title="Auto-play with focus sessions">🔁</button>
          <button data-role="pip" aria-label="Pop out" title="Pop out">⧉</button>
        </div>
      </div>
    </div>
    <div data-role="pane-youtube" class="sc-dock-pane sc-hidden">
      <input data-role="yt-input" class="sc-dock-yt-input" placeholder="Paste a YouTube video or playlist URL" />
      <div data-role="yt-banner" class="sc-dock-yt-banner sc-hidden">
        <div class="sc-dock-yt-art" data-role="yt-art"></div>
        <div class="sc-dock-info">
          <div class="sc-dock-title" data-role="yt-title">—</div>
          <div class="sc-dock-artist" data-role="yt-channel">—</div>
        </div>
        <div class="sc-dock-controls">
          <button data-role="yt-prev" aria-label="Previous">⏮</button>
          <button data-role="yt-play" aria-label="Play/Pause">▶</button>
          <button data-role="yt-next" aria-label="Next">⏭</button>
        </div>
      </div>
      <div data-role="yt-player" class="sc-dock-yt-player"></div>
      <p class="sc-dock-yt-note">Standard YouTube embed — plays via YouTube's own official IFrame Player API, so it stays visible per YouTube's terms. No audio-only or stream-extraction mode is offered here.</p>
    </div>`;
}

let ytApiReady: Promise<void> | null = null;
let ytPlayers = new WeakMap<HTMLElement, any>();

function loadYouTubeIframeApi(): Promise<void> {
  if (ytApiReady) return ytApiReady;
  ytApiReady = new Promise((resolve) => {
    if ((window as any).YT?.Player) { resolve(); return; }
    const prevCb = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => { prevCb?.(); resolve(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return ytApiReady;
}

function extractYouTubeId(url: string): { videoId?: string; listId?: string } {
  try {
    const u = new URL(url);
    const listId = u.searchParams.get('list') ?? undefined;
    const videoId = u.searchParams.get('v') ?? (u.hostname === 'youtu.be' ? u.pathname.slice(1) : undefined);
    return { videoId, listId };
  } catch { return {}; }
}

/** Live YouTube "now playing" info, driven off the official player's own
 *  events — never scraped, never fetched via an unofficial endpoint. */
interface YtNowPlaying { title: string; channel: string; videoId: string; isPlaying: boolean; }
const ytNowPlaying = new WeakMap<HTMLElement, YtNowPlaying>();

function renderYtBanner(root: HTMLElement): void {
  const info = ytNowPlaying.get(root);
  const banner = root.querySelector<HTMLElement>('[data-role="yt-banner"]');
  if (!banner) return;
  if (!info) { banner.classList.add('sc-hidden'); return; }
  banner.classList.remove('sc-hidden');
  const art = banner.querySelector<HTMLElement>('[data-role="yt-art"]');
  const title = banner.querySelector<HTMLElement>('[data-role="yt-title"]');
  const channel = banner.querySelector<HTMLElement>('[data-role="yt-channel"]');
  const playBtn = banner.querySelector<HTMLElement>('[data-role="yt-play"]');
  // hqdefault.jpg is YouTube's own public thumbnail CDN for the video ID —
  // same URL pattern <iframe>/oEmbed markup already exposes, not scraped.
  if (art) art.style.backgroundImage = info.videoId ? `url(https://i.ytimg.com/vi/${info.videoId}/hqdefault.jpg)` : '';
  if (title) title.textContent = info.title || 'Loading…';
  if (channel) channel.textContent = info.channel || '';
  if (playBtn) playBtn.textContent = info.isPlaying ? '⏸' : '▶';
}

async function mountYouTubePlayer(root: HTMLElement, url: string): Promise<void> {
  const target = root.querySelector<HTMLElement>('[data-role="yt-player"]');
  if (!target) return;
  const { videoId, listId } = extractYouTubeId(url);
  if (!videoId && !listId) return;
  await loadYouTubeIframeApi();
  target.innerHTML = '';
  const mount = document.createElement('div');
  target.appendChild(mount);
  const YT = (window as any).YT;
  const player = new YT.Player(mount, {
    height: '100%', width: '100%',
    videoId: listId ? undefined : videoId,
    playerVars: listId ? { listType: 'playlist', list: listId } : {},
    events: {
      onReady: () => {
        const data = player.getVideoData?.() ?? {};
        ytNowPlaying.set(root, { title: data.title ?? '', channel: data.author ?? '', videoId: data.video_id ?? videoId ?? '', isPlaying: false });
        renderYtBanner(root);
      },
      onStateChange: (e: any) => {
        const data = player.getVideoData?.() ?? {};
        const YTState = (window as any).YT.PlayerState;
        ytNowPlaying.set(root, {
          title: data.title ?? '', channel: data.author ?? '', videoId: data.video_id ?? '',
          isPlaying: e.data === YTState.PLAYING,
        });
        renderYtBanner(root);
      },
    },
  });
  ytPlayers.set(root, player);
}

function wireDockEvents(el: HTMLElement): void {
  el.querySelector('[data-role="play"]')?.addEventListener('click', () => togglePlay());
  el.querySelector('[data-role="next"]')?.addEventListener('click', () => next());
  el.querySelector('[data-role="prev"]')?.addEventListener('click', () => prev());
  el.querySelector('[data-role="pip"]')?.addEventListener('click', () => popOut());

  const autosyncBtn = el.querySelector<HTMLElement>('[data-role="autosync"]');
  if (autosyncBtn) {
    autosyncBtn.classList.toggle('active', isAutoSyncEnabled());
    autosyncBtn.addEventListener('click', () => {
      const next = !isAutoSyncEnabled();
      setAutoSyncEnabled(next);
      autosyncBtn.classList.toggle('active', next);
    });
  }

  const tabSpotify = el.querySelector<HTMLElement>('[data-role="tab-spotify"]');
  const tabYoutube = el.querySelector<HTMLElement>('[data-role="tab-youtube"]');
  const paneSpotify = el.querySelector<HTMLElement>('[data-role="pane-spotify"]');
  const paneYoutube = el.querySelector<HTMLElement>('[data-role="pane-youtube"]');
  tabSpotify?.addEventListener('click', () => {
    tabSpotify.classList.add('active'); tabYoutube?.classList.remove('active');
    paneSpotify?.classList.remove('sc-hidden'); paneYoutube?.classList.add('sc-hidden');
  });
  tabYoutube?.addEventListener('click', () => {
    tabYoutube.classList.add('active'); tabSpotify?.classList.remove('active');
    paneYoutube?.classList.remove('sc-hidden'); paneSpotify?.classList.add('sc-hidden');
  });

  const ytInput = el.querySelector<HTMLInputElement>('[data-role="yt-input"]');
  ytInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && ytInput.value.trim()) mountYouTubePlayer(el, ytInput.value.trim());
  });

  el.querySelector('[data-role="yt-play"]')?.addEventListener('click', () => {
    const p = ytPlayers.get(el);
    if (!p?.getPlayerState) return;
    const YTState = (window as any).YT?.PlayerState;
    if (p.getPlayerState() === YTState?.PLAYING) p.pauseVideo(); else p.playVideo();
  });
  el.querySelector('[data-role="yt-next"]')?.addEventListener('click', () => ytPlayers.get(el)?.nextVideo?.());
  el.querySelector('[data-role="yt-prev"]')?.addEventListener('click', () => ytPlayers.get(el)?.previousVideo?.());
}

function renderDock(): void {
  const roots = [dockEl, pipWindow?.document.querySelector('.sc-music-dock') as HTMLElement | null].filter(Boolean) as HTMLElement[];
  for (const root of roots) {
    const art = root.querySelector<HTMLElement>('[data-role="art"]');
    const title = root.querySelector<HTMLElement>('[data-role="title"]');
    const artist = root.querySelector<HTMLElement>('[data-role="artist"]');
    const fill = root.querySelector<HTMLElement>('[data-role="fill"]');
    const playBtn = root.querySelector<HTMLElement>('[data-role="play"]');
    if (art) art.style.backgroundImage = state.artUrl ? `url(${state.artUrl})` : '';
    if (title && state.title) title.textContent = state.title;
    if (artist && state.title) artist.textContent = state.artist;
    if (fill && state.durationMs) fill.style.width = `${(state.progressMs / state.durationMs) * 100}%`;
    if (playBtn) playBtn.textContent = state.isPlaying ? '⏸' : '▶';
  }
}

/**
 * Pop the dock into a real OS-level PIP window. Falls back to a no-op
 * (dock just stays inline) on browsers without the API — this mirrors
 * how the mini-clock PIP feature already degrades in this project.
 */
async function popOut(): Promise<void> {
  const dpip = (window as any).documentPictureInPicture;
  if (!dpip) return;
  const win: Window = await dpip.requestWindow({ width: 320, height: 120 });
  pipWindow = win;
  // Copy the dock's stylesheet so the popped-out window matches.
  [...document.styleSheets].forEach((sheet) => {
    try {
      const css = [...sheet.cssRules].map((r) => r.cssText).join('\n');
      const style = win.document.createElement('style');
      style.textContent = css;
      win.document.head.appendChild(style);
    } catch { /* cross-origin sheet, skip */ }
  });
  const clone = document.createElement('div');
  clone.className = 'sc-music-dock sc-music-dock--pip';
  clone.innerHTML = dockMarkup();
  win.document.body.appendChild(clone);
  wireDockEvents(clone);
  renderDock();
  win.addEventListener('pagehide', () => { pipWindow = null; }, { once: true });
}

export function isConnected(): boolean { return Integrations.isSpotifyConnected(); }
export function getState(): Readonly<DockState> { return state; }
