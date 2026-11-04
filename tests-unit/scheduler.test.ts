import { test } from "node:test";
import assert from "node:assert/strict";
import { createSchedulerClock } from "./mock-audio.ts";
import { EventScheduler } from "../src/audio/scheduler.ts";

test("manual mode does not start a wall-clock timer", () => {
  const { ctx } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, { autoStart: false, wakeMs: 1000 });
  scheduler.add(0.1, 0.1, () => {});
  assert.strictEqual(scheduler.activeTasks, 1);
  assert.strictEqual(scheduler.running, false);
  scheduler.clearTasks();
});

test("tick() runs a due task once and moves its next deadline", () => {
  const { ctx, advance } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, {
    autoStart: false,
    lookahead: 0.05,
  });
  const ran: number[] = [];
  scheduler.add(0.1, 0.1, (time) => ran.push(time));
  scheduler.tick();
  assert.strictEqual(ran.length, 0, "nothing is due before its first deadline");
  advance(0.1);
  scheduler.tick();
  assert.strictEqual(ran.length, 1);
  assert.strictEqual(ran[0], 0.1);
});

test("a burst is capped at eight events per tick", () => {
  const { ctx } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, {
    autoStart: false,
    lookahead: 1,
  });
  let runs = 0;
  scheduler.add(0.02, 0.02, () => runs++);
  scheduler.tick();
  assert.strictEqual(runs, 8);
  scheduler.clearTasks();
});

test("task errors are counted, reported, and eventually evicted", () => {
  const { ctx, advance } = createSchedulerClock();
  let reported = 0;
  const scheduler = new EventScheduler(ctx, {
    autoStart: false,
    lookahead: 0.05,
    maxConsecutiveFailures: 3,
    onError: () => reported++,
  });
  scheduler.add(0.1, 0.1, () => {
    throw new Error("boom");
  });
  for (let i = 0; i < 9; i++) {
    advance(0.1);
    scheduler.tick();
  }
  // Evicted after its own third consecutive failure, so only three errors
  // were ever reported even though the loop ticked nine times.
  assert.strictEqual(reported, 3);
  assert.strictEqual(scheduler.errorCount, 3);
  assert.strictEqual(scheduler.activeTasks, 0, "failing task is removed");
});

test("the default failure threshold is eight consecutive errors", () => {
  const { ctx, advance } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, {
    autoStart: false,
    lookahead: 0.05,
  });
  scheduler.add(0.1, 0.1, () => {
    throw new Error("boom");
  });
  for (let i = 0; i < 7; i++) {
    advance(0.1);
    scheduler.tick();
  }
  assert.strictEqual(scheduler.activeTasks, 1, "seven failures are tolerated");
  advance(0.1);
  scheduler.tick();
  assert.strictEqual(scheduler.activeTasks, 0, "the eighth evicts the task");
  assert.strictEqual(scheduler.errorCount, 8);
});

test("one failing task never evicts or starves another task", () => {
  const { ctx, advance } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, {
    autoStart: false,
    lookahead: 0.05,
    maxConsecutiveFailures: 2,
  });
  let healthyRuns = 0;
  scheduler.add(0.1, 0.1, () => {
    throw new Error("broken voice");
  });
  scheduler.add(0.1, 0.1, () => healthyRuns++);

  for (let i = 0; i < 6; i++) {
    advance(0.1);
    scheduler.tick();
  }

  assert.strictEqual(scheduler.activeTasks, 1, "only the broken task is gone");
  assert.strictEqual(scheduler.errorCount, 2, "the healthy task never errored");
  assert.strictEqual(healthyRuns, 6, "the healthy task ran on every tick");
});

test("intermittent failures reset on success and never evict the task", () => {
  const { ctx, advance } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, {
    autoStart: false,
    lookahead: 0.05,
    maxConsecutiveFailures: 2,
  });
  let calls = 0;
  scheduler.add(0.1, 0.1, () => {
    calls++;
    if (calls % 2 === 0) throw new Error("occasional blip");
  });

  for (let i = 0; i < 12; i++) {
    advance(0.1);
    scheduler.tick();
  }

  assert.strictEqual(calls, 12);
  assert.strictEqual(scheduler.activeTasks, 1, "a success clears the streak");
  assert.strictEqual(scheduler.errorCount, 6, "aggregate count is still exact");
});

test("a throwing onError callback cannot stop the scheduler", () => {
  const { ctx, advance } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, {
    autoStart: false,
    lookahead: 0.05,
    onError: () => {
      throw new Error("reporting is broken too");
    },
  });
  let healthyRuns = 0;
  scheduler.add(0.1, 0.1, () => {
    throw new Error("boom");
  });
  scheduler.add(0.1, 0.1, () => healthyRuns++);

  for (let i = 0; i < 3; i++) {
    advance(0.1);
    assert.doesNotThrow(() => scheduler.tick());
  }
  assert.strictEqual(healthyRuns, 3);
  assert.strictEqual(scheduler.errorCount, 3);
});

