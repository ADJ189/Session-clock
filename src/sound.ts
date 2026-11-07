import type { SoundDef } from "./types";
import { CAPS, subscribeOrientation } from "./platform";
import { makeFileTrack, isFileTrackSupported } from "./soundfiles";
import { makeSynthTrack } from "./soundsynth";
import { safeGet, safeSet } from "./storage";
import {
  clampFadeMinutes,
  clampGain,
  clampMasterGain,
  DEFAULT_MASTER_GAIN,
  DEFAULT_TRACK_GAIN,
  FADE_MINUTES_MAX,
  FADE_MINUTES_MIN,
} from "./audio/settings";
import {
  curveParam,
  equalPowerCurve,
  rampParam,
} from "./audio/automation";
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
// Signal graph (all sources meet at the analyser, which acts as the mix bus):
//
//   track gain → optional spatial rig ─┐
//   binaural gain ─────────────────────┴→ analyser (mix meter) → masterGain
//     → duckGain (temporary focus duck) → fadeGain (timed fade-out)
//     → compressor → destination
//
// The analyser sits before the user master, duck and fade stages, so the
// mixer meter shows the combined programme mix even when master is low or a
// timed fade has finished. UI copy says "combined level of the tracks".
// The three post-mix stages multiply instead of overwriting one another:
// master is the user's setting, duck is temporary, fade is the timer.
let masterGain: GainNode | null = null;
let duckGain: GainNode | null = null;
let fadeGain: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let analyserData: Uint8Array<ArrayBuffer> | null = null;

const trackNodes: Record<string, { nodes: AudioNode[]; gain: GainNode }> = {};
const trackVols: Record<string, number> = {};
SOUNDS.forEach((s) => {
  trackVols[s.id] = DEFAULT_TRACK_GAIN;
});

let binauralNodes: {
  left: OscillatorNode;
  right: OscillatorNode;
  merger: ChannelMergerNode;
  gain: GainNode;
} | null = null;
export let binauralPresetId: string | null = null;

let masterVol = DEFAULT_MASTER_GAIN;
// Fade duration is persisted (sc_sound_fade, whole minutes 0..60). 0 means no
// automatic fade-out. Changing it while tracks play reschedules from now;
// setting 0 cancels any pending fade.
let fadeMinutes = clampFadeMinutes(safeGet("sc_sound_fade"));
let fadeTimer = 0;
let fadeGeneration = 0;
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
    duckGain = ctx.createGain();
    duckGain.gain.value = 1;
    fadeGain = ctx.createGain();
    fadeGain.gain.value = 1;

    // DynamicsCompressor prevents clipping at high volumes (200% boost)
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    analyser.connect(masterGain);
    masterGain.connect(duckGain);
    duckGain.connect(fadeGain);
    fadeGain.connect(comp);
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
function startTrack(id: string, startGain: number): boolean {
  if (trackNodes[id]) return true;
  if (!ensureCtxSafe()) return false;
  const made = MAKERS[id]?.();
  if (!made) return false;
  const g = ctx!.createGain();
  g.gain.value = clampGain(startGain);
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
  // A new sound cancels a fade-out that was already running so the user
  // hears what they just started. The fade stage is independent of master.
  fadeGeneration++;
  if (fadeGain) {
    rampParam(fadeGain.gain, 1, ctx!.currentTime, 0.02);
  }
  onTrackChange?.();
  scheduleFadeTimer();
  return true;
}

