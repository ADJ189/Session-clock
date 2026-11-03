import { test } from "node:test";
import { assertEquals } from "./assert.ts";
import { createSchedulerClock } from "./mock-audio.ts";
import { EventScheduler } from "../src/audio/scheduler.ts";

test("manual mode does not start a wall-clock timer", () => {
  const { ctx } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, { autoStart: false, wakeMs: 1000 });
  scheduler.add(0.1, 0.1, () => {});
  assertEquals(scheduler.activeTasks, 1);
  assertEquals(scheduler.running, false);
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
  assertEquals(ran.length, 0, "nothing is due before its first deadline");
  advance(0.1);
  scheduler.tick();
  assertEquals(ran.length, 1);
  assertEquals(ran[0], 0.1);
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
  assertEquals(runs, 8);
  scheduler.clearTasks();
});

test("task errors are counted, reported, and eventually evicted", () => {
  const { ctx, advance } = createSchedulerClock();
  let reported = 0;
  const scheduler = new EventScheduler(ctx, {
    autoStart: false,
    lookahead: 0.05,
    onError: () => reported++,
  });
  scheduler.add(0.1, 0.1, () => {
    throw new Error("boom");
  });
  for (let i = 0; i < 9; i++) {
    advance(0.1);
    scheduler.tick();
  }
  assertEquals(reported, 9);
  assertEquals(scheduler.errorCount, 9);
  assertEquals(scheduler.activeTasks, 0, "failing task is removed");
});

test("remove() stops the scheduler when the last task goes", () => {
  const { ctx } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, { autoStart: false, wakeMs: 1000 });
  const first = scheduler.add(0.2, 0.4, () => {});
  const second = scheduler.add(0.2, 0.4, () => {});
  scheduler.remove(first);
  assertEquals(scheduler.activeTasks, 1);
  scheduler.remove(second);
  assertEquals(scheduler.activeTasks, 0);
  assertEquals(scheduler.running, false);
});

test("default mode starts a timer and clearTasks stops it", () => {
  const { ctx } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, { wakeMs: 60_000 });
  try {
    scheduler.add(0.2, 0.2, () => {});
    assertEquals(scheduler.running, true);
    scheduler.clearTasks();
    assertEquals(scheduler.running, false);
    assertEquals(scheduler.activeTasks, 0);
  } finally {
    scheduler.stop();
  }
});

test("tick() on an empty scheduler stops it", () => {
  const { ctx } = createSchedulerClock();
  const scheduler = new EventScheduler(ctx, { autoStart: false });
  scheduler.tick();
  assertEquals(scheduler.running, false);
});
