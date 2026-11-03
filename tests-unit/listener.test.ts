import { test } from "node:test";
import { assertEquals, assert } from "./assert.ts";
import {
  deviceOrientationToListener,
  smoothListenerVectors,
  type ListenerVectors,
} from "../src/audio/listener.ts";

function close(actual: number, expected: number, eps = 1e-6): void {
  assert(
    Math.abs(actual - expected) <= eps,
    `expected ${expected}, got ${actual}`,
  );
}

function closeVector(
  actual: [number, number, number],
  expected: [number, number, number],
): void {
  close(actual[0], expected[0]);
  close(actual[1], expected[1]);
  close(actual[2], expected[2]);
}

function length(v: [number, number, number]): number {
  return Math.hypot(v[0], v[1], v[2]);
}

test("missing or non-finite orientation leaves the listener alone", () => {
  assertEquals(deviceOrientationToListener(null, 0, 0), null);
  assertEquals(deviceOrientationToListener(0, undefined, 0), null);
  assertEquals(deviceOrientationToListener(0, 0, Number.NaN), null);
  assertEquals(deviceOrientationToListener(0, Number.POSITIVE_INFINITY, 0), null);
});

test("an upright phone looks straight down -Z", () => {
  const result = deviceOrientationToListener(0, 90, 0);
  assert(result);
  closeVector(result.forward, [0, 0, -1]);
  closeVector(result.up, [0, 1, 0]);
});

test("a phone lying flat looks down and its up vector points forward", () => {
  const result = deviceOrientationToListener(0, 0, 0);
  assert(result);
  closeVector(result.forward, [0, -1, 0]);
  closeVector(result.up, [0, 0, -1]);
});

test("alpha rotates the listener yaw", () => {
  const result = deviceOrientationToListener(90, 90, 0);
  assert(result);
  closeVector(result.forward, [-1, 0, 0]);
});

test("screen rotation rolls the up vector", () => {
  const result = deviceOrientationToListener(0, 90, 0, 90);
  assert(result);
  closeVector(result.forward, [0, 0, -1]);
  closeVector(result.up, [1, 0, 0]);
});

test("non-finite screen angle falls back to zero", () => {
  const a = deviceOrientationToListener(20, 45, 10, Number.NaN);
  const b = deviceOrientationToListener(20, 45, 10, 0);
  assert(a && b);
  closeVector(a.forward, b.forward);
  closeVector(a.up, b.up);
});

test("all returned vectors are unit length", () => {
  for (const [alpha, beta, gamma] of [
    [0, 0, 0],
    [30, 60, -20],
    [180, 90, 90],
    [-45, 10, 45],
  ]) {
    const result = deviceOrientationToListener(alpha, beta, gamma, 90);
    assert(result);
    close(length(result.forward), 1);
    close(length(result.up), 1);
  }
});

test("smoothing keeps the previous vectors when factor is zero", () => {
  const previous: ListenerVectors = {
    forward: [0, 0, -1],
    up: [0, 1, 0],
  };
  const next: ListenerVectors = { forward: [1, 0, 0], up: [1, 0, 0] };
  const result = smoothListenerVectors(previous, next, 0);
  closeVector(result.forward, previous.forward);
  closeVector(result.up, previous.up);
});

test("smoothing returns the next vectors when factor is one", () => {
  const previous: ListenerVectors = {
    forward: [0, 0, -1],
    up: [0, 1, 0],
  };
  const next: ListenerVectors = { forward: [1, 0, 0], up: [0, 0, 1] };
  const result = smoothListenerVectors(previous, next, 1);
  closeVector(result.forward, next.forward);
  closeVector(result.up, next.up);
});

test("smoothing interpolates halfway and re-normalises", () => {
  const previous: ListenerVectors = {
    forward: [0, 0, -1],
    up: [0, 1, 0],
  };
  const next: ListenerVectors = { forward: [1, 0, 0], up: [1, 0, 0] };
  const result = smoothListenerVectors(previous, next, 0.5);
  closeVector(result.forward, [Math.SQRT1_2, 0, -Math.SQRT1_2]);
  closeVector(result.up, [Math.SQRT1_2, Math.SQRT1_2, 0]);
});

test("smoothing with no previous value passes the sample through", () => {
  const next: ListenerVectors = { forward: [1, 0, 0], up: [0, 1, 0] };
  assertEquals(smoothListenerVectors(null, next), next);
});

test("smoothing clamps factors outside 0..1", () => {
  const previous: ListenerVectors = {
    forward: [0, 0, -1],
    up: [0, 1, 0],
  };
  const next: ListenerVectors = { forward: [1, 0, 0], up: [1, 0, 0] };
  closeVector(smoothListenerVectors(previous, next, 9).forward, [1, 0, 0]);
  closeVector(smoothListenerVectors(previous, next, -9).forward, [0, 0, -1]);
});
