// ── Session Clock Ambient Synthesis Engine ─────────────────────────────
// A fully custom, dependency-free procedural audio engine. It builds ordinary
// Web Audio nodes and returns the app's existing maker contract:
//
//   { out: AudioNode, nodes: AudioNode[] }
//
// via soundsynth.ts. It never connects to `ctx.destination` and never creates
// a second AudioContext: the caller's mixer, per-track gain, analyser,
// spatial rig and compressor stay in charge.
//
// Coverage: every sound ID in sound.ts has an implementation. Recorded CDN
// tracks still take priority; this engine is their fallback and the primary
// source for non-recorded presets.

import { createRandom, type RandomSource } from "./prng";
import {
  createNoiseSource,
  getNoiseBuffer,
  getNoiseCacheBytes,
  type NoiseColor,
} from "./noise";
import {
  chainFilters,
  createNoiseHit,
  createThump,
  createToneTransient,
  makeGain,
  makeLfo,
  makePanner,
  type FilterSpec,
} from "./dsp";
import { EventScheduler } from "./scheduler";
import { getDiagnosticsRuntime } from "../diagnostics";

export const AMBIENT_PRESET_IDS = [
  "rain",
  "roofrain",
  "white",
  "pink",
  "brown",
  "forest",
  "cafe",
  "ocean",
  "fire",
  "wind",
  "snow",
  "keyboard",
  "library",
  "airplane",
  "spaceship",
  "campfire",
  "waves",
  "river",
  "waterfall",
  "thunder",
  "night",
  "birds",
  "hum",
  "frogs",
  "city",
  "fan",
  "clock",
  "vinyl",
  "heartbeat",
  "drone",
  "space",
  "lofi",
  "pad",
  "musicbox",
  "bells",
] as const;

export type AmbientPresetId = (typeof AMBIENT_PRESET_IDS)[number];

export interface AmbientVoiceStats {
  preset: AmbientPresetId;
  nodes: number;
  sources: number;
  tasks: number;
  noiseCacheBytes: number;
}

export interface AmbientVoice {
  readonly preset: AmbientPresetId;
  readonly output: GainNode;
  readonly active: boolean;
  start(): void;
  stop(): void;
  stats(): AmbientVoiceStats;
}

export interface AmbientVoiceOptions {
  seed?: number;
  /** Test hook: keeps scheduling deterministic and disables wall timers. */
  manualScheduler?: boolean;
}

interface EngineStats {
  activeVoices: number;
  createdVoices: number;
  stoppedVoices: number;
  peakActiveVoices: number;
  buildErrors: number;
  schedulerErrors: number;
}

const engineStats: EngineStats = {
  activeVoices: 0,
  createdVoices: 0,
  stoppedVoices: 0,
  peakActiveVoices: 0,
  buildErrors: 0,
  schedulerErrors: 0,
};

export function getEngineStats(): Readonly<EngineStats> {
  return { ...engineStats };
}

export function getActiveVoiceCount(): number {
  return engineStats.activeVoices;
}

function reportAudioError(message: string, error?: unknown): void {
  try {
    getDiagnosticsRuntime()?.record({
      subsystem: "audio",
      kind: "error",
      message,
      error,
      details: { activeVoices: engineStats.activeVoices },
    });
  } catch {
    // Audio must keep working even if diagnostics is unavailable.
  }
}

class VoiceScope {
  private nodes = new Set<AudioNode>();
  private sources = new Set<AudioScheduledSourceNode>();
  private cleanups = new Set<() => void>();
  private disposed = false;

  get nodeCount(): number {
    return this.nodes.size;
  }

  get sourceCount(): number {
    return this.sources.size;
  }

  track<T extends AudioNode>(node: T): T {
    this.nodes.add(node);
    return node;
  }

  trackSource<T extends AudioScheduledSourceNode>(source: T): T {
    this.nodes.add(source);
    this.sources.add(source);
    return source;
  }

  cleanup(fn: () => void): void {
    this.cleanups.add(fn);
  }

  /** Release a one-shot's graph after it has ended, keeping memory bounded. */
  releaseOnEnd(
    source: AudioScheduledSourceNode,
    nodes: AudioNode[],
  ): void {
    const release = () => {
      for (const node of nodes) {
        this.nodes.delete(node);
        try {
          node.disconnect();
        } catch {
          // Already disconnected.
        }
      }
      this.sources.delete(source);
      this.nodes.delete(source);
    };
    try {
      source.onended = release;
    } catch {
      // Older engines may not expose onended; stop() still disconnects.
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const cleanup of this.cleanups) {
      try {
        cleanup();
      } catch {
        // Cleanup is best-effort.
      }
    }
    this.cleanups.clear();
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    for (const node of this.nodes) {
      try {
        node.disconnect();
      } catch {
        // Already disconnected.
      }
    }
    this.nodes.clear();
    this.sources.clear();
  }
}

