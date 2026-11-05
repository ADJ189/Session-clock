// Small, typed Web Audio helpers shared by every ambience preset. This is
// intentionally not a generic DSP framework: it only covers the operations
// the 35 presets actually use.

export type FilterType =
  | "lowpass"
  | "highpass"
  | "bandpass"
  | "notch"
  | "peaking"
  | "lowshelf"
  | "highshelf";

export interface FilterSpec {
  type: FilterType;
  frequency: number;
  q?: number;
  gainDb?: number;
}

export const MIN_GAIN = 0.0001;

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function safeFrequency(hz: number): number {
  return clamp(hz, 10, 22000);
}

export function safeTime(seconds: number): number {
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

export function makeGain(ctx: BaseAudioContext, value = 0): GainNode {
  const gain = ctx.createGain();
  gain.gain.value = clamp(value, 0, 4);
  return gain;
}

export function makeFilter(
  ctx: BaseAudioContext,
  spec: FilterSpec,
): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = spec.type;
  filter.frequency.value = safeFrequency(spec.frequency);
  if (spec.q != null) filter.Q.value = clamp(spec.q, 0.0001, 40);
  if (spec.gainDb != null) filter.gain.value = clamp(spec.gainDb, -40, 40);
  return filter;
}

/** Connects a chain of filters in order and returns the final node. */
export function chainFilters(
  ctx: BaseAudioContext,
  input: AudioNode,
  specs: readonly FilterSpec[],
): AudioNode {
  let node: AudioNode = input;
  for (const spec of specs) {
    const filter = makeFilter(ctx, spec);
    node.connect(filter);
    node = filter;
  }
  return node;
}

export function makePanner(
  ctx: BaseAudioContext,
  pan: number,
): AudioNode {
  try {
    if (typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      return p;
    }
  } catch {
    // Fall through to a plain gain (no panning on this engine).
  }
  return makeGain(ctx, 1);
}

export interface LfoOptions {
  frequency: number;
  depth: number;
  type?: OscillatorType;
}

export interface LfoHandle {
  oscillator: OscillatorNode;
  gain: GainNode;
}

/** Creates an LFO but does not start it; the voice owns the lifecycle. */
export function makeLfo(
  ctx: BaseAudioContext,
  options: LfoOptions,
): LfoHandle {
  const oscillator = ctx.createOscillator();
  oscillator.type = options.type ?? "sine";
  oscillator.frequency.value = clamp(options.frequency, 0.001, 60);
  const gain = makeGain(ctx, options.depth);
  oscillator.connect(gain);
  return { oscillator, gain };
}

/** Short linear attack + exponential-ish decay on an AudioParam. */
export function envelope(
  param: AudioParam,
  when: number,
  peak: number,
  attack: number,
  decay: number,
): void {
  const t = safeTime(when);
  const a = Math.max(0.0005, attack);
  const d = Math.max(0.001, decay);
  const level = Math.max(MIN_GAIN, peak);
  try {
    param.cancelScheduledValues(t);
    param.setValueAtTime(MIN_GAIN, t);
    param.linearRampToValueAtTime(level, t + a);
    param.exponentialRampToValueAtTime(MIN_GAIN, t + a + d);
  } catch {
    param.value = level;
  }
}

/** Smoothly move a param without ever scheduling a non-finite value. */
export function rampParam(
  param: AudioParam,
  value: number,
  when: number,
  duration = 0.15,
): void {
  const target = clamp(value, 0, 4);
  const t = safeTime(when);
  try {
    param.setTargetAtTime(target, t, Math.max(0.001, duration / 3));
  } catch {
    param.value = target;
  }
}

export interface TransientOptions {
  frequency: number;
  endFrequency?: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
  pan?: number;
}

/** A pitched one-shot (droplets, bells, chirps, ticks). */
export function createToneTransient(
  ctx: BaseAudioContext,
  when: number,
  options: TransientOptions,
): { oscillator: OscillatorNode; gain: GainNode; stopAt: number } {
  const oscillator = ctx.createOscillator();
  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(
    safeFrequency(options.frequency),
    safeTime(when),
  );
  if (options.endFrequency != null) {
    try {
      oscillator.frequency.exponentialRampToValueAtTime(
        safeFrequency(options.endFrequency),
        safeTime(when) + Math.max(0.01, options.duration),
      );
    } catch {
      // Some engines reject equal/zero exponential targets.
    }
  }
  const gain = makeGain(ctx, 0);
  envelope(gain.gain, when, options.gain, 0.005, options.duration);
  const pan = makePanner(ctx, options.pan ?? 0);
  oscillator.connect(gain);
  gain.connect(pan);
  const stopAt = safeTime(when) + options.duration + 0.05;
  return { oscillator, gain, stopAt };
}

export interface NoiseHitOptions {
  color?: "white" | "pink" | "brown";
  duration: number;
  gain: number;
  filter?: FilterSpec;
  pan?: number;
  playbackRate?: number;
}

/** A filtered noise burst (crackles, water spray, impacts). */
export function createNoiseHit(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  when: number,
  options: NoiseHitOptions,
): {
  source: AudioBufferSourceNode;
  filter: AudioNode;
  gain: GainNode;
  pan: AudioNode;
  stopAt: number;
  offset: number;
} {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  if (options.playbackRate != null) {
    source.playbackRate.value = clamp(options.playbackRate, 0.1, 4);
  }
  // Seeded randomness does not reach buffer offsets (see prng.ts): the same
  // sample is allowed to start at a different point each time it is retriggered.
  const offset = Math.random() * Math.max(0.001, buffer.duration * 0.25);
  const playDuration = options.duration + 0.05;
  // Thunder and similar bursts can outlast the shared noise buffer. Looping
  // keeps the source alive for the whole envelope instead of cutting the tail
  // off when `offset + duration` passes the end of the buffer.
  if (offset + playDuration > buffer.duration) {
    source.loop = true;
    source.loopEnd = buffer.duration;
    source.loopStart = offset;
  }
  const filter = options.filter
    ? makeFilter(ctx, options.filter)
    : makeGain(ctx, 1);
  const gain = makeGain(ctx, 0);
  envelope(gain.gain, when, options.gain, 0.004, options.duration);
  const pan = makePanner(ctx, options.pan ?? 0);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(pan);
  const stopAt = safeTime(when) + options.duration + 0.05;
  try {
    source.start(safeTime(when), offset, playDuration);
    source.stop(stopAt);
  } catch {
    // A source that cannot be scheduled must not break the whole voice.
  }
  return { source, filter, gain, pan, stopAt, offset };
}

/** A low-frequency thump used by heartbeat, thunder and city pass-bys. */
export function createThump(
  ctx: BaseAudioContext,
  when: number,
  frequency: number,
  gainValue: number,
  duration: number,
): { oscillator: OscillatorNode; gain: GainNode; stopAt: number } {
  const oscillator = ctx.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(safeFrequency(frequency), safeTime(when));
  try {
    oscillator.frequency.exponentialRampToValueAtTime(
      safeFrequency(frequency * 0.55),
      safeTime(when) + duration,
    );
  } catch {
    // Keep the start frequency if the ramp is rejected.
  }
  const gain = makeGain(ctx, 0);
  envelope(gain.gain, when, gainValue, 0.012, duration);
  oscillator.connect(gain);
  const stopAt = safeTime(when) + duration + 0.05;
  return { oscillator, gain, stopAt };
}
