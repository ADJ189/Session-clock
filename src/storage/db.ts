import Dexie, { type EntityTable } from 'dexie';
import type { Album, Artist, Playlist, QueueState, Track } from '../core/types';

export interface LikedRow {
  trackId: string;
  likedAt: number;
}

export interface HistoryRow {
  id?: number;
  trackId: string;
  playedAt: number;
}

/** Cached dominant-color result from the artwork worker, keyed by artwork URL. */
export interface ArtworkColorRow {
  artworkUrl: string;
  h: number;
  s: number;
  l: number;
  computedAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

class MusicDB extends Dexie {
  tracks!: EntityTable<Track, 'id'>;
  albums!: EntityTable<Album, 'id'>;
  artists!: EntityTable<Artist, 'id'>;
  playlists!: EntityTable<Playlist, 'id'>;
  liked!: EntityTable<LikedRow, 'trackId'>;
  history!: EntityTable<HistoryRow, 'id'>;
  artworkColors!: EntityTable<ArtworkColorRow, 'artworkUrl'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor() {
    super('session-clock-music');
    this.version(1).stores({
      tracks: 'id, artist, album',
      albums: 'id, artist',
      artists: 'id',
      playlists: 'id, updatedAt',
      liked: 'trackId, likedAt',
      // auto-increment id lets repeat plays of the same track coexist in history
      history: '++id, trackId, playedAt',
      artworkColors: 'artworkUrl, computedAt',
      settings: 'key'
    });
  }
}

export const db = new MusicDB();

export async function saveQueueState(state: QueueState): Promise<void> {
  await db.settings.put({ key: 'queue', value: state });
}

export async function loadQueueState(): Promise<QueueState | null> {
  const row = await db.settings.get('queue');
  return (row?.value as QueueState) ?? null;
}

export async function recordHistory(trackId: string): Promise<void> {
  await db.history.add({ trackId, playedAt: Date.now() });
  // Keep history bounded — trim anything past the most recent 2000 plays
  // in the background rather than on every write.
  const count = await db.history.count();
  if (count > 2000) {
    const overflow = count - 2000;
    const oldest = await db.history.orderBy('playedAt').limit(overflow).primaryKeys();
    await db.history.bulkDelete(oldest);
  }
}
