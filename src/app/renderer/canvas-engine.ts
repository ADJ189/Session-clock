// Canvas and clock rendering engine: frame loop, clock renderers, theme application
import type { Theme, TimeString, LitEntry } from "../../types";
import { THEMES, THEME_BY_ID, NAT_QUOTES } from "../../themes";
import { p2, p3, fmtSession, DAYS, MONTHS, GREETS } from "../../utils";
import * as Sound from "../../sound";
import * as Pom from "../../pomodoro";
import * as Intel from "../../intelligence";
import * as Features from "../../features";
import * as Easter from "../../easter";
import * as ThemeLib from "../../themelib";
import { onAccentInk } from "../utils/color";
import {
  buildParticles,
  drawBg,
  runTransition,
  setParallax,
  invalidateCache,
} from "../../renderer";
import {
  getTier,
  tickFps,
  resetFpsSampling,
  isTabVisible,
} from "../../perf";
import { clockController } from "../controllers/clock-controller";
import {
  isHideSeconds,
  isUse24Hour,
  stepParallax,
} from "../services/display-service";
import {
  bcBroadcast,
  updateFlowState,
  updateFlowIntensityUI,
  checkMilestones,
} from "../services/session-features";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let currentTheme: Theme = THEMES[0];
export function getCurrentTheme(): Theme {
  return currentTheme;
}

const root = document.documentElement;
const cssVar = (name: string, val: string) => root.style.setProperty(name, val);

let applyingRemoteTheme = false;
let themeGeneration = 0;

export function setApplyingRemoteTheme(val: boolean) {
  applyingRemoteTheme = val;
}

export function flashTheme() {
  document.body.classList.remove("theme-flash");
  void document.body.offsetWidth;
  document.body.classList.add("theme-flash");
  setTimeout(() => document.body.classList.remove("theme-flash"), 500);
}

