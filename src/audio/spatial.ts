// Typed spatial profiles for every ambient sound ID. Phase 1 treats each
// sound option as one track-level emitter; individual bird/frog/crackle
// emitters are a later extension. Values follow the HRTF integration spec:
// azimuth/elevation in degrees, distance in loose scene metres, movement
// width in degrees. They are starting sound-design values, not measurements.
//
// Input layout: there is deliberately no per-profile mono/stereo field. A
// PannerNode inherits the channel layout of whatever feeds it (the per-track
// gain) and performs its own localisation, so a profile-level "auto" value
// would look like a setting while doing nothing. If a track ever needs an
// explicit conversion (for example a mono down-mix before an equal-power
// fallback), add it to the graph with a channel-count assertion in
// tests-unit/spatial-graph.test.ts — not as an unread profile property.

import type { AmbientPresetId } from "./engine";
import { clamp } from "./dsp";

export type SpatialMovement =
  | { kind: "fixed" }
  | { kind: "sweep"; widthDeg: number; rateRadPerSec: number }
  | {
    kind: "wander";
    widthDeg: number;
    rateRadPerSec: number;
    secondaryRatio: number;
  }
  | { kind: "burst"; widthDeg: number; rateRadPerSec: number };

export interface SpatialProfile {
  /** One sound option is one spatial emitter in Phase 1. */
  mode: "track-emitter" | "centered" | "bypass";
  panningModel: "HRTF" | "equalpower";
  position: {
    azimuthDeg: number;
    elevationDeg: number;
    distanceM: number;
  };
  movement: SpatialMovement;
  distance: {
    model: "inverse" | "linear" | "exponential";
    refDistance: number;
    maxDistance: number;
    rolloffFactor: number;
  };
}

const DEFAULT_DISTANCE = {
  model: "inverse" as const,
  refDistance: 1,
  maxDistance: 30,
  rolloffFactor: 0.6,
};

function profile(
  mode: SpatialProfile["mode"],
  azimuthDeg: number,
  elevationDeg: number,
  distanceM: number,
  movement: SpatialMovement,
): SpatialProfile {
  return {
    mode,
    panningModel: "HRTF",
    position: { azimuthDeg, elevationDeg, distanceM },
    movement,
    distance: DEFAULT_DISTANCE,
  };
}

const fixed = (): SpatialMovement => ({ kind: "fixed" });
const sweep = (widthDeg: number, rateRadPerSec: number): SpatialMovement => ({
  kind: "sweep",
  widthDeg,
  rateRadPerSec,
});
const wander = (
  widthDeg: number,
  rateRadPerSec: number,
  secondaryRatio = 1.618,
): SpatialMovement => ({
  kind: "wander",
  widthDeg,
  rateRadPerSec,
  secondaryRatio,
});
const burst = (widthDeg: number, rateRadPerSec: number): SpatialMovement => ({
  kind: "burst",
  widthDeg,
  rateRadPerSec,
});

