// Core domain types. Nothing here knows about a specific music provider —
// that separation is the whole point (see music/provider.ts).

export interface Artwork {
  url: string;
  width?: number;
  height?: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  durationSec: number;
  artwork?: Artwork;
  /** Opaque per-provider id, e.g. a YouTube video id. Never assume a shape. */
  sourceId: string;
  sourceKind: 'youtube';
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artwork?: Artwork;
  trackIds: string[];
}

export interface Artist {
  id: string;
  name: string;
  artwork?: Artwork;
}

export interface Playlist {
  id: string;
  title: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
}

/**
 * A resolved, playable source for a track. `kind` tells the player engine
 * how to mount it — this repo only ever produces 'iframe' sources (see
 * music/providers/youtube.ts), never a raw/deciphered media URL.
 */
export type PlayableSource =
  | { kind: 'audio-url'; url: string; expiresAt?: number }
  | { kind: 'iframe'; embedUrl: string };

export type RepeatMode = 'off' | 'one' | 'all';

export interface QueueState {
  trackIds: string[];
  currentIndex: number;
  shuffle: boolean;
  repeat: RepeatMode;
}