export function applyTheme(theme: Theme, instant = false) {
  const myGeneration = ++themeGeneration;
  if (currentTheme && currentTheme.id !== theme.id && !instant) {
    window.__uiSounds?.themeSwitch?.();
    document.body.classList.add("theme-switching");
    setTimeout(() => document.body.classList.remove("theme-switching"), 350);
  }

  const doApply = () => {
    if (myGeneration !== themeGeneration) return;
    currentTheme = theme;
    invalidateCache();
    buildParticles(theme);
    cssVar("--clr-text", theme.text);
    cssVar("--clr-accent", theme.accent);
    cssVar("--clr-accent2", theme.accent2);
    cssVar("--clr-on-accent", onAccentInk(theme.accent));

    const accentRgb = theme.accent.startsWith("#")
      ? theme.accent
          .slice(1)
          .match(/.{2}/g)!
          .map((h) => Number.parseInt(h, 16))
          .join(",")
      : "110,231,183";
    cssVar("--clr-accent-rgb", accentRgb);
    cssVar("--clr-track", theme.track);
    cssVar("--clr-btn-bg", theme.btnBg);
    cssVar("--clr-btn-fg", theme.btnFg);
    cssVar("--clr-pill", theme.pill);
    cssVar("--clr-panel", theme.panel);
    cssVar("--font-main", theme.font);
    cssVar(
      "--glow",
      theme.glow === "none"
        ? "none"
        : `0 0 45px ${theme.accent}44,0 0 100px ${theme.accent}18`,
    );
    cssVar("--btn-radius", theme.isMedia ? "3px" : "99px");
    cssVar("--lb-h", theme.isMedia && theme.lb ? "3.8vh" : "0px");

    document.body.classList.toggle("light-theme", !!theme.light);
    document.body.className = document.body.className
      .replace(/\btheme-\S+/g, "")
      .trim();
    document.body.classList.add(`theme-${theme.id}`);

    const overlayEl = $("overlay");
    if (overlayEl) overlayEl.style.background = theme.overlay === "none" ? "" : theme.overlay;
    const vignetteEl = $("vignette");
    if (vignetteEl) vignetteEl.style.background = theme.vignette === "none" ? "" : theme.vignette;
    const scanlinesEl = $("scanlines");
    if (scanlinesEl) scanlinesEl.style.opacity = theme.scanlines ? "1" : "0";

    const grainEl = $("grain");
    if (grainEl) {
      grainEl.style.opacity = theme.grain ? "0.25" : "0";
      if (theme.grain) {
        grainEl.style.backgroundImage = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.12'/%3E%3C/svg%3E")`;
      }
    }

    const hdrEl = $("hdrBloom");
    if (hdrEl) {
      if (theme.hdr) {
        hdrEl.style.background = `radial-gradient(ellipse at 50% 50%,${theme.accent}09 0%,transparent 65%)`;
        hdrEl.style.opacity = "1";
      } else {
        hdrEl.style.opacity = "0";
      }
    }

    const showBadge = $("showBadge");
    if (showBadge) {
      if (theme.isMedia && theme.tagline) {
        showBadge.textContent = theme.tagline;
        showBadge.classList.add("visible");
      } else {
        showBadge.classList.remove("visible");
      }
    }

    const quoteText = $("quoteText");
    const litMeta = $("litMeta");
    if (quoteText && litMeta) {
      if (theme.id === "literary") {
        quoteText.style.fontFamily = "'Lora',serif";
        quoteText.style.fontSize = "clamp(.75rem,1.4vw,.95rem)";
        litMeta.style.display = "block";
      } else {
        quoteText.style.fontFamily = quoteText.style.fontSize = "";
        litMeta.style.display = "none";
        const qs = theme.quotes?.length ? theme.quotes : NAT_QUOTES;
        quoteText.style.opacity = "0";
        setTimeout(() => {
          if (myGeneration !== themeGeneration) return;
          quoteText.textContent = `"${qs[0]}"`;
          quoteText.style.opacity = ".38";
        }, 420);
      }
    }

    ThemeLib.onThemeApplied(theme.id);
    lastQKey = "";
    localStorage.setItem("sc_last_theme", theme.id);
    if (!applyingRemoteTheme) bcBroadcast("theme", { id: theme.id });

    if (
      theme.id === "commonroom" &&
      localStorage.getItem("sc_auto_theme_ambience") === "1"
    ) {
      setTimeout(() => {
        if (myGeneration === themeGeneration) Sound.autoStartCommonRoom();
      }, 400);
    }
    if (theme.id === "literary") ensureLitClockLoaded();
    updateClockCanvas();
  };

  if (instant || !theme.isMedia) {
    doApply();
    if (!instant) flashTheme();
    return;
  }
  runTransition(theme.transition ?? "defaultFade", doApply);
}

// ── Render loop ────────────────────────────────────────────────────────
let lastTs = 0;
let lastSec = -1;
let lastQKey = "";
let rafSkip = 0;
let modalFrameTs = 0;
let fpsPaused = false;
const MODAL_FRAME_MS = 250;

let litClockData: Record<TimeString, LitEntry> | null = null;
let litClockLoading = false;
export function ensureLitClockLoaded() {
  if (litClockData || litClockLoading) return;
  litClockLoading = true;
  void import("../../litclock")
    .then((m) => {
      litClockData = m.LIT_CLOCK;
      litClockLoading = false;
    })
    .catch(() => {
      litClockLoading = false;
    });
}

export function tickDigit(el: HTMLElement, val: string) {
  if (el.textContent === val) return;
  el.classList.remove("tick");
  void (el as HTMLElement).offsetWidth;
  el.textContent = val;
  el.classList.add("tick");
}

let isSessionRunningFn = () => false;
let getSessionElapsedFn = () => 0;

export function setSessionRunningCheck(fn: () => boolean, getElapsed: () => number) {
  isSessionRunningFn = fn;
  getSessionElapsedFn = getElapsed;
}

export function startRenderLoop() {
  requestAnimationFrame((ts) => {
    lastTs = ts;
    renderFrame(ts);
  });
}

