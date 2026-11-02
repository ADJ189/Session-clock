import type { SoundDef } from "./types";
import { CAPS, subscribeOrientation } from "./platform";
import { makeFileTrack, isFileTrackSupported } from "./soundfiles";
import { makeSynthTrack } from "./soundsynth";
import { safeGet } from "./storage";
import {
  getSpatialProfile,
  positionForProfile,
  type SpatialProfile,
} from "./audio/spatial";
import {
  deviceOrientationToListener,
  smoothListenerVectors,
  type ListenerVectors,
} from "./audio/listener";

export const SOUNDS: SoundDef[] = [
  { id: "rain", name: "Rain", icon: "🌧", desc: "Gentle rainfall on a window" },
  {
    id: "roofrain",
    name: "Rain on Roof",
    icon: "🏚",
    desc: "Heavier patter on a hard surface overhead",
  },
  {
    id: "white",
    name: "White Noise",
    icon: "📺",
    desc: "Full-spectrum flat hiss",
  },
  {
    id: "pink",
    name: "Pink Noise",
    icon: "🎛",
    desc: "Softer, more natural-sounding hiss",
  },
  {
    id: "brown",
    name: "Brown Noise",
    icon: "📻",
    desc: "Deep, soothing rumble",
  },
  {
    id: "forest",
    name: "Forest",
    icon: "🌲",
    desc: "Wind, leaves, distant birds",
  },
  {
    id: "cafe",
    name: "Café",
    icon: "☕",
    desc: "Warm murmur of a coffee shop",
  },
  { id: "ocean", name: "Ocean", icon: "🌊", desc: "Waves rolling onto shore" },
  { id: "fire", name: "Fireplace", icon: "🔥", desc: "Crackling wood fire" },
  {
    id: "wind",
    name: "Wind",
    icon: "🍃",
    desc: "Open-air gusts, ebbing and flowing",
  },
  {
    id: "snow",
    name: "Snowfall",
    icon: "❄️",
    desc: "Soft hush and distant footsteps",
  },
  {
    id: "keyboard",
    name: "Keyboard",
    icon: "⌨️",
    desc: "Mechanical typing, in bursts",
  },
  {
    id: "library",
    name: "Library",
    icon: "📚",
    desc: "Quiet room tone, rare page turns",
  },
  {
    id: "airplane",
    name: "Airplane Cabin",
    icon: "✈️",
    desc: "Steady jet-engine drone, great for masking",
  },
  {
    id: "spaceship",
    name: "Spaceship",
    icon: "🚀",
    desc: "Deep engine drone, sci-fi hum",
  },
  {
    id: "campfire",
    name: "Campfire",
    icon: "🏕",
    desc: "Bright outdoor fire under the stars",
  },
  {
    id: "waves",
    name: "Waves & Rocks",
    icon: "🌊",
    desc: "Surf crashing against the shore",
  },
  // ── Recorded, not synthesized — atomic layers meant to mix with the
  // above (river under rain, thunder under rain) — see soundfiles.ts ────
  {
    id: "river",
    name: "River",
    icon: "🏞",
    desc: "Water moving steadily over a stony bed",
  },
  {
    id: "waterfall",
    name: "Waterfall",
    icon: "💧",
    desc: "Steady falling-water roar",
  },
  {
    id: "thunder",
    name: "Thunder",
    icon: "⛈",
    desc: "Distant rolling thunder — layer under Rain",
  },
  {
    id: "night",
    name: "Crickets",
    icon: "🌌",
    desc: "Crickets in still night air",
  },
  { id: "birds", name: "Birds", icon: "🐦", desc: "Birdsong, near and far" },
  // ── custom engine (procedural) — presets with no recorded or hand-written
  // equivalent above. See soundsynth.ts for the adapter onto audio/engine.ts. ─
  {
    id: "hum",
    name: "Room Hum",
    icon: "🔌",
    desc: "Low electrical hum, steady and unobtrusive",
  },
  {
    id: "frogs",
    name: "Frogs",
    icon: "🐸",
    desc: "Pond frogs calling after dusk",
  },
  {
    id: "city",
    name: "City",
    icon: "🏙",
    desc: "Distant traffic and city murmur",
  },
  {
    id: "fan",
    name: "Fan",
    icon: "🌀",
    desc: "Steady fan whir, close and even",
  },
  {
    id: "clock",
    name: "Ticking Clock",
    icon: "🕰",
    desc: "A clock's steady tick, second by second",
  },
  {
    id: "vinyl",
    name: "Vinyl Crackle",
    icon: "💿",
    desc: "Warm turntable hiss and pops",
  },
  {
    id: "heartbeat",
    name: "Heartbeat",
    icon: "💓",
    desc: "A slow, steady heartbeat",
  },
  {
    id: "drone",
    name: "Drone",
    icon: "🔊",
    desc: "Deep, sustained tone underneath everything",
  },
  {
    id: "space",
    name: "Deep Space",
    icon: "🛰",
    desc: "Slow cosmic drift, distant and vast",
  },
  {
    id: "lofi",
    name: "Lo-fi Beat",
    icon: "🎧",
    desc: "Soft lo-fi chords over a gentle beat loop",
  },
  {
    id: "pad",
    name: "Ambient Pad",
    icon: "🎹",
    desc: "Slow evolving synth pad, warm and sustained",
  },
  {
    id: "musicbox",
    name: "Music Box",
    icon: "🎵",
    desc: "A delicate wind-up melody",
  },
  { id: "bells", name: "Bells", icon: "🔔", desc: "Soft, spaced-out chimes" },
];