test("evicting the last task stops the wake timer", () => {
  const { ctx, advance } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, {
    autoStart: false,
    lookahead: 0.05,
    wakeMs: 60_000,
    maxConsecutiveFailures: 1,
  });
  scheduler.add(0.1, 0.1, () => {
    throw new Error("boom");
  });
  scheduler.start();
  assert.strictEqual(scheduler.running, true);

  advance(0.1);
  scheduler.tick();
  assert.strictEqual(scheduler.activeTasks, 0);
  assert.strictEqual(scheduler.running, false);
});

test("remove() stops the scheduler when the last task goes", () => {
  const { ctx } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, { autoStart: false, wakeMs: 1000 });
  const first = scheduler.add(0.2, 0.4, () => {});
  const second = scheduler.add(0.2, 0.4, () => {});
  scheduler.remove(first);
  assert.strictEqual(scheduler.activeTasks, 1);
  scheduler.remove(second);
  assert.strictEqual(scheduler.activeTasks, 0);
  assert.strictEqual(scheduler.running, false);
});

test("default mode starts a timer and clearTasks stops it", () => {
  const { ctx } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, { wakeMs: 60_000 });
  try {
    scheduler.add(0.2, 0.2, () => {});
    assert.strictEqual(scheduler.running, true);
    scheduler.clearTasks();
    assert.strictEqual(scheduler.running, false);
    assert.strictEqual(scheduler.activeTasks, 0);
  } finally {
    scheduler.stop();
  }
});

test("tick() on an empty scheduler stops it", () => {
  const { ctx } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, { autoStart: false });
  scheduler.tick();
  assert.strictEqual(scheduler.running, false);
});

// ── Missed events after a suspended / throttled tab ──────────────────
// Ambience is not replayed: a task that is minutes behind drops what it
// missed and continues from the present.

test("a long suspension does not replay a burst of missed events", () => {
  const { ctx, advance } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, {
    autoStart: false,
    lookahead: 0.12,
  });
  const ran: number[] = [];
  scheduler.add(0.4, 0.4, (time) => ran.push(time));

  advance(300); // five minutes in a background tab
  scheduler.tick();

  assert.deepStrictEqual(ran, [], "missed events are dropped, not replayed");
  assert.ok(scheduler.droppedEventCount > 0, "the drop is accounted for");
});

test("catch-up work stays bounded for a very long pause", () => {
  const { ctx, advance } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, {
    autoStart: false,
    lookahead: 0.12,
  });
  const ran: number[] = [];
  // A 20 ms interval would mean 30 000 missed events for a ten-minute pause.
  scheduler.add(0.02, 0.02, (time) => ran.push(time));

  advance(600);
  scheduler.tick();

  assert.ok(ran.length <= 8, `at most one lookahead window, saw ${ran.length}`);
  for (const time of ran) assert.ok(time >= 600 - 1e-9);
  assert.ok(
    scheduler.droppedEventCount <= 32,
    `bounded skip loop, saw ${scheduler.droppedEventCount} skips`,
  );
});

test("after catch-up the next event lands at or after the current time", () => {
  const { ctx, advance } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, {
    autoStart: false,
    lookahead: 0.12,
  });
  const ran: number[] = [];
  scheduler.add(0.5, 0.5, (time) => ran.push(time));

  advance(120);
  scheduler.tick();
  assert.strictEqual(ran.length, 0);

  advance(0.5);
  const now = 120.5;
  scheduler.tick();
  assert.strictEqual(ran.length, 1);
  assert.ok(
    ran[0]! >= now - 1e-9,
    `event time ${ran[0]} must not precede ${now}`,
  );
});

test("a healthy task keeps running after another task rebases", () => {
  const { ctx, advance } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, {
    autoStart: false,
    lookahead: 0.12,
  });
  const stale: number[] = [];
  const healthy: number[] = [];
  // Intervals longer than the lookahead window so a rebased deadline is not
  // immediately due in the same tick.
  scheduler.add(0.5, 0.5, (time) => stale.push(time));
  scheduler.add(0.2, 0.2, (time) => healthy.push(time));

  advance(90);
  scheduler.tick();
  assert.deepStrictEqual(stale, []);

  advance(0.2);
  scheduler.tick();
  assert.strictEqual(healthy.length, 1);
  assert.strictEqual(scheduler.activeTasks, 2);
});

test("every executed event time is at or after the current audio time", () => {
  const { ctx, advance } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, {
    autoStart: false,
    lookahead: 0.2,
  });
  const samples: { ran: number; now: number }[] = [];
  scheduler.add(0.07, 0.07, (time) => {
    samples.push({ ran: time, now: ctx.currentTime });
  });

  for (let i = 0; i < 40; i++) {
    // Irregular spacing models throttled wake-ups better than a fixed step.
    advance(i % 7 === 0 ? 3.5 : 0.09);
    scheduler.tick();
  }

  assert.ok(samples.length > 0);
  for (const sample of samples) {
    assert.ok(
      sample.ran >= sample.now - 1e-9,
      `ran at ${sample.ran} while the clock was ${sample.now}`,
    );
  }
  assert.strictEqual(scheduler.activeTasks, 1);
});
