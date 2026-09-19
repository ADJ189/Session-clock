// ── Recorded ambient audio — gapless, crossfaded infinite loops ────────
// sound.ts's other tracks are all synthesized live with WebAudio nodes,
// which loop for free (AudioBufferSourceNode.loop / continuous oscillators).
// Recorded material doesn't have that luxury — a raw HTMLAudioElement.loop
// jump-cuts at the seam, which is very audible on anything with rhythm or
// texture (a footstep, a bird, a rumble of thunder). Instead each track
// here runs two <audio> elements offset by one crossfade window: while one
// plays out its last few seconds, the other has already started from 0
// underneath it, and an equal-power gain curve blends between them — so
// there's always audio playing and the seam is masked rather than heard.
// That pair keeps swapping forever, which is what gives the "loops
// infinitely until the user stops" behaviour the mixer expects.
//
// Playback is routed through MediaElementAudioSourceNode into the same
// per-track GainNode → analyser → masterGain → compressor chain the
// synthesized tracks use, so volume, the VU meter, and the ITD/ILD spatial
// rig in sound.ts all keep working on these exactly as they do on the
// procedural ones — this module only owns the two <audio> elements and
// the crossfade scheduling, not the rest of the mix graph.

import { CAPS, FEATURES, IS_TOUCH } from './platform';

export interface FileTrackConfig {
  url: string;
  /** Seconds of overlap used to mask the loop seam. Tuned per recording:
   *  steady, textureless material (rain, river) can get away with a short
   *  crossfade; material with slow swells (wind) or sparse events that
   *  would sound bad if cut off mid-event (night crickets, thunder) gets
   *  a longer one so a swap is much less likely to land on top of one. */
  crossfadeSec: number;
  /** Per-file level trim — the recordings weren't all mastered to the same
   *  loudness, and this keeps them sitting evenly against each other and
   *  the procedural tracks once everything hits the shared compressor. */
  gainTrim: number;
}

export const FILE_TRACKS: Record<string, FileTrackConfig> = {
  rain:         { url: '/sounds/rain.opus',         crossfadeSec: 3, gainTrim: 0.9  },
  fire:         { url: '/sounds/fire.opus',          crossfadeSec: 4, gainTrim: 0.85 },
  wind:         { url: '/sounds/wind.opus',          crossfadeSec: 5, gainTrim: 0.9  },
  forest:       { url: '/sounds/forest.opus',        crossfadeSec: 4, gainTrim: 0.9  },
  wildforest:   { url: '/sounds/wildforest.opus',    crossfadeSec: 5, gainTrim: 0.85 },
  river:        { url: '/sounds/river.opus',         crossfadeSec: 3, gainTrim: 0.9  },
  night:        { url: '/sounds/night.opus',         crossfadeSec: 5, gainTrim: 0.85 },
  thunderstorm: { url: '/sounds/thunderstorm.opus',  crossfadeSec: 6, gainTrim: 0.8  },
};

export function isFileBackedTrack(id: string): boolean { return id in FILE_TRACKS; }
/** False only for a file-backed id on a browser without Ogg/Opus support
 *  (old Safari/iOS) — sound.ts uses this to grey out the toggle for the
 *  handful of tracks (wildforest/river/night/thunderstorm) that have no
 *  procedural equivalent to fall back to. */
export function isFileTrackSupported(id: string): boolean { return !isFileBackedTrack(id) || CAPS.oggOpus; }

