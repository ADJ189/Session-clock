// ── Custom procedural presets ──────────────────────────────────────────
// Session Clock ships its own dependency-free synthesis engine under
// ./audio/. It returns plain Web Audio nodes and never connects to
// ctx.destination, so a preset drops into the same per-track
// GainNode → analyser → masterGain → compressor chain every other maker
// uses. Volume, the VU meter, spatialisation and the shared compressor all
// keep working without special cases.
//
// The engine exposes explicit start/stop/cleanup semantics. This adapter
// starts the voice immediately because sound.ts's playTrack() starts
// source nodes after the maker returns, and the engine's continuous noise
// sources must not be started twice. The scheduler and every node are
// released through one `_customStop` proxy — the same pattern the
// recorded-audio makers already use.

import "./globals";

import {
  createAmbientVoice,
  isAmbientPresetId,
  type AmbientPresetId,
} from "./audio/engine";

/** Legacy aliases kept so existing callers do not need to know the
 *  engine's preset names. */
const PRESET_ALIASES: Record<string, AmbientPresetId> = {
  stream: "river",
  crickets: "night",
};

/** Every preset ID the custom engine implements, plus the two historical
 *  aliases. */
export type SynthPreset = AmbientPresetId | keyof typeof PRESET_ALIASES;

function resolvePreset(preset: SynthPreset): AmbientPresetId | null {
  if (isAmbientPresetId(preset)) return preset;
  return PRESET_ALIASES[preset] ?? null;
}

/** Matches the { out, nodes } shape every maker in sound.ts returns so it
 *  drops straight into the MAKERS dispatch table. */
export function makeSynthTrack(
  ctx: AudioContext,
  preset: SynthPreset,
): { out: AudioNode; nodes: AudioNode[] } | null {
  const resolved = resolvePreset(preset);
  if (!resolved) return null;

  const voice = createAmbientVoice(ctx, resolved);
  voice.start();

  const stopProxy = ctx.createGain();
  stopProxy.gain.value = 0;
  stopProxy._customStop = () => voice.stop();
  return { out: voice.output, nodes: [stopProxy] };
}
