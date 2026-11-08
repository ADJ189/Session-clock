// ── Animation clock ───────────────────────────────────────────────────
// Canvas themes are authored against a 60 Hz frame. The display may run at
// 30, 60, 120, 144 or 240 Hz, and background throttling can deliver one
// frame every few hundred milliseconds. Motion must be proportional to
// elapsed time, not to the number of callbacks.
//
// `motionScale()` returns "how many 60 Hz frames elapsed", clamped so a
// stalled frame cannot teleport particles across the screen. At 60 Hz it is
// exactly 1, which keeps every tuned 60 Hz timing unchanged.

export const REFERENCE_FPS = 60;
export const REFERENCE_FRAME_SECONDS = 1 / REFERENCE_FPS;

/** Longest single delta we trust for animation (tab switches, GC pauses). */
export const DEFAULT_MAX_DELTA_SECONDS = 0.1;

export function clampDelta(
  dtSeconds: number,
  maxDelta = DEFAULT_MAX_DELTA_SECONDS,
): number {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return 0;
  const limit = Number.isFinite(maxDelta) && maxDelta > 0
    ? maxDelta
    : DEFAULT_MAX_DELTA_SECONDS;
  return Math.min(dtSeconds, limit);
}

/**
 * Elapsed 60 Hz-frame equivalents, clamped to `maxFrames`. A hidden tab that
 * resumes with a multi-second delta advances at most `maxFrames` frames, so
 * motion continues from where it was instead of jumping forward.
 */
export function motionScale(dtSeconds: number, maxFrames = 4): number {
  const frames = Number.isFinite(maxFrames) && maxFrames > 0 ? maxFrames : 4;
  const dt = clampDelta(dtSeconds, frames * REFERENCE_FRAME_SECONDS);
  return dt / REFERENCE_FRAME_SECONDS;
}

/**
 * Fixed-step accumulator for simulations that must not vary with refresh
 * rate (for example a cellular automaton). It is deliberately separate from
 * `motionScale`: interpolation stays a render concern, while the simulation
 * advances in whole steps and carries the remainder forward.
 */
export class FixedStepAccumulator {
  readonly stepSeconds: number;
  readonly maxSteps: number;
  private accumulator = 0;

  constructor(
    stepSeconds: number,
    maxSteps = 5,
  ) {
    this.stepSeconds = stepSeconds;
    this.maxSteps = maxSteps;
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) {
      throw new RangeError("stepSeconds must be a positive finite number");
    }
  }

  /** Advance by `dtSeconds`, invoking `step` once per whole fixed step.
   *  Returns the number of steps executed. Excess time beyond `maxSteps` is
   *  discarded so a resumed tab cannot run a long catch-up loop. */
  advance(dtSeconds: number, step: (stepSeconds: number) => void): number {
    this.accumulator += clampDelta(dtSeconds, this.stepSeconds * this.maxSteps);
    let steps = 0;
    const eps = 1e-9;
    while (this.accumulator + eps >= this.stepSeconds && steps < this.maxSteps) {
      this.accumulator = Math.max(0, this.accumulator - this.stepSeconds);
      step(this.stepSeconds);
      steps++;
    }
    if (steps >= this.maxSteps) {
      this.accumulator = Math.min(this.accumulator, this.stepSeconds);
    }
    return steps;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
