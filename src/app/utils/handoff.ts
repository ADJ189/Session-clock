// Pure validation for the QR/session handoff URL. Keeping this separate from
// the DOM controller makes the bounds easy to unit test and guarantees the
// handoff path uses the same 1–120 / 1–60 minute limits as the settings
// setters instead of writing unchecked values straight into storage.
import type { PomPhase } from "../../types";

export const POM_PHASES: readonly PomPhase[] = ["work", "break", "longBreak"];

export const WORK_MINUTES = { min: 1, max: 120 } as const;
export const BREAK_MINUTES = { min: 1, max: 60 } as const;

/** Parse a handoff duration: finite integer, clamped to the setter bounds. */
export function parseHandoffMinutes(
  raw: string | null,
  fallback: number,
  bounds: { min: number; max: number },
): number {
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) return fallback;
  return Math.max(bounds.min, Math.min(bounds.max, value));
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

export function isPomPhase(value: string | null): value is PomPhase {
  return value !== null && (POM_PHASES as readonly string[]).includes(value);
}
