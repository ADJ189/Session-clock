// ── Ambient types for experimental Web APIs ─────────────────────────────
// TypeScript's bundled DOM lib doesn't yet include these (Battery Status,
// Document Picture-in-Picture, and iOS's gated DeviceMotionEvent
// permission prompt). Kept intentionally minimal — only the members this
// app actually touches in src/apis.ts — so we can use real types there
// instead of `as any`.

interface BatteryManager extends EventTarget {
  readonly level: number;
  readonly charging: boolean;
}

interface Navigator {
  /** Battery Status API — not implemented in Firefox/Safari, hence optional. */
  getBattery?: () => Promise<BatteryManager>;
}

interface DocumentPictureInPictureWindow extends Window {}

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<DocumentPictureInPictureWindow>;
}

interface Window {
  /** Document Picture-in-Picture API — Chrome 116+ only. */
  documentPictureInPicture?: DocumentPictureInPicture;
}

interface DeviceMotionEventConstructor {
  /** iOS 13+ gates motion events behind an explicit user-gesture permission prompt. */
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

// ── Non-standard / vendor-prefixed browser APIs ──────────────────────────
// Not in TypeScript's bundled DOM lib. Declared once here so call sites use
// real types instead of `as any` casts.

/** Network Information API — Chromium-only, unstandardized. */
interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g' | (string & {});
}

interface Navigator {
  /** iOS Safari home-screen (standalone) flag. */
  readonly standalone?: boolean;
  /** Network Information API — Chromium-only. */
  readonly connection?: NetworkInformationLike;
  /** Device Memory API (GB, coarse) — Chromium-only. */
  readonly deviceMemory?: number;
}

/** Chromium `beforeinstallprompt` (PWA install). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
}

/** Web Speech API — `SpeechRecognition` is absent from the DOM lib. Named
 *  *Like so a future lib.dom addition can't collide with these. */
interface SpeechRecognitionResultEventLike extends Event {
  readonly results: ArrayLike<ArrayLike<{ readonly transcript: string }>>;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: ((e: Event) => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** Vendor-prefixed Fullscreen API (older Safari / Firefox / Edge legacy). */
interface HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

interface Document {
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
  readonly webkitFullscreenElement?: Element | null;
  readonly mozFullScreenElement?: Element | null;
  readonly msFullscreenElement?: Element | null;
}

/** UI blips exposed by main.ts so other modules can fire them without a
 *  circular import. */
interface ScUiSounds {
  sessionStart?: () => void;
  sessionEnd?: () => void;
  themeSwitch?: () => void;
}

/** Cross-module hooks the app deliberately hangs off `window` (to avoid
 *  circular imports between main.ts / easter.ts / focuslog.ts). All optional:
 *  they're assigned during boot, so callers must tolerate them being absent. */
interface Window {
  __splashT0?: number;
  __scLat?: number;
  __uiSounds?: ScUiSounds;
  __scFps?: () => number;
  __scTier?: () => string;
  __scThemeCount?: () => number;
  __scAudioNodes?: () => string;
  __scRandomTheme?: () => void;
  __scTriggerKeyword?: (keyword: string) => void;
  __checkMidnight?: () => void;
  __scIncognito?: () => boolean;
  __scPalette?: typeof import('./palette');
  __zenMoveHandler?: EventListener;
  __onSyncComplete?: (rttMs: number) => void;
  __onSyncFail?: () => void;
  /** Namespace used by inline handlers in index.html. */
  SC?: Record<string, unknown>;
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

/** The Web Audio nodes in sound.ts / soundfiles.ts / soundsynth.ts carry two
 *  private bookkeeping fields: a custom stop hook (used by "stop proxy"
 *  gain nodes) and a started-flag so scheduled sources aren't started twice. */
interface AudioNode {
  _customStop?: () => void;
  _started?: boolean;
}

// ── Spotify Web Playback SDK (minimal — members musicdock.ts uses) ───────
interface SpotifyTrackLike {
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
}
interface SpotifyPlaybackStateLike {
  paused: boolean;
  position?: number;
  duration?: number;
  track_window?: { current_track?: SpotifyTrackLike };
}
interface SpotifyPlayerLike {
  addListener(
    event: 'ready' | 'not_ready',
    cb: (p: { device_id: string }) => void,
  ): void;
  addListener(
    event: 'player_state_changed',
    cb: (s: SpotifyPlaybackStateLike | null) => void,
  ): void;
  connect(): Promise<boolean>;
  togglePlay(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  resume(): Promise<void>;
  pause(): Promise<void>;
}
interface SpotifyPlayerOptions {
  name: string;
  getOAuthToken: (cb: (token: string) => void) => void;
  volume?: number;
}

// ── YouTube IFrame Player API (minimal — members musicdock.ts uses) ──────
interface YtPlayerLike {
  getVideoData?(): { title?: string; author?: string; video_id?: string };
  getPlayerState?(): number;
  playVideo?(): void;
  pauseVideo?(): void;
  nextVideo?(): void;
  previousVideo?(): void;
  seekTo?(seconds: number, allowSeekAhead: boolean): void;
  loadVideoById?(id: string): void;
  loadPlaylist?(opts: { listType: string; list: string }): void;
  getDuration?(): number;
  getCurrentTime?(): number;
}
interface YtStateChangeEvent {
  data: number;
}
interface YtPlayerOptions {
  height?: string;
  width?: string;
  videoId?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: () => void;
    onStateChange?: (e: YtStateChangeEvent) => void;
  };
}
interface YtGlobal {
  Player: new (el: HTMLElement, opts: YtPlayerOptions) => YtPlayerLike;
  PlayerState: { ENDED: number; PLAYING: number } & Record<string, number>;
}

interface Window {
  Spotify?: { Player: new (opts: SpotifyPlayerOptions) => SpotifyPlayerLike };
  onSpotifyWebPlaybackSDKReady?: () => void;
  YT?: YtGlobal;
  onYouTubeIframeAPIReady?: () => void;
}
