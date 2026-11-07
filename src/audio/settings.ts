// ── Audio settings schema ─────────────────────────────────────────────
// Single typed model for every persisted mixer value. localStorage is a
// hostile input: JSON.parse() succeeding only proves the bytes were JSON,
// not that a preset has a known track ID, a finite gain or a bounded name.
// These helpers are the storage boundary; sound.ts calls the same clamp
// helpers again at the engine boundary so a caller that bypasses the UI
// still cannot create an unsafe AudioParam value.
//
// Units: engine gains are linear 0..2 (0..200% in the UI). Fade duration is
// whole minutes, 0..60, where 0 means "no automatic fade-out".

export const AUDIO_SCHEMA_VERSION = 2;

export const MAX_PRESETS = 5;
export const MAX_PRESET_NAME_LENGTH = 40;

export const TRACK_GAIN_MIN = 0;
export const TRACK_GAIN_MAX = 2;
export const DEFAULT_TRACK_GAIN = 0.8;

export const MASTER_GAIN_MIN = 0;
export const MASTER_GAIN_MAX = 2;
export const DEFAULT_MASTER_GAIN = 0.7;

export const FADE_MINUTES_MIN = 0;
export const FADE_MINUTES_MAX = 60;

export interface SoundPreset {
  name: string;
  tracks: Record<string, number>;
  master: number;
}

export interface MixScene {
  tracks: Record<string, number>;
}

/** Coerce an unknown value to a finite number, then clamp it. */
export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function clampGain(value: unknown, fallback = DEFAULT_TRACK_GAIN): number {
  return clampNumber(value, TRACK_GAIN_MIN, TRACK_GAIN_MAX, fallback);
}

export function clampMasterGain(
  value: unknown,
  fallback = DEFAULT_MASTER_GAIN,
): number {
  return clampNumber(value, MASTER_GAIN_MIN, MASTER_GAIN_MAX, fallback);
}

export function clampFadeMinutes(value: unknown): number {
  const n = clampNumber(value, FADE_MINUTES_MIN, FADE_MINUTES_MAX, 0);
  // Fade is whole minutes in the UI; a fractional stored value is rounded
  // rather than silently producing a timer the slider cannot represent.
  return Math.round(n);
}

/** UI percent (0..200) → validated engine gain. */
export function percentToGain(
  percent: unknown,
  fallback = DEFAULT_TRACK_GAIN,
): number {
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    return fallback;
  }
  return clampGain(percent / 100, fallback);
}

/** Validated engine gain → whole UI percent (0..200). */
export function gainToPercent(gain: unknown): number {
  return Math.round(clampGain(gain) * 100);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Keep only known track IDs with finite, in-range gains. Unknown IDs are
 * dropped rather than rejected wholesale: a preset saved by a future version
 * that added a track should still load its known tracks.
 */
export function normalizeTrackMap(
  raw: unknown,
  validIds: ReadonlySet<string>,
): Record<string, number> {
  const tracks: Record<string, number> = {};
  if (!isRecord(raw)) return tracks;
  for (const [id, value] of Object.entries(raw)) {
    if (!validIds.has(id)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    tracks[id] = clampGain(value);
  }
  return tracks;
}

function normalizePresetName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().slice(0, MAX_PRESET_NAME_LENGTH);
  return name.length > 0 ? name : null;
}

/** Returns null for anything that is not a usable preset object. */
export function normalizePreset(
  raw: unknown,
  validIds: ReadonlySet<string>,
): SoundPreset | null {
  if (!isRecord(raw)) return null;
  const name = normalizePresetName(raw.name);
  if (!name) return null;
  return {
    name,
    tracks: normalizeTrackMap(raw.tracks, validIds),
    master: clampMasterGain(raw.master),
  };
}

function dedupePresets(
  presets: SoundPreset[],
): SoundPreset[] {
  const byName = new Map<string, SoundPreset>();
  for (const preset of presets) {
    // Later entries win, matching the old in-place overwrite semantics.
    byName.set(preset.name, preset);
  }
  return [...byName.values()].slice(-MAX_PRESETS);
}

/**
 * Parse the persisted preset list. Accepts:
 *   - v2 envelope: { v: 2, presets: [...] }
 *   - legacy bare array: [...]
 * Corrupt or unknown-version data degrades to an empty list, never a throw.
 */
export function parsePresets(
  raw: string | null,
  validIds: ReadonlySet<string>,
): SoundPreset[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  let candidates: unknown = parsed;
  if (isRecord(parsed)) {
    // Unknown future versions are still parsed best-effort; fields that do
    // not match the current schema are dropped by normalizePreset().
    candidates = Array.isArray(parsed.presets) ? parsed.presets : [];
  }
  if (!Array.isArray(candidates)) return [];

  const presets: SoundPreset[] = [];
  for (const entry of candidates) {
    const preset = normalizePreset(entry, validIds);
    if (preset) presets.push(preset);
  }
  return dedupePresets(presets);
}

export function serializePresets(presets: readonly SoundPreset[]): string {
  return JSON.stringify({
    v: AUDIO_SCHEMA_VERSION,
    presets: dedupePresets([...presets]),
  });
}

/**
 * Parse one focus/break scene. An empty `tracks` map is valid and means
 * "silence": crossfading to it fades every playing track out.
 */
export function normalizeScene(
  raw: unknown,
  validIds: ReadonlySet<string>,
): MixScene | null {
  if (!isRecord(raw)) return null;
  return { tracks: normalizeTrackMap(raw.tracks, validIds) };
}

export function parseScene(
  raw: string | null,
  validIds: ReadonlySet<string>,
): MixScene | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return normalizeScene(parsed, validIds);
}

export function serializeScene(scene: MixScene): string {
  return JSON.stringify({
    v: AUDIO_SCHEMA_VERSION,
    tracks: scene.tracks,
  });
}
