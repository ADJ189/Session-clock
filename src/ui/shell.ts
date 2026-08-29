import type { Track } from '../core/types';
import type { PlayerEngine } from '../player/engine';
import type { MusicProvider } from '../music/provider';
import { ColorBridge } from '../visual/colorbridge';

const fmt = (secs: number): string => {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export function mountShell(root: HTMLElement, engine: PlayerEngine, provider: MusicProvider): void {
  root.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar__brand">Session Clock · Music</div>
        <button class="nav-item active" data-nav="search">Search</button>
        <button class="nav-item" data-nav="library">Library</button>
        <button class="nav-item" data-nav="queue-toggle">Queue</button>
      </aside>

      <main class="main">
        <div class="search-row">
          <input class="search-input" type="search" placeholder="Search — artists, tracks, albums" />
        </div>
        <div class="track-list" id="results"></div>
      </main>

      <div class="now-playing">
        <div class="now-playing__track">
          <img class="now-playing__art" id="np-art" alt="" />
          <div class="now-playing__meta">
            <div class="marquee" id="np-title-wrap">
              <div class="marquee__inner now-playing__title" id="np-title">Nothing playing</div>
            </div>
            <div class="now-playing__artist" id="np-artist"></div>
          </div>
        </div>

        <div class="transport">
          <div class="transport__buttons">
            <button id="btn-shuffle" title="Shuffle">⤨</button>
            <button id="btn-prev" title="Previous">⏮</button>
            <button id="btn-play" class="primary" title="Play/Pause">▶</button>
            <button id="btn-next" title="Next">⏭</button>
            <button id="btn-repeat" title="Repeat">↻</button>
          </div>
          <div class="progress">
            <span id="np-current">0:00</span>
            <div class="progress__track" id="progress-track">
              <div class="progress__fill" id="progress-fill"></div>
            </div>
            <span id="np-duration">0:00</span>
          </div>
        </div>

        <div class="volume">
          <input type="range" id="vol" min="0" max="1" step="0.01" value="1" />
        </div>
      </div>

      <div class="queue-drawer" id="queue-drawer">
        <h2>Up next</h2>
        <div class="track-list" id="queue-list"></div>
      </div>

      <div class="yt-surface" id="yt-surface"></div>
    </div>
  `;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  const colorBridge = new ColorBridge();

  // --- Search: debounced, and cancels the in-flight request rather than
  // letting a slow older response overwrite a newer one (classic
  // race-condition source in search-as-you-type UIs). ---
  const searchInput = $<HTMLInputElement>('.search-input');
  const resultsEl = $<HTMLDivElement>('#results');
  let searchController: AbortController | null = null;
  let debounceHandle: number | null = null;

  searchInput.addEventListener('input', () => {
    if (debounceHandle) window.clearTimeout(debounceHandle);
    debounceHandle = window.setTimeout(() => void runSearch(searchInput.value.trim()), 300);
  });

  async function runSearch(query: string): Promise<void> {
    searchController?.abort();
    if (!query) {
      resultsEl.innerHTML = '';
      return;
    }
    searchController = new AbortController();
    try {
      const results = await provider.search(query, searchController.signal);
      renderTrackList(resultsEl, results.tracks, results.tracks);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error('Search failed', err);
    }
  }

  function renderTrackList(container: HTMLElement, tracks: Track[], playContext: Track[]): void {
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    tracks.forEach((track, i) => {
      const row = document.createElement('button');
      row.className = 'track-row';
      row.innerHTML = `
        <img src="${track.artwork?.url ?? ''}" alt="" loading="lazy" />
        <div>
          <div class="track-row__title">${escapeHtml(track.title)}</div>
          <div class="track-row__artist">${escapeHtml(track.artist)}</div>
        </div>
        <div class="track-row__duration">${track.durationSec ? fmt(track.durationSec) : ''}</div>
      `;
      row.addEventListener('click', () => void engine.playTracks(playContext, i));
      frag.appendChild(row);
    });
    container.appendChild(frag);
  }

  // --- Transport controls ---
  $('#btn-play').addEventListener('click', () => engine.togglePlayPause());
  $('#btn-next').addEventListener('click', () => void engine.next());
  $('#btn-prev').addEventListener('click', () => void engine.previous());
  $('#btn-shuffle').addEventListener('click', () => {
    engine.toggleShuffle();
    $('#btn-shuffle').classList.toggle('active', engine.shuffle);
  });
  $('#btn-repeat').addEventListener('click', () => {
    engine.cycleRepeat();
    $('#btn-repeat').classList.toggle('active', engine.repeat !== 'off');
  });

  const volInput = $<HTMLInputElement>('#vol');
  volInput.addEventListener('input', () => engine.setVolume(Number(volInput.value)));

  const progressTrack = $('#progress-track');
  let seekDurationSec = 0;
  progressTrack.addEventListener('click', (e) => {
    const rect = progressTrack.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    engine.seek(ratio * seekDurationSec);
  });

  // --- Queue drawer toggle ---
  const queueDrawer = $('#queue-drawer');
  $('[data-nav="queue-toggle"]').addEventListener('click', () => queueDrawer.classList.toggle('open'));

  // --- Engine → UI ---
  const titleWrap = $('#np-title-wrap');
  const titleEl = $('#np-title');

  engine.on((event) => {
    switch (event.type) {
      case 'trackchange': {
        const t = event.track;
        $<HTMLImageElement>('#np-art').src = t?.artwork?.url ?? '';
        titleEl.textContent = t?.title ?? 'Nothing playing';
        $('#np-artist').textContent = t?.artist ?? '';
        colorBridge.setArtwork(t?.artwork?.url);
        // Re-check overflow after the new title is laid out.
        requestAnimationFrame(() => {
          titleWrap.classList.toggle('overflowing', titleEl.scrollWidth > titleWrap.clientWidth);
        });
        break;
      }
      case 'playstate':
        $('#btn-play').textContent = event.playing ? '⏸' : '▶';
        break;
      case 'timeupdate': {
        seekDurationSec = event.durationSec;
        $('#np-current').textContent = fmt(event.currentSec);
        $('#np-duration').textContent = fmt(event.durationSec);
        const pct = event.durationSec > 0 ? (event.currentSec / event.durationSec) * 100 : 0;
        $<HTMLDivElement>('#progress-fill').style.width = `${pct}%`;
        break;
      }
      case 'error':
        console.error('Playback error', event.error);
        break;
    }
  });
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