export function renderFrame(ts: number) {
  if (!isTabVisible()) {
    requestAnimationFrame(renderFrame);
    return;
  }

  const tier = getTier();
  if (tier === "low") {
    rafSkip = (rafSkip + 1) % 3;
    if (rafSkip !== 0) {
      requestAnimationFrame(renderFrame);
      return;
    }
  }

  const modalThrottled = document.body.classList.contains("modal-open");
  if (modalThrottled) {
    if (ts - modalFrameTs < MODAL_FRAME_MS) {
      requestAnimationFrame(renderFrame);
      return;
    }
    modalFrameTs = ts;
  }

  requestAnimationFrame(renderFrame);
  const dt = Math.min((ts - lastTs) / 1000, modalThrottled ? 0.3 : 0.05);
  lastTs = ts;

  if (modalThrottled) {
    fpsPaused = true;
  } else {
    if (fpsPaused) {
      fpsPaused = false;
      resetFpsSampling(ts);
    }
    tickFps(ts);
  }

  const parallaxEnabled =
    localStorage.getItem("sc_parallax") !== "0" &&
    !document.body.classList.contains("reduced-motion");
  if (tier !== "low" && parallaxEnabled) {
    const { px, py } = stepParallax(0.06);
    setParallax(px, py);
  } else {
    setParallax(0, 0);
  }

  if (!document.body.classList.contains("modal-open")) {
    drawBg(dt, currentTheme, Intel.getFlowIntensity());
  }

  const sessionRunning = isSessionRunningFn();
  Intel.tickFlowIntensity(sessionRunning, dt);
  Sound.tickSpatial();

  const now = new Date();
  const ms = now.getMilliseconds(),
    sec = now.getSeconds(),
    min = now.getMinutes(),
    hr = now.getHours();
  const hr12 = hr % 12 || 12;
  const is24 = isUse24Hour() || currentTheme.id === "terminal";
  const hrStr = p2(is24 ? hr : hr12),
    minStr = p2(min),
    secStr = p2(sec);

  const clockMode = clockController.getMode();
  switch (clockMode) {
    case "analogue":
      renderAnalogue(hr, min, sec, ms);
      break;
    case "flip":
      renderFlip(hrStr, minStr, secStr);
      break;
    case "word":
      renderWord(hr, min);
      break;
    case "minimal":
      renderMinimal(hr12, hr);
      break;
    case "segment":
      renderSegment(hrStr, minStr, secStr);
      break;
    default: {
      const dHr = $("digitHr"),
        dMin = $("digitMin"),
        dSec = $("digitSec"),
        aDis = $("ampmDis"),
        sMs = $("secMs");
      if (dHr) tickDigit(dHr, hrStr);
      if (dMin) tickDigit(dMin, minStr);
      if (dSec) tickDigit(dSec, secStr);
      if (aDis) aDis.textContent = is24 ? "" : hr >= 12 ? "PM" : "AM";
      const newSecMs = "." + p3(Math.floor(ms / 50) * 50);
      if (sMs && sMs.textContent !== newSecMs) sMs.textContent = newSecMs;
    }
  }

  if (currentTheme.id === "smpte" && clockMode === "digital") {
    const frame = Math.floor(ms / (1000 / 24)) % 24;
    const smpteStr = ":" + p2(frame);
    const sMs = $("secMs");
    if (sMs && sMs.textContent !== smpteStr) sMs.textContent = smpteStr;
  }

  const newTimeDis = `${hrStr}:${minStr}:${secStr}`;
  const timeDis = $("timeDis");
  if (timeDis && timeDis.textContent !== newTimeDis)
    timeDis.textContent = newTimeDis;

  const dp = (((hr * 3600 + min * 60 + sec) * 1000 + ms) / 864e5) * 100;
  const pFill = $("progressFill");
  if (pFill) pFill.style.width = dp.toFixed(4) + "%";

  const sTmr = $("sessionTimer");
  if (sessionRunning) {
    if (Pom.isActive()) Pom.tick(performance.now());
    else if (sTmr) sTmr.textContent = fmtSession(getSessionElapsedFn());
  }

  if (sec !== lastSec) {
    lastSec = sec;
    window.__checkMidnight?.();

    if (Easter.isSiderealMode()) {
      const lat = (window as unknown as { __scLat?: number }).__scLat ?? 0;
      const el = document.getElementById("sessionStatusLine");
      if (el) el.textContent = Easter.getSiderealTime(lat);
    } else if (sessionRunning && Pom.isActive()) {
      const phase = Pom.getPhase();
      const rem = Pom.getRemainingSeconds();
      Features.setStatusState("running", {
        pomEnabled: true,
        pomPhase: phase,
        remainingSecs: rem,
      });
    }

    Features.tickCountdown();
    Features.tickWorldClock();
    updateFlowState();
    updateFlowIntensityUI(Intel.getFlowIntensity());
    checkMilestones();

    const dateDis = $("dateDis");
    if (dateDis) {
      dateDis.textContent = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
    }
    const greeting = $("greeting");
    if (greeting) {
      greeting.textContent = GREETS.find(([s, e]) => hr >= s && hr < e)?.[2] ?? "";
    }
    const dayPct = $("dayPct");
    if (dayPct) {
      dayPct.textContent = dp.toFixed(1) + "%";
    }

    const quoteText = $("quoteText");
    const litMeta = $("litMeta");
    if (quoteText) {
      if (currentTheme.id === "literary") {
        const key = (p2(hr) + ":" + p2(Math.floor(min / 5) * 5)) as TimeString;
        if (key !== lastQKey && litClockData) {
          lastQKey = key;
          const entry = litClockData[key];
          if (entry) {
            quoteText.style.opacity = "0";
            setTimeout(() => {
              quoteText.textContent = `"${entry.quote}"`;
              if (litMeta) litMeta.textContent = entry.source;
              quoteText.style.opacity = ".55";
            }, 400);
          }
        }
      } else {
        const qs = currentTheme.quotes?.length ? currentTheme.quotes : NAT_QUOTES;
        const qi = Math.trunc((hr * 60 + min) / 5) % qs.length;
        const qKey = String(qi);
        if (qKey !== lastQKey) {
          lastQKey = qKey;
          quoteText.style.opacity = "0";
          setTimeout(() => {
            quoteText.textContent = `"${qs[qi]}"`;
            quoteText.style.opacity = ".38";
          }, 400);
        }
      }
    }
  }
}

