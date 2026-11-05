// Application startup orchestration and lifecycle management
import { mount } from "svelte";
import App from "./App.svelte";
import {
  applyPlatformClasses,
  bindGlobalHaptics,
  BROWSER,
  CAPS,
  ENGINE,
  OS,
} from "../platform";
import { installDiagnostics, copyDiagnosticsText } from "../diagnostics";
import { rendererHealth } from "../rendererHealth";
import { initPerf, getTier, setTier, getFps } from "../perf";
import * as Motion from "../motion";
import * as Sound from "../sound";
import * as Pom from "../pomodoro";
import * as Log from "../focuslog";
import * as Intel from "../intelligence";
import * as APIs from "../apis";
import * as Privacy from "../privacy";
import * as Easter from "../easter";
import * as Cmd from "../cmdpalette";
import * as Features from "../features";
import * as Integrations from "../integrations";
import * as MusicDock from "../musicdock";
import * as SideTasks from "../sidetasks";
import * as ThemeLib from "../themelib";
import { THEMES, THEME_BY_ID } from "../themes";
import { resize } from "../renderer";
import {
  initWeather,
  isRaining,
  isSnowing,
  isClear,
  getWeatherOverlay,
} from "../weather";
import { openWeatherPage, setWeatherPageCallbacks } from "../weatherpage";
import { initAnalytics } from "../analytics";
import { showToast } from "./ui/toast";
import { initUiSounds } from "./audio/ui-sounds";
import { LOGOS } from "./themes/theme-logos";
import { clockController } from "./controllers/clock-controller";
import { sessionController } from "./controllers/session-controller";
import { settingsController } from "./controllers/settings-controller";
import { soundMixerController } from "./controllers/sound-mixer-controller";
import { themeBuilderController } from "./controllers/theme-builder-controller";
import { registerAllCommands } from "./commands/command-registry";
import {
  initModals,
  openModal,
  closeModal,
  buildPomUI,
  openDataPanel,
  openLegalPanel,
  openLanguageModal,
  openThemeBuilder,
  openSettings,
  openIntegrations,
  setupKeyboardShortcuts,
} from "./controllers/modal-controller";
import {
  initDisplayService,
  applyUse24Hour,
  applyHideSeconds,
  applyHideMs,
  applyCalmMode,
  applyFocusMode,
  applyIdleDetection,
  toggleKiosk,
  togglePresent,
  toggleZen,
  zenOn,
  toggleFocusLock,
  focusLockIntercept,
  isFocusLockEnabled,
  attachGyroParallax,
  wireIdleListeners,
  wireGithubCelebration,
  startNowPlayingPoll,
  stopNowPlayingPoll,
  isPrivacyMode,
  togglePrivacy,
  hideSeconds,
  hideMs,
  use24Hour,
} from "./services/display-service";
import {
  initSessionFeatures,
  openQRHandoff,
  applyHandoffState,
  startAnimedoro,
  openShareCard,
  bcBroadcast,
  checkSmartBreak,
  fireMilestoneConfetti,
  showMotivationWidget,
  resetMilestones,
} from "./services/session-features";
import {
  currentTheme,
  getCurrentTheme,
  applyTheme,
  updateClockCanvas,
  updatePanelHeight,
  setThemePanelCollapsed,
  toggleThemePanel,
  startRenderLoop,
  setSessionRunningCheck,
  makeFallbackLogo,
  setLogoContent,
} from "./renderer/canvas-engine";
import { initWallpaperDrop } from "./services/wallpaper-service";
import { startInfoStrip } from "./services/info-strip";

const APP_VERSION = "2.0.0";
const SPLASH_MIN_MS = 1000;
const SPLASH_FONT_GRACE_MS = 800;

interface ScReadinessState {
  coreReady: boolean;
  rendererReady: boolean;
  audioReady: boolean;
  optionalFeaturesReady: boolean;
  bootStage: string;
}

export const readiness: ScReadinessState = {
  coreReady: false,
  rendererReady: false,
  audioReady: false,
  optionalFeaturesReady: false,
  bootStage: "module-evaluated",
};