interface StartRecord {
  node: AudioScheduledSourceNode;
  when: number;
  offset?: number;
}

interface NoiseBedOptions {
  gain?: number;
  filters?: FilterSpec[];
  pan?: number;
  seconds?: number;
  lfo?: { frequency: number; depth: number; type?: OscillatorType };
}

interface ToneOptions {
  gain?: number;
  type?: OscillatorType;
  pan?: number;
  detune?: number;
  lfo?: { frequency: number; depth: number; type?: OscillatorType };
}

/**
 * Per-voice builder. Presets only describe layers and events; this class
 * owns starting, stopping, tracking and scheduled-event cleanup.
 */
class Rig {
  readonly ctx: BaseAudioContext;
  readonly preset: AmbientPresetId;
  readonly out: GainNode;
  readonly rng: RandomSource;
  readonly scheduler: EventScheduler;
  private scope = new VoiceScope();
  private starts: StartRecord[] = [];
  private started = false;
  private manualScheduler: boolean;

  constructor(
    ctx: BaseAudioContext,
    preset: AmbientPresetId,
    options: AmbientVoiceOptions = {},
  ) {
    this.ctx = ctx;
    this.preset = preset;
    this.rng = createRandom(options.seed);
    this.manualScheduler = options.manualScheduler === true;
    this.out = this.scope.track(makeGain(ctx, 0.75));
    this.scheduler = new EventScheduler(ctx, {
      autoStart: !this.manualScheduler,
      onError: (error) => {
        engineStats.schedulerErrors++;
        reportAudioError(`Scheduler error in ${preset}`, error);
      },
    });
    this.scope.cleanup(() => this.scheduler.clearTasks());
  }

  noiseBed(color: NoiseColor, options: NoiseBedOptions = {}): GainNode {
    const seconds = options.seconds ?? 4;
    const { source, phase } = createNoiseSource(this.ctx, color, {
      seconds,
      phase: this.rng.range(0, seconds * 0.8),
    });
    this.scope.trackSource(source);
    this.starts.push({ node: source, when: this.ctx.currentTime + 0.01, offset: phase });

    let node = chainFilters(this.ctx, source, options.filters ?? []);
    const gain = this.scope.track(makeGain(this.ctx, options.gain ?? 0.2));
    node.connect(gain);
    node = gain;
    if (options.pan != null) {
      const pan = this.scope.track(makePanner(this.ctx, options.pan));
      node.connect(pan);
      node = pan;
    }
    node.connect(this.out);

    if (options.lfo) {
      const lfo = makeLfo(this.ctx, options.lfo);
      this.scope.track(lfo.oscillator);
      this.scope.track(lfo.gain);
      lfo.oscillator.connect(lfo.gain);
      lfo.gain.connect(gain.gain);
      this.starts.push({
        node: lfo.oscillator,
        when: this.ctx.currentTime + 0.01,
      });
    }
    return gain;
  }

  tone(frequency: number, options: ToneOptions = {}): OscillatorNode {
    const oscillator = this.ctx.createOscillator();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.value = Math.max(10, Math.min(20000, frequency));
    if (options.detune != null) oscillator.detune.value = options.detune;
    this.scope.trackSource(oscillator);

    const gain = this.scope.track(makeGain(this.ctx, options.gain ?? 0.02));
    oscillator.connect(gain);
    let node: AudioNode = gain;
    if (options.pan != null) {
      const pan = this.scope.track(makePanner(this.ctx, options.pan));
      node.connect(pan);
      node = pan;
    }
    node.connect(this.out);

    if (options.lfo) {
      const lfo = makeLfo(this.ctx, options.lfo);
      this.scope.track(lfo.oscillator);
      this.scope.track(lfo.gain);
      lfo.oscillator.connect(lfo.gain);
      lfo.gain.connect(oscillator.detune);
      this.starts.push({
        node: lfo.oscillator,
        when: this.ctx.currentTime + 0.01,
      });
    }

    this.starts.push({
      node: oscillator,
      when: this.ctx.currentTime + 0.01,
    });
    return oscillator;
  }

  /** Recurring discrete event on the shared audio-clock scheduler. */
  event(
    minSeconds: number,
    maxSeconds: number,
    run: (time: number) => void,
  ): void {
    this.scheduler.add(minSeconds, maxSeconds, run);
  }

