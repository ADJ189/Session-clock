// ── Recorded ambient audio — gapless, crossfaded infinite loops ────────
// sound.ts's other tracks are all synthesized live with WebAudio nodes,
// which loop for free (continuous oscillators / scheduled noise). Recorded
// material doesn't have that luxury — a raw HTMLAudioElement.loop jump-cuts
// at the seam, which is very audible on anything with rhythm or texture (a
// footstep, a bird, a rumble of thunder). Instead each track here runs two
// <audio> elements offset by one crossfade window: while one plays out its
// last couple of seconds, the other has already started from 0 underneath
// it, and an equal-power gain curve blends between them — so there's
// always audio playing and the seam is masked rather than heard. That pair
// keeps swapping forever, which is what gives the "loops infinitely until
// the user stops" behaviour the mixer expects.
//
// Two design choices were checked against real implementations rather than
// guessed:
//
// - Why streamed <audio> instead of decodeAudioData: ambiently's engine
//   decodes its ambience recordings into an AudioBuffer and loops them
//   natively — genuinely gapless, and the right call for its own audio,
//   which is deliberately cut to 30-second clips. This catalog isn't —
//   most of these recordings run 1-5 minutes, and a fully-decoded stereo
//   48kHz buffer for a 5-minute track is well over 100MB of memory per
//   track. Streaming keeps memory bounded regardless of length, at the
//   cost of driving the crossfade from playback position instead of a
//   sample-accurate buffer offset — worth it here.
// - Why an explicit crossfade at all: Moodist's own player (Howler.js,
//   src/hooks/use-sound.ts) just sets `loop: true` and fades on play/pause
//   — no seam-masking. That works because their source clips are curated
//   to already loop cleanly. This catalog is the same recordings, just
//   opus-encoded, with no guarantee of a clean loop point, so the
//   crossfade here is what actually delivers "loops infinitely... to
//   ensure it's continuous" rather than assuming the source does.
//
// The crossfade shape (equal-power sin/cos gain curves via
// setValueCurveAtTime) is the same one monochrome's track-to-track
// crossfade uses in js/player.js: a linear ramp between two signals
// measurably dips in the middle because they don't sum back to unity,
// where equal-power holds perceived loudness roughly constant. The trigger
// itself is closer to how Metrolist schedules ExoPlayer's crossfade in
// MusicService.kt — fired from a precise position check rather than one
// long timer — adapted to the Web platform's equivalent of a precise
// position check: requestAnimationFrame while the tab is visible (~16ms
// resolution, re-checked every frame) with a coarser interval as a
// background-tab safety net, since rAF itself is throttled/paused there.
//
// Playback is routed through MediaElementAudioSourceNode into the same
// per-track GainNode → analyser → masterGain → compressor chain the
// synthesized tracks use (the same shape monochrome's audio-context.js
// builds around a MediaElementSource + GainNode pair), so volume, the VU
// meter, and the ITD/ILD spatial rig in sound.ts all keep working on these
// exactly as they do on the procedural ones — this module only owns the
// two <audio> elements and the crossfade scheduling, not the rest of the
// mix graph.

import { CAPS, FEATURES, IS_TOUCH } from './platform';

export interface FileTrackConfig {
  /** Ogg/Opus source — the only format shipped this time (see the repo-size
   *  note in the project history: an earlier AAC fallback duplicated every
   *  file and roughly doubled the payload for a rarely-hit case). Opus
   *  unsupported now just means: procedural fallback if the track has one,
   *  otherwise a disabled toggle — see isFileTrackSupported(). */
  url: string;
  /** Seconds of overlap used to mask the loop seam. Tuned per recording:
   *  steady, textureless material (rain, river, waterfall) can get away
   *  with a short crossfade; material with slow swells (wind) or sparse
   *  events that would sound bad if cut off mid-event (thunder, birds,
   *  crickets) gets a little more so a swap is much less likely to land on
   *  top of one. */
  crossfadeSec: number;
  /** Per-file level trim — the recordings weren't all mastered to the same
   *  loudness, and this keeps them sitting evenly against each other and
   *  the procedural tracks once everything hits the shared compressor. */
  gainTrim: number;
  /** True for tracks that also have a synthesized WebAudio version in
   *  sound.ts — those never need to be disabled in the mixer even without
   *  Opus support, since MAKERS falls back to the procedural maker. */
  proceduralFallback?: boolean;
}

