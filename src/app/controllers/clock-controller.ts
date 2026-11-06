// Clock presentation & positioning controller for Session Clock
import { safeGet, safeSet, safeJsonGet, safeJsonSet } from "../../storage";

export type ClockMode =
  | "digital"
  | "analogue"
  | "flip"
  | "word"
  | "minimal"
  | "segment";

export type ClockPos = "top" | "center";

export type ClockPosMap = Partial<Record<ClockMode, ClockPos>>;

const VALID_CLOCK_MODES = new Set<ClockMode>([
  "digital",
  "analogue",
  "flip",
  "word",
  "minimal",
  "segment",
]);

function isValidClockMode(mode: unknown): mode is ClockMode {
  return typeof mode === "string" && VALID_CLOCK_MODES.has(mode as ClockMode);
}

function isValidClockPos(pos: unknown): pos is ClockPos {
  return pos === "top" || pos === "center";
}

export class ClockController {
  private clockMode: ClockMode = "digital";
  private clockPosMap: ClockPosMap = {};
  private centerMinimal = true;

  constructor() {
    const rawMode = safeGet("sc_clock_mode");
    this.clockMode = isValidClockMode(rawMode) ? rawMode : "digital";
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
    const validMode: ClockMode = isValidClockMode(m) ? m : "digital";
    this.clockMode = validMode;
    safeSet("sc_clock_mode", validMode);
    this.updateClockModeDOM();
    this.applyClockPosition(this.getClockPosition(validMode), validMode);
  }

  getClockPosition(mode: ClockMode = this.clockMode): ClockPos {
    const validMode: ClockMode = isValidClockMode(mode) ? mode : "digital";
    return this.clockPosMap[validMode] ?? "top";
  }

  applyClockPosition(
    pos: "top" | "center",
    mode: ClockMode = this.clockMode,
  ): void {
    const validPos: ClockPos = isValidClockPos(pos) ? pos : "top";
    const validMode: ClockMode = isValidClockMode(mode) ? mode : "digital";

    if (
      validMode === ("__proto__" as unknown) ||
      validMode === ("constructor" as unknown) ||
      validMode === ("prototype" as unknown)
    ) {
      return;
    }

    this.clockPosMap[validMode] = validPos;
    safeJsonSet("sc_clock_pos_map", this.clockPosMap);
    if (validMode !== this.clockMode) return;

    document.body.classList.toggle("clock-top", validPos === "top");
    document.body.classList.toggle("clock-center", validPos === "center");

    document.querySelectorAll(".clock-pos-pill").forEach((el) => {
      (el as HTMLElement).classList.toggle("center-active", validPos === "center");
      (el as HTMLElement).textContent = validPos === "center" ? "⊞ Centred" : "⊟ Top";
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
    safeSet("sc_center_minimal", on ? "1" : "0");
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
    const map: ClockPosMap = {};
    const raw = safeJsonGet<Record<string, unknown> | null>("sc_clock_pos_map", null);
    if (raw && typeof raw === "object") {
      for (const [key, value] of Object.entries(raw)) {
        if (
          key !== "__proto__" &&
          key !== "constructor" &&
          key !== "prototype" &&
          isValidClockMode(key) &&
          isValidClockPos(value)
        ) {
          map[key] = value;
        }
      }
      return map;
    }
    const legacy = safeGet("sc_clock_pos");
    if (isValidClockPos(legacy)) {
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
