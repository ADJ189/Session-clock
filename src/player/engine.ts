import type { Track } from '../core/types';
import type { MusicProvider } from '../music/provider';
import { recordHistory, saveQueueState } from '../storage/db';
import { AudioBackend, YouTubeIframeBackend, type PlaybackBackend } from './backends';
import { Queue } from './queue';

export type PlayerEvent =
  | { type: 'trackchange'; track: Track | null }
  | { type: 'playstate'; playing: boolean }
  | { type: 'timeupdate'; currentSec: number; durationSec: number }
  | { type: 'error'; error: unknown };

type Listener = (e: PlayerEvent) => void;

export class PlayerEngine {
  private queue = new Queue();
  private tracksById = new Map<string, Track>();
  private backend: PlaybackBackend | null = null;
  private listeners = new Set<Listener>();
  private playing = false;
  /** Debounces queue persistence — see comment on `scheduleQueueSave`. */
  private saveTimer: number | null = null;

  constructor(
    private provider: MusicProvider,
    private iframeContainer: HTMLElement
  ) {}

  /** Called once the real DOM node exists — see main.ts bootstrap order. */
  setIframeContainer(el: HTMLElement): void {
    this.iframeContainer = el;
  }

  on(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(e: PlayerEvent): void {
    for (const cb of this.listeners) cb(e);
  }

  get currentTrack(): Track | null {
    const id = this.queue.currentTrackId;
    return id ? this.tracksById.get(id) ?? null : null;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get shuffle(): boolean {
    return this.queue.shuffle;
  }

  get repeat() {
    return this.queue.repeat;
  }

  async playTracks(tracks: Track[], startIndex = 0): Promise<void> {
    for (const t of tracks) this.tracksById.set(t.id, t);
    this.queue.set(
      tracks.map((t) => t.id),
      startIndex
    );
    this.scheduleQueueSave();
    await this.loadCurrent();
  }

  addToQueue(tracks: Track[]): void {
    for (const t of tracks) this.tracksById.set(t.id, t);
    this.queue.append(tracks.map((t) => t.id));
    this.scheduleQueueSave();
  }

  toggleShuffle(): void {
    this.queue.setShuffle(!this.queue.shuffle);
    this.scheduleQueueSave();
  }

  cycleRepeat(): void {
    this.queue.cycleRepeat();
    this.scheduleQueueSave();
  }

  togglePlayPause(): void {
    if (!this.backend) return;
    if (this.playing) this.pause();
    else this.play();
  }

  play(): void {
    this.backend?.play();
    this.playing = true;
    this.emit({ type: 'playstate', playing: true });
  }

  pause(): void {
    this.backend?.pause();
    this.playing = false;
    this.emit({ type: 'playstate', playing: false });
  }

  seek(sec: number): void {
    this.backend?.seek(sec);
  }

  setVolume(v: number): void {
    this.backend?.setVolume(v);
  }

  async next(): Promise<void> {
    const nextId = this.queue.advance();
    if (!nextId) {
      this.pause();
      return;
    }
    await this.loadCurrent();
  }

  async previous(): Promise<void> {
    // Restart the current track if we're more than 3s in — matches the
    // behavior every music player's "previous" button actually has.
    if ((this.backend?.getCurrentTime() ?? 0) > 3) {
      this.backend?.seek(0);
      return;
    }
    const prevId = this.queue.previous();
    if (!prevId) return;
    await this.loadCurrent();
  }

  private async loadCurrent(): Promise<void> {
    const track = this.currentTrack;
    this.emit({ type: 'trackchange', track });
    if (!track) return;

    this.backend?.destroy();
    try {
      const source = await this.provider.resolvePlayableSource(track);
      this.backend =
        source.kind === 'iframe' ? new YouTubeIframeBackend(this.iframeContainer) : new AudioBackend();
      await this.backend.load(source);

      this.backend.onTimeUpdate((sec) => {
        this.emit({ type: 'timeupdate', currentSec: sec, durationSec: this.backend?.getDurationSec() ?? 0 });
      });
      this.backend.onEnded(() => void this.next());
      this.backend.onError((err) => this.emit({ type: 'error', error: err }));

      this.play();
      void recordHistory(track.id);
    } catch (error) {
      this.emit({ type: 'error', error });
    }
  }

  /**
   * Queue state is written on every shuffle/repeat/track change, but a
   * skip-happy user can fire several of those a second. Debounce the
   * IndexedDB write instead of persisting on every single mutation —
   * the queue only needs to survive a reload, not every intermediate state.
   */
  private scheduleQueueSave(): void {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      void saveQueueState(this.queue.snapshot());
    }, 400);
  }
}
