import { db } from '../storage/db';

export async function isLiked(trackId: string): Promise<boolean> {
  return (await db.liked.get(trackId)) !== undefined;
}

export async function toggleLike(trackId: string): Promise<boolean> {
  const existing = await db.liked.get(trackId);
  if (existing) {
    await db.liked.delete(trackId);
    return false;
  }
  await db.liked.put({ trackId, likedAt: Date.now() });
  return true;
}

export async function getLikedTrackIds(): Promise<string[]> {
  const rows = await db.liked.orderBy('likedAt').reverse().toArray();
  return rows.map((r) => r.trackId);
}