function featureProbe(): Record<string, boolean> {
  let canvas2d = false;
  try {
    canvas2d = !!document.createElement("canvas").getContext("2d");
  } catch {
    canvas2d = false;
  }
  const w = window as Window & { webkitAudioContext?: unknown };
  return {
    canvas2d,
    audioContext: "AudioContext" in window || "webkitAudioContext" in w,
    serviceWorker: "serviceWorker" in navigator,
    offscreenCanvas: "OffscreenCanvas" in window,
    opus: CAPS.oggOpus,
    broadcastChannel: "BroadcastChannel" in window,
    storage: (() => {
      try {
        localStorage.setItem("__sc_diag_probe__", "1");
        localStorage.removeItem("__sc_diag_probe__");
        return true;
      } catch {
        return false;
      }
    })(),
  };
}

let diagnostics: any;

function setBootStage(stage: string) {
  readiness.bootStage = stage;
  window.__bootStage = stage;
  diagnostics?.record({
    subsystem: "boot",
    kind: "readiness",
    message: `stage: ${stage}`,
  });
}

function markCoreReady() {
  if (readiness.coreReady) return;
  readiness.coreReady = true;
  window.__coreReady = true;
  setBootStage("core-ready");
}

function markRendererReady() {
  if (readiness.rendererReady) return;
  readiness.rendererReady = true;
  window.__rendererReady = true;
  setBootStage(`renderer-${rendererHealth.status}`);
}

function markAudioReady() {
  if (readiness.audioReady) return;
  readiness.audioReady = true;
  window.__audioReady = true;
  setBootStage("audio-ready");
}

function hideSplash() {
  const el = document.getElementById("splashScreen");
  if (!el || el.classList.contains("splash-hide")) return;
  if (window.__bootFailed) return;
  const t0 = window.__splashT0 ?? 0;

  const fontsReady: Promise<unknown> =
    document.fonts?.ready ?? Promise.resolve();
  const fontsGraceTimeout = new Promise((resolve) =>
    setTimeout(resolve, SPLASH_FONT_GRACE_MS),
  );
  Promise.race([fontsReady, fontsGraceTimeout]).then(() =>
    finishHideSplash(el, t0),
  );
}

function finishHideSplash(el: HTMLElement, t0: number) {
  const elapsed = performance.now() - t0;
  const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
  setTimeout(() => {
    if (!document.body.contains(el) || el.classList.contains("splash-hide"))
      return;

    const tri = el.querySelector<HTMLElement>(".splash-mark-triangle");
    const reduceMotionPref = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (tri && !reduceMotionPref) {
      const m = new DOMMatrixReadOnly(getComputedStyle(tri).transform);
      const current = Math.atan2(m.b, m.a) * (180 / Math.PI);
      const normalized = ((current % 360) + 360) % 360;
      tri.style.animation = "none";
      tri.style.transform = `rotate(${normalized}deg)`;
      void tri.offsetWidth;
      tri.style.transition = "transform .5s cubic-bezier(.16,1,.3,1)";
      tri.style.transform = "rotate(360deg)";
    }

    el.classList.add("splash-hide");
    void Motion.splashExit(el, el.querySelector(".splash-mark-card"));
    el.addEventListener("transitionend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 600);
  }, wait);
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch((err: unknown) => {
      console.warn("Session Clock: service worker registration failed:", err);
    });
  }
}

function wireIntegrationsMinimize(): void {
  const overlay = document.getElementById("integrationsOverlay");
  const header = document.getElementById("integrationsHeader");
  const minimizeBtn = document.getElementById("integrationsMinimize");
  const closeBtn = document.getElementById("integrationsClose");
  if (!overlay || !header || !minimizeBtn || !closeBtn) return;

  const setMinimized = (min: boolean) => {
    overlay.classList.toggle("minimized", min);
    minimizeBtn.textContent = min ? "▢" : "–";
    minimizeBtn.title = min ? "Restore" : "Minimize";
  };
  minimizeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setMinimized(!overlay.classList.contains("minimized"));
  });
  header.addEventListener("click", () => {
    if (overlay.classList.contains("minimized")) setMinimized(false);
  });
  closeBtn.addEventListener("click", () => {
    overlay.classList.remove("open");
    setMinimized(false);
  });
}

