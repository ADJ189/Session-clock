// ── AudioParam automation helpers ─────────────────────────────────────
// Every audible gain change goes through here so it is scheduled on the
// AudioContext clock and is click-free. Direct `param.value = x` writes jump
// the waveform and can click; scheduling many overlapping ramps without
// holding the current value can also jump backwards when a new change
// cancels an in-flight ramp.

/**
 * Freeze `param` at its currently scheduled value so a new ramp starts from
 * where the listener actually is, not from the last automation target.
 * `cancelAndHoldAtTime` is the correct primitive; the fallback reads `.value`
 * (which reflects the current computed value in every shipping engine) and
 * re-anchors with setValueAtTime().
 */
export function holdParam(param: AudioParam, now: number): void {
  const cancellable = param as unknown as {
    cancelAndHoldAtTime?: (cancelTime: number) => AudioParam;
  };
  if (typeof cancellable.cancelAndHoldAtTime === "function") {
    try {
      cancellable.cancelAndHoldAtTime(now);
      return;
    } catch {
      // Some engines throw when no automation exists; fall through.
    }
  }
  const current = param.value;
  try {
    param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
  } catch {
    // A closed/read-only param is left alone.
  }
}

/**
 * Ramp a gain parameter to `target` over `durationSec`. A very short duration
 * (the default 40 ms) feels immediate to a slider while removing zipper noise.
 */
export function rampParam(
  param: AudioParam | null | undefined,
  target: number,
  now: number,
  durationSec = 0.04,
): void {
  if (!param || !Number.isFinite(target) || !Number.isFinite(now)) return;
  holdParam(param, now);
  if (durationSec <= 0) {
    try {
      param.setValueAtTime(target, now);
    } catch {
      try {
        param.value = target;
      } catch {
        // Ignore a closed param.
      }
    }
    return;
  }
  try {
    param.linearRampToValueAtTime(target, now + durationSec);
  } catch {
    try {
      param.value = target;
    } catch {
      // Ignore a closed param.
    }
  }
}

/**
 * Schedule an equal-power fade curve from `from` to `to` over `durationSec`.
 * Used for track crossfades where two signals overlap: cos/sin holds roughly
 * constant perceived loudness, unlike a linear ramp.
 *
 * Returns false when the engine rejects curve automation (overlapping
 * automation is the usual cause) so callers can choose a fallback. The
 * fallback must still be scheduled on the AudioContext clock.
 */
export function curveParam(
  param: AudioParam | null | undefined,
  curve: Float32Array,
  now: number,
  durationSec: number,
): boolean {
  if (!param || curve.length < 2) return false;
  if (!Number.isFinite(now) || !Number.isFinite(durationSec)) return false;
  if (durationSec <= 0) return false;
  holdParam(param, now);
  try {
    param.setValueCurveAtTime(curve, now, durationSec);
    return true;
  } catch {
    return false;
  }
}

/** Equal-power curve from silence (in) or to silence (out). */
export function equalPowerCurve(
  direction: "in" | "out",
  peak: number,
  steps = 128,
): Float32Array {
  const safePeak = Number.isFinite(peak) ? Math.max(0, peak) : 0;
  const count = Math.max(2, Math.floor(steps));
  const curve = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * (Math.PI / 2);
    curve[i] = safePeak * (direction === "out" ? Math.cos(t) : Math.sin(t));
  }
  return curve;
}
