import Liricle from 'liricle';

export interface LyricsLine {
  index?: number;
  time: number;
  text: string;
}

type LineListener = (line: LyricsLine | null) => void;

/**
 * Thin wrapper around Liricle so ui/shell.ts doesn't need to know the
 * library's event API. `feed(seconds)` is meant to be called from the
 * player engine's existing timeupdate event -- no separate polling loop.
 */
export class LyricsSync {
  private liricle = new Liricle();
  private listeners = new Set<LineListener>();
  private loaded = false;

  constructor() {
    this.liricle.on('sync', (line) => {
      for (const cb of this.listeners) cb(line as LyricsLine | null);
    });
  }

  onLineChange(cb: LineListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  load(lrcText: string): boolean {
    try {
      this.liricle.load({ text: lrcText });
      this.loaded = true;
      return true;
    } catch {
      this.loaded = false;
      return false;
    }
  }

  clear(): void {
    this.loaded = false;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  get lines(): LyricsLine[] {
    return this.liricle.data?.lines ?? [];
  }

  feed(currentSec: number): void {
    if (this.loaded) this.liricle.sync(currentSec);
  }
}
