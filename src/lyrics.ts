// ── Lyrics ───────────────────────────────────────────────────────────
// Synced lyrics via LRCLIB (lrclib.net) — a free, public, no-auth
// lyrics database keyed on track/artist/duration. This is the same
// primary source used by desktop YouTube Music clients like Limusic
// and Zuno; unlike audio, lyric text isn't something YouTube (or
// Spotify) serves an API for, so a dedicated lyrics DB is the normal,
// ToS-clean way every music app — official or not — gets synced
// lyrics. No stream extraction, no scraping: one GET request to
// LRCLIB's public API.
//
// Matching is keyed on duration because the same song exists as
// several cuts (radio edit, album version, live) and the wrong one
// drifts out of sync after a verse or two — mirrors the approach
// documented in Limusic's README.

export interface LyricLine { time: number; text: string; }
export interface LyricsResult { synced: LyricLine[]; plain: string; }

const LRCLIB_BASE = 'https://lrclib.net/api';
const cache = new Map<string, LyricsResult | null>();

function cacheKey(track: string, artist: string, durationSec: number): string {
  return `${track.toLowerCase()}::${artist.toLowerCase()}::${Math.round(durationSec)}`;
}

/** Parses standard LRC `[mm:ss.xx] text` lines into a sorted line list. */
function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const re = /\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)/g;
  for (const line of lrc.split('\n')) {
    re.lastIndex = 0;
    const m = re.exec(line);
    if (!m) continue;
    const min = Number(m[1]);
    const sec = Number(m[2]);
    const text = (m[3] ?? '').trim();
    if (text) lines.push({ time: min * 60 + sec, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

/**
 * Looks up synced (or plain-fallback) lyrics for a track. Returns null
 * on no match or network failure — callers should treat that as "no
 * lyrics available" rather than an error state.
 */
export async function getLyrics(track: string, artist: string, durationSec: number): Promise<LyricsResult | null> {
  if (!track) return null;
  const key = cacheKey(track, artist, durationSec);
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const url = new URL(`${LRCLIB_BASE}/get`);
    url.searchParams.set('track_name', track);
    if (artist) url.searchParams.set('artist_name', artist);
    if (durationSec > 0) url.searchParams.set('duration', String(Math.round(durationSec)));

    const res = await fetch(url.toString());
    if (!res.ok) { cache.set(key, null); return null; }
    const data = await res.json();

    const synced = typeof data.syncedLyrics === 'string' ? parseLrc(data.syncedLyrics) : [];
    const plain = typeof data.plainLyrics === 'string' ? data.plainLyrics : '';
    if (!synced.length && !plain) { cache.set(key, null); return null; }

    const result: LyricsResult = { synced, plain };
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** Binary-searches `synced` for the line active at `timeSec`. Returns
 *  -1 if before the first line. */
export function activeLineIndex(synced: LyricLine[], timeSec: number): number {
  let lo = 0, hi = synced.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (synced[mid]!.time <= timeSec) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return ans;
}