export function playTrack(id: string): boolean {
  return startTrack(id, trackVols[id] ?? DEFAULT_TRACK_GAIN);
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
  if (!SOUNDS.some((s) => trackNodes[s.id])) clearFadeTimer();
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
  const gain = clampGain(v, trackVols[id] ?? DEFAULT_TRACK_GAIN);
  trackVols[id] = gain;
  const node = trackNodes[id];
  if (node && ctx) {
    rampParam(node.gain.gain, gain, ctx.currentTime, 0.04);
  }
}
export function getTrackVolume(id: string) {
  return trackVols[id] ?? DEFAULT_TRACK_GAIN;
}
export function setMasterVolume(v: number) {
  masterVol = clampMasterGain(v, masterVol);
  if (masterGain && ctx) {
    // Ramps the user master only; the duck and fade stages are separate and
    // a pending duck timer can never restore a stale master value.
    rampParam(masterGain.gain, masterVol, ctx.currentTime, 0.04);
  }
}
export function getMasterVolume() {
  return masterVol;
}
export function setFade(v: number) {
  fadeMinutes = clampFadeMinutes(v);
  safeSet("sc_sound_fade", String(fadeMinutes));
  scheduleFadeTimer();
}
export function getFade(): number {
  return fadeMinutes;
}
export function getFadeRange(): { min: number; max: number } {
  return { min: FADE_MINUTES_MIN, max: FADE_MINUTES_MAX };
}

function clearFadeTimer() {
  if (!fadeTimer) return;
  clearTimeout(fadeTimer);
  fadeTimer = 0;
}

/** (Re)start the timed fade-out from now. No timer runs when fade is 0 or
 *  nothing is playing; changing the setting while playing reschedules. */
function scheduleFadeTimer() {
  clearFadeTimer();
  if (fadeMinutes <= 0) return;
  if (!SOUNDS.some((s) => trackNodes[s.id])) return;
  fadeTimer = window.setTimeout(fadeAll, fadeMinutes * 60_000);
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
  /**
   * Audio-clock time at which this rig was attached. All movement is
   * `ctx.currentTime - startedAt`, so the initial placement, later ticks and
   * panner automation share one monotonic clock (and so suspending the
   * context freezes movement instead of letting wall time move the source).
   */
  startedAt: number;
  /** Single random phase per rig, used for the initial placement and every update. */
  phaseOffset: number;
}

const spatialRigs: Record<string, TrackSpatialRig> = {};

// HRTF position params are effectively k-rate; ~25 Hz is plenty and avoids
// one audio-param write per display frame per track.
const SPATIAL_UPDATE_INTERVAL = 1 / 25;
// Also on the audio clock: a wall-clock throttle would fight the movement
// clock when the page is throttled or the context is suspended.
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

  // One phase, created once. The initial placement and every later tick use
  // this exact value; drawing a second `Math.random()` for the rig made the
  // first update land on a different phase than the starting position. The
  // draw is intentionally outside the per-voice seed (see audio/prng.ts) so
  // two replays of the same track do not sit in identical stereo positions.
  const now = ctx.currentTime;
  const phaseOffset = Math.random() * Math.PI * 2;
  const position = positionForProfile(profile, 0, phaseOffset);

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
      startedAt: now,
      phaseOffset,
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
      startedAt: now,
      phaseOffset,
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

