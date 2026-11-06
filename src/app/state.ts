// Low-frequency UI state store for Session Clock Svelte UI
export interface AppUiState {
  // Topbar
  weatherText: string;
  infoLabel: string;
  showBadge: string;
  clockPosLabel: string;

  // Workspace / Clock / Session
  greeting: string;
  digitHr: string;
  digitMin: string;
  digitSec: string;
  ampm: string;
  secMs: string;
  dateDis: string;
  dayPct: string;

  // Session
  pomMode: boolean;
  sessionLabel: string;
  sessionTimer: string;
  focusInputValue: string;
  startLabel: string;
  sessionStatus: string;
  distractionVisible: boolean;
  distractionCount: string;
  quote: string;
  meta: string;
}

export type StateListener = (state: AppUiState) => void;

class UiStateStore {
  private state: AppUiState = {
    weatherText: "Set location",
    infoLabel: "Session Clock",
    showBadge: "",
    clockPosLabel: "⊟ Top",

    greeting: "Good morning",
    digitHr: "--",
    digitMin: "--",
    digitSec: "--",
    ampm: "--",
    secMs: ".---",
    dateDis: "—",
    dayPct: "0%",

    pomMode: false,
    sessionLabel: "Session Timer",
    sessionTimer: "00:00:00",
    focusInputValue: "",
    startLabel: "Start",
    sessionStatus: "Ready to focus",
    distractionVisible: false,
    distractionCount: "0 today",
    quote: "",
    meta: "",
  };

  private listeners = new Set<StateListener>();

  get(): AppUiState {
    return this.state;
  }

  update(patch: Partial<AppUiState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof AppUiState)[]) {
      if (patch[key] !== undefined && this.state[key] !== patch[key]) {
        (this.state as unknown as Record<string, unknown>)[key] = patch[key];
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export const uiState = new UiStateStore();
