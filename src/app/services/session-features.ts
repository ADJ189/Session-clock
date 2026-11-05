// Session features: flow state, milestones, smart breaks, QR handoff, Animedoro, and share cards
import * as Pom from "../../pomodoro";
import * as Log from "../../focuslog";
import * as Intel from "../../intelligence";
import * as APIs from "../../apis";
import { showToast } from "../ui/toast";
import { p2 } from "../../utils";
import { THEME_BY_ID } from "../../themes";
import type { Theme } from "../../types";
import type { ClockMode } from "../controllers/clock-controller";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let bc: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("sc_sync")
    : null;

export function bcBroadcast(type: string, payload: Record<string, unknown> = {}) {
  bc?.postMessage({ type, ...payload });
}

export interface SessionFeaturesContext {
  getCurrentTheme: () => Theme;
  applyTheme: (theme: Theme, instant?: boolean) => void;
  getClockMode: () => ClockMode;
  setClockMode: (mode: ClockMode) => void;
  updateClockCanvas: () => void;
  isSessionRunning: () => boolean;
  getSessionElapsed: () => number;
  startSessionTimer: () => void;
  pauseSessionTimer: () => void;
  resetSessionTimer: () => void;
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
  buildPomUI: () => void;
  setThemePanelCollapsed: (collapsed: boolean) => void;
}

let ctx: SessionFeaturesContext;

export function initSessionFeatures(context: SessionFeaturesContext) {
  ctx = context;

  if (bc) {
    bc.onmessage = (e) => {
      const { type } = e.data;
      if (type === "theme" && e.data.id !== ctx.getCurrentTheme()?.id) {
        ctx.applyTheme(THEME_BY_ID[e.data.id] ?? ctx.getCurrentTheme(), true);
      }
      if (type === "session") {
        if (e.data.running && !ctx.isSessionRunning()) ctx.startSessionTimer();
        if (!e.data.running && ctx.isSessionRunning()) ctx.pauseSessionTimer();
      }
      if (type === "pom_phase") {
        const pomPill = document.getElementById("pomModePill");
        if (pomPill) pomPill.textContent = e.data.pill;
      }
    };
  }
}

// ── Flow State UI ─────────────────────────────────────────────────────
let flowUIActive = false;
const FLOW_BADGE_ID = "flowBadge";
let _flowBar: HTMLElement | null = null;

export function getFlowBar(): HTMLElement {
  if (!_flowBar) {
    _flowBar = document.createElement("div");
    _flowBar.id = "flowBar";
    document.body.appendChild(_flowBar);
  }
  return _flowBar;
}

export function updateFlowIntensityUI(intensity: number) {
  const bar = getFlowBar();
  bar.style.width = `${(intensity * 100).toFixed(1)}%`;

  document.body.classList.toggle("flow-deep", intensity >= 0.6);
  document.body.classList.toggle("flow-peak", intensity >= 0.9);

  const badge = document.getElementById(FLOW_BADGE_ID);
  if (badge && badge.classList.contains("visible")) {
    const mins = Intel.getFlowDuration();
    if (intensity >= 0.9) badge.textContent = `⚡ Peak Flow · ${mins}m`;
    else if (intensity >= 0.6) badge.textContent = `⚡ Deep Flow · ${mins}m`;
    else badge.textContent = `⚡ Flow State · ${mins}m`;
  }
}

export function updateFlowState() {
  const isFlow = Intel.checkFlowState(ctx?.isSessionRunning() ?? false);
  if (isFlow === flowUIActive) return;
  flowUIActive = isFlow;

  if (isFlow) {
    ctx?.setThemePanelCollapsed(true);
    document.body.classList.add("flow-state");
    let badge = document.getElementById(FLOW_BADGE_ID);
    if (!badge) {
      badge = document.createElement("div");
      badge.id = FLOW_BADGE_ID;
      badge.className = "flow-badge";
      document.body.appendChild(badge);
    }
    badge.textContent = "⚡ Flow State";
    badge.classList.add("visible");
    showToast("⚡ Flow State — you're in the zone", 4000);
  } else {
    document.body.classList.remove("flow-state", "flow-deep", "flow-peak");
    const badge = document.getElementById(FLOW_BADGE_ID);
    if (badge) badge.classList.remove("visible");
  }
}