  toneAt(
    time: number,
    frequency: number,
    duration: number,
    gain: number,
    options: {
      endFrequency?: number;
      type?: OscillatorType;
      pan?: number;
    } = {},
  ): void {
    const t = createToneTransient(this.ctx, time, {
      frequency,
      endFrequency: options.endFrequency,
      duration,
      gain,
      type: options.type ?? "sine",
      pan: options.pan ?? this.rng.pm(0.5),
    });
    t.gain.disconnect();
    const pan = this.scope.track(makePanner(this.ctx, options.pan ?? 0));
    t.gain.connect(pan);
    pan.connect(this.out);
    this.scope.trackSource(t.oscillator);
    this.scope.releaseOnEnd(t.oscillator, [t.oscillator, t.gain, pan]);
    try {
      t.oscillator.start(Math.max(this.ctx.currentTime, time));
      t.oscillator.stop(t.stopAt);
    } catch {
      // If scheduling fails the event is silently skipped, never retried.
    }
  }

  noiseAt(
    time: number,
    options: {
      color?: NoiseColor;
      duration: number;
      gain: number;
      filter?: FilterSpec;
      pan?: number;
      playbackRate?: number;
    },
  ): void {
    const buffer = getNoiseBuffer(this.ctx, options.color ?? "white");
    const hit = createNoiseHit(this.ctx, buffer, time, {
      ...options,
      pan: options.pan ?? this.rng.pm(0.6),
    });
    hit.pan.connect(this.out);
    this.scope.trackSource(hit.source);
    this.scope.track(hit.filter);
    this.scope.track(hit.gain);
    this.scope.track(hit.pan);
    this.scope.releaseOnEnd(hit.source, [
      hit.source,
      hit.filter,
      hit.gain,
      hit.pan,
    ]);
  }

  thumpAt(time: number, frequency: number, gain: number, duration: number): void {
    const t = createThump(this.ctx, time, frequency, gain, duration);
    t.gain.connect(this.out);
    this.scope.trackSource(t.oscillator);
    this.scope.track(t.gain);
    this.scope.releaseOnEnd(t.oscillator, [t.oscillator, t.gain]);
    try {
      t.oscillator.start(Math.max(this.ctx.currentTime, time));
      t.oscillator.stop(t.stopAt);
    } catch {
      // Skipped.
    }
  }

  bellAt(time: number, base: number, gain = 0.04): void {
    const partials = [
      { ratio: 1, amp: 1, decay: 2.4 },
      { ratio: 2.01, amp: 0.55, decay: 1.8 },
      { ratio: 2.76, amp: 0.35, decay: 1.3 },
      { ratio: 5.4, amp: 0.18, decay: 0.9 },
    ];
    for (const p of partials) {
      this.toneAt(time, base * p.ratio, p.decay, gain * p.amp, {
        type: "sine",
        pan: this.rng.pm(0.4),
      });
    }
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    for (const record of this.starts) {
      try {
        if (record.offset != null) {
          // Only buffer sources take an offset; they are the only records
          // that set one, so the narrowing is safe.
          (record.node as AudioBufferSourceNode).start(
            record.when,
            record.offset,
          );
        } else {
          record.node.start(record.when);
        }
      } catch {
        // A single failed source must not stop the rest of the layer.
      }
    }
    // The scheduler is only useful once the voice is actually running.
    if (!this.manualScheduler && this.scheduler.activeTasks > 0) {
      this.scheduler.start();
    }
  }

  stop(): void {
    this.scheduler.clearTasks();
    this.scope.dispose();
  }

  stats(): AmbientVoiceStats {
    return {
      preset: this.preset,
      nodes: this.scope.nodeCount,
      sources: this.scope.sourceCount,
      tasks: this.scheduler.activeTasks,
      noiseCacheBytes: getNoiseCacheBytes(this.ctx),
    };
  }
}

// ── Preset families ────────────────────────────────────────────────────

