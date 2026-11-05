// Event scheduler for discrete ambience (birds, crackles, droplets, ticks,
// bells).
//
// Discrete sounds are scheduled against the audio clock, never against
// setTimeout. Timers only wake the scheduler; each event is placed at an
// absolute `AudioContext.currentTime`. This avoids the
// one-recursive-setTimeout-per-sound pattern and gives every voice a single
// cancellation point.
//
// One scheduler is owned by each sound rig, so a rig's teardown never cancels
// another rig's events. Several simultaneous ambient tracks therefore mean
// several wake timers; each is a 40 ms interval that is `unref`'d under Node,
// and its tick work is bounded (see `tick()`), so the cost is negligible.
//
// Two policies in `tick()` are deliberate and tested:
//  • Failures are counted per task. A task that throws repeatedly is evicted
//    on its own streak; one voice's errors never penalise another voice.
//  • Events missed while the page was suspended or throttled are dropped, not
//    replayed. Ambience is not worth catching up on, and a backgrounded tab
//    must not wake up to a burst of old birdsong.

export interface ScheduledTask {
  id: number;
  /** Absolute AudioContext time for the next event. */
  nextAt: number;
  run: (time: number) => void;
  nextInterval: () => number;
  /** Consecutive failures since the last successful run. */
  failures: number;
}

export interface SchedulerOptions {
  lookahead?: number;
  wakeMs?: number;
  onError?: (error: unknown) => void;
  /**
   * When false, `add()` registers the task but never starts the wall-clock
   * timer. Tests and the engine's `manualScheduler` hook drive `tick()`
   * themselves so a unit test process is never kept alive by ambience.
   */
  autoStart?: boolean;
  /**
   * Consecutive failures after which a task is removed. Defaults to 8, which
   * matches the previous behaviour (the tenth error used to evict) while
   * counting failures per task instead of globally.
   */
  maxConsecutiveFailures?: number;
}

/** Due events handled per task per tick. Keeps one task from starving others. */
const MAX_EVENTS_PER_TICK = 8;

/**
 * Missed events skipped before a task's deadline is rebased against the
 * current audio time. Bounds catch-up work after a long suspension: a task
 * that is minutes behind does not walk thousands of intervals.
 */
const MAX_MISSED_EVENTS = 32;

export class EventScheduler {
  readonly ctx: BaseAudioContext;
  private lookahead: number;
  private wakeMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tasks = new Map<number, ScheduledTask>();
  private nextId = 1;
  private errors = 0;
  private droppedEvents = 0;
  private maxConsecutiveFailures: number;
  private onError?: (error: unknown) => void;
  private autoStart: boolean;

  constructor(ctx: BaseAudioContext, options: SchedulerOptions = {}) {
    this.ctx = ctx;
    this.lookahead = options.lookahead ?? 0.12;
    this.wakeMs = options.wakeMs ?? 40;
    this.onError = options.onError;
    this.autoStart = options.autoStart ?? true;
    const max = options.maxConsecutiveFailures;
    this.maxConsecutiveFailures = Number.isFinite(max) && max! > 0
      ? Math.floor(max!)
      : 8;
  }

  get activeTasks(): number {
    return this.tasks.size;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  /** Aggregate failures across every task, for diagnostics only. */
  get errorCount(): number {
    return this.errors;
  }

  /**
   * Events dropped because they were already in the past when their turn
   * came (tab suspension, background throttling). Approximate after a rebase.
   */
  get droppedEventCount(): number {
    return this.droppedEvents;
  }

  /** Adds a recurring task and starts the wake loop if needed. */
  add(
    minSeconds: number,
    maxSeconds: number,
    run: (time: number) => void,
  ): number {
    const lo = Math.max(0.02, Math.min(minSeconds, maxSeconds));
    const hi = Math.max(lo, maxSeconds);
    const id = this.nextId++;
    // Timing is intentionally unseeded: a seed reproduces generator parameters
    // (see prng.ts), not when an ambience event happens. Production wants a
    // natural, non-repeating schedule; tests drive the clock manually.
    const task: ScheduledTask = {
      id,
      nextAt: this.ctx.currentTime + lo + Math.random() * (hi - lo),
      run,
      nextInterval: () => lo + Math.random() * (hi - lo),
      failures: 0,
    };
    this.tasks.set(id, task);
    if (this.autoStart) this.start();
    return id;
  }

  remove(id: number): void {
    this.tasks.delete(id);
    if (this.tasks.size === 0) this.stop();
  }

  clearTasks(): void {
    this.tasks.clear();
    this.stop();
  }

  start(): void {
    if (this.timer !== null) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), this.wakeMs);
    // Never keep a Node process alive only for ambience scheduling.
    const maybe = this.timer as unknown as { unref?: () => void };
    maybe?.unref?.();
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Schedules every task due inside the lookahead window. Public so tests can
   * advance a fake AudioContext clock without waiting on wall time.
   */
  tick(): void {
    if (this.tasks.size === 0) {
      this.stop();
      return;
    }
    const now = this.ctx.currentTime;
    const horizon = now + this.lookahead;
    for (const [id, task] of Array.from(this.tasks.entries())) {
      this.dropMissedEvents(task, now);
      let guard = 0;
      while (task.nextAt <= horizon && guard++ < MAX_EVENTS_PER_TICK) {
        // `run()` (or a stopped context) can move the clock during a tick. A
        // past timestamp is never handed to a generator as if it were fresh.
        if (task.nextAt < now) {
          this.droppedEvents++;
          task.nextAt = now + task.nextInterval();
          continue;
        }
        try {
          task.run(task.nextAt);
          // Reset on success: intermittent failures must not accumulate into
          // an eviction the way consecutive ones should.
          task.failures = 0;
        } catch (error) {
          task.failures++;
          this.errors++;
          try {
            this.onError?.(error);
          } catch {
            // Error reporting must not stop the scheduler.
          }
          if (task.failures >= this.maxConsecutiveFailures) {
            // Only the task on its own streak is removed; the aggregate
            // error count never decides which task to evict.
            this.tasks.delete(id);
            break;
          }
        }
        task.nextAt += task.nextInterval();
      }
    }
    if (this.tasks.size === 0) this.stop();
  }

  /**
   * Drops events whose deadline has already passed and, after
   * `MAX_MISSED_EVENTS` skips, rebases the deadline against the current audio
   * time so a long suspension costs bounded work.
   */
  private dropMissedEvents(task: ScheduledTask, now: number): void {
    let skipped = 0;
    while (task.nextAt < now) {
      if (skipped >= MAX_MISSED_EVENTS) {
        task.nextAt = now + task.nextInterval();
        break;
      }
      skipped++;
      task.nextAt += task.nextInterval();
    }
    this.droppedEvents += skipped;
  }
}