// ── Clock renderers ───────────────────────────────────────────────────
export function renderAnalogue(hr: number, min: number, sec: number, ms: number) {
  const el = document.getElementById("analogueClock") as HTMLCanvasElement | null;
  if (!el) return;
  const size = el.width;
  const cx = size / 2,
    cy = size / 2,
    R = size / 2 - 4;
  const ctx2 = el.getContext("2d")!;
  ctx2.clearRect(0, 0, size, size);
  const acc = currentTheme.accent;

  ctx2.beginPath();
  ctx2.arc(cx, cy, R, 0, Math.PI * 2);
  ctx2.strokeStyle = acc + "30";
  ctx2.lineWidth = 1.5;
  ctx2.stroke();

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const inner = i % 3 === 0 ? R * 0.82 : R * 0.88;
    ctx2.beginPath();
    ctx2.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx2.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx2.strokeStyle = acc + (i % 3 === 0 ? "cc" : "55");
    ctx2.lineWidth = i % 3 === 0 ? 2 : 1;
    ctx2.stroke();
  }

  const secAngle = ((sec + ms / 1000) / 60) * Math.PI * 2 - Math.PI / 2;
  const minAngle = ((min + sec / 60) / 60) * Math.PI * 2 - Math.PI / 2;
  const hrAngle = (((hr % 12) + min / 60) / 12) * Math.PI * 2 - Math.PI / 2;

  const drawHand = (
    angle: number,
    length: number,
    width: number,
    color: string,
  ) => {
    ctx2.beginPath();
    ctx2.moveTo(
      cx - Math.cos(angle) * R * 0.12,
      cy - Math.sin(angle) * R * 0.12,
    );
    ctx2.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
    ctx2.strokeStyle = color;
    ctx2.lineWidth = width;
    ctx2.lineCap = "round";
    ctx2.stroke();
  };

  drawHand(hrAngle, R * 0.55, 3.5, currentTheme.text);
  drawHand(minAngle, R * 0.78, 2.2, currentTheme.text);
  if (!isHideSeconds()) drawHand(secAngle, R * 0.88, 1.2, acc);

  ctx2.beginPath();
  ctx2.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx2.fillStyle = acc;
  ctx2.fill();
}

