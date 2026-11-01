// Deterministic PRNG for procedural ambience.
//
// Production uses a random seed per voice. Tests pass a fixed seed so event
// timing and noise offsets are reproducible. mulberry32 is small, fast and
// good enough for sound design; it is not used for security.

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
