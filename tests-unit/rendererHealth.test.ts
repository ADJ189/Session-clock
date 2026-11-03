import { test } from "node:test";
import { assertEquals } from "./assert.ts";
import {
  errorMessage,
  RendererHealthTracker,
  type RendererFailure,
} from "../src/rendererHealth.ts";

test("a fresh tracker is active on both paths", () => {
  const health = new RendererHealthTracker();
  assertEquals(health.status, "active");
  assertEquals(health.canDrawBackground, true);
  assertEquals(health.canRunTransitions, true);
  assertEquals(health.failureCount, 0);
});

test("a transition failure degrades but keeps the clock drawing", () => {
  let clock = 100;
  const failures: RendererFailure[] = [];
  const health = new RendererHealthTracker(
    (failure) => failures.push(failure),
    () => ++clock,
  );
  assertEquals(health.disableTransitions("context-missing"), true);
  assertEquals(health.status, "degraded");
  assertEquals(health.canDrawBackground, true);
  assertEquals(health.canRunTransitions, false);
  assertEquals(health.failureCount, 1);
  assertEquals(failures.length, 1);
  assertEquals(failures[0]!.path, "transitions");
  assertEquals(failures[0]!.at, 101);
});

test("a background failure disables the canvas path entirely", () => {
  const health = new RendererHealthTracker();
  health.disableTransitions("context-lost");
  health.disableBackground("context-lost");
  assertEquals(health.status, "disabled");
  assertEquals(health.canDrawBackground, false);
  assertEquals(health.canRunTransitions, false);
});

test("each (path, reason) pair is recorded exactly once", () => {
  const health = new RendererHealthTracker();
  assertEquals(health.disableTransitions("draw-error"), true);
  assertEquals(health.disableTransitions("draw-error"), false);
  assertEquals(health.disableTransitions("context-missing"), true);
  assertEquals(health.failureCount, 2);
});

test("failBackground stores a truncated error message", () => {
  const health = new RendererHealthTracker();
  assertEquals(health.failBackground(new Error("x".repeat(900))), true);
  const log = health.getFailureLog();
  assertEquals(log.length, 1);
  assertEquals(log[0]!.reason, "draw-error");
  assertEquals(log[0]!.message.length, 400);
});

test("failTransitions keeps the background alive", () => {
  const health = new RendererHealthTracker();
  health.failTransitions("not an error");
  assertEquals(health.status, "degraded");
  assertEquals(health.getFailureLog()[0]!.message, "not an error");
});

test("a throwing failure handler cannot break the boundary", () => {
  const health = new RendererHealthTracker(() => {
    throw new Error("handler exploded");
  });
  assertEquals(health.failBackground(new Error("draw")), true);
  assertEquals(health.status, "disabled");
});

test("setFailureHandler replaces the callback", () => {
  let a = 0;
  let b = 0;
  const health = new RendererHealthTracker(() => a++);
  health.setFailureHandler(() => b++);
  health.disableTransitions("context-lost");
  assertEquals(a, 0);
  assertEquals(b, 1);
  health.setFailureHandler(undefined);
  health.disableBackground("context-lost");
  assertEquals(b, 1, "no handler after clearing");
});

test("errorMessage handles Error, string and object values", () => {
  assertEquals(errorMessage(new Error("boom")), "boom");
  assertEquals(errorMessage(new TypeError("")), "TypeError");
  assertEquals(errorMessage("plain"), "plain");
  assertEquals(errorMessage({ code: 7 }), "[object Object]");
});

test("the failure log keeps chronological order", () => {
  const health = new RendererHealthTracker();
  health.disableTransitions("context-missing");
  health.failBackground(new Error("draw"));
  const log = health.getFailureLog();
  assertEquals(log.length, 2);
  assertEquals(log[0]!.path, "transitions");
  assertEquals(log[1]!.path, "background");
});

test("restoring a context re-enables its path and keeps failure history", () => {
  const health = new RendererHealthTracker();
  health.disableBackground("context-lost");
  health.disableTransitions("context-lost");
  assertEquals(health.status, "disabled");

  health.restoreBackground();
  assertEquals(health.status, "degraded");
  assertEquals(health.canDrawBackground, true);

  health.restoreTransitions();
  assertEquals(health.status, "active");
  assertEquals(health.canRunTransitions, true);
  assertEquals(health.failureCount, 2, "history is retained");
});