function noisePresets(r: Rig): void {
  switch (r.preset) {
    case "white":
      r.noiseBed("white", {
        gain: 0.14,
        filters: [{ type: "lowpass", frequency: 12000, q: 0.5 }],
      });
      break;
    case "pink":
      r.noiseBed("pink", {
        gain: 0.22,
        filters: [{ type: "lowpass", frequency: 9000, q: 0.5 }],
      });
      break;
    case "brown":
      r.noiseBed("brown", {
        gain: 0.28,
        filters: [{ type: "lowpass", frequency: 1100, q: 0.6 }],
      });
      r.tone(42, { gain: 0.018, type: "sine" });
      break;
    case "hum":
      r.noiseBed("brown", {
        gain: 0.045,
        filters: [{ type: "lowpass", frequency: 280, q: 0.7 }],
      });
      r.tone(50, {
        gain: 0.028,
        lfo: { frequency: 0.09, depth: 1.5 },
      });
      r.tone(100, { gain: 0.012 });
      r.tone(150, { gain: 0.004 });
      break;
    case "wind": {
      // Two decorrelated beds: a low body plus a moving bandpass band.
      r.noiseBed("brown", {
        gain: 0.11,
        filters: [{ type: "lowpass", frequency: 850, q: 0.5 }],
        lfo: { frequency: 0.055, depth: 0.025 },
      });
      r.noiseBed("pink", {
        gain: 0.05,
        filters: [
          { type: "bandpass", frequency: 620, q: 0.6 },
          { type: "lowpass", frequency: 2400, q: 0.5 },
        ],
        lfo: { frequency: 0.11, depth: 0.018 },
      });
      r.event(1.4, 4.2, (t) => {
        r.noiseAt(t, {
          color: "pink",
          duration: r.rng.range(0.7, 1.6),
          gain: r.rng.range(0.02, 0.055),
          filter: {
            type: "bandpass",
            frequency: r.rng.range(380, 1150),
            q: 0.7,
          },
        });
      });
      break;
    }
    case "snow": {
      // Airy, near-silent hush with a very slow swell.
      r.noiseBed("pink", {
        gain: 0.055,
        filters: [
          { type: "highpass", frequency: 320, q: 0.4 },
          { type: "lowpass", frequency: 5600, q: 0.5 },
        ],
        lfo: { frequency: 0.02, depth: 0.012 },
      });
      r.noiseBed("brown", {
        gain: 0.025,
        filters: [{ type: "lowpass", frequency: 520, q: 0.5 }],
      });
      break;
    }
    default:
      break;
  }
}

function waterPresets(r: Rig): void {
  switch (r.preset) {
    case "rain": {
      r.noiseBed("white", {
        gain: 0.13,
        filters: [
          { type: "highpass", frequency: 500, q: 0.7 },
          { type: "lowpass", frequency: 9000, q: 0.6 },
        ],
      });
      r.noiseBed("pink", {
        gain: 0.09,
        filters: [{ type: "lowpass", frequency: 2600, q: 0.6 }],
      });
      r.event(0.08, 0.55, (t) => {
        r.noiseAt(t, {
          duration: r.rng.range(0.03, 0.09),
          gain: r.rng.range(0.04, 0.14),
          filter: {
            type: "bandpass",
            frequency: r.rng.range(1600, 6500),
            q: 1.4,
          },
        });
      });
      break;
    }
    case "roofrain": {
      r.noiseBed("white", {
        gain: 0.16,
        filters: [
          { type: "highpass", frequency: 700, q: 0.7 },
          { type: "lowpass", frequency: 9500, q: 0.6 },
          { type: "peaking", frequency: 3200, q: 3.5, gainDb: 6 },
        ],
      });
      r.noiseBed("brown", {
        gain: 0.12,
        filters: [{ type: "lowpass", frequency: 420, q: 0.7 }],
      });
      r.event(0.05, 0.28, (t) => {
        r.noiseAt(t, {
          duration: r.rng.range(0.02, 0.06),
          gain: r.rng.range(0.06, 0.18),
          filter: { type: "highpass", frequency: r.rng.range(1200, 4000), q: 0.9 },
        });
      });
      break;
    }
    case "ocean": {
      const swell = r.noiseBed("pink", {
        gain: 0.2,
        filters: [{ type: "lowpass", frequency: 900, q: 0.5 }],
        lfo: { frequency: 0.065, depth: 0.11 },
      });
      void swell;
      r.noiseBed("white", {
        gain: 0.025,
        filters: [{ type: "highpass", frequency: 1400, q: 0.6 }],
      });
      r.event(4.5, 10, (t) => {
        r.noiseAt(t, {
          duration: r.rng.range(1.6, 3.2),
          gain: r.rng.range(0.035, 0.08),
          filter: { type: "bandpass", frequency: 700, q: 0.6 },
        });
      });
      break;
    }
    case "waves": {
      r.noiseBed("pink", {
        gain: 0.19,
        filters: [{ type: "lowpass", frequency: 780, q: 0.5 }],
        lfo: { frequency: 0.09, depth: 0.12 },
      });
      r.noiseBed("white", {
        gain: 0.035,
        filters: [{ type: "highpass", frequency: 1600, q: 0.6 }],
      });
      r.event(3.5, 8.5, (t) => {
        r.noiseAt(t, {
          duration: r.rng.range(0.8, 1.8),
          gain: r.rng.range(0.05, 0.11),
          filter: { type: "bandpass", frequency: 1200, q: 0.7 },
        });
      });
      break;
    }
    case "river": {
      r.noiseBed("white", {
        gain: 0.13,
        filters: [
          { type: "bandpass", frequency: 950, q: 0.55 },
          { type: "lowpass", frequency: 5200, q: 0.5 },
        ],
      });
      r.noiseBed("pink", {
        gain: 0.055,
        filters: [{ type: "bandpass", frequency: 2100, q: 1.1 }],
      });
      r.noiseBed("brown", {
        gain: 0.04,
        filters: [{ type: "lowpass", frequency: 220, q: 0.6 }],
      });
      break;
    }
    case "waterfall": {
      // The audit found Waterfall was the one file-backed sound without a
      // procedural fallback. This is that fallback: roar, spray, rumble.
      r.noiseBed("brown", {
        gain: 0.2,
        filters: [{ type: "lowpass", frequency: 620, q: 0.6 }],
      });
      r.noiseBed("white", {
        gain: 0.095,
        filters: [
          { type: "bandpass", frequency: 1900, q: 0.5 },
          { type: "lowpass", frequency: 7000, q: 0.5 },
        ],
        lfo: { frequency: 0.12, depth: 0.025 },
      });
      r.noiseBed("pink", {
        gain: 0.04,
        filters: [{ type: "highpass", frequency: 3000, q: 0.6 }],
      });
      r.tone(40, { gain: 0.022, type: "sine" });
      r.event(0.15, 0.7, (t) => {
        r.noiseAt(t, {
          duration: r.rng.range(0.05, 0.18),
          gain: r.rng.range(0.02, 0.06),
          filter: {
            type: "bandpass",
            frequency: r.rng.range(1800, 6000),
            q: 1.2,
          },
        });
      });
      break;
    }
    case "thunder": {
      r.noiseBed("white", {
        gain: 0.08,
        filters: [
          { type: "highpass", frequency: 400, q: 0.6 },
          { type: "lowpass", frequency: 7000, q: 0.5 },
        ],
      });
      r.noiseBed("brown", {
        gain: 0.07,
        filters: [{ type: "lowpass", frequency: 300, q: 0.5 }],
      });
      r.event(12, 34, (t) => {
        r.noiseAt(t, {
          color: "brown",
          duration: r.rng.range(2.5, 5.5),
          gain: r.rng.range(0.08, 0.16),
          filter: { type: "lowpass", frequency: 180, q: 0.7 },
          pan: r.rng.pm(0.5),
        });
        r.thumpAt(t + 0.1, 42, 0.05, r.rng.range(1.2, 2.2));
      });
      break;
    }
    default:
      break;
  }
}