// ── Motivation Booster ────────────────────────────────────────────────
const MOTIV_HALF = [
  ["Halfway there! 🔥", "Keep the momentum"],
  ["You're 50% done!", "The hardest part is behind you"],
  ["Half-time! ⚡", "Stay locked in"],
  ["Midpoint reached 🎯", "Finish strong"],
] as const;
const MOTIV_75 = [
  ["Almost there! 💪", "75% complete — don't stop now"],
  ["Final stretch! 🏁", "You've got this"],
  ["Three quarters done! ⚡", "Push through"],
] as const;

let _lastMilestonePct = 0;

export function fireMilestoneConfetti(count = 28) {
  if (
    document.body.classList.contains("calm-mode") ||
    document.body.classList.contains("reduced-motion")
  )
    return;
  const accentRgb =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--clr-accent-rgb")
      .trim() || "110,231,183";
  const colors = [
    `rgba(${accentRgb},0.85)`,
    "rgba(255,200,80,0.85)",
    "rgba(255,100,180,0.85)",
    "rgba(80,180,255,0.85)",
    "rgba(255,255,255,0.7)",
  ];
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("div");
    dot.className = "confetti-dot";
    const w = 5 + Math.random() * 6,
      h = 5 + Math.random() * 6;
    dot.style.cssText = [
      `left:${20 + Math.random() * 60}vw`,
      `top:${8 + Math.random() * 28}vh`,
      `background:${colors[Math.floor(Math.random() * colors.length)]}`,
      `animation-delay:${(Math.random() * 0.5).toFixed(2)}s`,
      `animation-duration:${(1.8 + Math.random()).toFixed(2)}s`,
      `width:${w.toFixed(1)}px`,
      `height:${h.toFixed(1)}px`,
      `border-radius:${Math.random() > 0.5 ? "50%" : "2px"}`,
    ].join(";");
    document.body.appendChild(dot);
    setTimeout(() => {
      if (dot.parentNode) dot.remove();
    }, 3800);
  }
}

export function showMotivationWidget(headline: string, sub: string) {
  document
    .querySelectorAll(".motivation-widget,.milestone-bg")
    .forEach((el) => el.remove());

  const bg = document.createElement("div");
  bg.className = "milestone-bg";
  document.body.appendChild(bg);
  setTimeout(() => {
    if (bg.parentNode) bg.remove();
  }, 3200);

  const w = document.createElement("div");
  w.className = "motivation-widget";
  const big = document.createElement("span");
  big.className = "motivation-text";
  big.textContent = headline;
  const sm = document.createElement("span");
  sm.className = "motivation-sub";
  sm.textContent = sub;
  w.append(big, sm);
  document.body.appendChild(w);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => w.classList.add("visible")),
  );
  setTimeout(() => {
    w.classList.add("hiding");
    setTimeout(() => {
      if (w.parentNode) w.remove();
    }, 700);
  }, 3200);

  try {
    window.__uiSounds?.sessionStart?.();
  } catch {
    /* ignore */
  }
}

export function checkMilestones() {
  if (!ctx?.isSessionRunning()) return;
  const totalMs = Pom.isActive()
    ? Pom.getSettings().workMins * 60_000
    : 25 * 60_000;
  const elapsed = ctx.getSessionElapsed();
  const pct = Math.min(1, elapsed / totalMs);

  if (pct >= 0.5 && _lastMilestonePct < 0.5) {
    _lastMilestonePct = 0.5;
    const [h, s] = MOTIV_HALF[Math.floor(Math.random() * MOTIV_HALF.length)]!;
    showMotivationWidget(h, s);
    fireMilestoneConfetti(28);
  } else if (pct >= 0.75 && _lastMilestonePct < 0.75) {
    _lastMilestonePct = 0.75;
    const [h, s] = MOTIV_75[Math.floor(Math.random() * MOTIV_75.length)]!;
    showMotivationWidget(h, s);
    fireMilestoneConfetti(16);
  }
}