// Per-track accent — used to tint each track's icon tile in the mixer
// (Metrolist-style per-item color identity) instead of one uniform
// generic icon color across the whole grid.
export const SOUND_ACCENT: Record<string, string> = {
  rain: "#0a84ff",
  roofrain: "#409cff",
  white: "#8e8e93",
  pink: "#ff2d55",
  brown: "#a2845e",
  forest: "#30d158",
  cafe: "#c8a165",
  ocean: "#32ade6",
  fire: "#ff9f0a",
  wind: "#64d2ff",
  snow: "#eaf6ff",
  keyboard: "#8e8e93",
  library: "#bf5af2",
  airplane: "#5e5ce6",
  spaceship: "#5e5ce6",
  campfire: "#ff9f0a",
  waves: "#32ade6",
  river: "#32ade6",
  waterfall: "#64d2ff",
  thunder: "#409cff",
  night: "#5e5ce6",
  birds: "#30d158",
  hum: "#8e8e93",
  frogs: "#30d158",
  city: "#8e8e93",
  fan: "#64d2ff",
  clock: "#a2845e",
  vinyl: "#c8a165",
  heartbeat: "#ff2d55",
  drone: "#5e5ce6",
  space: "#5e5ce6",
  lofi: "#bf5af2",
  pad: "#0a84ff",
  musicbox: "#ff9f0a",
  bells: "#eaf6ff",
};

export interface BinauralPreset {
  id: string;
  name: string;
  icon: string;
  desc: string;
  carrier: number;
  beat: number;
}
export const BINAURAL_PRESETS: BinauralPreset[] = [
  {
    id: "gamma",
    name: "Deep Focus",
    icon: "🧠",
    desc: "Gamma 40Hz · Peak concentration",
    carrier: 200,
    beat: 40,
  },
  {
    id: "beta",
    name: "Alert",
    icon: "⚡",
    desc: "Beta 18Hz · Active thinking",
    carrier: 200,
    beat: 18,
  },
  {
    id: "alpha",
    name: "Calm Focus",
    icon: "🌊",
    desc: "Alpha 10Hz · Relaxed awareness",
    carrier: 200,
    beat: 10,
  },
  {
    id: "theta",
    name: "Flow State",
    icon: "✨",
    desc: "Theta 6Hz · Creative flow",
    carrier: 200,
    beat: 6,
  },
  {
    id: "delta",
    name: "Rest",
    icon: "🌙",
    desc: "Delta 2Hz · Deep rest & recovery",
    carrier: 200,
    beat: 2,
  },
];
SOUND_ACCENT.gamma = "#ff375f";
SOUND_ACCENT.beta = "#ffd60a";
SOUND_ACCENT.alpha = "#32ade6";
SOUND_ACCENT.theta = "#bf5af2";
SOUND_ACCENT.delta = "#5e5ce6";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let analyserData: Uint8Array<ArrayBuffer> | null = null;

const trackNodes: Record<string, { nodes: AudioNode[]; gain: GainNode }> = {};
const trackVols: Record<string, number> = {};
SOUNDS.forEach((s) => {
  trackVols[s.id] = 0.8;
});

let binauralNodes: {
  left: OscillatorNode;
  right: OscillatorNode;
  merger: ChannelMergerNode;
  gain: GainNode;
} | null = null;
export let binauralPresetId: string | null = null;