function firePresets(r: Rig): void {
  switch (r.preset) {
    case "fire":
    case "campfire": {
      const outdoor = r.preset === "campfire";
      r.noiseBed("brown", {
        gain: outdoor ? 0.1 : 0.12,
        filters: [{ type: "lowpass", frequency: 480, q: 0.6 }],
      });
      r.noiseBed("white", {
        gain: outdoor ? 0.025 : 0.03,
        filters: [{ type: "bandpass", frequency: 2400, q: 0.8 }],
      });
      if (outdoor) {
        r.noiseBed("pink", {
          gain: 0.035,
          filters: [{ type: "lowpass", frequency: 420, q: 0.5 }],
          lfo: { frequency: 0.07, depth: 0.02 },
        });
      }
      r.event(0.06, 0.4, (t) => {
        r.noiseAt(t, {
          duration: r.rng.range(0.02, 0.07),
          gain: r.rng.range(0.025, 0.11),
          filter: {
            type: "bandpass",
            frequency: r.rng.range(1800, 6000),
            q: 1.5,
          },
        });
      });
      r.event(0.5, 2.2, (t) => {
        r.noiseAt(t, {
          color: "brown",
          duration: r.rng.range(0.08, 0.2),
          gain: r.rng.range(0.03, 0.08),
          filter: { type: "lowpass", frequency: 500, q: 0.7 },
        });
      });
      break;
    }
    case "vinyl": {
      r.noiseBed("white", {
        gain: 0.022,
        filters: [{ type: "highpass", frequency: 1600, q: 0.6 }],
      });
      r.noiseBed("brown", {
        gain: 0.02,
        filters: [{ type: "lowpass", frequency: 240, q: 0.6 }],
      });
      r.event(0.08, 0.7, (t) => {
        r.noiseAt(t, {
          duration: r.rng.range(0.004, 0.022),
          gain: r.rng.range(0.01, 0.05),
          filter: {
            type: "bandpass",
            frequency: r.rng.range(1200, 5200),
            q: 2,
          },
        });
      });
      r.event(4, 12, (t) => {
        r.noiseAt(t, {
          color: "brown",
          duration: 0.05,
          gain: 0.03,
          filter: { type: "lowpass", frequency: 700, q: 0.6 },
        });
      });
      break;
    }
    default:
      break;
  }
}

