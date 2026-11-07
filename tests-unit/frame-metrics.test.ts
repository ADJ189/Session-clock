import { test } from "node:test";
import assert from "node:assert/strict";
import { FrameMetricsTracker } from "../src/frame-metrics.ts";

test("FrameMetricsTracker starts with empty snapshot", () => {
  const tracker = new FrameMetricsTracker({ bufferCapacity: 50 });
  const snapshot = tracker.getSnapshot();

  assert.strictEqual(snapshot.sampleCount, 0);
  assert.strictEqual(snapshot.p50, 0);
  assert.strictEqual(snapshot.p95, 0);
  assert.strictEqual(snapshot.p99, 0);
  assert.strictEqual(snapshot.droppedFrameCount, 0);
  assert.strictEqual(snapshot.droppedFrameRatio, 0);
  assert.strictEqual(snapshot.longTaskCount, 0);
  assert.strictEqual(snapshot.totalLongTaskDurationMs, 0);
  assert.strictEqual(snapshot.lastDrawDurationMs, null);
});

test("FrameMetricsTracker calculates correct percentiles and FPS", () => {
  const tracker = new FrameMetricsTracker({ bufferCapacity: 100, targetFrameMs: 16.67 });

  // Feed 100 frames at exactly 16.67ms (60 fps)
  let t = 1000;
  tracker.recordFrame(t);
  for (let i = 0; i < 100; i++) {
    t += 16.67;
    tracker.recordFrame(t, 2.5);
  }

  const snapshot = tracker.getSnapshot();
  assert.strictEqual(snapshot.sampleCount, 100);
  assert.strictEqual(Math.round(snapshot.p50), 17);
  assert.strictEqual(Math.round(snapshot.p95), 17);
  assert.strictEqual(Math.round(snapshot.p99), 17);
  assert.strictEqual(snapshot.fps, 60);
  assert.strictEqual(snapshot.droppedFrameCount, 0);
  assert.strictEqual(snapshot.droppedFrameRatio, 0);
  assert.strictEqual(snapshot.lastDrawDurationMs, 2.5);
});

test("FrameMetricsTracker detects dropped frames when intervals exceed threshold", () => {
  const tracker = new FrameMetricsTracker({ bufferCapacity: 100, targetFrameMs: 16.67 });

  let t = 1000;
  tracker.recordFrame(t);
  // 10 normal frames (16.67ms)
  for (let i = 0; i < 10; i++) {
    t += 16.67;
    tracker.recordFrame(t);
  }
  // 2 stalled frames: one at 50ms (~2 dropped) and one at 35ms (~1 dropped)
  t += 50;
  tracker.recordFrame(t);
  t += 35;
  tracker.recordFrame(t);

  const snapshot = tracker.getSnapshot();
  assert.ok(snapshot.droppedFrameCount >= 3);
  assert.ok(snapshot.droppedFrameRatio > 0);
  assert.ok(snapshot.p95 > 30);
});

test("FrameMetricsTracker discards stale intervals after tab resume", () => {
  const tracker = new FrameMetricsTracker({ bufferCapacity: 50 });

  tracker.recordFrame(1000);
  tracker.recordFrame(1016);
  // 10 second gap (tab sleep / resume)
  tracker.recordFrame(11016);
  tracker.recordFrame(11032);

  const snapshot = tracker.getSnapshot();
  // The 10000ms delta must have been discarded, leaving 2 samples (16ms each)
  assert.strictEqual(snapshot.sampleCount, 2);
  assert.strictEqual(Math.round(snapshot.p50), 16);
  assert.strictEqual(snapshot.droppedFrameCount, 0);
});

test("FrameMetricsTracker records long tasks correctly", () => {
  const tracker = new FrameMetricsTracker();

  tracker.recordLongTask(64.5);
  tracker.recordLongTask(120.3);

  const snapshot = tracker.getSnapshot();
  assert.strictEqual(snapshot.longTaskCount, 2);
  assert.strictEqual(Math.round(snapshot.totalLongTaskDurationMs), 185);
});

test("FrameMetricsTracker reset clears state cleanly", () => {
  const tracker = new FrameMetricsTracker();

  tracker.recordFrame(1000);
  tracker.recordFrame(1030);
  tracker.recordLongTask(75);

  assert.ok(tracker.getSnapshot().sampleCount > 0);
  assert.ok(tracker.getSnapshot().longTaskCount > 0);

  tracker.reset(2000);
  const cleared = tracker.getSnapshot();
  assert.strictEqual(cleared.sampleCount, 0);
  assert.strictEqual(cleared.longTaskCount, 0);
  assert.strictEqual(cleared.totalLongTaskDurationMs, 0);
  assert.strictEqual(cleared.droppedFrameCount, 0);
});