// ── Where the recordings actually live ──────────────────────────────
// Same reasoning as DEFAULT_SPOTIFY_CLIENT_ID / DEFAULT_GOOGLE_CLIENT_ID
// in authconfig.ts: a plain constant, safe to commit (it's just a public
// URL, not a secret), that the app falls back gracefully without.
//
// Leave this blank and every url below resolves same-origin
// ('/opus/nature/wind.opus', served from this repo's own public/opus/) —
// useful for local dev without network access. Point it at jsDelivr
// instead (the default below) and the recordings load from there,
// keeping the ~17MB of audio out of this repo's git history entirely.
// jsDelivr was picked over a paid-tier-risk option (Cloudflare R2 etc.)
// specifically because it has no billing tier at all for this — it's a
// free CDN that auto-mirrors any public GitHub repo, and it already
// sends Access-Control-Allow-Origin: * on every file, so there's no
// CORS configuration to get right either.
//
// Either way the track still plays: if this is set but a file can't
// actually be fetched (wrong tag, the second repo renamed, jsDelivr
// having a bad day), the onUnavailable hook in makeFileTrack() below
// swaps to the ambiently fallback rather than going silent — so a
// misconfigured or temporarily-unreachable CDN degrades the *quality* of
// the sound, never breaks the track outright.
//
// Source repo: ADJ189/Ambient-Sounds, files laid out as
// opus/<category>/<name>.opus (opus/nature/wind.opus, opus/rain/thunder.opus,
// etc. — see FILE_TRACKS below for the exact paths this app expects).
// jsDelivr caches by tag — untagged @main content can take up to 24h to
// update after a push, so bump the tag (@v1 → @v2 → ...) whenever the
// files in the repo change, and update the constant below to match.
export const AUDIO_CDN_BASE =
  'https://cdn.jsdelivr.net/gh/ADJ189/Ambient-Sounds@v1';

export const FILE_TRACKS: Record<string, FileTrackConfig> = {
  // ── Existing procedural tracks, now preferring the recording ─────────
  // Paths match ADJ189/Ambient-Sounds's opus/<category>/ layout.
  rain:      { url: '/opus/rain/rain.opus',      crossfadeSec: 2, gainTrim: 0.9,  proceduralFallback: true },
  fire:      { url: '/opus/nature/fire.opus',    crossfadeSec: 3, gainTrim: 0.85, proceduralFallback: true },
  wind:      { url: '/opus/nature/wind.opus',    crossfadeSec: 3, gainTrim: 0.9,  proceduralFallback: true },
  forest:    { url: '/opus/nature/forest.opus',  crossfadeSec: 4, gainTrim: 0.85, proceduralFallback: true },
  cafe:      { url: '/opus/places/cafe.opus',    crossfadeSec: 3, gainTrim: 0.85, proceduralFallback: true },
  library:   { url: '/opus/places/library.opus', crossfadeSec: 3, gainTrim: 0.85, proceduralFallback: true },
  waves:     { url: '/opus/nature/waves.opus',   crossfadeSec: 3, gainTrim: 0.9,  proceduralFallback: true },
  // ── Recording-only tracks — atomic layers meant to be mixed with the
  // ones above (river under rain, thunder under rain, etc.) rather than
  // pre-combined, matching how both reference apps structure theirs. Most
  // of these now have an ambiently preset as their fallback too (see
  // MAKERS in sound.ts) — `proceduralFallback: true` here just means "some
  // fallback exists, don't grey this out," not which kind. waterfall is
  // the one genuine exception: no ambiently preset is a good match for it,
  // so it really is disabled on a browser without Ogg/Opus support. ─────
  river:     { url: '/opus/nature/river.opus',     crossfadeSec: 2, gainTrim: 0.9,  proceduralFallback: true },
  waterfall: { url: '/opus/nature/waterfall.opus', crossfadeSec: 2, gainTrim: 0.85 },
  thunder:   { url: '/opus/rain/thunder.opus',     crossfadeSec: 4, gainTrim: 0.8,  proceduralFallback: true },
  night:     { url: '/opus/nature/night.opus',     crossfadeSec: 3, gainTrim: 0.85, proceduralFallback: true }, // crickets
  birds:     { url: '/opus/animals/birds.opus',    crossfadeSec: 3, gainTrim: 0.85, proceduralFallback: true },
};

