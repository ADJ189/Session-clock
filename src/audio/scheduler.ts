// One shared event scheduler per AudioContext.
//
// Discrete sounds (birds, crackles, droplets, ticks, bells) are scheduled
// against the audio clock, never against setTimeout. Timers only wake the
// scheduler; each event is placed at an absolute `AudioContext.currentTime`.
// This avoids the one-recursive-setTimeout-per-sound pattern and gives every
// voice a single cancellation point.

export interface ScheduledTask {
  id: number;
  /** Absolute AudioContext time for the next event. */
  nextAt: number;
  run: (time: number) => void;
  nextInterval: () => number;
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
}

export class EventScheduler {
  readonly ctx: BaseAudioContext;
  private lookahead: number;
  private wakeMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tasks = new Map<number, ScheduledTask>();
  private nextId = 1;
  private errors = 0;
  private onError?: (error: unknown) => void;
  private autoStart: boolean;

  constructor(ctx: BaseAudioContext, options: SchedulerOptions = {}) {
    this.ctx = ctx;
    this.lookahead = options.lookahead ?? 0.12;
    this.wakeMs = options.wakeMs ?? 40;
    this.onError = options.onError;
    this.autoStart = options.autoStart ?? true;
  }

  get activeTasks(): number {
    return this.tasks.size;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  get errorCount(): number {
    return this.errors;
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
    const task: ScheduledTask = {
      id,
      nextAt: this.ctx.currentTime + lo + Math.random() * (hi - lo),
      run,
      nextInterval: () => lo + Math.random() * (hi - lo),
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
    const horizon = this.ctx.currentTime + this.lookahead;
    for (const [id, task] of Array.from(this.tasks.entries())) {
      let guard = 0;
      while (task.nextAt <= horizon && guard++ < 8) {
        try {
          task.run(task.nextAt);
        } catch (error) {
          this.errors++;
          try {
            this.onError?.(error);
          } catch {
            // Error reporting must not stop the scheduler.
          }
          // A repeatedly failing task is removed rather than retried forever.
          if (this.errors > 8) {
            this.tasks.delete(id);
            break;
          }
        }
        task.nextAt += task.nextInterval();
      }
    }
    if (this.tasks.size === 0) this.stop();
  }
}