export const SPATIAL_PROFILES = {
  rain: profile("track-emitter", 0, 0, 6, sweep(49.5, 0.04)),
  roofrain: profile("track-emitter", 0, 25, 3, sweep(58.5, 0.05)),
  white: profile("centered", 0, 0, 1, fixed()),
  pink: profile("centered", 0, 0, 1, fixed()),
  brown: profile("centered", 0, 0, 1.5, wander(27, 0.02)),
  forest: profile("track-emitter", 0, 0, 8, burst(49.5, 0.07)),
  cafe: profile("track-emitter", 0, 0, 5, wander(49.5, 0.12)),
  ocean: profile("track-emitter", 0, 0, 12, sweep(58.5, 0.05)),
  fire: profile("track-emitter", 14, 0, 2, fixed()),
  wind: profile("track-emitter", 0, 0, 7, wander(63, 0.03)),
  snow: profile("track-emitter", 0, 0, 6, wander(22.5, 0.015)),
  keyboard: profile("track-emitter", -18, 0, 1.2, fixed()),
  library: profile("track-emitter", -5, 0, 3.5, wander(18, 0.01)),
  airplane: profile("track-emitter", 0, 0, 1.5, fixed()),
  spaceship: profile("track-emitter", 0, 0, 3.5, fixed()),
  campfire: profile("track-emitter", -9, 0, 2.5, fixed()),
  waves: profile("track-emitter", 0, 0, 8, burst(54, 0.06)),
  river: profile("track-emitter", 0, 0, 6, wander(31.5, 0.03)),
  waterfall: profile("track-emitter", 0, 0, 9, fixed()),
  thunder: profile("track-emitter", 0, 0, 25, sweep(49.5, 0.04)),
  night: profile("track-emitter", 0, 0, 7, wander(18, 0.01)),
  birds: profile("track-emitter", 0, 5, 7, burst(67.5, 0.09)),
  hum: profile("centered", 0, 0, 1, fixed()),
  frogs: profile("track-emitter", 0, -3, 6, burst(58.5, 0.1)),
  city: profile("track-emitter", 0, 0, 20, wander(45, 0.05)),
  fan: profile("track-emitter", 0, 0, 1.5, fixed()),
  clock: profile("track-emitter", -14, 0, 1, fixed()),
  vinyl: profile("track-emitter", 0, 0, 1.2, fixed()),
  heartbeat: profile("bypass", 0, 0, 0.8, fixed()),
  drone: profile("centered", 0, 0, 4, fixed()),
  space: profile("track-emitter", 0, 0, 15, wander(36, 0.015)),
  lofi: profile("track-emitter", 0, 0, 2, fixed()),
  pad: profile("track-emitter", 0, 0, 5, wander(31.5, 0.02)),
  musicbox: profile("track-emitter", 9, 0, 2.2, fixed()),
  bells: profile("track-emitter", 0, 5, 6, burst(45, 0.08)),
} satisfies Record<AmbientPresetId, SpatialProfile>;

export function getSpatialProfile(id: string): SpatialProfile | null {
  return (SPATIAL_PROFILES as Record<string, SpatialProfile>)[id] ?? null;
}

export function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export const clampFinite = clamp;

export interface CartesianPosition {
  x: number;
  y: number;
  z: number;
}

/** Web Audio right-handed scene: +X right, +Y up, -Z forward. */
export function sphericalToCartesian(
  azimuthDeg: number,
  elevationDeg: number,
  distanceM: number,
): CartesianPosition {
  const az = degreesToRadians(clampFinite(azimuthDeg, -180, 180));
  const el = degreesToRadians(clampFinite(elevationDeg, -90, 90));
  const r = clampFinite(distanceM, 0.05, 100);
  return {
    x: r * Math.sin(az) * Math.cos(el),
    y: r * Math.sin(el),
    z: -r * Math.cos(az) * Math.cos(el),
  };
}

/** Deterministic pan shape preserved from the legacy profiles. */
export function movementPan(
  movement: SpatialMovement,
  elapsedSeconds: number,
  phaseOffset: number,
): number {
  if (movement.kind === "fixed") return 0;
  const t = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  const phase = t * movement.rateRadPerSec + phaseOffset;
  switch (movement.kind) {
    case "sweep":
      return Math.sin(phase);
    case "wander":
      return (
        Math.sin(phase) * 0.6 +
        Math.sin(phase * movement.secondaryRatio) * 0.4
      );
    case "burst": {
      const raw = Math.sin(phase * 1.3) * Math.sin(phase * 0.7);
      return Math.sign(raw) * Math.sqrt(Math.abs(raw));
    }
  }
}

export function positionForProfile(
  targetProfile: SpatialProfile,
  elapsedSeconds: number,
  phaseOffset: number,
): CartesianPosition {
  if (targetProfile.mode === "bypass") {
    return sphericalToCartesian(0, 0, targetProfile.position.distanceM);
  }
  const movement = movementPan(targetProfile.movement, elapsedSeconds, phaseOffset);
  const width = targetProfile.movement.kind === "fixed"
    ? 0
    : targetProfile.movement.widthDeg;
  const azimuth = targetProfile.position.azimuthDeg + movement * width;
  return sphericalToCartesian(
    clampFinite(azimuth, -180, 180),
    targetProfile.position.elevationDeg,
    targetProfile.position.distanceM,
  );
}
