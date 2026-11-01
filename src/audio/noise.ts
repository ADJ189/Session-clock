// Shared, immutable noise buffers.
//
// Buffer allocation was one of the audit findings: generators called
// makeNoiseBuf() per invocation, allocating 4–8 s of stereo samples every
// track start. Buffers here are cached per AudioContext in a WeakMap, so a
// dead context cannot be kept alive by the cache. BufferSourceNodes are
// one-shot and always recreated; the AudioBuffer payload is reused.
//
// Memory estimate (mono, 4 s): 4 * sampleRate * 4 bytes.
// 48 kHz → 768 KB. Four colours → ~3 MB per live AudioContext.

export type NoiseColor = "white" | "pink" | "brown";

interface CacheEntry {
  buffer: AudioBuffer;
  bytes: number;
}

const cache = new WeakMap<BaseAudioContext, Map<string, CacheEntry>>();

function cacheFor(ctx: BaseAudioContext): Map<string, CacheEntry> {
  let map = cache.get(ctx);
  if (!map) {
    map = new Map();
    cache.set(ctx, map);
  }
  return map;
}

function fillWhite(data: Float32Array, amp: number): void {
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * amp;
  }
}

// Paul Kellett's -3 dB/octave pink-noise approximation (7-pole IIR).
function fillPink(data: Float32Array, amp: number): void {
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * amp;
    b6 = white * 0.115926;
  }
}

// Brown/Brownian noise: leaky integration of white noise. The leak keeps DC
// and very-low-frequency drift bounded, then the result is normalised.
function fillBrown(data: Float32Array, amp: number): void {
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = Math.max(-1, Math.min(1, last * 3.5)) * amp;
  }
}

/**
 * Returns a cached mono noise buffer. `seconds` and `channels` are part of
 * the key: callers that need stereo should request it deliberately rather
 * than paying for it on every source.
 */
export function getNoiseBuffer(
  ctx: BaseAudioContext,
  color: NoiseColor,
  seconds = 4,
  channels: 1 | 2 = 1,
): AudioBuffer {
  const safeSeconds = Math.max(0.25, Math.min(12, seconds));
  const key = `${color}:${safeSeconds}:${channels}:${ctx.sampleRate}`;
  const map = cacheFor(ctx);
  const hit = map.get(key);
  if (hit) return hit.buffer;

  const frames = Math.max(1, Math.floor(ctx.sampleRate * safeSeconds));
  const buffer = ctx.createBuffer(channels, frames, ctx.sampleRate);
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    if (color === "white") fillWhite(data, 0.35);
    else if (color === "pink") fillPink(data, 0.055);
    else fillBrown(data, 0.32);
  }
  map.set(key, { buffer, bytes: frames * channels * 4 });
  return buffer;
}

/** Diagnostic helper: cached bytes for one context. */
export function getNoiseCacheBytes(ctx: BaseAudioContext): number {
  let total = 0;
  for (const entry of cacheFor(ctx).values()) total += entry.bytes;
  return total;
}

export function clearNoiseCache(ctx: BaseAudioContext): void {
  cache.delete(ctx);
}

/**
 * Creates a looping BufferSource. `startAt` defaults to now and `phase`
 * decorrelates layers built from the same cached buffer.
 */
export interface NoiseSourceHandle {
  source: AudioBufferSourceNode;
  buffer: AudioBuffer;
  /** Random/offset start position in seconds, used to decorrelate layers. */
  phase: number;
}

/**
 * Creates a looping BufferSource plus a decorrelation phase. The caller owns
 * start/stop, because all procedural voices start only from `voice.start()`.
 */
export function createNoiseSource(
  ctx: BaseAudioContext,
  color: NoiseColor,
  options: { seconds?: number; phase?: number } = {},
): NoiseSourceHandle {
  const buffer = getNoiseBuffer(ctx, color, options.seconds ?? 4);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const phase = Math.max(0, Math.min(buffer.duration * 0.9, options.phase ?? 0));
  return { source, buffer, phase };
}
