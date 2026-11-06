// Session & Pomodoro presentation and timer controller
import * as Pom from "../../pomodoro";
import * as Log from "../../focuslog";
import * as Intel from "../../intelligence";
import * as APIs from "../../apis";
import * as Features from "../../features";
import * as Privacy from "../../privacy";
import { fmtSession } from "../../utils";
import { setBeforeAnalyticsReload } from "../../analytics";

export interface SessionDomRefs {
  btnStart: HTMLButtonElement | null;
  btnReset: HTMLElement | null;
  focusInput: HTMLInputElement | null;
  focusInputWrap: HTMLElement | null;
  sessionTimer: HTMLElement | null;
}

export type BroadcastFn = (type: string, payload?: Record<string, unknown>) => void;
export type ToastFn = (msg: string, dur?: number) => void;
export type ConfettiFn = (count: number) => void;
export type MotivationWidgetFn = (title: string, desc: string) => void;

export class SessionController {
  private sessionRunning = false;
  private sessionStart = 0;
  private sessionElapsed = 0;
  private broadcast: BroadcastFn = () => {};
  private toast: ToastFn = () => {};
  private confetti: ConfettiFn = () => {};
  private motivation: MotivationWidgetFn = () => {};
  private resetMilestonesCallback: () => void = () => {};

  init(options: {
    broadcast: BroadcastFn;
    toast: ToastFn;
    confetti: ConfettiFn;
    motivation: MotivationWidgetFn;
    resetMilestones: () => void;
  }): void {
    this.broadcast = options.broadcast;
    this.toast = options.toast;
    this.confetti = options.confetti;
    this.motivation = options.motivation;
    this.resetMilestonesCallback = options.resetMilestones;

    setBeforeAnalyticsReload(() => this.saveSessionState());
    window.addEventListener("beforeunload", () => this.saveSessionState());
  }

  private getDom(): SessionDomRefs {
    return {
      btnStart: document.getElementById("btnStart") as HTMLButtonElement | null,
      btnReset: document.getElementById("btnReset"),
      focusInput: document.getElementById("focusInput") as HTMLInputElement | null,
      focusInputWrap: document.getElementById("focusInputWrap"),
      sessionTimer: document.getElementById("sessionTimer"),
    };
  }

  isRunning(): boolean {
    return this.sessionRunning;
  }

  getStart(): number {
    return this.sessionStart;
  }

  getElapsed(): number {
    return this.sessionRunning
      ? performance.now() - this.sessionStart
      : this.sessionElapsed;
  }

  setElapsed(elapsed: number): void {
    this.sessionElapsed = elapsed;
  }

  startTimer(): void {
    const dom = this.getDom();
    this.sessionRunning = true;
    this.sessionStart = performance.now() - this.sessionElapsed;
    document.body.classList.add("session-running");
    window.__uiSounds?.sessionStart?.();

    if (dom.btnStart) {
      Features.updateButtonLabels(
        "running",
        Pom.getPhase(),
        Pom.isActive(),
        dom.btnStart,
      );
    }
    Features.setStatusState("running", { pomEnabled: Pom.isActive() });
    Features.updateDistractionUI(true);
    dom.focusInputWrap?.classList.add("visible");

    if (Pom.isActive()) Pom.onStart();
    Intel.onSessionStart();
    Intel.onFlowInterrupt();
    this.broadcast("session", { running: true });
    void APIs.requestNotifications();
    void APIs.acquireWakeLock();
  }

  pauseTimer(): void {
    const dom = this.getDom();
    this.sessionRunning = false;
    this.sessionElapsed = performance.now() - this.sessionStart;

    if (Pom.isActive()) Pom.onPause();
    Intel.onSessionPause();

    document.body.classList.remove("session-running");
    if (dom.btnStart) {
      Features.updateButtonLabels(
        "paused",
        Pom.getPhase(),
        Pom.isActive(),
        dom.btnStart,
      );
    }
    Features.setStatusState("paused");
    Features.updateDistractionUI(false);
    Intel.onFlowInterrupt();
    this.broadcast("session", { running: false });
  }

