// ── UI sound system ───────────────────────────────────────────────────
// Dialed-style audio feedback: subtle, pleasant clicks and chirps for UI events.

let uiAudioCtx: AudioContext | null = null;
const getUiCtx = (): AudioContext => {
  if (!uiAudioCtx) uiAudioCtx = new AudioContext();
  return uiAudioCtx;
};

export const uiSounds = {
  click() {
    try {
      const ctx = getUiCtx();
      if (ctx.state === "suspended") void ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.setValueAtTime(1200, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06);
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      o.type = "sine";
      o.start();
      o.stop(ctx.currentTime + 0.08);
    } catch {
      /**/
    }
  },
  toggle(on: boolean) {
    try {
      const ctx = getUiCtx();
      if (ctx.state === "suspended") void ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.setValueAtTime(on ? 880 : 660, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(
        on ? 1200 : 440,
        ctx.currentTime + 0.1,
      );
      g.gain.setValueAtTime(0.05, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      o.type = "sine";
      o.start();
      o.stop(ctx.currentTime + 0.12);
    } catch {
      /**/
    }
  },
  sessionStart() {
    try {
      const ctx = getUiCtx();
      if (ctx.state === "suspended") void ctx.resume();
      [0, 0.12, 0.24].forEach((delay, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        const freqs = [523, 659, 784]; // C5 E5 G5
        o.frequency.value = freqs[i]!;
        g.gain.setValueAtTime(0, ctx.currentTime + delay);
        g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + delay + 0.3,
        );
        o.type = "sine";
        o.start(ctx.currentTime + delay);
        o.stop(ctx.currentTime + delay + 0.3);
      });
    } catch {
      /**/
    }
  },
  sessionEnd() {
    try {
      const ctx = getUiCtx();
      if (ctx.state === "suspended") void ctx.resume();
      [0, 0.15, 0.3, 0.45].forEach((delay, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        const freqs = [784, 659, 523, 392]; // G5 E5 C5 G4
        o.frequency.value = freqs[i]!;
        g.gain.setValueAtTime(0, ctx.currentTime + delay);
        g.gain.linearRampToValueAtTime(0.07, ctx.currentTime + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + delay + 0.35,
        );
        o.type = "sine";
        o.start(ctx.currentTime + delay);
        o.stop(ctx.currentTime + delay + 0.4);
      });
    } catch {
      /**/
    }
  },
  themeSwitch() {
    try {
      const ctx = getUiCtx();
      if (ctx.state === "suspended") void ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.setValueAtTime(400, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.15);
      g.gain.setValueAtTime(0.04, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      o.type = "sine";
      o.start();
      o.stop(ctx.currentTime + 0.18);
    } catch {
      /**/
    }
  },
  error() {
    try {
      const ctx = getUiCtx();
      if (ctx.state === "suspended") void ctx.resume();
      [0, 0.1].forEach((delay) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = 180;
        g.gain.setValueAtTime(0.06, ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + delay + 0.12,
        );
        o.type = "sawtooth";
        o.start(ctx.currentTime + delay);
        o.stop(ctx.currentTime + delay + 0.12);
      });
    } catch {
      /**/
    }
  },
};

export function initUiSounds() {
  if (typeof window !== "undefined") {
    (window as unknown as { __uiSounds?: typeof uiSounds }).__uiSounds = uiSounds;
  }
  if (typeof document !== "undefined") {
    document.addEventListener(
      "click",
      (e) => {
        if (localStorage.getItem("sc_ui_sounds") === "0") return;
        const t = e.target as HTMLElement;
        if (
          t.closest(
            ".feat-btn, .btn-ghost, .btn-icon, .nat-btn, .media-card, .panel-tab, .topbar-icon-btn, .modal-close, .cmd-item",
          )
        ) {
          uiSounds.click();
        }
        if (t.closest(".settings-toggle")) {
          const isOn = (
            t.closest(".settings-toggle") as HTMLElement
          ).classList.contains("on");
          uiSounds.toggle(isOn);
        }
      },
      { passive: true },
    );
  }
}