let flipPrev = { hr: "", min: "", sec: "" };
export function renderFlip(hr: string, min: string, sec: string) {
  const update = (id: string, val: string, prev: string) => {
    const el = document.getElementById(id);
    if (!el || val === prev) return;
    const top = el.querySelector<HTMLElement>(".flip-top");
    const bot = el.querySelector<HTMLElement>(".flip-bot");
    const topBack = el.querySelector<HTMLElement>(".flip-top-back");
    if (!top || !bot || !topBack) return;
    top.textContent = prev;
    bot.textContent = val;
    topBack.textContent = val;
    el.classList.remove("flipping");
    void el.offsetWidth;
    el.classList.add("flipping");
  };
  update("flipHr", hr, flipPrev.hr);
  update("flipMin", min, flipPrev.min);
  update("flipSec", sec, flipPrev.sec);
  flipPrev = { hr, min, sec };
}

const WORD_GRID = [
  "ITLISASTIME",
  "ACQUARTERDC",
  "TWENTYFIVEX",
  "HALFSTENFTO",
  "PASTERUNINE",
  "ONESIXTHREE",
  "FOURFIVETWO",
  "EIGHTELEVEN",
  "SEVENTWELVE",
  "TENSEOCLOCK",
];
const WORDS: Record<string, [number, number, number][]> = {
  IT: [[0, 0, 1]],
  IS: [[0, 3, 4]],
  A: [[0, 5, 5]],
  QUARTER: [[1, 2, 8]],
  TWENTY: [[2, 0, 5]],
  FIVE: [[2, 6, 9]],
  HALF: [[3, 0, 3]],
  TEN: [[3, 5, 7]],
  TO: [[3, 9, 10]],
  PAST: [[4, 0, 3]],
  ONE: [[5, 0, 2]],
  SIX: [[5, 3, 5]],
  THREE: [[5, 6, 10]],
  FOUR: [[6, 0, 3]],
  FIVE2: [[6, 4, 7]],
  TWO: [[6, 8, 10]],
  EIGHT: [[7, 0, 4]],
  ELEVEN: [[7, 5, 10]],
  SEVEN: [[8, 0, 4]],
  TWELVE: [[8, 5, 10]],
  TEN2: [[9, 0, 2]],
  OCLOCK: [[9, 4, 9]],
};
const HOUR_WORDS = [
  "TWELVE",
  "ONE",
  "TWO",
  "THREE",
  "FOUR",
  "FIVE2",
  "SIX",
  "SEVEN",
  "EIGHT",
  "NINE",
  "TEN2",
  "ELEVEN",
];