let masterVol = 0.7;
let fadeMinutes = 0;
let fadeTimer = 0;
let onTrackChange: (() => void) | null = null;
export function setTrackChangeHandler(fn: () => void) {
  onTrackChange = fn;
}

function ensureCtx() {
  if (!ctx) {
    ctx = new AudioContext();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;
    analyserData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

    masterGain = ctx.createGain();
    masterGain.gain.value = masterVol;

    // DynamicsCompressor prevents clipping at high volumes (200% boost)
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    // Chain: tracks → analyser → masterGain → compressor → destination
    analyser.connect(masterGain);
    masterGain.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
}

// A missing/blocked AudioContext is an optional-subsystem failure: remember it
// once so every later play attempt returns false instead of throwing into a
// click handler. The clock and timer must keep working without audio.
let audioUnavailable = false;
function ensureCtxSafe(): boolean {
  if (audioUnavailable) return false;
  try {
    ensureCtx();
    return true;
  } catch {
    audioUnavailable = true;
    return false;
  }
}
export function isAudioAvailable(): boolean {
  return !audioUnavailable;
}

// ── Autoplay-policy unlock ─────────────────────────────────────────────
// Browsers (Safari especially) only allow AudioContext creation/resume
// synchronously inside a genuine user-gesture handler. Anything started
// later via setTimeout or on theme-restore (e.g. autoStartCommonRoom,
// which auto-plays rain + fire) is NOT considered gesture-triggered and
// stays silently suspended forever — this is why those two tracks in
// particular can appear to "not work". Call this once from the very
// first pointerdown/keydown/touchstart on the page so the context is
// already running by the time anything tries to auto-start a track.
let audioUnlocked = false;
export function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  // Web Audio can be missing or blocked (some WebKit builds, Lockdown Mode,
  // privacy settings). This runs inside the page's very first gesture, so a
  // throw here would surface as an uncaught page error on the first click.
  ensureCtxSafe();
}

export function getAudioLevel(): number {
  if (!analyser || !analyserData) return 0;
  analyser.getByteFrequencyData(analyserData);
  let sum = 0;
  for (let i = 0; i < analyserData.length; i++) sum += analyserData[i]!;
  return sum / (analyserData.length * 255);
}

export function getBassLevel(): number {
  if (!analyser || !analyserData) return 0;
  analyser.getByteFrequencyData(analyserData);
  let sum = 0;
  const bins = Math.min(8, analyserData.length);
  for (let i = 0; i < bins; i++) sum += analyserData[i]!;
  return sum / (bins * 255);
}

// ── MAKERS dispatch ───────────────────────────────────────────────────
// Two tiers, in preference order:
//   1. Recorded audio (soundfiles.ts) — best quality where it exists, but
//      needs Ogg/Opus support and the file to actually load.
//   2. The custom procedural engine (soundsynth.ts) — pure Web Audio with
//      no network or codec dependency. It is both the fallback for every
//      recording and the primary source for presets that were never
//      recorded, so every sound ID always has a working audio path.
//
// Waterfall used to be the exception: it had a recording but no procedural
// fallback, so unsupported browsers disabled its toggle. The engine now
// covers it, which removes that file-only path entirely.
const MAKERS: Record<
  string,
  () => { out: AudioNode; nodes: AudioNode[] } | null