export function resetMilestones() {
  _lastMilestonePct = 0;
  document
    .querySelectorAll(".motivation-widget,.milestone-bg,.confetti-dot")
    .forEach((el) => el.remove());
}

// ── Smart Break Suggester ─────────────────────────────────────────────
let breakBadgeShown = false;

export function getBreakReminderMins(): number {
  const v = Number.parseInt(
    localStorage.getItem("sc_break_reminder_mins") || "90",
    10,
  );
  return Number.isFinite(v) && v > 0 ? v : 90;
}

export function checkSmartBreak() {
  if (localStorage.getItem("sc_smart_break") === "0") return;
  if (Pom.isActive()) return;
  if (!Intel.checkBreakNeeded(ctx?.isSessionRunning() ?? false, getBreakReminderMins())) return;
  if (breakBadgeShown) return;
  breakBadgeShown = true;

  const mins = getBreakReminderMins();
  showToast(
    `🧘 You've been focused for ${mins}+ minutes — a short break helps.`,
    6500,
  );
  APIs.sendNotification(
    "Time for a quick break?",
    `You've been focused for ${mins}+ minutes. Stretch, hydrate, rest your eyes for a moment.`,
    "break-reminder",
  );

  const pill = document.querySelector<HTMLElement>(".session-status-line");
  if (pill) {
    pill.classList.add("break-hint");
    pill.title = `You've been focused for ${mins}+ minutes — consider a short break`;
    setTimeout(() => pill.classList.remove("break-hint"), 30_000);
  }
  setTimeout(() => {
    breakBadgeShown = false;
  }, 30_000);
}

// ── QR Handoff ────────────────────────────────────────────────────────
export async function openQRHandoff() {
  const canvas = $<HTMLCanvasElement>("qrCanvas");
  const label = $("qrLabel");
  const urlEl = $("qrUrl");
  if (!canvas) return;

  const currentTheme = ctx.getCurrentTheme();
  const state: Record<string, string> = {
    theme: currentTheme.id,
    clock: ctx.getClockMode(),
  };
  if (ctx.isSessionRunning()) {
    state.ses = "1";
    state.elapsed = String(Math.round(ctx.getSessionElapsed()));
  }
  if (Pom.isActive()) {
    state.pom = "1";
    const s = Pom.getSettings();
    state.pw = String(s.workMins);
    state.pb = String(s.breakMins);
  }
  const focusInput = document.getElementById("focusInput") as HTMLInputElement | null;
  if (focusInput?.value.trim()) {
    state.task = focusInput.value.trim().slice(0, 30);
  }

  const params = new URLSearchParams(state).toString();
  const url = `${location.origin}${location.pathname}?${params}`;

  if (urlEl) {
    urlEl.textContent = url.length > 60 ? url.slice(0, 57) + "…" : url;
  }

  const fg = currentTheme.text;
  const bg = currentTheme.baseBg[1] ?? currentTheme.baseBg[0];
  const { drawQR } = await import("../../qr");
  drawQR(canvas, url, fg, bg);

  if (label)
    label.textContent =
      url.length > 77
        ? "URL too long for QR — shorten task name"
        : "Scan to continue this session on another device";

  ctx.openModal("qrOverlay");
}

export function applyHandoffState() {
  const p = new URLSearchParams(location.search);
  if (!p.has("theme") && !p.has("ses") && !p.has("start")) return;
  const themeId = p.get("theme");
  if (themeId && THEME_BY_ID[themeId]) ctx.applyTheme(THEME_BY_ID[themeId], true);
  const cm = p.get("clock") as ClockMode | null;
  if (cm) {
    ctx.setClockMode(cm);
    ctx.updateClockCanvas();
  }
  const task = p.get("task");
  const focusInput = document.getElementById("focusInput") as HTMLInputElement | null;
  if (task && focusInput) {
    focusInput.value = task;
  }
  if (p.get("ses") === "1") {
    const elapsed = Number.parseInt(p.get("elapsed") ?? "0");
    (window as any).__sessionHandoffElapsed = elapsed;
    setTimeout(() => {
      const btn = document.getElementById("btnStart");
      btn?.click();
    }, 800);
  } else if (p.get("start") === "1") {
    setTimeout(() => {
      const btn = document.getElementById("btnStart");
      btn?.click();
    }, 800);
  }
  history.replaceState({}, "", location.pathname);
}

