// ── Renderer health ────────────────────────────────────────────────────
// The clock and timer must survive any visual failure. This tiny state
// machine is deliberately DOM-free so it can be unit-tested under Deno and
// used from both renderer.ts and main.ts without creating an import cycle.
//
// States:
//   active    — both canvas paths are usable
//   degraded  — background still works, transitions were disabled
//   disabled  — background canvas is unavailable; CSS/static presentation
//
// A background failure is permanent for the page session. A transition
// failure is contained: the next theme change simply swaps instantly.
// Failures are recorded once per path so a per-frame exception cannot flood
// the diagnostics buffer.

export type RendererStatus = "active" | "degraded" | "disabled";
export type RendererPath = "background" | "transitions";
export type RendererFailureReason =
  | "context-missing"
  | "context-lost"
  | "draw-error"
  | "transition-error";

export interface RendererFailure {
  at: number;
  path: RendererPath;
  reason: RendererFailureReason;
  message: string;
}

export type RendererFailureHandler = (failure: RendererFailure) => void;

export class RendererHealthTracker {
  private background = true;
  private transitions = true;
  private failures: RendererFailure[] = [];
  private recorded = new Set<string>();
  private now: () => number;
  private onFailure?: RendererFailureHandler;

  constructor(
    onFailure?: RendererFailureHandler,
    now: () => number = Date.now,
  ) {
    this.onFailure = onFailure;
    this.now = now;
  }

  setFailureHandler(handler?: RendererFailureHandler): void {
    this.onFailure = handler;
  }

  get status(): RendererStatus {
    if (!this.background) return "disabled";
    if (!this.transitions) return "degraded";
    return "active";
  }

  get canDrawBackground(): boolean {
    return this.background;
  }

  get canRunTransitions(): boolean {
    return this.transitions;
  }

  get failureCount(): number {
    return this.failures.length;
  }

  getFailureLog(): readonly RendererFailure[] {
    return this.failures;
  }

  /** Background context is null at boot, or lost later. */
  disableBackground(reason: RendererFailureReason, detail = ""): boolean {
    this.background = false;
    return this.record("background", reason, detail || "Background canvas unavailable");
  }

  /** Transition context is null, lost, or threw. */
  disableTransitions(reason: RendererFailureReason, detail = ""): boolean {
    this.transitions = false;
    return this.record("transitions", reason, detail || "Transition canvas unavailable");
  }

  /**
   * A background draw threw. The failing path is disabled permanently so the
   * renderer is not re-entered every animation frame.
   */
  failBackground(error: unknown): boolean {
    this.background = false;
    return this.record("background", "draw-error", errorMessage(error));
  }

  /** A transition step threw. Swap instantly from now on; keep the clock. */
  failTransitions(error: unknown): boolean {
    this.transitions = false;
    return this.record("transitions", "transition-error", errorMessage(error));
  }

  /**
   * A canvas context was restored. Re-enable the path so drawing resumes;
   * the failure log remains as history, and a later loss is still contained.
   */
  restoreBackground(): void {
    this.background = true;
  }

  restoreTransitions(): void {
    this.transitions = true;
  }

  /**
   * Returns true only the first time a given (path, reason) failure is seen.
   * Callers use this to emit exactly one diagnostic event.
   */
  private record(
    path: RendererPath,
    reason: RendererFailureReason,
    message: string,
  ): boolean {
    const key = `${path}:${reason}`;
    if (this.recorded.has(key)) return false;
    this.recorded.add(key);
    const failure: RendererFailure = {
      at: this.now(),
      path,
      reason,
      message: message.slice(0, 400),
    };
    this.failures.push(failure);
    try {
      this.onFailure?.(failure);
    } catch {
      // A diagnostics callback must never take down the renderer boundary.
    }
    return true;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

/**
 * Process-wide singleton used by the app. Tests instantiate their own tracker
 * to keep state isolated.
 */
export const rendererHealth = new RendererHealthTracker();