> = {
  rain: () => makeFileTrack(ctx!, "rain", () => makeSynthTrack(ctx!, "rain")),
  roofrain: () => makeSynthTrack(ctx!, "roofrain"),
  white: () => makeSynthTrack(ctx!, "white"),
  pink: () => makeSynthTrack(ctx!, "pink"),
  brown: () => makeSynthTrack(ctx!, "brown"),
  forest: () =>
    makeFileTrack(ctx!, "forest", () => makeSynthTrack(ctx!, "forest")),
  cafe: () => makeFileTrack(ctx!, "cafe", () => makeSynthTrack(ctx!, "cafe")),
  ocean: () => makeSynthTrack(ctx!, "ocean"),
  fire: () => makeFileTrack(ctx!, "fire", () => makeSynthTrack(ctx!, "fire")),
  wind: () => makeFileTrack(ctx!, "wind", () => makeSynthTrack(ctx!, "wind")),
  snow: () => makeSynthTrack(ctx!, "snow"),
  keyboard: () => makeSynthTrack(ctx!, "keyboard"),
  library: () =>
    makeFileTrack(ctx!, "library", () => makeSynthTrack(ctx!, "library")),
  airplane: () => makeSynthTrack(ctx!, "airplane"),
  spaceship: () => makeSynthTrack(ctx!, "spaceship"),
  campfire: () => makeSynthTrack(ctx!, "campfire"),
  waves: () =>
    makeFileTrack(ctx!, "waves", () => makeSynthTrack(ctx!, "waves")),
  river: () => makeFileTrack(ctx!, "river", () => makeSynthTrack(ctx!, "river")),
  waterfall: () =>
    makeFileTrack(ctx!, "waterfall", () => makeSynthTrack(ctx!, "waterfall")),
  thunder: () =>
    makeFileTrack(ctx!, "thunder", () => makeSynthTrack(ctx!, "thunder")),
  night: () => makeFileTrack(ctx!, "night", () => makeSynthTrack(ctx!, "night")),
  birds: () => makeFileTrack(ctx!, "birds", () => makeSynthTrack(ctx!, "birds")),
  hum: () => makeSynthTrack(ctx!, "hum"),
  frogs: () => makeSynthTrack(ctx!, "frogs"),
  city: () => makeSynthTrack(ctx!, "city"),
  fan: () => makeSynthTrack(ctx!, "fan"),
  clock: () => makeSynthTrack(ctx!, "clock"),
  vinyl: () => makeSynthTrack(ctx!, "vinyl"),
  heartbeat: () => makeSynthTrack(ctx!, "heartbeat"),
  drone: () => makeSynthTrack(ctx!, "drone"),
  space: () => makeSynthTrack(ctx!, "space"),
  lofi: () => makeSynthTrack(ctx!, "lofi"),
  pad: () => makeSynthTrack(ctx!, "pad"),
  musicbox: () => makeSynthTrack(ctx!, "musicbox"),
  bells: () => makeSynthTrack(ctx!, "bells"),
};

/** Re-exported for the mixer UI. Every known file-backed track now has a
 *  procedural fallback, so this stays true even on browsers without
 *  Ogg/Opus support. */
export { isFileTrackSupported };

// ── Public API ────────────────────────────────────────────────────────
export function playTrack(id: string): boolean {
  if (trackNodes[id]) return true;
  if (!ensureCtxSafe()) return false;
  const made = MAKERS[id]?.();
  if (!made) return false;
  const g = ctx!.createGain();
  g.gain.value = trackVols[id] ?? 0.8;
  made.out.connect(g);
  g.connect(analyser!);
  made.nodes.forEach((n) => {
    if (n._customStop) return; // skip custom stop proxies
    if (
      "start" in n &&
      typeof (n as AudioScheduledSourceNode).start === "function" &&
      !n._started
    ) {
      try {
        (n as AudioScheduledSourceNode).start();
        n._started = true;
      } catch {}
    }
  });
  trackNodes[id] = { nodes: made.nodes, gain: g };
  if (spatialEnabled) attachSpatialRig(id, g);
  onTrackChange?.();
  if (fadeMinutes > 0) {
    clearTimeout(fadeTimer);
    fadeTimer = window.setTimeout(fadeAll, fadeMinutes * 60_000);
  }
  return true;
}

export function stopTrack(id: string) {
  if (!trackNodes[id]) return;
  const t = trackNodes[id];
  detachSpatialRig(id, t.gain);
  t.nodes.forEach((n) => {
    // Call custom cleanup hook if present (chirp/crackle schedulers)
    if (n._customStop) {
      n._customStop();
      return;
    }
    try {
      (n as AudioScheduledSourceNode).stop();
    } catch {}
    try {
      n.disconnect();
    } catch {}
  });
  try {
    t.gain.disconnect();
  } catch {}
  delete trackNodes[id];
  onTrackChange?.();
}

export function toggleTrack(id: string): boolean {
  if (trackNodes[id]) {
    stopTrack(id);
    return true;
  }
  return playTrack(id);
}
export function isPlaying(id: string) {
  return !!trackNodes[id];
}
export function setTrackVolume(id: string, v: number) {
  trackVols[id] = v;
  if (trackNodes[id]) trackNodes[id].gain.gain.value = v;
}
export function getTrackVolume(id: string) {
  return trackVols[id] ?? 0.8;
}
export function setMasterVolume(v: number) {
  masterVol = v;
  if (masterGain) masterGain.gain.value = v;
}
export function getMasterVolume() {
  return masterVol;
}
export function setFade(v: number) {
  fadeMinutes = v;
}

