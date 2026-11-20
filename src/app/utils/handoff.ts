// Pure validation for the QR/session handoff URL. Keeping this separate from
// the DOM controller makes the bounds easy to unit test and guarantees the
// handoff path uses the same limits as the regular settings setters instead of
// writing unchecked values straight into storage.
import type { PomPhase } from "../../types";
import {
  BREAK_MINUTES,
  WORK_MINUTES,
  LONG_BREAK_MINUTES,
  LONG_BREAK_AFTER,
  clampPomodoroSetting,
  type MinuteBounds,
} from "../../pomodoro-limits";

export { BREAK_MINUTES, WORK_MINUTES, LONG_BREAK_MINUTES, LONG_BREAK_AFTER };

export const POM_PHASES: readonly PomPhase[] = ["work", "break", "longBreak"];

/** Parse a handoff duration: finite integer, clamped to the setter bounds. */
export function parseHandoffMinutes(
  raw: string | null,
  fallback: number,
  bounds: MinuteBounds,
): number {
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) return fallback;
  return clampPomodoroSetting(value, fallback, bounds);
}

/** Parse an elapsed-time value (milliseconds): finite, non-negative integer. */
export function parseHandoffElapsed(
  raw: string | null,
  fallback = 0,
): number {
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0)
    return fallback;
  return value;
}

/** Parse completed-cycle count: finite, non-negative integer. */
export function parseHandoffCycles(
  raw: string | null,
  fallback = 0,
): number {
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0)
    return fallback;
  return value;
}

export const parseHandoffCycleCount = parseHandoffCycles;

export function isPomPhase(value: string | null): value is PomPhase {
  return value !== null && (POM_PHASES as readonly string[]).includes(value);
}
