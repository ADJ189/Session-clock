// Clock presentation & positioning controller for Session Clock
import { safeGet } from "../../storage";

export type ClockMode =
  | "digital"
  | "analogue"
  | "flip"
  | "word"
  | "minimal"
  | "segment";

export type ClockPosMap = Partial<Record<ClockMode, "top" | "center">>;

export class ClockController {
  private clockMode: ClockMode = "digital";
  private clockPosMap: ClockPosMap = {};
  private centerMinimal = true;

  constructor() {
    this.clockMode =
      (localStorage.getItem("sc_clock_mode") as ClockMode) || "digital";
    this.clockPosMap = this.loadClockPosMap();
    this.centerMinimal = safeGet("sc_center_minimal") !== "0";
  }

  init(): void {
    this.updateClockModeDOM();
    this.applyClockPosition(this.getClockPosition(this.clockMode), this.clockMode);
    this.applyCenterMinimal(this.centerMinimal);
  }

  getMode(): ClockMode {
    return this.clockMode;
  }

  setClockMode(m: ClockMode): void {
    this.clockMode = m;
    localStorage.setItem("sc_clock_mode", m);
    this.updateClockModeDOM();
    this.applyClockPosition(this.getClockPosition(m), m);
  }

  getClockPosition(mode: ClockMode = this.clockMode): "top" | "center" {
    return this.clockPosMap[mode] ?? "top";
  }

  applyClockPosition(
    pos: "top" | "center",
    mode: ClockMode = this.clockMode,
  ): void {
    this.clockPosMap[mode] = pos;
    localStorage.setItem("sc_clock_pos_map", JSON.stringify(this.clockPosMap));
    if (mode !== this.clockMode) return;

    document.body.classList.toggle("clock-top", pos === "top");
    document.body.classList.toggle("clock-center", pos === "center");

    document.querySelectorAll(".clock-pos-pill").forEach((el) => {
      (el as HTMLElement).classList.toggle("center-active", pos === "center");
      (el as HTMLElement).textContent = pos === "center" ? "⊞ Centred" : "⊟ Top";
    });
  }

  toggleClockPosition(): void {
    const current = this.getClockPosition(this.clockMode);
    const next = current === "center" ? "top" : "center";
    this.applyClockPosition(next, this.clockMode);
  }

  isCenterMinimal(): boolean {
    return this.centerMinimal;
  }

  applyCenterMinimal(on: boolean): void {
    this.centerMinimal = on;
    localStorage.setItem("sc_center_minimal", on ? "1" : "0");
    document.body.classList.toggle("center-minimal", on);
  }

  updateClockModeDOM(): void {
    const cb = document.getElementById("clock-block-wrap");
    if (cb) cb.dataset.mode = this.clockMode;
    document.querySelectorAll(".clock-mode-btn").forEach((b) => {
      (b as HTMLElement).classList.toggle(
        "active",
        (b as HTMLElement).dataset.mode === this.clockMode,
      );
    });
  }

  private loadClockPosMap(): ClockPosMap {
    try {
      const raw = localStorage.getItem("sc_clock_pos_map");
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    const legacy = localStorage.getItem("sc_clock_pos") as
      | "top"
      | "center"
      | null;
    if (legacy === "top" || legacy === "center") {
      return {
        digital: legacy,
        analogue: legacy,
        flip: legacy,
        word: legacy,
        minimal: legacy,
        segment: legacy,
      };
    }
    return {};
  }
}

export const clockController = new ClockController();