// ── Spatial 3D audio — native HRTF per track ───────────────────────────
// Phase 1 treats every sound option as one track-level emitter. The panner
// sits after the per-track gain and before the shared analyser, so the same
// node spatialises the CDN Opus recording, its procedural fallback, and a
// preset that was never recorded. Binaural beats keep their separate
// left/right path below and are never sent through HRTF.
//
// The old hand-built ITD + per-ear filter chain is gone. Native
// PannerNode(HRTF) already supplies measured direction cues; stacking the
// approximation on top would double-darken the far ear. When HRTF creation
// fails, a StereoPannerNode equal-power route keeps playback alive.
let spatialEnabled = safeGet("sc_spatial") === "1";

interface TrackSpatialRig {
  profile: SpatialProfile;
  panner: PannerNode | null;
  fallback: StereoPannerNode | null;
  route: "hrtf" | "equalpower";
  phaseOffset: number;
}

const spatialRigs: Record<string, TrackSpatialRig> = {};

// HRTF position params are effectively k-rate; ~25 Hz is plenty and avoids
// one audio-param write per display frame per track.
const SPATIAL_UPDATE_INTERVAL = 1 / 25;
let lastSpatialUpdate = -Infinity;

function safeParam(
  param: AudioParam | undefined,
  value: number,
  now: number,
  timeConstant = 0.06,
): void {
  if (!param || !Number.isFinite(value)) return;
  try {
    param.setTargetAtTime(value, now, timeConstant);
  } catch {
    try {
      param.value = value;
    } catch {
      // A read-only or closed param is skipped.
    }
  }
}

function createHrtfPanner(
  context: AudioContext,
  profile: SpatialProfile,
): PannerNode {
  const panner = context.createPanner();
  panner.panningModel = profile.panningModel;
  panner.distanceModel = profile.distance.model;
  panner.refDistance = profile.distance.refDistance;
  panner.maxDistance = profile.distance.maxDistance;
  panner.rolloffFactor = profile.distance.rolloffFactor;
  panner.coneInnerAngle = 360;
  panner.coneOuterAngle = 360;
  panner.coneOuterGain = 1;
  return panner;
}

function writePannerPosition(
  panner: PannerNode,
  position: { x: number; y: number; z: number },
  now: number,
  immediate = false,
): void {
  if (
    panner.positionX && panner.positionY && panner.positionZ
  ) {
    if (immediate) {
      try {
        panner.positionX.value = position.x;
        panner.positionY.value = position.y;
        panner.positionZ.value = position.z;
        return;
      } catch {
        // Fall through to automation/legacy setter.
      }
    }
    safeParam(panner.positionX, position.x, now);
    safeParam(panner.positionY, position.y, now);
    safeParam(panner.positionZ, position.z, now);
    return;
  }
  const legacy = panner as PannerNode & {
    setPosition?: (x: number, y: number, z: number) => void;
  };
  try {
    legacy.setPosition?.(position.x, position.y, position.z);
  } catch {
    // Nothing else to do; the panner stays at the origin but still plays.
  }
}

function panFromPosition(position: {
  x: number;
  y: number;
  z: number;
}): number {
  const horizontal = Math.hypot(position.x, position.z);
  if (horizontal < 1e-6) return 0;
  return Math.max(-1, Math.min(1, position.x / horizontal));
}

function attachSpatialRig(id: string, gainNode: GainNode): void {
  if (spatialRigs[id] || !ctx) return;
  const profile = getSpatialProfile(id);
  if (!profile || profile.mode === "bypass") return;

  const now = ctx.currentTime;
  const position = positionForProfile(profile, now, Math.random() * Math.PI * 2);

  try {
    gainNode.disconnect(analyser!);
  } catch {
    // It may already be disconnected during a replay race.
  }

  try {
    const panner = createHrtfPanner(ctx, profile);
    writePannerPosition(panner, position, now, true);
    gainNode.connect(panner);
    panner.connect(analyser!);
    spatialRigs[id] = {
      profile,
      panner,
      fallback: null,
      route: "hrtf",
      phaseOffset: Math.random() * Math.PI * 2,
    };
    return;
  } catch {
    // HRTF unavailable or rejected by this engine; degrade below.
  }

  try {
    const fallback = ctx.createStereoPanner();
    fallback.pan.value = panFromPosition(position);
    gainNode.connect(fallback);
    fallback.connect(analyser!);
    spatialRigs[id] = {
      profile,
      panner: null,
      fallback,
      route: "equalpower",
      phaseOffset: Math.random() * Math.PI * 2,
    };
  } catch {
    // Even equal-power panning failed; reconnect the dry path so audio
    // continues rather than going silent.
    try {
      gainNode.connect(analyser!);
    } catch {
      // Nothing further can be done for this track.
    }
  }
}