// ── Animedoro mode ────────────────────────────────────────────────────
let theaterTimer: number | null = null;
let theaterRemainMs = 20 * 60_000;

export function startAnimedoro() {
  Pom.updateSettings({ workMins: 50, breakMins: 20 });
  if (!Pom.isActive()) {
    Pom.toggle();
    ctx?.buildPomUI();
  }
}

export function triggerTheaterMode(breakMins: number) {
  const overlay = document.getElementById("theaterOverlay");
  const timerEl = document.getElementById("theaterTimer");
  const minEl = document.getElementById("theaterMinutes");
  if (!overlay) return;

  const endTime = Date.now() + breakMins * 60_000;
  if (minEl) minEl.textContent = String(breakMins);
  overlay.classList.add("visible");

  const tick = () => {
    theaterRemainMs = endTime - Date.now();
    if (timerEl) {
      const m = Math.floor(Math.max(0, theaterRemainMs) / 60000);
      const s = Math.floor((Math.max(0, theaterRemainMs) % 60000) / 1000);
      timerEl.textContent = `${p2(m)}:${p2(s)}`;
    }
    if (theaterRemainMs <= 0) {
      overlay.classList.remove("visible");
      if (theaterTimer) clearInterval(theaterTimer);
    }
  };
  tick();
  if (theaterTimer) clearInterval(theaterTimer);
  theaterTimer = window.setInterval(tick, 1000);

  const skipBtn = document.getElementById("theaterSkip");
  if (skipBtn)
    skipBtn.onclick = () => {
      overlay.classList.remove("visible");
      if (theaterTimer) clearInterval(theaterTimer);
    };
}

// ── Share focus card ──────────────────────────────────────────────────
export async function openShareCard() {
  const log = Log.readFocusLog();
  const today = new Date().toDateString();
  const todayMs = (log as Array<{ date: string; dur: number }>)
    .filter((e) => e.date === today)
    .reduce((s, e) => s + e.dur, 0);
  const todayMins = Math.max(1, Math.floor(todayMs / 60000));
  const focusInput = document.getElementById("focusInput") as HTMLInputElement | null;
  const task = focusInput?.value.trim() ?? "";

  const currentTheme = ctx.getCurrentTheme();
  const cardOpts = {
    themeName: currentTheme.name,
    accentColor: currentTheme.accent,
    bgColor: currentTheme.baseBg[0]!,
    textColor: currentTheme.text,
    glow: currentTheme.glow,
    focusMinutes: todayMins,
    taskName: task,
    streakDays: Intel.getStreak().current,
    date: new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };

  const { generateShareCard } = await import("../../share");
  const cv = generateShareCard(cardOpts, false);

  if (APIs.canShare()) {
    try {
      const blob: Blob = await new Promise((res) =>
        cv.toBlob((b) => res(b!), "image/png", 0.95),
      );
      const file = new File([blob], "session-clock.png", { type: "image/png" });
      await navigator.share({
        files: [file],
        title: "Session Clock",
        text: `${todayMins} minutes focused today`,
      });
      showToast("Shared! 🎉");
      return;
    } catch {
      /* fall through */
    }
  }

  try {
    const blob: Blob = await new Promise((res) =>
      cv.toBlob((b) => res(b!), "image/png", 0.95),
    );
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    showToast("Focus card copied to clipboard! 📋");
    return;
  } catch {
    /* fall through */
  }

  try {
    await navigator.clipboard.writeText(cv.toDataURL("image/png", 0.95));
    showToast("Card data copied — paste into an image editor 📋");
    return;
  } catch {
    /* fall through */
  }

  const link = document.createElement("a");
  link.download = `session-clock-${Date.now()}.png`;
  link.href = cv.toDataURL("image/png", 0.95);
  link.click();
  showToast("Focus card saved! 🖼");
}