function wildlifePresets(r: Rig): void {
  switch (r.preset) {
    case "forest": {
      r.noiseBed("pink", {
        gain: 0.075,
        filters: [{ type: "lowpass", frequency: 820, q: 0.5 }],
      });
      r.noiseBed("white", {
        gain: 0.04,
        filters: [{ type: "bandpass", frequency: 3600, q: 1.6 }],
        lfo: { frequency: 0.13, depth: 0.018 },
      });
      r.event(3, 11, (t) => {
        const notes = r.rng.int(2, 5);
        const base = r.rng.range(2100, 4200);
        for (let n = 0; n < notes; n++) {
          r.toneAt(
            t + n * r.rng.range(0.08, 0.16),
            base * (1 + n * 0.06),
            0.06,
            0.02,
            {
              endFrequency: base * 1.25,
              pan: r.rng.pm(0.7),
            },
          );
        }
      });
      break;
    }
    case "night": {
      r.noiseBed("brown", {
        gain: 0.012,
        filters: [{ type: "lowpass", frequency: 250, q: 0.5 }],
      });
      const cricket = (base: number, amp: number) => {
        r.event(0.55, 1.5, (t) => {
          const pulses = r.rng.int(2, 4);
          for (let p = 0; p < pulses; p++) {
            r.toneAt(
              t + p * 0.055,
              base + r.rng.pm(90),
              0.035,
              amp,
              { pan: r.rng.pm(0.8) },
            );
          }
        });
      };
      cricket(4300, 0.018);
      cricket(3300, 0.012);
      break;
    }
    case "birds": {
      r.noiseBed("pink", {
        gain: 0.018,
        filters: [{ type: "lowpass", frequency: 1200, q: 0.5 }],
      });
      r.event(2.5, 9, (t) => {
        const notes = r.rng.int(2, 6);
        const base = r.rng.range(1700, 4400);
        for (let n = 0; n < notes; n++) {
          const f = base * r.rng.range(0.86, 1.4);
          r.toneAt(t + n * r.rng.range(0.07, 0.19), f, 0.09, 0.028, {
            endFrequency: f * r.rng.range(0.8, 1.5),
            pan: r.rng.pm(0.8),
          });
        }
      });
      break;
    }
    case "frogs": {
      r.noiseBed("brown", {
        gain: 0.016,
        filters: [{ type: "lowpass", frequency: 320, q: 0.5 }],
      });
      r.event(0.7, 2.8, (t) => {
        const base = r.rng.range(160, 420);
        const pulses = r.rng.int(1, 3);
        for (let p = 0; p < pulses; p++) {
          r.toneAt(t + p * 0.12, base, 0.09, 0.035, {
            endFrequency: base * 0.8,
            type: "triangle",
            pan: r.rng.pm(0.7),
          });
        }
      });
      break;
    }
    default:
      break;
  }
}

function placePresets(r: Rig): void {
  switch (r.preset) {
    case "cafe": {
      r.noiseBed("pink", {
        gain: 0.075,
        filters: [
          { type: "bandpass", frequency: 620, q: 0.7 },
          { type: "lowpass", frequency: 3200, q: 0.5 },
        ],
        lfo: { frequency: 0.08, depth: 0.02 },
      });
      r.noiseBed("brown", {
        gain: 0.045,
        filters: [{ type: "lowpass", frequency: 170, q: 0.7 }],
      });
      r.event(2, 7, (t) => {
        r.bellAt(t, r.rng.range(1200, 2800), 0.016);
      });
      break;
    }
    case "library": {
      r.noiseBed("brown", {
        gain: 0.032,
        filters: [{ type: "lowpass", frequency: 260, q: 0.6 }],
      });
      r.noiseBed("white", {
        gain: 0.012,
        filters: [{ type: "lowpass", frequency: 1200, q: 0.5 }],
      });
      r.event(7, 24, (t) => {
        r.noiseAt(t, {
          duration: r.rng.range(0.18, 0.5),
          gain: 0.03,
          filter: { type: "bandpass", frequency: 2600, q: 0.9 },
          pan: r.rng.pm(0.6),
        });
      });
      break;
    }
    case "city": {
      r.noiseBed("brown", {
        gain: 0.1,
        filters: [{ type: "lowpass", frequency: 320, q: 0.5 }],
      });
      r.event(4.5, 14, (t) => {
        r.noiseAt(t, {
          duration: r.rng.range(1.4, 3.4),
          gain: r.rng.range(0.035, 0.075),
          filter: { type: "lowpass", frequency: r.rng.range(500, 1200), q: 0.6 },
          pan: r.rng.range(-0.9, 0.9),
        });
      });
      r.event(14, 34, (t) => {
        r.toneAt(t, r.rng.range(240, 420), 0.5, 0.012, {
          type: "triangle",
          pan: r.rng.pm(0.8),
        });
      });
      break;
    }
    case "keyboard": {
      r.noiseBed("brown", {
        gain: 0.018,
        filters: [{ type: "lowpass", frequency: 300, q: 0.6 }],
      });
      r.event(1.8, 6.5, (t) => {
        const keys = r.rng.int(3, 10);
        let when = t;
        for (let k = 0; k < keys; k++) {
          r.noiseAt(when, {
            duration: 0.018,
            gain: r.rng.range(0.04, 0.09),
            filter: { type: "bandpass", frequency: r.rng.range(1400, 3200), q: 1.8 },
            pan: r.rng.pm(0.5),
          });
          r.toneAt(when, r.rng.range(140, 260), 0.03, 0.025, {
            type: "triangle",
            pan: r.rng.pm(0.4),
          });
          when += r.rng.range(0.06, 0.19);
        }
      });
      break;
    }
    default:
      break;
  }
}