// ── Autoplay-policy retry ────────────────────────────────────────────
// A track started from a real click (the mixer toggle) always has an
// active user gesture, so el.play() succeeds immediately. autoStartCommonRoom
// fires from a setTimeout after a theme switch though — no gesture in that
// call stack — and Safari in particular can reject the very first play()
// on a freshly-created <audio> element for that reason even though the
// shared AudioContext is already running. Rather than silently staying
// muted, a blocked player registers itself here and gets one more try on
// the next real interaction anywhere on the page.
const pendingResume = new Set<GaplessLoopPlayer>();
let retryListenerBound = false;
function ensureRetryListener(): void {
  if (retryListenerBound) return;
  retryListenerBound = true;
  const retry = () => {
    pendingResume.forEach(p => p.retryPlay());
    if (pendingResume.size === 0) {
      document.removeEventListener('pointerdown', retry);
      document.removeEventListener('keydown', retry);
      retryListenerBound = false;
    }
  };
  document.addEventListener('pointerdown', retry);
  document.addEventListener('keydown', retry);
}

class GaplessLoopPlayer {
  private els: [HTMLAudioElement, HTMLAudioElement];
  private srcNodes: [MediaElementAudioSourceNode, MediaElementAudioSourceNode];
  private gains: [GainNode, GainNode];
  readonly out: GainNode;
  private active: 0 | 1 = 0;
  private watchHandle = 0;
  private crossfading = false;
  private stopped = false;

  constructor(private ctx: AudioContext, private cfg: FileTrackConfig) {
    const make = () => {
      const el = new Audio();
      // Data-saver / known-slow connections: don't buffer ahead at all
      // until play() actually requests it. Touch devices default to
      // metadata-only (duration, first frame) rather than eagerly pulling
      // the whole file over what's often a metered connection; desktop
      // buffers ahead for a snappier, gap-free start.
      el.preload = CAPS.saveData ? 'none' : (IS_TOUCH ? 'metadata' : 'auto');
      el.loop = false; // looping is driven manually below, for the crossfade
      el.src = cfg.url;
      el.addEventListener('ended', () => {
        // Only reachable if the scheduled crossfade never got a chance to
        // fire — e.g. duration wasn't known yet under preload:'none'. Hard
        // swap rather than leave a silent gap; not as smooth as the normal
        // crossfade but strictly better than dead air.
        if (!this.stopped && !this.crossfading) this.hardSwap();
      });
      return el;
    };
    this.els = [make(), make()];
    this.srcNodes = [ctx.createMediaElementSource(this.els[0]), ctx.createMediaElementSource(this.els[1])];
    this.gains = [ctx.createGain(), ctx.createGain()];
    this.gains[0].gain.value = 0;
    this.gains[1].gain.value = 0;
    this.out = ctx.createGain();
    this.out.gain.value = cfg.gainTrim;
    this.srcNodes[0].connect(this.gains[0]).connect(this.out);
    this.srcNodes[1].connect(this.gains[1]).connect(this.out);
  }

  start(): void {
    const now = this.ctx.currentTime;
    const g = this.gains[this.active];
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(1, now + 0.25); // short fade-in, avoids a click on first start
    this.attemptPlay(this.els[this.active]);
    this.primeOther();
    this.watch();
  }

