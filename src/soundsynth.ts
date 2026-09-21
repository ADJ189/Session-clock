// ── ambiently-backed procedural presets ─────────────────────────────────
// ambiently (npm, MIT) ships two very different things: a standalone
// AmbientlyEngine that owns its own master bus (hardwired straight to
// ctx.destination — see its engine.ts) and, underneath that, a plain
// createSynth(ctx, preset) function that just builds a Web Audio node
// graph and hands back { output, start(), stop() } — no opinions about
// where that output goes. This app only imports the latter. Going through
// the Engine would mean two disconnected audio paths: everything routed
// through it would skip this app's per-track volume, the ITD/ILD spatial
// rig, the shared analyser the VU meter reads from, and the shared
// compressor — all of which live on sound.ts's own per-track GainNode →
// analyser → masterGain → compressor chain. createSynth has none of that
// baggage: its output is a bare GainNode, so it drops into that chain the
// same way every hand-written generator in sound.ts already does.
//
// Cost of doing it this way: importing createSynth pulls in the whole
// synth engine (~30-35KB raw / high-single-digit KB gzipped once your own
// build minifies it — the Engine/React pieces this app doesn't import get
// tree-shaken out, but synth.ts's 25-preset switch can't be split further
// since the preset is a runtime string) — negligible next to what an
// equivalent audio file would have cost, and it's code, not a growing pile
// of binary assets.
//
// A few of these presets (rain/wind/fire/ocean/snow/white/pink/brown) have
// the same name as a track this app already had a hand-written generator
// for. Those generators are gone now, not kept as a fallback — createSynth
// has no failure mode to fall back from (it's pure oscillators/filters/
// noise buffers, not a network fetch or a codec that might be unsupported;
// it works anywhere Web Audio itself works). Keeping two implementations
// of the same sound around would just be dead weight.

import { createSynth, type SynthPreset, type SynthVoice } from 'ambiently';

/** Matches the { out, nodes } shape every generator in sound.ts returns,
 *  so it drops straight into the same MAKERS dispatch table. The voice is
 *  exposed only via a `_customStop` proxy node — same pattern sound.ts
 *  already uses for its own scheduler-backed tracks (forest's chirps,
 *  fire's crackle) and for the recorded-audio tracks in soundfiles.ts — so
 *  playTrack/stopTrack need no special-casing for ambiently-backed tracks
 *  either. */
export function makeSynthTrack(ctx: AudioContext, preset: SynthPreset): { out: AudioNode; nodes: AudioNode[] } {
  const voice: SynthVoice = createSynth(ctx, preset);
  voice.start();
  const stopProxy = ctx.createGain(); stopProxy.gain.value = 0;
  (stopProxy as any)._customStop = () => voice.stop();
  return { out: voice.output, nodes: [stopProxy] };
}