export function getWordClockWords(hr: number, min: number): Set<string> {
  const lit = new Set<string>(["IT", "IS"]);
  const m5 = Math.round(min / 5) * 5;
  if (m5 === 0) {
    lit.add("OCLOCK");
  } else if (m5 === 5) {
    lit.add("FIVE");
    lit.add("PAST");
  } else if (m5 === 10) {
    lit.add("TEN");
    lit.add("PAST");
  } else if (m5 === 15) {
    lit.add("A");
    lit.add("QUARTER");
    lit.add("PAST");
  } else if (m5 === 20) {
    lit.add("TWENTY");
    lit.add("PAST");
  } else if (m5 === 25) {
    lit.add("TWENTY");
    lit.add("FIVE");
    lit.add("PAST");
  } else if (m5 === 30) {
    lit.add("HALF");
    lit.add("PAST");
  } else if (m5 === 35) {
    lit.add("TWENTY");
    lit.add("FIVE");
    lit.add("TO");
  } else if (m5 === 40) {
    lit.add("TWENTY");
    lit.add("TO");
  } else if (m5 === 45) {
    lit.add("A");
    lit.add("QUARTER");
    lit.add("TO");
  } else if (m5 === 50) {
    lit.add("TEN");
    lit.add("TO");
  } else if (m5 === 55) {
    lit.add("FIVE");
    lit.add("TO");
  }
  const hIdx = (m5 >= 35 ? (hr % 12) + 1 : hr % 12) % 12;
  lit.add(HOUR_WORDS[hIdx]!);
  return lit;
}

let wordPrevKey = "";
export function renderWord(hr: number, min: number) {
  const key = `${hr}:${Math.floor(min / 5)}`;
  if (key === wordPrevKey) return;
  wordPrevKey = key;
  const lit = getWordClockWords(hr, min);
  const el = document.getElementById("wordClockGrid");
  if (!el) return;
  el.innerHTML = "";
  WORD_GRID.forEach((row, ri) => {
    [...row].forEach((ch, ci) => {
      const span = document.createElement("span");
      span.textContent = ch;
      span.className = "wc-char";
      let isLit = false;
      for (const [word, positions] of Object.entries(WORDS)) {
        if (!lit.has(word)) continue;
        for (const [r, cs, ce] of positions) {
          if (r === ri && ci >= cs && ci <= ce) {
            isLit = true;
            break;
          }
        }
        if (isLit) break;
      }
      span.classList.toggle("wc-lit", isLit);
      el.appendChild(span);
    });
  });
}

export function renderMinimal(hr12: number, hr: number) {
  const is24 = isUse24Hour() || currentTheme.id === "terminal";
  const el = document.getElementById("minimalHr");
  const ap = document.getElementById("minimalAP");
  if (el) el.textContent = String(is24 ? hr : hr12);
  if (ap) ap.textContent = is24 ? "" : hr >= 12 ? "PM" : "AM";
}

const SEG_PATHS: Record<string, number[]> = {
  "0": [1, 1, 1, 1, 1, 1, 0],
  "1": [0, 1, 1, 0, 0, 0, 0],
  "2": [1, 1, 0, 1, 1, 0, 1],
  "3": [1, 1, 1, 1, 0, 0, 1],
  "4": [0, 1, 1, 0, 0, 1, 1],
  "5": [1, 0, 1, 1, 0, 1, 1],
  "6": [1, 0, 1, 1, 1, 1, 1],
  "7": [1, 1, 1, 0, 0, 0, 0],
  "8": [1, 1, 1, 1, 1, 1, 1],
  "9": [1, 1, 1, 1, 0, 1, 1],
};

export function drawSegDigit(
  ctx2: CanvasRenderingContext2D,
  digit: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  dimColor: string,
  strokeScale = 1,
) {
  const segs = SEG_PATHS[digit] ?? SEG_PATHS["8"]!;
  const t = 4 * strokeScale,
    g = 3 * strokeScale;
  const iw = w - t * 2 - g * 2,
    ih = (h - t * 3 - g * 4) / 2;
  const drawSeg = (on: number, draw: () => void) => {
    ctx2.fillStyle = on ? color : dimColor;
    draw();
  };
  drawSeg(segs[0]!, () => {
    ctx2.fillRect(x + t + g, y, iw, t);
  });
  drawSeg(segs[1]!, () => {
    ctx2.fillRect(x + w - t, y + t + g, t, ih);
  });
  drawSeg(segs[2]!, () => {
    ctx2.fillRect(x + w - t, y + t * 2 + g * 3 + ih, t, ih);
  });
  drawSeg(segs[3]!, () => {
    ctx2.fillRect(x + t + g, y + h - t, iw, t);
  });
  drawSeg(segs[4]!, () => {
    ctx2.fillRect(x, y + t * 2 + g * 3 + ih, t, ih);
  });
  drawSeg(segs[5]!, () => {
    ctx2.fillRect(x, y + t + g, t, ih);
  });
  drawSeg(segs[6]!, () => {
    ctx2.fillRect(x + t + g, y + t + g * 3 + ih, iw, t);
  });
}