function detachSpatialRig(id: string, gainNode: GainNode): void {
  const rig = spatialRigs[id];
  if (!rig) return;

  const spatialNode = rig.panner ?? rig.fallback;
  try {
    if (spatialNode) gainNode.disconnect(spatialNode);
  } catch {
    // Already disconnected.
  }
  try {
    rig.panner?.disconnect();
  } catch {
    // Already disconnected.
  }
  try {
    rig.fallback?.disconnect();
  } catch {
    // Already disconnected.
  }

  try {
    gainNode.connect(analyser!);
  } catch {
    // Analyser can be missing only during teardown.
  }
  delete spatialRigs[id];
}

export function isSpatialEnabled(): boolean {
  return spatialEnabled;
}

export function setSpatial(v: boolean): void {
  spatialEnabled = v;
  localStorage.setItem("sc_spatial", v ? "1" : "0");
  Object.keys(trackNodes).forEach((id) => {
    const node = trackNodes[id];
    if (!node) return;
    if (v) attachSpatialRig(id, node.gain);
    else detachSpatialRig(id, node.gain);
  });
}

export function tickSpatial(now: number): void {
  if (!spatialEnabled || !ctx) return;
  if (!Number.isFinite(now)) return;
  if (now - lastSpatialUpdate < SPATIAL_UPDATE_INTERVAL) return;
  lastSpatialUpdate = now;

  Object.keys(spatialRigs).forEach((id) => {
    const rig = spatialRigs[id];
    if (!rig || rig.profile.movement.kind === "fixed") return;
    const position = positionForProfile(
      rig.profile,
      now,
      rig.phaseOffset,
    );
    if (rig.panner) writePannerPosition(rig.panner, position, ctx!.currentTime);
    if (rig.fallback) {
      safeParam(
        rig.fallback.pan,
        panFromPosition(position),
        ctx!.currentTime,
        0.08,
      );
    }
  });
}

// ── Listener orientation (device tracking, optional) ───────────────────
// DeviceOrientation reports the phone, not headphone pose. It is offered as
// a listener-orientation proxy only; product copy must not call it head
// tracking. A denied permission leaves HRTF active with a fixed listener.
let headTrackingEnabled = safeGet("sc_head_tracking") === "1";
let unsubscribeHeadTracking: (() => void) | null = null;
let listenerVectors: ListenerVectors | null = null;
let lastListenerUpdate = 0;

function setListenerParam(
  param: AudioParam | undefined,
  value: number,
  now: number,
): void {
  if (!param || !Number.isFinite(value)) return;
  try {
    param.setTargetAtTime(value, now, 0.06);
  } catch {
    try {
      param.value = value;
    } catch {
      // Ignore engines with read-only listener params.
    }
  }
}

function applyListenerVectors(vectors: ListenerVectors): void {
  if (!ctx) return;
  const listener = ctx.listener;
  const now = ctx.currentTime;
  if (listener.forwardX) {
    setListenerParam(listener.forwardX, vectors.forward[0], now);
    setListenerParam(listener.forwardY, vectors.forward[1], now);
    setListenerParam(listener.forwardZ, vectors.forward[2], now);
    setListenerParam(listener.upX, vectors.up[0], now);
    setListenerParam(listener.upY, vectors.up[1], now);
    setListenerParam(listener.upZ, vectors.up[2], now);
    return;
  }
  const legacy = listener as AudioListener & {
    setOrientation?: (
      x: number,
      y: number,
      z: number,
      upX: number,
      upY: number,
      upZ: number,
    ) => void;
  };
  try {
    legacy.setOrientation?.(
      vectors.forward[0],
      vectors.forward[1],
      vectors.forward[2],
      vectors.up[0],
      vectors.up[1],
      vectors.up[2],
    );
  } catch {
    // Keep the default listener.
  }
}

function resetListenerOrientation(): void {
  listenerVectors = null;
  applyListenerVectors({
    forward: [0, 0, -1],
    up: [0, 1, 0],
  });
}

function screenOrientationDegrees(): number {
  try {
    const orientation = screen.orientation;
    if (orientation && Number.isFinite(orientation.angle)) {
      return orientation.angle;
    }
  } catch {
    // Older engines.
  }
  return 0;
}

