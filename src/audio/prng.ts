// Seeded PRNG for procedural ambience.
//
// What a seed promises: the *procedural parameters* a generator draws from
// this source — event durations, gains, frequencies, pans and starting phases
// in `engine.ts` — are reproducible. The same seed and the same call order
// produce the same values.
//
// What it does not promise: a bit-identical performance. These paths stay
// deliberately unseeded because they are either time-driven or shared across
// voices:
//   • `scheduler.ts` picks event *timing* with `Math.random()` (wall/audio
//     clock policy, not a generator parameter);
//   • `noise.ts` fills cached noise buffers once per context with
//     `Math.random()`, and the cache is shared between voices;
//   • `dsp.ts` picks a random offset inside a sampled buffer;
//   • `sound.ts` draws a spatial phase offset per rig.
// Production seeds each voice randomly; tests pass a fixed seed to reproduce
// parameters, never to assert identical audio output. mulberry32 is small,
// fast and good enough for sound design; it is not used for security.

export interface RandomSource {
  /** Uniform [0, 1). */
  next(): number;
  /** Uniform [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Symmetric [-amount, amount). */
  pm(amount: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Approximate standard normal via Box-Muller. */
  gaussian(): number;
}

export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed = Math.floor(Math.random() * 0xffffffff)) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  pm(amount: number): number {
    return this.range(-amount, amount);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }

  gaussian(): number {
    // Box-Muller; guard against log(0).
    const u = Math.max(1e-12, this.next());
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

export function createRandom(seed?: number): RandomSource {
  return new SeededRandom(seed);
}