export function renderSegment(hr: string, min: string, sec: string) {
  const el = document.getElementById("segmentClock") as HTMLCanvasElement | null;
  if (!el) return;
  const ctx2 = el.getContext("2d")!;
  ctx2.clearRect(0, 0, el.width, el.height);
  const acc = currentTheme.accent;
  const dim = acc + "18";

  const scale = el.height / 110;
  const dw = 42 * scale,
    dh = 80 * scale,
    gap = 12 * scale,
    colonW = 18 * scale;
  const dotR = 3 * scale;

  const secondsHidden = isHideSeconds();
  const digits = secondsHidden
    ? [hr[0]!, hr[1]!, min[0]!, min[1]!]
    : [hr[0]!, hr[1]!, min[0]!, min[1]!, sec[0]!, sec[1]!];
  const colonCount = secondsHidden ? 1 : 2;
  const totalW =
    digits.length * dw + (digits.length - 1) * gap + colonCount * colonW;
  let ox = (el.width - totalW) / 2,
    oy = (el.height - dh) / 2;
  digits.forEach((d, i) => {
    if (i === 2 || (!secondsHidden && i === 4)) {
      ctx2.fillStyle = Math.floor(Date.now() / 500) % 2 === 0 ? acc : dim;
      ctx2.beginPath();
      ctx2.arc(ox + colonW / 2, oy + dh * 0.33, dotR, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.beginPath();
      ctx2.arc(ox + colonW / 2, oy + dh * 0.67, dotR, 0, Math.PI * 2);
      ctx2.fill();
      ox += colonW + gap;
    }
    drawSegDigit(ctx2, d, ox, oy, dw, dh, acc, dim, scale);
    ox += dw + gap;
  });
}

export function updateClockCanvas() {
  const block = document.getElementById("clock-block-wrap");
  if (!block) return;
  const clockMode = clockController.getMode();
  block.dataset.mode = clockMode;

  [
    "analogueClock",
    "flipClockWrap",
    "wordClockGrid",
    "minimalClockWrap",
    "segmentClock",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  const digitalRow = document.querySelector<HTMLElement>(".clock-row");
  if (digitalRow)
    digitalRow.style.display = clockMode === "digital" ? "" : "none";
  const ampmStack = document.querySelector<HTMLElement>(".ampm-stack");
  if (ampmStack)
    ampmStack.style.display = clockMode === "digital" ? "" : "none";

  const centered = clockController.getClockPosition(clockMode) === "center";

  if (clockMode === "analogue") {
    const canvas = document.createElement("canvas");
    canvas.id = "analogueClock";
    const cap = centered ? 620 : 360;
    const wFrac = centered ? 0.82 : 0.62;
    const hFrac = centered ? 0.66 : 0.4;
    const sz = Math.min(
      Math.min(window.innerWidth * wFrac, window.innerHeight * hFrac),
      cap,
    );
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.height = sz * dpr;
    canvas.style.width = canvas.style.height = sz + "px";
    canvas.dataset.secondsHidden = isHideSeconds() ? "1" : "0";
    block.appendChild(canvas);
  } else if (clockMode === "flip") {
    const wrap = document.createElement("div");
    wrap.id = "flipClockWrap";
    wrap.className = "flip-clock-wrap";
    const parts = isHideSeconds() ? ["Hr", "Min"] : ["Hr", "Min", "Sec"];
    parts.forEach((part, i) => {
      if (i > 0) {
        const sep = document.createElement("span");
        sep.className = "flip-sep" + (part === "Sec" ? " flip-sep-sec" : "");
        sep.textContent = ":";
        wrap.appendChild(sep);
      }
      const card = document.createElement("div");
      card.id = `flip${part}`;
      card.className = "flip-card";
      ["flip-top", "flip-bot", "flip-top-back"].forEach((cls) => {
        const d = document.createElement("div");
        d.className = cls;
        d.textContent = "00";
        card.appendChild(d);
      });
      wrap.appendChild(card);
    });
    block.appendChild(wrap);
    flipPrev = { hr: "", min: "", sec: "" };
  } else if (clockMode === "word") {
    const grid = document.createElement("div");
    grid.id = "wordClockGrid";
    grid.className = "word-clock-grid";
    block.appendChild(grid);
    wordPrevKey = "";
  } else if (clockMode === "minimal") {
    const wrap = document.createElement("div");
    wrap.id = "minimalClockWrap";
    wrap.className = "minimal-clock-wrap";
    const hrSpan = document.createElement("span");
    hrSpan.id = "minimalHr";
    hrSpan.className = "minimal-hr";
    hrSpan.textContent = "--";
    const apSpan = document.createElement("span");
    apSpan.id = "minimalAP";
    apSpan.className = "minimal-ap";
    apSpan.textContent = "AM";
    wrap.append(hrSpan, apSpan);
    block.appendChild(wrap);
  } else if (clockMode === "segment") {
    const canvas = document.createElement("canvas");
    canvas.id = "segmentClock";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.min(
      window.innerWidth * (centered ? 0.94 : 0.88),
      centered ? 900 : 520,
    );
    const cssH = centered ? 170 : 110;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    block.appendChild(canvas);
  }
}

export function updatePanelHeight() {
  const panel = $("themePanel");
  if (!panel) return;
  const h = panel.offsetHeight;
  document.documentElement.style.setProperty("--panel-h", h + "px");
}

export function setThemePanelCollapsed(collapsed: boolean) {
  const themePanel = $("themePanel");
  if (themePanel) themePanel.classList.toggle("collapsed", collapsed);
  document.body.classList.toggle("theme-panel-collapsed", collapsed);
}

export function toggleThemePanel() {
  ThemeLib.toggle();
}

export function makeFallbackLogo(t: Theme): SVGElement | HTMLElement {
  const cv = document.createElement("canvas");
  cv.width = 32;
  cv.height = 22;
  const cx2 = cv.getContext("2d")!;
  cx2.fillStyle = t.baseBg[0]!;
  cx2.fillRect(0, 0, 32, 22);
  cx2.fillStyle = t.accent;
  cx2.font = "bold 8px system-ui";
  cx2.textAlign = "center";
  cx2.textBaseline = "middle";
  cx2.fillText(t.name.slice(0, 2).toUpperCase(), 16, 11);
  const img = document.createElement("img");
  img.src = cv.toDataURL();
  img.alt = "";
  img.style.cssText = "width:32px;height:22px;display:block";
  return img;
}

export function setLogoContent(
  logo: HTMLElement,
  svgStr: string | undefined,
  fallback: () => SVGElement | HTMLElement,
) {
  while (logo.firstChild) logo.removeChild(logo.firstChild);
  if (svgStr) {
    const withNs = svgStr.includes("xmlns=")
      ? svgStr
      : svgStr.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
    const parser = new DOMParser();
    const doc = parser.parseFromString(withNs, "image/svg+xml");
    const el = doc.documentElement;
    const ok =
      el &&
      el.tagName.toLowerCase() === "svg" &&
      el.namespaceURI === "http://www.w3.org/2000/svg" &&
      !doc.querySelector("parsererror");
    if (ok) {
      logo.appendChild(el);
      return;
    }
  }
  logo.appendChild(fallback());
}