  private attemptPlay(el: HTMLAudioElement): void {
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => { pendingResume.add(this); ensureRetryListener(); });
    }
  }

  /** Called from the shared gesture-retry listener above. */
  retryPlay(): void {
    const el = this.els[this.active];
    if (!el.paused) { pendingResume.delete(this); return; }
    const p = el.play();
    if (p && typeof p.then === 'function') p.then(() => pendingResume.delete(this)).catch(() => {});
  }

  /** Warms up the currently-inactive element ahead of the next crossfade
   *  so it has data buffered by the time it's needed, instead of possibly
   *  stalling mid-swap on a slow connection. Deliberately done on idle
   *  time — it's a nice-to-have, not worth competing with anything the
   *  user is actively doing. */
  private primeOther(): void {
    const other = this.els[1 - this.active];
    const warm = () => { if (!this.stopped) { try { other.load(); } catch { /* ignore */ } } };
    if (FEATURES.requestIdleCallback) (window as any).requestIdleCallback(warm, { timeout: 4000 });
    else setTimeout(warm, 1500);
  }

  private watch(): void {
    clearInterval(this.watchHandle);
    // Polling every 200ms is far finer than any of these crossfade windows
    // need — and unlike one long setTimeout, a late-firing interval (e.g. a
    // throttled background tab) just starts the crossfade a little late
    // rather than silently missing the loop boundary altogether.
    this.watchHandle = window.setInterval(() => {
      if (this.stopped || this.crossfading) return;
      const el = this.els[this.active];
      if (!isFinite(el.duration)) return; // metadata not loaded yet
      if (el.currentTime >= el.duration - this.cfg.crossfadeSec) this.crossfade();
    }, 200);
  }

  private crossfade(): void {
    this.crossfading = true;
    const from = this.active;
    const to: 0 | 1 = from === 0 ? 1 : 0;
    const now = this.ctx.currentTime;
    const dur = this.cfg.crossfadeSec;

    this.els[to].currentTime = 0;
    this.attemptPlay(this.els[to]);

    // Equal-power (cosine/sine) crossfade rather than a linear ramp — two
    // linearly-faded signals dip audibly in the middle of the overlap
    // because they don't sum back to unity gain; equal-power keeps
    // perceived loudness roughly constant across the whole transition.
    const steps = 24;
    const curveOut = new Float32Array(steps + 1);
    const curveIn = new Float32Array(steps + 1);
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * (Math.PI / 2);
      curveOut[i] = Math.cos(t);
      curveIn[i] = Math.sin(t);
    }
    this.gains[from].gain.cancelScheduledValues(now);
    this.gains[to].gain.cancelScheduledValues(now);
    this.gains[from].gain.setValueCurveAtTime(curveOut, now, dur);
    this.gains[to].gain.setValueCurveAtTime(curveIn, now, dur);

    setTimeout(() => {
      const oldEl = this.els[from];
      try { oldEl.pause(); oldEl.currentTime = 0; } catch { /* ignore */ }
      this.active = to;
      this.crossfading = false;
      this.primeOther();
      this.watch();
    }, dur * 1000 + 30);
  }

  private hardSwap(): void {
    const from = this.active;
    const to: 0 | 1 = from === 0 ? 1 : 0;
    const now = this.ctx.currentTime;
    this.gains[from].gain.cancelScheduledValues(now);
    this.gains[from].gain.setValueAtTime(0, now);
    this.gains[to].gain.cancelScheduledValues(now);
    this.gains[to].gain.setValueAtTime(1, now);
    this.els[to].currentTime = 0;
    this.attemptPlay(this.els[to]);
    this.active = to;
    this.primeOther();
    this.watch();
  }

  stop(): void {
    this.stopped = true;
    clearInterval(this.watchHandle);
    pendingResume.delete(this);
    this.els.forEach(el => { try { el.pause(); el.removeAttribute('src'); el.load(); } catch { /* ignore */ } });
    this.srcNodes.forEach(n => { try { n.disconnect(); } catch { /* ignore */ } });
    this.gains.forEach(g => { try { g.disconnect(); } catch { /* ignore */ } });
    try { this.out.disconnect(); } catch { /* ignore */ }
  }
}

/** Matches the { out, nodes } shape every procedural maker in sound.ts
 *  returns, so it drops straight into the same MAKERS dispatch table. The
 *  loop player is exposed only via a `_customStop` proxy node — same
 *  pattern sound.ts already uses for its own scheduler-backed tracks
 *  (forest's chirps, fire's crackle) — so playTrack/stopTrack need no
 *  special-casing for file-backed tracks at all. */
export function makeFileTrack(ctx: AudioContext, id: string): { out: AudioNode; nodes: AudioNode[] } | null {
  const cfg = FILE_TRACKS[id];
  if (!cfg || !CAPS.oggOpus) return null;
  const player = new GaplessLoopPlayer(ctx, cfg);
  player.start();
  const stopProxy = ctx.createGain(); stopProxy.gain.value = 0;
  (stopProxy as any)._customStop = () => player.stop();
  return { out: player.out, nodes: [stopProxy] };
}
