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
      durationSec: 0, // filled in by a follow-up videos.list call if needed
      artwork: item.snippet.thumbnails?.medium
        ? { url: item.snippet.thumbnails.medium.url }
        : undefined,
      sourceId: item.id.videoId,
      sourceKind: 'youtube'
    }));

    return { tracks, albums: [], artists: [], playlists: [] };
  }

  async resolvePlayableSource(track: Track): Promise<PlayableSource> {
    return {
      kind: 'iframe',
      embedUrl: `https://www.youtube.com/embed/${track.sourceId}?autoplay=1&enablejsapi=1`
    };
  }
}
