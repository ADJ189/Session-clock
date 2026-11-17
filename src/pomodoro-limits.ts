// Shared Pomodoro duration bounds. The settings setters, the handoff URL
// parser and the custom-cycle controls all read these values, so a restored
// link can never persist a timer the UI itself cannot edit.

export interface MinuteBounds {
  readonly min: number;
  readonly max: number;
}

export const WORK_MINUTES: MinuteBounds = { min: 1, max: 180 };
export const BREAK_MINUTES: MinuteBounds = { min: 1, max: 90 };
export const LONG_BREAK_MINUTES: MinuteBounds = { min: 1, max: 120 };
export const LONG_BREAK_AFTER: MinuteBounds = { min: 1, max: 12 };

/**
 * Round a finite number into the supplied bounds. Anything non-numeric
 * (missing, null, string, NaN, Infinity) uses the fallback instead, so a
 * corrupt storage value or handoff parameter cannot produce a broken timer.
 */
export function clampPomodoroSetting(
  value: unknown,
  fallback: number,
  bounds: MinuteBounds,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(bounds.min, Math.min(bounds.max, Math.round(value)));
}
