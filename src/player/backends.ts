import type { PlayableSource } from '../core/types';

export interface PlaybackBackend {
  load(source: PlayableSource): Promise<void>;
  play(): void;
  pause(): void;
  seek(sec: number): void;
  setVolume(v: number): void; // 0..1
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDurationSec(): number;
  destroy(): void;
  onTimeUpdate(cb: (sec: number) => void): void;
  onEnded(cb: () => void): void;
  onError(cb: (err: unknown) => void): void;
  /**
   * Returns the underlying <audio>/<video> element for Web Audio analysis,
   * or null when playback happens in a cross-origin surface the page
   * can't attach an AnalyserNode to (the YouTube IFrame backend -- its
   * audio lives in a separate browsing context, so real FFT data simply
   * isn't available there; see player/analyser.ts for the fallback).
   */
  getMediaElement(): HTMLMediaElement | null;
}

/** Native <audio> backend for provider-issued, licensed audio-url sources. */
export class AudioBackend implements PlaybackBackend {
  private el: HTMLAudioElement;

  constructor() {
    this.el = new Audio();
    this.el.preload = 'auto';
  }

  async load(source: PlayableSource): Promise<void> {
    if (source.kind !== 'audio-url') throw new Error('AudioBackend requires an audio-url source');
    this.el.src = source.url;
  }

  play(): void {
    void this.el.play();
  }
  pause(): void {
    this.el.pause();
  }
  seek(sec: number): void {
    this.el.currentTime = sec;
  }
  setVolume(v: number): void {
    this.el.volume = Math.min(1, Math.max(0, v));
  }
  setMuted(muted: boolean): void {
    this.el.muted = muted;
  }
  setPlaybackRate(rate: number): void {
    this.el.playbackRate = rate;
  }
  getCurrentTime(): number {
    return this.el.currentTime;
  }
  getDurationSec(): number {
    return Number.isFinite(this.el.duration) ? this.el.duration : 0;
  }
  getMediaElement(): HTMLMediaElement | null {
    return this.el;
  }
  destroy(): void {
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
  }
  onTimeUpdate(cb: (sec: number) => void): void {
    this.el.addEventListener('timeupdate', () => cb(this.el.currentTime));
  }
  onEnded(cb: () => void): void {
    this.el.addEventListener('ended', cb);
  }
  onError(cb: (err: unknown) => void): void {
    this.el.addEventListener('error', () => cb(this.el.error));
  }
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;

/** Loads YouTube's official IFrame API script exactly once, however many players need it. */
function loadYouTubeApi(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

/**
 * Official YouTube IFrame Player backend. Mounts YouTube's own embedded
 * player and drives it through the documented postMessage-based API —
 * this is the compliant playback path (video attached, official player),
 * not a stream-extraction shortcut.
 */
export class YouTubeIframeBackend implements PlaybackBackend {
  private player: any = null;
  private ready: Promise<void>;
  private timeUpdateCb?: (sec: number) => void;
  private endedCb?: () => void;
  private errorCb?: (err: unknown) => void;
  private pollHandle: number | null = null;

  constructor(private container: HTMLElement) {
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    await loadYouTubeApi();
    await new Promise<void>((resolve) => {
      this.player = new window.YT.Player(this.container, {
        height: '100%',
        width: '100%',
        playerVars: { playsinline: 1, controls: 0, rel: 0 },
        events: {
          onReady: () => resolve(),
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.ENDED) this.endedCb?.();
          },
          onError: (e: any) => this.errorCb?.(e)
        }
      });
    });
    this.pollHandle = window.setInterval(() => {
      if (this.timeUpdateCb && this.player?.getCurrentTime) {
        this.timeUpdateCb(this.player.getCurrentTime());
      }
    }, 500);
  }

  async load(source: PlayableSource): Promise<void> {
    if (source.kind !== 'iframe') throw new Error('YouTubeIframeBackend requires an iframe source');
    await this.ready;
    const videoId = new URL(source.embedUrl).pathname.split('/').pop();
    this.player.loadVideoById(videoId);
  }

  play(): void {
    this.player?.playVideo?.();
  }
  pause(): void {
    this.player?.pauseVideo?.();
  }
  seek(sec: number): void {
    this.player?.seekTo?.(sec, true);
  }
  setVolume(v: number): void {
    this.player?.setVolume?.(Math.round(v * 100));
  }
  setMuted(muted: boolean): void {
    if (muted) this.player?.mute?.();
    else this.player?.unMute?.();
  }
  setPlaybackRate(rate: number): void {
    this.player?.setPlaybackRate?.(rate);
  }
  getCurrentTime(): number {
    return this.player?.getCurrentTime?.() ?? 0;
  }
  getDurationSec(): number {
    return this.player?.getDuration?.() ?? 0;
  }
  getMediaElement(): HTMLMediaElement | null {
    return null; // cross-origin iframe -- not attachable to Web Audio, see interface doc
  }
  destroy(): void {
    if (this.pollHandle) window.clearInterval(this.pollHandle);
    this.player?.destroy?.();
  }
  onTimeUpdate(cb: (sec: number) => void): void {
    this.timeUpdateCb = cb;
  }
  onEnded(cb: () => void): void {
    this.endedCb = cb;
  }
  onError(cb: (err: unknown) => void): void {
    this.errorCb = cb;
  }
}