function machinePresets(r: Rig): void {
  switch (r.preset) {
    case "airplane": {
      r.noiseBed("brown", {
        gain: 0.22,
        filters: [{ type: "lowpass", frequency: 140, q: 0.6 }],
        lfo: { frequency: 0.11, depth: 0.025 },
      });
      r.tone(78, { gain: 0.03, lfo: { frequency: 0.09, depth: 3 } });
      r.tone(156, { gain: 0.014 });
      r.noiseBed("white", {
        gain: 0.035,
        filters: [{ type: "lowpass", frequency: 3200, q: 0.5 }],
      });
      break;
    }
    case "spaceship": {
      r.tone(55, {
        gain: 0.04,
        lfo: { frequency: 0.06, depth: 5 },
        type: "sawtooth",
      });
      r.tone(82.5, {
        gain: 0.025,
        lfo: { frequency: 0.043, depth: 4 },
        type: "triangle",
      });
      r.tone(110, { gain: 0.012, detune: 4 });
      r.noiseBed("pink", {
        gain: 0.035,
        filters: [{ type: "lowpass", frequency: 320, q: 0.6 }],
      });
      r.event(6, 14, (t) => {
        r.toneAt(t, r.rng.range(180, 520), 1.8, 0.012, {
          type: "sine",
          endFrequency: r.rng.range(90, 240),
        });
      });
      break;
    }
    case "fan": {
      r.noiseBed("brown", {
        gain: 0.09,
        filters: [{ type: "lowpass", frequency: 220, q: 0.6 }],
      });
      r.tone(60, { gain: 0.02 });
      const airflow = r.noiseBed("white", {
        gain: 0.032,
        filters: [{ type: "bandpass", frequency: 1300, q: 0.8 }],
      });
      void airflow;
      r.noiseBed("white", {
        gain: 0.018,
        filters: [{ type: "bandpass", frequency: 1300, q: 0.8 }],
        lfo: { frequency: 11, depth: 0.012 },
      });
      break;
    }
    default:
      break;
  }
}

function rhythmPresets(r: Rig): void {
  switch (r.preset) {
    case "clock": {
      let tick = 0;
      r.event(1, 1, (t) => {
        const high = tick++ % 2 === 0;
        r.toneAt(t, high ? 1900 : 1450, 0.028, 0.045, {
          type: "square",
          pan: high ? -0.15 : 0.15,
        });
        r.noiseAt(t, {
          duration: 0.012,
          gain: 0.02,
          filter: { type: "bandpass", frequency: 3000, q: 1.4 },
        });
      });
      break;
    }
    case "heartbeat": {
      r.noiseBed("brown", {
        gain: 0.012,
        filters: [{ type: "lowpass", frequency: 180, q: 0.6 }],
      });
      r.event(0.95, 1.25, (t) => {
        r.thumpAt(t, 58, 0.13, 0.16);
        r.thumpAt(t + 0.19, 46, 0.09, 0.2);
      });
      break;
    }
    case "lofi": {
      r.tone(110, {
        gain: 0.018,
        type: "triangle",
        lfo: { frequency: 0.13, depth: 2.5 },
      });
      r.tone(164.8, { gain: 0.012, type: "sine" });
      r.tone(220, { gain: 0.009, type: "sine" });
      r.noiseBed("pink", {
        gain: 0.02,
        filters: [{ type: "lowpass", frequency: 1800, q: 0.5 }],
      });
      let step = 0;
      r.event(0.5, 0.5, (t) => {
        const s = step++ % 8;
        if (s === 0 || s === 3) r.thumpAt(t, 90, 0.06, 0.2);
        if (s === 4) {
          r.noiseAt(t, {
            duration: 0.12,
            gain: 0.028,
            filter: { type: "bandpass", frequency: 2200, q: 1.1 },
          });
        }
        if (s % 2 === 1) {
          r.noiseAt(t, {
            duration: 0.03,
            gain: 0.012,
            filter: { type: "highpass", frequency: 6000, q: 0.7 },
          });
        }
      });
      break;
    }
    default:
      break;
  }
}

