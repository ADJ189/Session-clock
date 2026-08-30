import type { PlayableSource, SearchResults, Track } from '../../core/types';
import type { MusicProvider } from '../provider';

/**
 * YouTube provider. Search/metadata goes through the official Data API v3
 * (OAuth-gated, same token flow Session Clock's integrations.ts already
 * has). Playback resolves to an 'iframe' source that mounts YouTube's own
 * official IFrame Player — the video stays attached, per YouTube's terms.
 *
 * There is intentionally no code path here that fetches or deciphers a
 * direct/adaptive stream URL. If you're wiring this up for real, plug your
 * existing OAuth token (ensureFreshToken from Session Clock) into
 * `apiKeyOrToken` below and implement `search` against
 * `https://www.googleapis.com/youtube/v3/search`.
 */
export class YouTubeProvider implements MusicProvider {
  readonly id = 'youtube';

  constructor(private getToken: () => Promise<string | null>) {}

  isAuthenticated(): boolean {
    return this._authenticated;
  }

  private _authenticated = false;

  async connect(): Promise<void> {
    const token = await this.getToken();
    this._authenticated = Boolean(token);
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchResults> {
    const token = await this.getToken();
    if (!token) return { tracks: [], albums: [], artists: [], playlists: [] };

    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('videoCategoryId', '10'); // Music
    url.searchParams.set('maxResults', '25');
    url.searchParams.set('q', query);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal
    });
    if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`);
    const data = await res.json();

    const tracks: Track[] = (data.items ?? []).map((item: any): Track => ({
      id: `yt:${item.id.videoId}`,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      durationSec: 0, // filled in below
      artwork: item.snippet.thumbnails?.medium
        ? { url: item.snippet.thumbnails.medium.url }
        : undefined,
      sourceId: item.id.videoId,
      sourceKind: 'youtube'
    }));

    await this.fillDurations(tracks, token, signal);
    return { tracks, albums: [], artists: [], playlists: [] };
  }

  /**
   * search.list doesn't return durations -- a second, official videos.list
   * call is required. Batched into one request for up to 50 ids rather
   * than one request per track, since that's what the API actually allows
   * and it avoids burning quota per-row.
   */
  private async fillDurations(tracks: Track[], token: string, signal?: AbortSignal): Promise<void> {
    if (tracks.length === 0) return;
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'contentDetails');
    url.searchParams.set('id', tracks.map((t) => t.sourceId).join(','));

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (!res.ok) return; // duration is a nice-to-have -- don't fail the whole search over it
    const data = await res.json();
    const durationById = new Map<string, number>(
      (data.items ?? []).map((item: any) => [item.id, parseIso8601Duration(item.contentDetails.duration)])
    );
    for (const t of tracks) t.durationSec = durationById.get(t.sourceId) ?? 0;
  }

  async resolvePlayableSource(track: Track): Promise<PlayableSource> {
    return {
      kind: 'iframe',
      embedUrl: `https://www.youtube.com/embed/${track.sourceId}?autoplay=1&enablejsapi=1`
    };
  }
}

/** Parses YouTube's ISO 8601 durations (e.g. "PT3M45S") into whole seconds. */
function parseIso8601Duration(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}
