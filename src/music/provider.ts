import type { PlayableSource, SearchResults, Track } from '../core/types';

/**
 * A MusicProvider is the only place that talks to an outside service.
 * The UI, queue, and player engine never import a provider directly —
 * they go through core/state.ts's `provider` instance.
 *
 * Deliberate scope note: `resolvePlayableSource` must return either a
 * licensed/official audio URL (e.g. a provider-issued stream you're
 * authorized to play) or an 'iframe' source that mounts the provider's
 * own official embedded player. It must never resolve a track by
 * deciphering or reverse-engineering a private streaming API — see
 * music/providers/youtube.ts for how the YouTube provider honors that.
 */
export interface MusicProvider {
  readonly id: string;
  search(query: string, signal?: AbortSignal): Promise<SearchResults>;
  resolvePlayableSource(track: Track): Promise<PlayableSource>;
  isAuthenticated(): boolean;
  connect(): Promise<void>;
}