function tonalPresets(r: Rig): void {
  switch (r.preset) {
    case "drone": {
      r.tone(55, { gain: 0.035, lfo: { frequency: 0.05, depth: 3 } });
      r.tone(110, { gain: 0.02, type: "triangle" });
      r.tone(164.8, { gain: 0.014, lfo: { frequency: 0.037, depth: 2 } });
      r.tone(220, { gain: 0.008 });
      r.noiseBed("pink", {
        gain: 0.018,
        filters: [{ type: "lowpass", frequency: 500, q: 0.5 }],
      });
      break;
    }
    case "space": {
      r.noiseBed("brown", {
        gain: 0.065,
        filters: [{ type: "lowpass", frequency: 210, q: 0.5 }],
      });
      r.tone(48, { gain: 0.018, lfo: { frequency: 0.02, depth: 1.5 } });
      r.tone(72, { gain: 0.009 });
      r.event(7, 19, (t) => {
        r.bellAt(t, r.rng.range(480, 1400), 0.008);
      });
      break;
    }
    case "pad": {
      const notes = [110, 164.81, 220, 329.63];
      for (const note of notes) {
        r.tone(note, {
          gain: 0.014,
          type: "triangle",
          lfo: { frequency: r.rng.range(0.04, 0.11), depth: 2.5 },
        });
      }
      r.noiseBed("pink", {
        gain: 0.012,
        filters: [{ type: "lowpass", frequency: 1600, q: 0.5 }],
      });
      break;
    }
    case "musicbox": {
      const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
      r.event(1.1, 4.2, (t) => {
        const base = r.rng.pick(scale);
        r.bellAt(t, base, 0.026);
      });
      break;
    }
    case "bells": {
      r.event(4.5, 13, (t) => {
        r.bellAt(t, r.rng.range(220, 720), 0.035);
      });
      break;
    }
    default:
      break;
  }
}

function applyPreset(r: Rig): void {
  noisePresets(r);
  waterPresets(r);
  firePresets(r);
  wildlifePresets(r);
  placePresets(r);
  machinePresets(r);
  rhythmPresets(r);
  tonalPresets(r);
}

// ── Public factory ─────────────────────────────────────────────────────

class AmbientVoiceImpl implements AmbientVoice {
  readonly preset: AmbientPresetId;
  readonly output: GainNode;
  private rig: Rig;
  private running = false;
  private stopped = false;

  constructor(
    ctx: BaseAudioContext,
    preset: AmbientPresetId,
    options: AmbientVoiceOptions,
  ) {
    this.preset = preset;
    this.rig = new Rig(ctx, preset, options);
    try {
      applyPreset(this.rig);
    } catch (error) {
      engineStats.buildErrors++;
      reportAudioError(`Preset build failed: ${preset}`, error);
      // A failed preset still gets a safe, quiet noise bed rather than
      // leaving the user with a dead toggle.
      this.rig.noiseBed("brown", {
        gain: 0.06,
        filters: [{ type: "lowpass", frequency: 900, q: 0.6 }],
      });
    }
    this.output = this.rig.out;
    engineStats.createdVoices++;
    engineStats.activeVoices++;
    engineStats.peakActiveVoices = Math.max(
      engineStats.peakActiveVoices,
      engineStats.activeVoices,
    );
  }

  get active(): boolean {
    return this.running && !this.stopped;
  }

  start(): void {
    if (this.stopped || this.running) return;
    this.running = true;
    this.rig.start();
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.running = false;
    this.rig.stop();
    engineStats.activeVoices = Math.max(0, engineStats.activeVoices - 1);
    engineStats.stoppedVoices++;
  }

  stats(): AmbientVoiceStats {
    return this.rig.stats();
  }
}

export function createAmbientVoice(
  ctx: BaseAudioContext,
  preset: AmbientPresetId,
  options: AmbientVoiceOptions = {},
): AmbientVoice {
  return new AmbientVoiceImpl(ctx, preset, options);
}

export function isAmbientPresetId(id: string): id is AmbientPresetId {
  return (AMBIENT_PRESET_IDS as readonly string[]).includes(id);
}
