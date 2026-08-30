import { db } from '../storage/db';
import type { Playlist } from '../core/types';

function newId(): string {
  return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createPlaylist(title: string): Promise<Playlist> {
  const now = Date.now();
  const playlist: Playlist = { id: newId(), title: title.trim() || 'Untitled playlist', trackIds: [], createdAt: now, updatedAt: now };
  await db.playlists.put(playlist);
  return playlist;
}

export async function renamePlaylist(id: string, title: string): Promise<void> {
  await db.playlists.update(id, { title: title.trim() || 'Untitled playlist', updatedAt: Date.now() });
}

export async function deletePlaylist(id: string): Promise<void> {
  await db.playlists.delete(id);
}

export async function addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
  const pl = await db.playlists.get(playlistId);
  if (!pl || pl.trackIds.includes(trackId)) return;
  await db.playlists.update(playlistId, { trackIds: [...pl.trackIds, trackId], updatedAt: Date.now() });
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  const pl = await db.playlists.get(playlistId);
  if (!pl) return;
  await db.playlists.update(playlistId, {
    trackIds: pl.trackIds.filter((id) => id !== trackId),
    updatedAt: Date.now()
  });
}

export async function getAllPlaylists(): Promise<Playlist[]> {
  return db.playlists.orderBy('updatedAt').reverse().toArray();
}
