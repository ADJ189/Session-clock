// Device-orientation → AudioListener conversion.
//
// DeviceOrientationEvent alpha/beta/gamma describe the phone, not a headset.
// We use the same Euler → quaternion → camera-basis convention popularised by
// Three.js's DeviceOrientationControls: a -90° X correction changes the
// device's screen coordinates into the Web Audio scene (forward = -Z,
// up = +Y), then the current screen rotation is applied as a final roll.
//
// Pure functions only, so Deno tests can cover cardinal orientations without
// a DOM or sensor.

export type Vector3Tuple = [number, number, number];

export interface ListenerVectors {
  forward: Vector3Tuple;
  up: Vector3Tuple;
}

interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

const HALF_SQRT = Math.SQRT1_2;

function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function axisAngle(
  x: number,
  y: number,
  z: number,
  radians: number,
): Quaternion {
  const half = radians / 2;
  const s = Math.sin(half);
  return { x: x * s, y: y * s, z: z * s, w: Math.cos(half) };
}

function rotate(q: Quaternion, v: Vector3Tuple): Vector3Tuple {
  // v' = v + 2 * cross(q.xyz, cross(q.xyz, v) + q.w * v)
  const cx = q.y * v[2] - q.z * v[1] + q.w * v[0];
  const cy = q.z * v[0] - q.x * v[2] + q.w * v[1];
  const cz = q.x * v[1] - q.y * v[0] + q.w * v[2];
  return [
    v[0] + 2 * (q.y * cz - q.z * cy),
    v[1] + 2 * (q.z * cx - q.x * cz),
    v[2] + 2 * (q.x * cy - q.y * cx),
  ];
}

function normalise(v: Vector3Tuple): Vector3Tuple {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (!Number.isFinite(length) || length < 1e-9) return [0, 0, -1];
  return [v[0] / length, v[1] / length, v[2] / length];
}

function eulerYXZ(
  xRad: number,
  yRad: number,
  zRad: number,
): Quaternion {
  const c1 = Math.cos(xRad / 2);
  const c2 = Math.cos(yRad / 2);
  const c3 = Math.cos(zRad / 2);
  const s1 = Math.sin(xRad / 2);
  const s2 = Math.sin(yRad / 2);
  const s3 = Math.sin(zRad / 2);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 - s1 * s2 * c3,
    w: c1 * c2 * c3 + s1 * s2 * s3,
  };
}

const DEG = Math.PI / 180;

/**
 * Converts device Euler angles (degrees) and screen orientation (degrees)
 * into Web Audio forward/up vectors. Returns null when any input is missing
 * or non-finite, so callers can leave the listener safely at its default.
 */
export function deviceOrientationToListener(
  alpha: number | null | undefined,
  beta: number | null | undefined,
  gamma: number | null | undefined,
  screenAngleDeg = 0,
): ListenerVectors | null {
  if (alpha == null || beta == null || gamma == null) return null;
  if (
    !Number.isFinite(alpha) ||
    !Number.isFinite(beta) ||
    !Number.isFinite(gamma)
  ) {
    return null;
  }
  const screen = Number.isFinite(screenAngleDeg) ? screenAngleDeg : 0;

  // Three.js DeviceOrientationControls: Euler order YXZ with (beta, alpha,
  // -gamma), then a -90° X correction, then the screen-orientation roll.
  let q = eulerYXZ(beta * DEG, alpha * DEG, -gamma * DEG);
  q = multiply(q, { x: -HALF_SQRT, y: 0, z: 0, w: HALF_SQRT });
  q = multiply(q, axisAngle(0, 0, 1, -screen * DEG));

  return {
    forward: normalise(rotate(q, [0, 0, -1])),
    up: normalise(rotate(q, [0, 1, 0])),
  };
}

/** Exponential smoothing that handles the ±1 wrap in vector space safely. */
export function smoothListenerVectors(
  previous: ListenerVectors | null,
  next: ListenerVectors,
  factor = 0.25,
): ListenerVectors {
  if (!previous) return next;
  const f = Math.max(0, Math.min(1, factor));
  const mix = (a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple =>
    normalise([
      a[0] + (b[0] - a[0]) * f,
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f,
    ]);
  return {
    forward: mix(previous.forward, next.forward),
    up: mix(previous.up, next.up),
  };
}
