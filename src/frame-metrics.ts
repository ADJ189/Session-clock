// ── Frame Metrics & Runtime Monitoring ────────────────────────────────
// Measures frame times, percentiles (P50/P95/P99), dropped frames, and
// main-thread long tasks. Used by adaptive quality in perf.ts and reported in
// runtime diagnostics.

export interface FrameMetricsSnapshot {
  sampleCount: number;
  fps: number;
  p50: number; // ms
  p95: number; // ms
  p99: number; // ms
  droppedFrameRatio: number; // 0..1
  droppedFrameCount: number;
  longTaskCount: number;
  totalLongTaskDurationMs: number;
  lastDrawDurationMs: number | null;
}

export interface FrameMetricsOptions {
  bufferCapacity?: number;
  targetFrameMs?: number;
}

const DEFAULT_BUFFER_CAPACITY = 120;
const DEFAULT_TARGET_FRAME_MS = 1000 / 60; // 16.667ms
const STALE_GAP_THRESHOLD_MS = 3000;

export class FrameMetricsTracker {
  private buffer: number[] = [];
  private capacity: number;
  private targetFrameMs: number;
  private lastFrameTs = 0;
  private totalFrames = 0;
  private droppedFrames = 0;
  private longTaskCount = 0;
  private totalLongTaskDurationMs = 0;
  private lastDrawDuration: number | null = null;
  private observer: PerformanceObserver | null = null;

  constructor(options: FrameMetricsOptions = {}) {
    this.capacity = options.bufferCapacity ?? DEFAULT_BUFFER_CAPACITY;
    this.targetFrameMs = options.targetFrameMs ?? DEFAULT_TARGET_FRAME_MS;
    this.initLongTaskObserver();
  }

  private initLongTaskObserver(): void {
    if (typeof PerformanceObserver === "undefined") return;
    try {
      const types = (
        PerformanceObserver as unknown as { supportedEntryTypes?: string[] }
      ).supportedEntryTypes;
      if (Array.isArray(types) && !types.includes("longtask")) return;

      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordLongTask(entry.duration);
        }
      });
      this.observer.observe({ entryTypes: ["longtask"] });
    } catch {
      // Browsers without longtask support or in restrictive environments
      this.observer = null;
    }
  }

  public recordLongTask(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;
    this.longTaskCount++;
    this.totalLongTaskDurationMs += durationMs;
  }

  /**
   * Records a frame timestamp. `now` is expected to be a high-resolution
   * timestamp (performance.now()).
   */
  public recordFrame(now: number, drawDurationMs?: number): void {
    if (!Number.isFinite(now)) return;

    if (drawDurationMs !== undefined && Number.isFinite(drawDurationMs)) {
      this.lastDrawDuration = Math.max(0, drawDurationMs);
    }

    if (this.lastFrameTs === 0) {
      this.lastFrameTs = now;
      return;
    }

    const delta = now - this.lastFrameTs;
    this.lastFrameTs = now;

    // Discard negative or stale intervals (e.g. background tab resuming)
    if (delta <= 0 || delta > STALE_GAP_THRESHOLD_MS) {
      return;
    }

    this.buffer.push(delta);
    if (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }

    this.totalFrames++;

    // A frame is considered dropped if it exceeded 1.5x the target interval.
    // Count missed refresh cycles beyond the first.
    if (delta > this.targetFrameMs * 1.5) {
      const missed = Math.max(1, Math.round(delta / this.targetFrameMs) - 1);
      this.droppedFrames += missed;
    }
  }

  public setTargetFrameMs(targetMs: number): void {
    if (Number.isFinite(targetMs) && targetMs > 0) {
      this.targetFrameMs = targetMs;
    }
  }

  public getTargetFrameMs(): number {
    return this.targetFrameMs;
  }

  /** Calculates a given percentile (0..1) from the rolling buffer. */
  public getPercentile(p: number): number {
    if (this.buffer.length === 0) return 0;
    const sorted = [...this.buffer].sort((a, b) => a - b);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.floor(p * (sorted.length - 1))),
    );
    return Math.round((sorted[index] ?? 0) * 100) / 100;
  }

  public getP50(): number {
    return this.getPercentile(0.5);
  }

  public getP95(): number {
    return this.getPercentile(0.95);
  }

  public getP99(): number {
    return this.getPercentile(0.99);
  }

  public getDroppedFrameRatio(): number {
    const total = this.totalFrames + this.droppedFrames;
    if (total === 0) return 0;
    return Math.round((this.droppedFrames / total) * 1000) / 1000;
  }

  public getFps(): number {
    if (this.buffer.length < 2) return 60;
    const sum = this.buffer.reduce((acc, v) => acc + v, 0);
    if (sum <= 0) return 60;
    const avgDeltaMs = sum / this.buffer.length;
    return Math.round(1000 / avgDeltaMs);
  }

  public getSnapshot(): FrameMetricsSnapshot {
    return {
      sampleCount: this.buffer.length,
      fps: this.getFps(),
      p50: this.getP50(),
      p95: this.getP95(),
      p99: this.getP99(),
      droppedFrameRatio: this.getDroppedFrameRatio(),
      droppedFrameCount: this.droppedFrames,
      longTaskCount: this.longTaskCount,
      totalLongTaskDurationMs: Math.round(this.totalLongTaskDurationMs * 100) / 100,
      lastDrawDurationMs: this.lastDrawDuration,
    };
  }

  public reset(now?: number): void {
    this.buffer = [];
    this.lastFrameTs = now !== undefined && Number.isFinite(now) ? now : 0;
    this.totalFrames = 0;
    this.droppedFrames = 0;
    this.longTaskCount = 0;
    this.totalLongTaskDurationMs = 0;
    this.lastDrawDuration = null;
  }

  public dispose(): void {
    if (this.observer) {
      try {
        this.observer.disconnect();
      } catch {
        // Ignored
      }
      this.observer = null;
    }
  }
}

export const frameMetrics = new FrameMetricsTracker();