function onOrientationSample(sample: {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
}): void {
  if (!ctx || !headTrackingEnabled) return;
  const wallNow = Date.now();
  if (wallNow - lastListenerUpdate < 33) return; // ~30 Hz is plenty
  lastListenerUpdate = wallNow;

  const next = deviceOrientationToListener(
    sample.alpha,
    sample.beta,
    sample.gamma,
    screenOrientationDegrees(),
  );
  if (!next) return;
  listenerVectors = smoothListenerVectors(listenerVectors, next, 0.2);
  applyListenerVectors(listenerVectors);
}

export function isHeadTrackingEnabled(): boolean {
  return headTrackingEnabled;
}
export function isHeadTrackingAvailable(): boolean {
  return CAPS.deviceOrientation;
}

/** Call from within a user gesture — same iOS permission requirement as
 *  requestMotionPermission(). */
export function setHeadTracking(v: boolean): void {
  headTrackingEnabled = v;
  localStorage.setItem("sc_head_tracking", v ? "1" : "0");
  if (v && !unsubscribeHeadTracking) {
    unsubscribeHeadTracking = subscribeOrientation(onOrientationSample);
  } else if (!v && unsubscribeHeadTracking) {
    unsubscribeHeadTracking();
    unsubscribeHeadTracking = null;
    resetListenerOrientation();
  }
}

// ── Binaural Beats ────────────────────────────────────────────────────
export function playBinaural(presetId: string): boolean {
  stopBinaural();
  if (!ensureCtxSafe()) return false;
  const preset = BINAURAL_PRESETS.find((p) => p.id === presetId);
  if (!preset) return false;

  const merger = ctx!.createChannelMerger(2);
  const gain = ctx!.createGain();
  gain.gain.value = 0.15;
  const left = ctx!.createOscillator();
  const right = ctx!.createOscillator();
  left.type = right.type = "sine";
  left.frequency.value = preset.carrier;
  right.frequency.value = preset.carrier + preset.beat;

  const lg = ctx!.createGain();
  lg.gain.value = 1;
  const rg = ctx!.createGain();
  rg.gain.value = 1;
  left.connect(lg);
  lg.connect(merger, 0, 0);
  right.connect(rg);
  rg.connect(merger, 0, 1);
  merger.connect(gain);
  gain.connect(masterGain!);

  left.start();
  right.start();
  binauralNodes = { left, right, merger, gain };
  binauralPresetId = presetId;
  onTrackChange?.();
  return true;
}

export function stopBinaural() {
  if (!binauralNodes) return;
  try {
    binauralNodes.left.stop();
  } catch {}
  try {
    binauralNodes.right.stop();
  } catch {}
  try {
    binauralNodes.gain.disconnect();
    binauralNodes.merger.disconnect();
  } catch {}
  binauralNodes = null;
  binauralPresetId = null;
  onTrackChange?.();
}

export function toggleBinaural(presetId: string): boolean {
  if (binauralPresetId === presetId) {
    stopBinaural();
    return true;
  }
  return playBinaural(presetId);
}

// ── Adaptive audio ────────────────────────────────────────────────────
let adaptiveDuckTimer = 0;
export function adaptOnWorkStart() {
  if (!masterGain) return;
  const orig = masterGain.gain.value;
  masterGain.gain.value = orig * 0.78;
  clearTimeout(adaptiveDuckTimer);
  adaptiveDuckTimer = window.setTimeout(() => {
    if (masterGain) masterGain.gain.value = orig;
  }, 8000);
}
export function adaptOnBreak() {
  clearTimeout(adaptiveDuckTimer);
  if (masterGain) masterGain.gain.value = masterVol;
  if (trackNodes["fire"])
    trackNodes["fire"].gain.gain.value = trackVols["fire"] ?? 0.8;
}

export function autoStartCommonRoom() {
  if (!SOUNDS.some((s) => isPlaying(s.id))) {
    playTrack("rain");
    playTrack("fire");
  }
}

// ── Crossfade ─────────────────────────────────────────────────────────
// Smoothly ramps out currently-playing tracks not in `toIds` while
// ramping in (or starting) the tracks in `toIds`, instead of an abrupt
// stop/start cut. Operates on each track's own per-track GainNode, so
// master volume and other tracks are untouched.
//
// Equal-power (cosine/sine) curve rather than a linear ramp — same
// reasoning and 128-point resolution as the gapless-loop crossfade in
// soundfiles.ts: a linear fade dips in perceived loudness partway through
// because the two curves don't sum back to unity, while cos/sin holds
// roughly constant loudness across the transition. Falls back to a
// manual rAF-driven fade if scheduling the curve throws (overlapping
// AudioParam automation occasionally does) — same escape hatch used
// there.
const CROSSFADE_STEPS = 128;
function equalPowerCurve(from: "out" | "in", peak: number): Float32Array {
  const curve = new Float32Array(CROSSFADE_STEPS);
  for (let i = 0; i < CROSSFADE_STEPS; i++) {
    const t = (i / (CROSSFADE_STEPS - 1)) * (Math.PI / 2);
    curve[i] = peak * (from === "out" ? Math.cos(t) : Math.sin(t));
  }
  return curve;
}

