import { test } from "node:test";
import assert from "node:assert/strict";
import {
  errorMessage,
  RendererHealthTracker,
  type RendererFailure,
} from "../src/rendererHealth.ts";

test("a fresh tracker is active on both paths", () => {
  const health = new RendererHealthTracker();
  assert.strictEqual(health.status, "active");
  assert.strictEqual(health.canDrawBackground, true);
  assert.strictEqual(health.canRunTransitions, true);
  assert.strictEqual(health.failureCount, 0);
});

test("a transition failure degrades but keeps the clock drawing", () => {
  let clock = 100;
  const failures: RendererFailure[] = [];
  const health = new RendererHealthTracker(
    (failure) => failures.push(failure),
    () => ++clock,
  );
  assert.strictEqual(health.disableTransitions("context-missing"), true);
  assert.strictEqual(health.status, "degraded");
  assert.strictEqual(health.canDrawBackground, true);
  assert.strictEqual(health.canRunTransitions, false);
  assert.strictEqual(health.failureCount, 1);
  assert.strictEqual(failures.length, 1);
  assert.strictEqual(failures[0]!.path, "transitions");
  assert.strictEqual(failures[0]!.at, 101);
});

test("a background failure disables the canvas path entirely", () => {
  const health = new RendererHealthTracker();
  health.disableTransitions("context-lost");
  health.disableBackground("context-lost");
  assert.strictEqual(health.status, "disabled");
  assert.strictEqual(health.canDrawBackground, false);
  assert.strictEqual(health.canRunTransitions, false);
});

test("each (path, reason) pair is recorded exactly once", () => {
  const health = new RendererHealthTracker();
  assert.strictEqual(health.disableTransitions("draw-error"), true);
  assert.strictEqual(health.disableTransitions("draw-error"), false);
  assert.strictEqual(health.disableTransitions("context-missing"), true);
  assert.strictEqual(health.failureCount, 2);
});

test("failBackground stores a truncated error message", () => {
  const health = new RendererHealthTracker();
  assert.strictEqual(health.failBackground(new Error("x".repeat(900))), true);
  const log = health.getFailureLog();
  assert.strictEqual(log.length, 1);
  assert.strictEqual(log[0]!.reason, "draw-error");
  assert.strictEqual(log[0]!.message.length, 400);
});

test("failTransitions keeps the background alive", () => {
  const health = new RendererHealthTracker();
  health.failTransitions("not an error");
  assert.strictEqual(health.status, "degraded");
  assert.strictEqual(health.getFailureLog()[0]!.message, "not an error");
});

test("a throwing failure handler cannot break the boundary", () => {
  const health = new RendererHealthTracker(() => {
    throw new Error("handler exploded");
  });
  assert.strictEqual(health.failBackground(new Error("draw")), true);
  assert.strictEqual(health.status, "disabled");
});

test("setFailureHandler replaces the callback", () => {
  let a = 0;
  let b = 0;
  const health = new RendererHealthTracker(() => a++);
  health.setFailureHandler(() => b++);
  health.disableTransitions("context-lost");
  assert.strictEqual(a, 0);
  assert.strictEqual(b, 1);
  health.setFailureHandler(undefined);
  health.disableBackground("context-lost");
  assert.strictEqual(b, 1, "no handler after clearing");
});

test("errorMessage handles Error, string and object values", () => {
  assert.strictEqual(errorMessage(new Error("boom")), "boom");
  assert.strictEqual(errorMessage(new TypeError("")), "TypeError");
  assert.strictEqual(errorMessage("plain"), "plain");
  assert.strictEqual(errorMessage({ code: 7 }), "[object Object]");
});

test("the failure log keeps chronological order", () => {
  const health = new RendererHealthTracker();
  health.disableTransitions("context-missing");
  health.failBackground(new Error("draw"));
  const log = health.getFailureLog();
  assert.strictEqual(log.length, 2);
  assert.strictEqual(log[0]!.path, "transitions");
  assert.strictEqual(log[1]!.path, "background");
});

test("restoring a context re-enables its path and keeps failure history", () => {
  const health = new RendererHealthTracker();
  health.disableBackground("context-lost");
  health.disableTransitions("context-lost");
  assert.strictEqual(health.status, "disabled");

  health.restoreBackground();
  assert.strictEqual(health.status, "degraded");
  assert.strictEqual(health.canDrawBackground, true);

  health.restoreTransitions();
  assert.strictEqual(health.status, "active");
  assert.strictEqual(health.canRunTransitions, true);
  assert.strictEqual(health.failureCount, 2, "history is retained");
});