// Called from the animation frame, but takes no timestamp argument: every
// value that reaches `positionForProfile()` is elapsed audio time. Mixing
// `requestAnimationFrame`'s page-relative timestamp into this used to make a
// moving track jump on its first update (the placement used audio time, the
// tick used page time) and on every context suspend/resume.
export function tickSpatial(): void {
  if (!spatialEnabled || !ctx) return;
  const now = ctx.currentTime;
  if (!Number.isFinite(now)) return;
  // `currentTime` is monotonic within one context, but a rebuilt context
  // starts near zero. Without this guard the throttle would stay ahead of the
  // new clock and freeze movement for the rest of the session.
  if (now < lastSpatialUpdate) lastSpatialUpdate = -Infinity;
  if (now - lastSpatialUpdate < SPATIAL_UPDATE_INTERVAL) return;
  lastSpatialUpdate = now;

  Object.keys(spatialRigs).forEach((id) => {
    const rig = spatialRigs[id];
    if (!rig || rig.profile.movement.kind === "fixed") return;
    const elapsed = Math.max(0, now - rig.startedAt);
    const position = positionForProfile(
      rig.profile,
      elapsed,
      rig.phaseOffset,
    );
    if (rig.panner) writePannerPosition(rig.panner, position, now);
    if (rig.fallback) {
      safeParam(
        rig.fallback.pan,
        panFromPosition(position),
        now,
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
// The binaural pair is mixed into the same analyser/mix bus as every other
// source, so the mixer meter represents the whole audible programme. It
// deliberately bypasses the per-track spatial rig: HRTF would destroy the
// exact left/right frequency split the effect depends on.
let binauralStopTimer = 0;

export function playBinaural(presetId: string): boolean {
  stopBinaural();
  if (!ensureCtxSafe()) return false;
  const preset = BINAURAL_PRESETS.find((p) => p.id === presetId);
  if (!preset) return false;
  const ac = ctx!;

  const merger = ac.createChannelMerger(2);
  const gain = ac.createGain();
  const left = ac.createOscillator();
  const right = ac.createOscillator();
  left.type = right.type = "sine";
  left.frequency.value = preset.carrier;
  right.frequency.value = preset.carrier + preset.beat;

  const lg = ac.createGain();
  lg.gain.value = 1;
  const rg = ac.createGain();
  rg.gain.value = 1;
  left.connect(lg);
  lg.connect(merger, 0, 0);
  right.connect(rg);
  rg.connect(merger, 0, 1);
  merger.connect(gain);
  gain.connect(analyser!);

  // Short fade-in avoids the click of two oscillators starting at full gain.
  const now = ac.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.25);

  left.start();
  right.start();
  binauralNodes = { left, right, merger, gain };
  binauralPresetId = presetId;
  onTrackChange?.();
  return true;
}

export function stopBinaural() {
  const nodes = binauralNodes;
  if (!nodes) return;
  binauralNodes = null;
  binauralPresetId = null;
  clearTimeout(binauralStopTimer);
  if (ctx) rampParam(nodes.gain.gain, 0, ctx.currentTime, 0.2);
  // The ramp is the audible stop; this timer only tears the graph down. It
  // may run late in a background tab without leaving audible output behind.
  binauralStopTimer = window.setTimeout(() => {
    try {
      nodes.left.stop();
    } catch {}
    try {
      nodes.right.stop();
    } catch {}
    try {
      nodes.gain.disconnect();
      nodes.merger.disconnect();
    } catch {}
  }, 240);
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
// Ducking lives on its own gain stage after the user master, so the timer
// only ever restores duckGain to 1. It can never write a stale value back
// over a master-volume change the user made during the duck window.
const DUCK_FACTOR = 0.78;
const DUCK_HOLD_MS = 8000;
let adaptiveDuckTimer = 0;

export function adaptOnWorkStart() {
  if (!ctx || !duckGain) return;
  clearTimeout(adaptiveDuckTimer);
  rampParam(duckGain.gain, DUCK_FACTOR, ctx.currentTime, 0.25);
  adaptiveDuckTimer = window.setTimeout(() => {
    if (ctx && duckGain) {
      rampParam(duckGain.gain, 1, ctx.currentTime, 0.5);
    }
  }, DUCK_HOLD_MS);
}
export function adaptOnBreak() {
  clearTimeout(adaptiveDuckTimer);
  if (ctx && duckGain) {
    rampParam(duckGain.gain, 1, ctx.currentTime, 0.4);
  }
}

export function autoStartCommonRoom() {
  if (!SOUNDS.some((s) => isPlaying(s.id))) {
    playTrack("rain");
    playTrack("fire");
  }
}

// ── Crossfade ─────────────────────────────────────────────────────────
// Smoothly ramps out currently-playing tracks not in the target map while
// ramping in (or starting) the tracks in it. Operates on each track's own
// per-track GainNode, so master, duck and fade stages are untouched.
//
// Target levels and live gains are kept separate: a scene passes its
// validated target map here, this function stores those targets in
// `trackVols` and schedules the actual gain transition from whatever the
// track is currently playing at. It never writes the target to the live gain
// before the ramp, which used to erase the transition.
//
// Equal-power (cosine/sine) curves are used when a track enters or leaves,
// because two overlapping signals then hold roughly constant loudness. A
// track that stays in the mix gets a short linear ramp to its new target.
// All scheduling is on the AudioContext clock, so it finishes while the tab
// is backgrounded. If the engine rejects curve automation, the linear
// AudioParam fallback is still audio-clock scheduled (never rAF-driven).
const CROSSFADE_STEPS = 128;

export type CrossfadeTargets = Record<string, number> | readonly string[];

let crossfadeGeneration = 0;

function normalizeTargets(targets: CrossfadeTargets): Record<string, number> {
  const map: Record<string, number> = {};
  const known = new Set(SOUNDS.map((s) => s.id));
  if (Array.isArray(targets)) {
    for (const id of targets) {
      if (typeof id !== "string" || !known.has(id)) continue;
      map[id] = clampGain(trackVols[id] ?? DEFAULT_TRACK_GAIN);
    }
    return map;
  }
  if (!targets || typeof targets !== "object") return map;
  for (const [id, value] of Object.entries(targets)) {
    if (!known.has(id)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    map[id] = clampGain(value);
  }
  return map;
}

export function crossfadeTo(
  targets: CrossfadeTargets,
  durationMs = 2500,
): void {
  if (!ensureCtxSafe()) return;
  const seconds = Math.max(0.05, durationMs / 1000);
  const now = ctx!.currentTime;
  const targetMap = normalizeTargets(targets);
  const generation = ++crossfadeGeneration;

  // Target levels are the new stored fader values; live gains are scheduled
  // separately below.
  for (const [id, gain] of Object.entries(targetMap)) trackVols[id] = gain;

  // Fade out anything playing that is not in the target set.
  for (const id of Object.keys(trackNodes)) {
    if (id in targetMap) continue;
    const track = trackNodes[id];
    if (!track) continue;
    const startVal = Math.max(0, track.gain.gain.value);
    const scheduled = curveParam(
      track.gain.gain,
      equalPowerCurve("out", startVal, CROSSFADE_STEPS),
      now,
      seconds,
    );
    if (!scheduled) rampParam(track.gain.gain, 0, now, seconds);
    window.setTimeout(() => {
      // A newer transition owns the graph now; do not tear down a track it
      // may have re-admitted.
      if (generation !== crossfadeGeneration) return;
      const tn = trackNodes[id];
      if (tn && tn.gain.gain.value < 0.01) stopTrack(id);
    }, durationMs + 80);
  }

  // Start (if needed) and ramp in the target tracks.
  for (const [id, target] of Object.entries(targetMap)) {
    if (!trackNodes[id] && !startTrack(id, 0)) continue;
    const track = trackNodes[id];
    if (!track) continue;
    const startVal = Math.max(0, track.gain.gain.value);
    if (startVal <= 0.001) {
      const scheduled = curveParam(
        track.gain.gain,
        equalPowerCurve("in", target, CROSSFADE_STEPS),
        now,
        seconds,
      );
      if (!scheduled) rampParam(track.gain.gain, target, now, seconds);
    } else {
      rampParam(track.gain.gain, target, now, seconds);
    }
  }
  onTrackChange?.();
}

// Timed fade-out. The audible ramp is on the AudioParam timeline; the timer
// below only disconnects the finished tracks. If the browser throttles the
// timer, output is already silent because fadeGain reached 0.
const FADE_OUT_SECONDS = 1.5;

function fadeAll() {
  fadeTimer = 0;
  if (!ctx || !fadeGain) return;
  const generation = ++fadeGeneration;
  rampParam(fadeGain.gain, 0, ctx.currentTime, FADE_OUT_SECONDS);
  window.setTimeout(() => {
    if (generation !== fadeGeneration) return;
    SOUNDS.forEach((s) => stopTrack(s.id));
    // Re-arm the stage for the next playback. Tracks are already stopped, so
    // this cannot produce an audible jump.
    if (ctx && fadeGain) {
      rampParam(fadeGain.gain, 1, ctx.currentTime, 0.01);
    }
  }, FADE_OUT_SECONDS * 1000 + 80);
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