export function crossfadeTo(toIds: string[], durationMs = 2500) {
  if (!ensureCtxSafe()) return;
  const seconds = Math.max(0.05, durationMs / 1000);
  const now = ctx!.currentTime;

  const fadeParam = (
    param: AudioParam,
    curve: Float32Array,
    currentVal: number,
  ) => {
    param.cancelScheduledValues(now);
    param.setValueAtTime(Math.max(0.0001, currentVal), now);
    try {
      param.setValueCurveAtTime(curve, now, seconds);
      return true;
    } catch {
      return false; // overlapping automation threw — caller falls back to a manual fade
    }
  };

  // Ramp out anything playing that isn't in the target set
  Object.keys(trackNodes).forEach((id) => {
    if (toIds.includes(id)) return;
    const t = trackNodes[id];
    if (!t) return;
    const startVal = Math.max(0.0001, t.gain.gain.value);
    const scheduled = fadeParam(
      t.gain.gain,
      equalPowerCurve("out", startVal),
      startVal,
    );
    if (!scheduled) {
      const startedAt = performance.now();
      const manualFade = () => {
        const tn = trackNodes[id];
        if (!tn) return;
        const p = Math.min(
          1,
          (performance.now() - startedAt) / (seconds * 1000),
        );
        try {
          tn.gain.gain.value = startVal * Math.cos(p * (Math.PI / 2));
        } catch {
          return;
        }
        if (p < 1) requestAnimationFrame(manualFade);
      };
      requestAnimationFrame(manualFade);
    }
    // Only actually stop it if nothing re-raised it in the meantime
    // (guards against a second crossfadeTo() call racing this one).
    setTimeout(() => {
      const tn = trackNodes[id];
      if (tn && tn.gain.gain.value < 0.01) stopTrack(id);
    }, durationMs + 60);
  });

  // Start (if needed) and ramp in the target tracks
  toIds.forEach((id) => {
    const target = trackVols[id] ?? 0.8;
    if (!trackNodes[id]) playTrack(id);
    const t = trackNodes[id];
    if (!t) return;
    const startVal = Math.max(0.0001, t.gain.gain.value);
    const scheduled = fadeParam(
      t.gain.gain,
      equalPowerCurve("in", target),
      startVal,
    );
    if (!scheduled) {
      const startedAt = performance.now();
      const manualFade = () => {
        const tn = trackNodes[id];
        if (!tn) return;
        const p = Math.min(
          1,
          (performance.now() - startedAt) / (seconds * 1000),
        );
        try {
          tn.gain.gain.value = target * Math.sin(p * (Math.PI / 2));
        } catch {
          return;
        }
        if (p < 1) requestAnimationFrame(manualFade);
      };
      requestAnimationFrame(manualFade);
    }
  });
  onTrackChange?.();
}

function fadeAll() {
  if (!masterGain) return;
  const start = masterGain.gain.value;
  let t = 0;
  const step = setInterval(() => {
    t += 0.05;
    masterGain!.gain.value = Math.max(0, start * (1 - t));
    if (t >= 1) {
      SOUNDS.forEach((s) => stopTrack(s.id));
      clearInterval(step);
    }
  }, 100);
}

export function playChime() {
  if (!ensureCtxSafe()) return;
  const ac = ctx!;
  (
    [
      [523.25, 0],
      [659.25, 180],
      [783.99, 340],
    ] as [number, number][]
  ).forEach(([freq, delay]) => {
    setTimeout(() => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.value = 0.22;
      osc.connect(g);
      g.connect(ac.destination);
      osc.start();
      g.gain.setValueAtTime(0.22, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.8);
      setTimeout(() => {
        try {
          osc.stop();
        } catch {}
      }, 2000);
    }, delay);
  });
}

// Legacy compat
export function stop() {
  SOUNDS.forEach((s) => stopTrack(s.id));
}
export function play(id: string) {
  playTrack(id);
}
export function toggle(id: string) {
  toggleTrack(id);
}