  resetTimer(): void {
    const dom = this.getDom();
    const dur = this.sessionRunning
      ? performance.now() - this.sessionStart
      : this.sessionElapsed;
    const taskText = dom.focusInput?.value.trim() ?? "";
    const recorded = Log.record(taskText, dur);
    Features.updateDistractionUI(false);

    if (dur > 60_000) {
      window.__uiSounds?.sessionEnd?.();
      Intel.recordCompleted();
      const streak = Intel.updateStreak();
      const milestone = Intel.getStreakMilestone(streak.current);
      if (milestone) this.toast(milestone);
      Intel.onBreakTaken();

      this.confetti(32);
      this.motivation(
        "✓ Session Complete!",
        "Nice focus — logged to your history.",
      );

      const sessionMins = Math.floor(dur / 60000);
      const distractionCount = Number.parseInt(
        localStorage.getItem("sc_distraction_today") ?? "0",
      );
      const smartBreak = Features.calcSmartBreak(
        sessionMins,
        distractionCount,
        Intel.getVelocityScore(),
        Pom.isActive(),
      );
      setTimeout(() => this.toast(`☕ ${smartBreak.activity}`, 7000), 1200);

      const todaySessions = Log.focusLogCount();
      Features.setStatusState("complete", { todaySessions });
      Features.showCompletionRating(
        dur / 1000,
        taskText,
        (rating) => {
          if (rating > 0 && recorded) {
            const log = Log.readFocusLog();
            const mine = Log.findEntry(log, recorded) as
              | (typeof recorded & { rating?: number })
              | undefined;
            if (mine) {
              mine.rating = rating;
              Log.writeFocusLog(log);
            }
          }
        },
      );
    } else if (dur > Intel.MIN_ABANDON_MS) {
      Intel.recordAbandoned(dur);
    }

    Intel.onFlowInterrupt();
    document.body.classList.remove("session-running");
    this.resetMilestonesCallback();
    this.sessionRunning = false;
    this.sessionStart = this.sessionElapsed = 0;

    if (dom.btnStart) {
      Features.updateButtonLabels(
        "idle",
        "work",
        Pom.isActive(),
        dom.btnStart,
      );
    }
    const todaySessions = Log.focusLogCount();
    Features.setStatusState("idle", { todaySessions });
    if (dom.sessionTimer) dom.sessionTimer.textContent = "00:00:00";
    dom.focusInputWrap?.classList.remove("visible");
    if (dom.focusInput) dom.focusInput.value = "";

    if (Pom.isActive()) Pom.reset();
    this.broadcast("session", { running: false });
  }

  logDistraction(): void {
    Features.logDistraction();
    Features.updateDistractionUI(true);
    this.toast("Distraction logged. Refocus.");
  }

  saveSessionState(): void {
    try {
      const dur = this.sessionRunning
        ? performance.now() - this.sessionStart
        : this.sessionElapsed;
      const dom = this.getDom();
      const task = dom.focusInput ? dom.focusInput.value : "";
      const pomState = Pom.isActive() ? Pom.getSessionSnapshot() : null;
      const incognito = Privacy.isIncognito();

      if (this.sessionRunning || dur > 0 || task.length > 0 || Pom.isActive()) {
        const state = {
          running: this.sessionRunning,
          elapsed: dur,
          task,
          pomodoro: pomState,
          incognito,
        };
        sessionStorage.setItem("sc_saved_session", JSON.stringify(state));
      }
    } catch {
      // ignore
    }
  }

  restoreSavedSession(): void {
    try {
      const raw = sessionStorage.getItem("sc_saved_session");
      if (!raw) return;
      sessionStorage.removeItem("sc_saved_session");
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return;

      const dom = this.getDom();
      if (typeof data.task === "string" && data.task && dom.focusInput) {
        dom.focusInput.value = data.task;
        dom.focusInputWrap?.classList.add("visible");
      }

      if (data.pomodoro) {
        Pom.restoreSessionSnapshot(data.pomodoro);
      }
      if (data.incognito) {
        Privacy.setIncognito(true);
      }

      const elapsed = typeof data.elapsed === "number" ? data.elapsed : 0;
      if (data.running) {
        this.sessionElapsed = elapsed;
        this.startTimer();
      } else if (elapsed > 0) {
        this.sessionElapsed = elapsed;
        if (!Pom.isActive() && dom.sessionTimer) {
          dom.sessionTimer.textContent = fmtSession(elapsed);
        }
        dom.focusInputWrap?.classList.add("visible");
        if (dom.btnStart) {
          Features.updateButtonLabels(
            "paused",
            Pom.getPhase(),
            Pom.isActive(),
            dom.btnStart,
          );
        }
        Features.setStatusState("paused");
      }
    } catch {
      // corrupt saved state
    }
  }
}

export const sessionController = new SessionController();