export async function bootSessionClock(): Promise<void> {
  // 1. Platform classes & haptics
  applyPlatformClasses();
  bindGlobalHaptics();

  // 2. Readiness + diagnostics
  window.__scReady = readiness;
  diagnostics = installDiagnostics({
    stage: "boot",
    environment: () => ({
      appVersion: APP_VERSION,
      buildId: (globalThis as { __SC_BUILD_ID__?: string }).__SC_BUILD_ID__,
      browser: BROWSER,
      engine: ENGINE,
      os: OS,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${screen.width}x${screen.height}`,
      dpr: window.devicePixelRatio,
      visibility: document.visibilityState,
      qualityTier: getTier(),
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemoryGb: (navigator as any).deviceMemory,
      features: featureProbe(),
      serviceWorkerControlled: !!navigator.serviceWorker?.controller,
      online: navigator.onLine,
    }),
  });

  window.__scMarkAudioReady = markAudioReady;
  document.documentElement.classList.toggle(
    "force-no-backdrop-filter",
    localStorage.getItem("sc_force_no_blur") === "1",
  );

  // 3. Audio autoplay-policy unlock
  const unlock = () => {
    try {
      Sound.unlockAudio();
    } finally {
      markAudioReady();
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });

  // 4. Mount Svelte Application Root
  const appRoot = document.getElementById("app-root");
  if (!appRoot) throw new Error("Missing #app-root in DOM");

  mount(App, {
    target: appRoot,
    props: {
      onopenthemes: () => focusLockIntercept(toggleThemePanel),
      onopenweather: () => {
        const wp = document.getElementById("weatherPill");
        if (wp) openWeatherPage(wp);
      },
      ontoggleclockpos: () => clockController.toggleClockPosition(),
      onopencmd: () => Cmd.open(),
      onopenkb: () => openModal("kbOverlay"),
      ontogglepom: () => {
        Pom.toggle();
        buildPomUI();
        openModal("pomOverlay");
      },
      oninputfocus: (val: string) => {
        const focusInput = document.getElementById("focusInput") as HTMLInputElement | null;
        if (focusInput) focusInput.value = val;
      },
      onstart: () =>
        sessionController.isRunning()
          ? sessionController.pauseTimer()
          : sessionController.startTimer(),
      onreset: () => sessionController.resetTimer(),
      onadddistraction: () => sessionController.logDistraction(),
      onopensound: () => {
        soundMixerController.notify();
        openModal("soundOverlay");
      },
      ontogglezen: () => toggleZen(),
      onopensettings: () => openSettings(),
    },
  });

  // 5. Initialize Controllers & Services
  clockController.init();
  sessionController.init({
    broadcast: (type, payload) => bcBroadcast(type, payload),
    toast: (msg, dur) => showToast(msg, dur),
    confetti: (count) => fireMilestoneConfetti(count),
    motivation: (title, desc) => showMotivationWidget(title, desc),
    resetMilestones: () => resetMilestones(),
  });

  setSessionRunningCheck(
    () => sessionController.isRunning(),
    () => sessionController.getElapsed(),
  );

  initDisplayService({
    updateClockCanvas: () => updateClockCanvas(),
    saveSessionState: () => sessionController.saveSessionState(),
    sessionRunning: () => sessionController.isRunning(),
  });

  initSessionFeatures({
    getCurrentTheme: () => getCurrentTheme(),
    applyTheme: (theme, instant) => applyTheme(theme, instant),
    getClockMode: () => clockController.getMode(),
    setClockMode: (mode) => clockController.setClockMode(mode),
    updateClockCanvas: () => updateClockCanvas(),
    isSessionRunning: () => sessionController.isRunning(),
    getSessionElapsed: () => sessionController.getElapsed(),
    startSessionTimer: () => sessionController.startTimer(),
    pauseSessionTimer: () => sessionController.pauseTimer(),
    resetSessionTimer: () => sessionController.resetTimer(),
    openModal: (id) => openModal(id),
    closeModal: (id) => closeModal(id),
    buildPomUI: () => buildPomUI(),
    setThemePanelCollapsed: (col) => setThemePanelCollapsed(col),
  });

  soundMixerController.mount();
  themeBuilderController.mount();

  settingsController.init({
    closeModal: (id) => closeModal(id),
    openModal: (id) => openModal(id),
    showToast: (msg, dur) => showToast(msg, dur),
    openThemeBuilder: () => openThemeBuilder(),
    openQRHandoff: () => openQRHandoff(),
    startAnimedoro: () => startAnimedoro(),
    toggleKiosk: () => toggleKiosk(),
    togglePresent: () => togglePresent(),
    openLanguage: () => openLanguageModal(),
    openIntegrations: () => openIntegrations(),
    openMixer: () => {
      soundMixerController.notify();
      openModal("soundOverlay");
    },
    openPomodoro: () => {
      buildPomUI();
      openModal("pomOverlay");
    },
    openDataPanel: () => openDataPanel(),
    openLegalPanel: (doc) => openLegalPanel(doc),

    getClockMode: () => clockController.getMode(),
    setClockMode: (mode) => clockController.setClockMode(mode),
    getClockPosition: () => clockController.getClockPosition(),
    applyClockPosition: (pos) => clockController.applyClockPosition(pos),
    isCenterMinimal: () => clockController.isCenterMinimal(),
    applyCenterMinimal: (val) => clockController.applyCenterMinimal(val),
    getHideSeconds: () => hideSeconds,
    applyHideSeconds: (val) => applyHideSeconds(val),
    getHideMs: () => hideMs,
    applyHideMs: (val) => applyHideMs(val),
    getUse24Hour: () => use24Hour,
    applyUse24Hour: (val) => applyUse24Hour(val),
    applyCalmMode: (val) => applyCalmMode(val),
    applyFocusMode: (val) => applyFocusMode(val),
    toggleFocusLock: () => toggleFocusLock(),
    isFocusLockEnabled: () => isFocusLockEnabled(),
    applyIdleDetection: (val) => applyIdleDetection(val),
    startNowPlayingPoll: () => startNowPlayingPoll(),
    stopNowPlayingPoll: () => stopNowPlayingPoll(),
    tryMatchNowPlayingTheme: () => {},
    attachGyroParallax: () => attachGyroParallax(),
    togglePrivacy: () => togglePrivacy(),
    isPrivacyMode: () => isPrivacyMode(),
    saveSessionState: () => sessionController.saveSessionState(),
    updateClockCanvas: () => updateClockCanvas(),
    copyDiagnosticsText: (t) => copyDiagnosticsText(t),
    getDiagnosticsText: () =>
      (window as unknown as { __scDiagnosticsText?: () => string })
        .__scDiagnosticsText?.() ?? "",
    wireIdleListeners: (n) => wireIdleListeners(n),
    isBreathingBreakEnabled: () => false,
    setBreathingBreakEnabled: () => {},
  });

  initModals();

  setupKeyboardShortcuts({
    onStartClick: () => {
      const btnStart = document.getElementById("btnStart");
      btnStart?.click();
    },
    onResetClick: () => {
      const btnReset = document.getElementById("btnReset");
      btnReset?.click();
    },
    getCurrentTheme: () => getCurrentTheme(),
    applyTheme: (theme) => applyTheme(theme),
    toggleKiosk: () => toggleKiosk(),
    togglePomodoro: () => {
      const btn = document.getElementById("btnPomToggle");
      btn?.click();
    },
    toggleThemePanel: () => toggleThemePanel(),
    toggleZen: () => toggleZen(),
    isZenOn: () => zenOn,
  });

  // 6. Theme Finder Controller
  ThemeLib.init({
    apply: (t) => applyTheme(t),
    currentId: () => getCurrentTheme().id,
    fillMark: (el, t) => setLogoContent(el, LOGOS[t.id], () => makeFallbackLogo(t)),
    openOverlay: () => openModal("themeLibOverlay"),
    closeOverlay: () => closeModal("themeLibOverlay"),
  });

  const themeLibOverlay = document.getElementById("themeLibOverlay");
  const dockThemesBtn = document.getElementById("btnDockThemes");
  if (themeLibOverlay && dockThemesBtn) {
    const syncDockState = () => {
      dockThemesBtn.classList.toggle(
        "active-tab",
        themeLibOverlay.classList.contains("open"),
      );
      dockThemesBtn.setAttribute(
        "aria-expanded",
        String(themeLibOverlay.classList.contains("open")),
      );
    };
    syncDockState();
    new MutationObserver(syncDockState).observe(themeLibOverlay, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  // 7. Register Command Palette Items
  Cmd.initPalette();
  registerAllCommands({
    sessionRunning: () => sessionController.isRunning(),
    startSession: () => sessionController.startTimer(),
    pauseSession: () => sessionController.pauseTimer(),
    resetSession: () => sessionController.resetTimer(),
    togglePomodoro: () => {
      Pom.toggle();
      buildPomUI();
      openModal("pomOverlay");
    },
    startAnimedoro: () => startAnimedoro(),
    openModal: (id) => openModal(id),
    closeModal: (id) => closeModal(id),
    openSettings: (tab) => openSettings(tab),
    openThemeBuilder: () => openThemeBuilder(),
    openQRHandoff: () => openQRHandoff(),
    openDataPanel: () => openDataPanel(),
    openLegalPanel: (doc) => openLegalPanel(doc),
    openLanguageModal: () => openLanguageModal(),
    openIntegrations: () => openIntegrations(),
    applyTheme: (theme, instant) => applyTheme(theme, instant),
    setClockMode: (mode) => clockController.setClockMode(mode),
    applyClockPosition: (pos) => clockController.applyClockPosition(pos),
    toggleKiosk: () => toggleKiosk(),
    togglePresent: () => togglePresent(),
    toggleZen: () => toggleZen(),
    togglePrivacy: () => togglePrivacy(),
    showToast: (msg, dur) => showToast(msg, dur),
    logos: LOGOS,
  });

  // 8. Other features & listeners
  initPerf();
  Motion.preloadAnime();

  APIs.initBattery().then(() => {
    APIs.onBatteryChange((level, charging) => {
      if (!charging && level < 0.2 && getTier() !== "low") {
        setTier("low");
        showToast("🔋 Battery saver: quality reduced to Low");
      }
    });
  });
  APIs.acquireWakeLock();

  resize();
  window.addEventListener("resize", () => {
    resize();
    updatePanelHeight();
  });

  updatePanelHeight();
  updateClockCanvas();
  startInfoStrip();
  initWallpaperDrop(
    () => getCurrentTheme(),
    (theme, instant) => applyTheme(theme, instant),
  );

  Easter.initEaster(
    (id) => {
      const t = THEME_BY_ID[id];
      if (t) applyTheme(t);
    },
    showToast,
    () => Sound.playChime(),
  );

  window.__scFps = () => getFps();
  window.__scTier = () => getTier();
  window.__scThemeCount = () => THEMES.length;
  window.__scAudioNodes = () => {
    try {
      const a = new AudioContext();
      const n = a.destination.channelCount;
      a.close();
      return "ok";
    } catch {
      return "?";
    }
  };
  window.__scRandomTheme = () => {
    const idx = Math.floor(Math.random() * THEMES.length);
    applyTheme(THEMES[idx]!);
  };
  window.__scIncognito = Privacy.isIncognito;

  registerSW();

  document.addEventListener("dragenter", () =>
    document.body.classList.add("drag-over"),
  );
  document.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget) document.body.classList.remove("drag-over");
  });
  document.addEventListener("drop", () =>
    document.body.classList.remove("drag-over"),
  );

  const kbBtn = document.getElementById("btnKbShortcuts");
  if (kbBtn) kbBtn.addEventListener("click", () => openModal("kbOverlay"));
  const cmdBtn = document.getElementById("btnCmdPalette");
  if (cmdBtn) cmdBtn.addEventListener("click", () => Cmd.open());
  const secretsBtn = document.getElementById("cmdSecretsBtn");
  if (secretsBtn) secretsBtn.addEventListener("click", () => Cmd.open("/"));

  const posPill = document.getElementById("clockPosPill");
  if (posPill) {
    posPill.addEventListener("click", () => clockController.toggleClockPosition());
  }

  // Ripple position tracking
  document.addEventListener(
    "mousedown",
    (e) => {
      const t = e.target as HTMLElement;
      const btn = t.closest(
        ".btn, .btn-primary, .btn-ghost, .feat-btn, .template-card",
      ) as HTMLElement | null;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const x = (((e.clientX - r.left) / r.width) * 100).toFixed(1);
      const y = (((e.clientY - r.top) / r.height) * 100).toFixed(1);
      btn.style.setProperty("--rx", x + "%");
      btn.style.setProperty("--ry", y + "%");
    },
    { passive: true },
  );

  // UI sounds wiring
  initUiSounds();

  const topbarThemesBtn = document.getElementById("topbarThemesBtn");
  if (topbarThemesBtn) {
    topbarThemesBtn.addEventListener("click", () => {
      focusLockIntercept(toggleThemePanel);
    });
  }

  const panelToggle = document.getElementById("panelToggle");
  if (panelToggle) {
    panelToggle.onclick = () => {
      focusLockIntercept(toggleThemePanel);
    };
  }

  document
    .getElementById("themesRevealBtn")
    ?.addEventListener("click", () => ThemeLib.open());

  wireGithubCelebration();
  setThemePanelCollapsed(true);

  const lastId = localStorage.getItem("sc_last_theme");
  applyTheme(
    lastId && THEME_BY_ID[lastId] ? THEME_BY_ID[lastId] : THEMES[0]!,
    true,
  );
  applyHandoffState();
  sessionController.restoreSavedSession();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) Intel.onTabHidden();
    else Intel.onTabVisible();
  });

  setInterval(() => {
    checkSmartBreak();
  }, 60_000);

  // Weather overlay preference
  if (localStorage.getItem("sc_weather_theme") !== "0") {
    document.body.classList.add("weather-overlay-on");
  }

  setWeatherPageCallbacks(isPrivacyMode, (_code, _temp, _desc) => {
    if (localStorage.getItem("sc_weather_theme") !== "0") {
      const overlay = getWeatherOverlay();
      const all = ["clear", "rain", "snow", "thunder", "fog", "cloudy"];
      all.forEach((c) => document.body.classList.remove(`weather-${c}`));
      if (overlay !== "none") document.body.classList.add(`weather-${overlay}`);
    }
  });

  const weatherPillEl = document.getElementById("weatherPill");
  if (weatherPillEl) {
    weatherPillEl.addEventListener("click", () => {
      openWeatherPage(weatherPillEl);
    });
  }

  if (!isPrivacyMode()) {
    const wIcon = document.getElementById("weatherIcon");
    const wText = document.getElementById("weatherText");
    const wPill = document.getElementById("weatherPill");
    if (wIcon && wText && wPill) {
      initWeather(wIcon, wText, wPill, isPrivacyMode, (_code, _temp, _desc) => {
        if (localStorage.getItem("sc_weather_theme") !== "0") {
          const overlay = getWeatherOverlay();
          const all = ["clear", "rain", "snow", "thunder", "fog", "cloudy"];
          all.forEach((c) => document.body.classList.remove(`weather-${c}`));
          if (overlay !== "none")
            document.body.classList.add(`weather-${overlay}`);
        }
      });
    }
  }

  Features.initStatusLine((text) => {
    const el = document.getElementById("sessionStatusLine");
    if (el) el.textContent = text;
  });
  const todaySessions = Log.focusLogCount();
  Features.setStatusState("idle", { todaySessions });
  const btnStartEl = document.getElementById("btnStart") as HTMLButtonElement | null;
  if (btnStartEl) {
    Features.updateButtonLabels("idle", "work", false, btnStartEl);
  }

  const distractionBtn = document.getElementById("btnDistraction");
  if (distractionBtn) {
    distractionBtn.addEventListener("click", () => {
      sessionController.logDistraction();
    });
  }

  const templatesContent = document.getElementById("templatesContent");
  if (templatesContent) {
    Features.buildTemplatesUI(templatesContent, (t) => {
      if (t.themeId) {
        const th = THEME_BY_ID[t.themeId];
        if (th) applyTheme(th);
      }
      Pom.setWorkMins(t.durationMins);
      Pom.setBreakMins(t.breakMins);
      if (!Pom.isActive()) Pom.toggle();
      showToast(`📋 ${t.icon} ${t.name} — ${t.durationMins}min session ready`);
      document.getElementById("templatesOverlay")?.classList.remove("open");
    });
  }

  const countdownContent = document.getElementById("countdownContent");
  if (countdownContent) {
    Features.buildCountdownUI(countdownContent, (label, target) => {
      Features.setCountdownTarget(
        label,
        target,
        (display, done) => {
          const statusEl = document.getElementById("sessionStatusLine");
          if (done) {
            showToast(`⏳ ${display}`, 5000);
            Features.setStatusState(
              sessionController.isRunning() ? "running" : "idle",
              {
                pomEnabled: Pom.isActive(),
                pomPhase: Pom.getPhase(),
                remainingSecs: Pom.getRemainingSeconds(),
              },
            );
          } else {
            if (statusEl) statusEl.textContent = display;
          }
        },
        () => {
          Features.setStatusState(
            sessionController.isRunning() ? "running" : "idle",
            {
              pomEnabled: Pom.isActive(),
              pomPhase: Pom.getPhase(),
              remainingSecs: Pom.getRemainingSeconds(),
            },
          );
        },
      );
      showToast(`⏳ Counting down to ${label}`);
    });
  }

  const worldClockContent = document.getElementById("worldClockContent");
  if (worldClockContent) Features.buildWorldClockUI(worldClockContent);

  const intContent = document.getElementById("integrationsContent");
  if (intContent) {
    Integrations.buildIntegrationsPanel(intContent, { showToast });
  }
  wireIntegrationsMinimize();

  const sidebar = document.createElement("div");
  sidebar.className = "sc-focus-sidebar";
  document.body.appendChild(sidebar);
  MusicDock.mountDock(sidebar);
  SideTasks.mountSideStack(sidebar);
  if (
    MusicDock.isMusicDeckEnabled() &&
    MusicDock.getProviderPref() !== "youtube" &&
    Integrations.isSpotifyConnected()
  ) {
    void MusicDock.initSpotifyPlayback();
  }

  if (window.location.search.includes("code=")) {
    Integrations.oauthHandleCallback().then((result) => {
      if (result && !result.ok) {
        const name =
          result.provider[0]!.toUpperCase() + result.provider.slice(1);
        showToast(`⚠️ ${name} connection failed: ${result.error}`, 6000);
      } else if (result?.ok) {
        const name =
          result.provider[0]!.toUpperCase() + result.provider.slice(1);
        showToast(`✅ ${name} connected!`, 4000);
        if (
          result.provider === "spotify" &&
          MusicDock.isMusicDeckEnabled() &&
          MusicDock.getProviderPref() !== "youtube"
        ) {
          void MusicDock.initSpotifyPlayback().then(() =>
            MusicDock.refreshDockConnectionState(),
          );
        }
        if (result.provider === "google") {
          MusicDock.refreshYouTubeConnectionState();
          SideTasks.refreshNow();
        }
      }
      if (intContent)
        Integrations.buildIntegrationsPanel(intContent, { showToast });
    });
  }

  if (Features.shouldShowOnboarding()) {
    setTimeout(() => {
      Features.showOnboarding({
        setDuration: (mins) => Pom.setWorkMins(mins),
        applyThemeById: (id) => {
          if (id) {
            const t = THEME_BY_ID[id];
            if (t) applyTheme(t);
          }
        },
        enableSound: (id) => {
          if (id) Sound.play(id);
        },
      });
    }, 800);
  } else {
    setTimeout(() => {
      const weatherSug = Features.getWeatherThemeSuggestion(
        isRaining(),
        isSnowing(),
        isClear(),
      );
      if (weatherSug && weatherSug.themeId !== getCurrentTheme().id) {
        showToast(`💡 ${weatherSug.reason} — try ${weatherSug.themeId}?`, 8000);
        return;
      }
      if (Features.shouldSuggestDayNightTheme(getCurrentTheme().id)) {
        const s = Features.getDayNightThemeSuggestion();
        if (s) showToast(`💡 ${s.reason} — or ignore!`, 8000);
      }
    }, 3000);
  }

  const voiceSupported = Features.initVoiceTimer(
    (cmd) => {
      switch (cmd.type) {
        case "start":
          if (cmd.minutes) Pom.setWorkMins(cmd.minutes);
          if (!sessionController.isRunning()) sessionController.startTimer();
          showToast(
            `🎙 ${cmd.minutes ? cmd.minutes + " min session" : "Session"} started`,
          );
          break;
        case "pause":
          if (sessionController.isRunning()) sessionController.pauseTimer();
          else if (sessionController.getElapsed() > 0)
            sessionController.startTimer();
          showToast(
            "🎙 " + (sessionController.isRunning() ? "Paused" : "Resumed"),
          );
          break;
        case "reset":
          sessionController.resetTimer();
          showToast("🎙 Timer reset");
          break;
        case "zen":
          toggleZen();
          showToast("🎙 Zen Mode " + (zenOn ? "on" : "off"));
          break;
        case "theme": {
          const name = cmd.themeName?.toLowerCase() ?? "";
          const match = THEMES.find(
            (t) => t.name.toLowerCase().includes(name) || t.id.includes(name),
          );
          if (match) {
            applyTheme(match);
            showToast(`🎙 Switched to ${match.name}`);
          } else showToast("🎙 Theme not found — try the command palette");
          break;
        }
        default:
          showToast(`🎙 Didn't catch that — try "start 25 minute session"`);
      }
    },
    (active) => {
      const btn = document.getElementById("voiceBtn");
      if (btn) btn.classList.toggle("active", active);
    },
  );

  if (voiceSupported) {
    const voiceBtn = document.createElement("button");
    voiceBtn.id = "voiceBtn";
    voiceBtn.className = "topbar-icon-btn";
    voiceBtn.title = 'Voice command (🎙 say "start 25 minute session")';
    voiceBtn.setAttribute("aria-label", "Voice timer");
    const micSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    micSvg.setAttribute("viewBox", "0 0 20 20");
    micSvg.setAttribute("width", "15");
    micSvg.setAttribute("height", "15");
    micSvg.setAttribute("fill", "currentColor");
    const micPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    micPath.setAttribute(
      "d",
      "M10 12a3 3 0 003-3V5a3 3 0 00-6 0v4a3 3 0 003 3zm5-3a5 5 0 01-10 0H3a7 7 0 0014 0h-2zm-5 7v2m0 0H8m2 0h2",
    );
    micSvg.appendChild(micPath);
    voiceBtn.appendChild(micSvg);
    voiceBtn.addEventListener("click", () => {
      if (Features.isVoiceActive()) Features.stopVoiceListening();
      else {
        Features.startVoiceListening();
        showToast('🎙 Listening… say "start 25 minute session"', 3000);
      }
    });
    const cmdBtn = document.getElementById("btnCmdPalette");
    if (cmdBtn?.parentNode) cmdBtn.parentNode.insertBefore(voiceBtn, cmdBtn);
  }

  // 9. Start render loop & mark core ready
  startRenderLoop();
  markCoreReady();

  // 10. First paint completion (double-rAF)
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      markRendererReady();
      window.__scBootOk?.();
      hideSplash();
      initAnalytics(isPrivacyMode());
      try {
        const reopenTab = sessionStorage.getItem("sc_reopen_settings");
        if (reopenTab) {
          sessionStorage.removeItem("sc_reopen_settings");
          openSettings(reopenTab);
        }
      } catch {
        /* ignore */
      }
    }),
  );
}