export function isFileBackedTrack(id: string): boolean { return id in FILE_TRACKS; }

/** False only when a track has no working audio path at all: Opus
 *  unsupported and no procedural fallback to drop back to. In practice
 *  that's the five recording-only tracks (river/waterfall/thunder/night/
 *  birds) on a browser that can't decode Ogg/Opus — old Safari/iOS below
 *  17. The seven hybrid tracks are never disabled here: MAKERS in sound.ts
 *  falls back to their original synthesized version regardless, so their
 *  mixer toggle always does something. */
export function isFileTrackSupported(id: string): boolean {
  const cfg = FILE_TRACKS[id];
  if (!cfg) return true;
  return CAPS.oggOpus || !!cfg.proceduralFallback;
}

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
  private rafHandle = 0;
  private intervalHandle = 0;
  private crossfadeSwapHandle = 0;
  private crossfading = false;
  private stopped = false;
  // True while waiting on the replacement element to actually be able to
  // play (see crossfade() below) — kept separate from `crossfading` so an
  // 'ended' event on the outgoing element during this window still falls
  // through to hardSwap() instead of finding the guard closed and going
  // silent with nothing scheduled to recover it.
  private awaitingReady = false;
  private cancelAwaitReady: (() => void) | null = null;
  // True once either element has actually produced audio at least once.
  // Distinguishes "the file loaded fine, then had a mid-session network
  // blip" (leave it alone — attemptPlay()'s retry-on-next-gesture already
  // covers a transient autoplay rejection, and a blip after real playback
  // is rare and self-corrects when the browser retries the stream) from
  // "this file was never reachable in the first place" (wrong URL, CORS
  // misconfigured, CDN down) — only the latter calls onUnavailable.
  private everPlayed = false;

  constructor(private ctx: AudioContext, private cfg: FileTrackConfig, private onUnavailable?: () => void) {
    const make = () => {
      const el = new Audio();
      // Data-saver / known-slow connections: don't buffer ahead at all
      // until play() actually requests it. Touch devices default to
      // metadata-only (duration, first frame) rather than eagerly pulling
      // the whole file over what's often a metered connection; desktop
      // buffers ahead for a snappier, gap-free start.
      el.preload = CAPS.saveData ? 'none' : (IS_TOUCH ? 'metadata' : 'auto');
      el.loop = false; // looping is driven manually below, for the crossfade
      // Needed whenever AUDIO_CDN_BASE points off-origin (jsDelivr etc.):
      // MediaElementAudioSourceNode taints the whole graph it's connected
      // to — silently breaking anything downstream that reads sample data,
      // like the analyser the VU meter runs off — unless the element has
      // CORS mode set AND the response actually carries an
      // Access-Control-Allow-Origin header (jsDelivr always sends one; a
      // same-origin '/sounds/...' request ignores this attribute entirely,
      // so it's harmless to set unconditionally).
      el.crossOrigin = 'anonymous';
      el.src = AUDIO_CDN_BASE + cfg.url;
      el.addEventListener('playing', () => { this.everPlayed = true; });
      el.addEventListener('error', () => {
        if (this.stopped || this.everPlayed) return; // a blip after real playback, not an outage — leave it
        this.stop();
        this.onUnavailable?.();
      });
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
      p.catch(() => {
        if (this.stopped) return; // don't resurrect a player that was already torn down
        pendingResume.add(this);
        ensureRetryListener();
      });
    }
  }

  /** Called from the shared gesture-retry listener above. */
  retryPlay(): void {
    if (this.stopped) { pendingResume.delete(this); return; }
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

  /** Watches for the loop boundary two ways at once: requestAnimationFrame
   *  while the tab is visible, which re-checks every frame (~16ms) — the
   *  Web equivalent of the precise position check Metrolist schedules its
   *  ExoPlayer crossfade from, rather than a coarse poll — plus a 250ms
   *  setInterval as a background-tab safety net, since rAF itself is
   *  throttled or fully paused there. Both funnel into the same
   *  maybeCrossfade() check, which is safe to call redundantly: crossfade()
   *  sets `crossfading` as its very first synchronous statement, so even
   *  if both fire in the same tick only one actually starts a crossfade. */
  private watch(): void {
    this.stopWatch();
    const rafTick = () => {
      if (this.stopped || this.crossfading) return;
      this.maybeCrossfade();
      if (!this.stopped && !this.crossfading) this.rafHandle = requestAnimationFrame(rafTick);
    };
    this.rafHandle = requestAnimationFrame(rafTick);
    this.intervalHandle = window.setInterval(() => this.maybeCrossfade(), 250);
  }

  private stopWatch(): void {
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    clearInterval(this.intervalHandle);
  }

  private maybeCrossfade(): void {
    if (this.stopped || this.crossfading || this.awaitingReady) return;
    const el = this.els[this.active];
    if (!isFinite(el.duration)) return; // metadata not loaded yet
    if (el.currentTime >= el.duration - this.cfg.crossfadeSec) this.crossfade();
  }

  /** Kicks off the swap to the other element. On a normal connection the
   *  inactive element already has data buffered (see primeOther()) and we
   *  can start the gain automation immediately. On save-data/2G, though,
   *  el.preload is 'none', so the replacement has nothing buffered yet and
   *  play() has to fetch before it can actually produce audio — fading the
   *  outgoing track out on the usual timer in that case just means dead
   *  air (or an abrupt late onset once the replacement finally catches
   *  up). So when the replacement isn't ready, keep the current element
   *  audible and wait for it to actually be able to play before starting
   *  the fade at all. */
  private crossfade(): void {
    this.stopWatch();
    const from = this.active;
    const to: 0 | 1 = from === 0 ? 1 : 0;
    const toEl = this.els[to];

    toEl.currentTime = 0;
    this.attemptPlay(toEl); // triggers loading even under preload:'none'

    if (toEl.readyState >= toEl.HAVE_FUTURE_DATA) {
      this.beginCrossfadeFade(from, to);
      return;
    }

    // Not buffered yet. `crossfading` stays false during this wait so the
    // outgoing element's 'ended' handler can still fire hardSwap() as a
    // fallback if it reaches its natural end before the replacement is
    // ready — that's a real possibility on a slow connection with a short
    // crossfadeSec, and it's still strictly better than silence.
    this.awaitingReady = true;
    const onCanPlay = () => {
      cleanup();
      if (this.stopped) return;
      this.awaitingReady = false;
      this.beginCrossfadeFade(from, to);
    };
    const cleanup = () => {
      toEl.removeEventListener('canplay', onCanPlay);
      this.cancelAwaitReady = null;
    };
    toEl.addEventListener('canplay', onCanPlay, { once: true });
    this.cancelAwaitReady = cleanup;
  }

  private beginCrossfadeFade(from: 0 | 1, to: 0 | 1): void {
    if (this.stopped) return;
    this.crossfading = true;
    const now = this.ctx.currentTime;
    const dur = this.cfg.crossfadeSec;

    // Equal-power (cosine/sine) crossfade rather than a linear ramp — two
    // linearly-faded signals dip audibly in the middle of the overlap
    // since they don't sum back to unity gain; equal-power keeps perceived
    // loudness roughly constant through the whole transition. 128 points
    // (same resolution monochrome's crossfadeToNext uses) is plenty smooth
    // for a 2-4s window without generating an oversized curve array.
    const fromGain = this.gains[from];
    const toGain = this.gains[to];
    let scheduled = false;
    try {
      const steps = 128;
      const curveOut = new Float32Array(steps);
      const curveIn = new Float32Array(steps);
      for (let i = 0; i < steps; i++) {
        const t = (i / (steps - 1)) * (Math.PI / 2);
        curveOut[i] = Math.cos(t);
        curveIn[i] = Math.sin(t);
      }
      fromGain.gain.cancelScheduledValues(now);
      toGain.gain.cancelScheduledValues(now);
      fromGain.gain.setValueCurveAtTime(curveOut, now, dur);
      toGain.gain.setValueCurveAtTime(curveIn, now, dur);
      scheduled = true;
    } catch {
      // Overlapping AudioParam automation can occasionally throw
      // NotSupportedError; a plain rAF-driven fade is a safe fallback —
      // same escape hatch monochrome's crossfadeToNext falls back to.
    }
    if (!scheduled) {
      const startedAt = performance.now();
      const manualFade = () => {
        if (this.stopped) return;
        const progress = Math.min(1, (performance.now() - startedAt) / (dur * 1000));
        const t = progress * (Math.PI / 2);
        try {
          fromGain.gain.value = Math.cos(t);
          toGain.gain.value = Math.sin(t);
        } catch { return; }
        if (progress < 1) requestAnimationFrame(manualFade);
      };
      requestAnimationFrame(manualFade);
    }

    this.crossfadeSwapHandle = window.setTimeout(() => {
      // stop() may have run while this crossfade was in flight — bail out
      // rather than reviving a watch() loop on a player that's already
      // torn down (that loop would then never get cleared).
      if (this.stopped) return;
      const oldEl = this.els[from];
      try { oldEl.pause(); oldEl.currentTime = 0; } catch { /* ignore */ }
      this.active = to;
      this.crossfading = false;
      this.primeOther();
      this.watch();
    }, dur * 1000 + 30);
  }

  private hardSwap(): void {
    // Cancel any in-flight "waiting for the replacement to be ready" state
    // from crossfade() — hardSwap is about to force a swap to whichever
    // element is active right now, so that listener would otherwise fire
    // later with a stale from/to pair.
    if (this.cancelAwaitReady) { this.cancelAwaitReady(); }
    this.awaitingReady = false;
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
    this.stopWatch();
    clearTimeout(this.crossfadeSwapHandle);
    if (this.cancelAwaitReady) { this.cancelAwaitReady(); }
    this.awaitingReady = false;
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
/** Matches the { out, nodes } shape every procedural maker in sound.ts
 *  returns, so it drops straight into the same MAKERS dispatch table. The
 *  loop player is exposed only via a `_customStop` proxy node — same
 *  pattern sound.ts already uses for its own scheduler-backed tracks
 *  (forest's chirps, fire's crackle) — so playTrack/stopTrack need no
 *  special-casing for file-backed tracks at all.
 *
 *  `fallback`, when given, is invoked if the recording never becomes
 *  playable at all — wrong URL, CORS misconfigured, the CDN it's hosted on
 *  being unreachable — rather than the track just going silent with no
 *  toggle to explain why. sound.ts passes its ambiently-backed
 *  makeSynthTrack() here for the tracks that have one. The swap happens
 *  underneath a stable output GainNode the caller connects to once, so
 *  playTrack() never needs to know playback quietly changed source.
 *
 *  `onDead`, when given, fires if the recording is unavailable *and*
 *  there's no fallback to adopt (or the fallback itself returns null) —
 *  i.e. the track has no working audio path left at all. Without this,
 *  the caller's trackNodes/isPlaying bookkeeping has no way to learn that
 *  a track it thinks is playing has gone permanently silent underneath
 *  it. sound.ts passes stopTrack(id) here for waterfall, the one track
 *  with no fallback maker. */
export function makeFileTrack(
  ctx: AudioContext,
  id: string,
  fallback?: () => { out: AudioNode; nodes: AudioNode[] } | null,
  onDead?: () => void,
): { out: AudioNode; nodes: AudioNode[] } | null {
  const cfg = FILE_TRACKS[id];
  if (!cfg || !CAPS.oggOpus) return fallback ? fallback() : null;

  const out = ctx.createGain();
  let activeStop = () => {};

  const useFallback = () => {
    activeStop();
    const alt = fallback?.();
    if (!alt) { activeStop = () => {}; onDead?.(); return; }
    alt.out.connect(out);
    // Mirrors playTrack()'s own start-loop in sound.ts: a maker's returned
    // nodes are normally started there, but this swap happens later and
    // asynchronously (the recording failed mid-session), bypassing that
    // loop entirely — so scheduled source nodes here need to be started
    // explicitly, or the adopted fallback sits connected but silent.
    alt.nodes.forEach(n => {
      if ((n as any)._customStop) return; // skip custom stop proxies
      if ('start' in n && typeof (n as AudioScheduledSourceNode).start === 'function' && !(n as any)._started) {
        try { (n as AudioScheduledSourceNode).start(); (n as any)._started = true; } catch {}
      }
    });
    activeStop = () => alt.nodes.forEach(n => {
      const custom = (n as any)._customStop;
      if (custom) custom();
      else if ('stop' in n && typeof (n as any).stop === 'function') (n as any).stop();
    });
  };

  const player = new GaplessLoopPlayer(ctx, cfg, useFallback);
  player.out.connect(out);
  activeStop = () => player.stop();
  player.start();

  const stopProxy = ctx.createGain(); stopProxy.gain.value = 0;
  (stopProxy as any)._customStop = () => activeStop();
  return { out, nodes: [stopProxy] };
}
