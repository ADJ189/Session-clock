// Settings dialog controller
import { mount, unmount } from "svelte";
import SettingsDialog from "../settings/SettingsDialog.svelte";
import type { ClockMode } from "./clock-controller";
import type { Theme } from "../../types";
import * as APIs from "../../apis";
import * as Sound from "../../sound";
import * as Pom from "../../pomodoro";
import * as Integrations from "../../integrations";
import * as MusicDock from "../../musicdock";
import * as Privacy from "../../privacy";
import {
  getLocale,
  LOCALE_NAMES,
  LOCALE_FLAGS,
  t,
} from "../../i18n";
import {
  getAnalyticsPreference,
  setAnalyticsPreference,
  resetAnalyticsToAuto,
  getAnalyticsStatus,
  isAutoBlocked,
  onAnalyticsStatusChange,
} from "../../analytics";
import {
  CAPS,
  requestMotionPermission,
} from "../../platform";
import {
  getFps,
  getTier,
  setTier,
  setAutoQuality,
  type QualityTier,
} from "../../perf";
import { invalidateCache } from "../../renderer";

export interface SettingsCallbacks {
  closeModal: (id: string) => void;
  openModal: (id: string) => void;
  showToast: (msg: string, dur?: number) => void;
  openThemeBuilder: () => void;
  openQRHandoff: () => Promise<void>;
  startAnimedoro: () => void;
  toggleKiosk: () => void;
  togglePresent: () => void;
  openLanguage: () => void;
  openIntegrations: () => void;
  openMixer: () => void;
  openPomodoro: () => void;
  openDataPanel: () => void;
  openLegalPanel: (doc: "privacy" | "terms") => void;
  getCurrentTheme: () => Theme;

  getClockMode: () => ClockMode;
  setClockMode: (mode: ClockMode) => void;
  getClockPosition: () => "center" | "top";
  applyClockPosition: (pos: "center" | "top") => void;
  isCenterMinimal: () => boolean;
  applyCenterMinimal: (val: boolean) => void;
  getHideSeconds: () => boolean;
  applyHideSeconds: (val: boolean) => void;
  getHideMs: () => boolean;
  applyHideMs: (val: boolean) => void;
  getUse24Hour: () => boolean;
  applyUse24Hour: (val: boolean) => void;
  applyCalmMode: (val: boolean) => void;
  applyFocusMode: (val: boolean) => void;
  toggleFocusLock: () => void;
  isFocusLockEnabled: () => boolean;
  applyIdleDetection: (val: boolean) => void;
  startNowPlayingPoll: () => void;
  stopNowPlayingPoll: () => void;
  tryMatchNowPlayingTheme: (track: { title: string; artist: string }, manual?: boolean) => void;
  attachGyroParallax: () => void;
  togglePrivacy: () => void;
  isPrivacyMode: () => boolean;
  saveSessionState: () => void;
  updateClockCanvas: () => void;
  copyDiagnosticsText: (text: string) => Promise<boolean>;
  getDiagnosticsText: () => string;
  wireIdleListeners: (nudge: boolean) => void;
  isBreathingBreakEnabled: () => boolean;
  setBreathingBreakEnabled: (val: boolean) => void;
}

export class SettingsController {
  private activeTab = "general";
  private appInstance: ReturnType<typeof mount> | null = null;
  private callbacks: SettingsCallbacks | null = null;

  init(callbacks: SettingsCallbacks): void {
    this.callbacks = callbacks;
    onAnalyticsStatusChange(() => {
      this.updateAnalyticsUI();
    });
  }

  getActiveTab(): string {
    return this.activeTab;
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  openSettings(tab?: string): void {
    if (!this.callbacks) return;
    if (tab) {
      this.activeTab = tab;
    }
    this.mountOrUpdate();
    this.callbacks.openModal("settingsOverlay");
  }

  closeSettings(): void {
    this.callbacks?.closeModal("settingsOverlay");
  }

  updateAnalyticsUI(): void {
    const overlay = document.getElementById("settingsOverlay");
    if (!overlay || !overlay.classList.contains("open") || this.activeTab !== "privacy") {
      return;
    }
    this.mountOrUpdate();
  }

  private mixerStatusText(): { sub: string; count: number } {
    const playing = Sound.SOUNDS.filter((s) => Sound.isPlaying(s.id)).map(
      (s) => s.name,
    );
    if (Sound.binauralPresetId) {
      const preset = Sound.BINAURAL_PRESETS.find(
        (p) => p.id === Sound.binauralPresetId,
      );
      if (preset) playing.push(preset.name);
    }
    return playing.length
      ? { sub: playing.join(" + "), count: playing.length }
      : { sub: "Rain, fireplace, binaural beats & more", count: 0 };
  }

  private buildProps() {
    const cb = this.callbacks!;
    const curFlag = LOCALE_FLAGS[getLocale()] || "🌐";
    const curName = LOCALE_NAMES[getLocale()] || "English";
    const connectedCount = Object.values(
      Integrations.getConnectionStatus(),
    ).filter(Boolean).length;

    const mixerStatus = this.mixerStatusText();

    const isPriv = cb.isPrivacyMode();
    const pref = getAnalyticsPreference();
    const status = getAnalyticsStatus();
    const autoBlocked = isAutoBlocked();

    let badgeText: string | undefined;
    let descText = t().analyticsDescNormal;
    const isEffectivelyOn =
      !isPriv &&
      pref !== "off" &&
      (status === "active" || (status === "not-attempted" && !autoBlocked));

    if (isPriv) {
      badgeText = "Off (Privacy Mode)";
      descText = t().analyticsDescPrivacyMode;
    } else if (pref === "off") {
      badgeText = t().analyticsStatusDisabled;
      descText = t().analyticsDescNormal;
    } else if (status === "unavailable" || (pref === "auto" && autoBlocked)) {
      badgeText = t().analyticsStatusUnavailable;
      descText = t().analyticsDescBlocked;
    } else if (status === "loading") {
      badgeText = t().analyticsStatusChecking;
      descText = t().analyticsDescNormal;
    } else if (status === "active") {
      badgeText =
        pref === "auto"
          ? t().analyticsStatusAutoOn
          : t().analyticsStatusActive;
      descText = t().analyticsDescNormal;
    } else {
      badgeText =
        pref === "auto"
          ? t().analyticsStatusAutoOn
          : t().analyticsStatusActive;
    }

    const availSounds = Sound.SOUNDS.filter((s) => Sound.isFileTrackSupported(s.id)).map(
      (s) => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
      }),
    );

    const reduceMotion =
      localStorage.getItem("sc_reduce_motion") === "1" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    return {
      activeTab: this.activeTab,
      ontabchange: (tId: string) => {
        this.activeTab = tId;
        this.mountOrUpdate();
      },
      onclose: () => {
        this.closeSettings();
      },

      // General props
      activeClockMode: cb.getClockMode(),
      languageLabel: `${curFlag} ${curName} — Change language`,
      connectedCount,
      onselectpreset: (pId: string) => {
        const PRESETS = [
          { id: "student", icon: "📚", label: "Student", work: 25, brk: 5, sound: "library", smartBreak: true, idleNudge: true, calm: false, reminderMins: 60 },
          { id: "office", icon: "💼", label: "Office Worker", work: 50, brk: 10, sound: "cafe", smartBreak: true, idleNudge: false, calm: false, reminderMins: 90 },
          { id: "deepwork", icon: "🌙", label: "Deep Work", work: 90, brk: 15, sound: "brown", smartBreak: false, idleNudge: false, calm: false, reminderMins: 120 },
          { id: "minimal", icon: "🧘", label: "Minimalist", work: 25, brk: 5, sound: "", smartBreak: false, idleNudge: false, calm: true, reminderMins: 90 },
        ];
        const p = PRESETS.find((pr) => pr.id === pId);
        if (p) {
          Pom.setWorkMins(p.work);
          Pom.setBreakMins(p.brk);
          Sound.stop();
          if (p.sound) Sound.play(p.sound);
          localStorage.setItem("sc_smart_break", p.smartBreak ? "1" : "0");
          localStorage.setItem("sc_idle_detect", p.idleNudge ? "1" : "0");
          cb.wireIdleListeners(p.idleNudge);
          localStorage.setItem("sc_break_reminder_mins", String(p.reminderMins));
          localStorage.setItem("sc_calm_mode", p.calm ? "1" : "0");
          document.body.classList.toggle("calm-mode", p.calm);
          if (p.calm) {
            localStorage.setItem("sc_reduce_motion", "1");
            document.body.classList.add("reduced-motion");
            localStorage.setItem("sc_parallax", "0");
            setTier("med");
            invalidateCache();
          }
          cb.showToast(`${p.icon} ${p.label} preset applied`, 3500);
          this.mountOrUpdate();
        }
      },
      onselectclockmode: (mode: string) => {
        cb.setClockMode(mode as ClockMode);
        cb.updateClockCanvas();
        this.mountOrUpdate();
      },
      onquickaction: (id: string) => {
        this.closeSettings();
        if (id === "custom-theme") cb.openThemeBuilder();
        else if (id === "qr-handoff") void cb.openQRHandoff();
        else if (id === "animedoro") {
          cb.startAnimedoro();
          cb.openModal("pomOverlay");
        } else if (id === "kiosk") cb.toggleKiosk();
        else if (id === "present") cb.togglePresent();
        else if (id === "pip") {
          const clockEl = document.getElementById("clock-block-wrap") || document.body;
          const theme = cb.getCurrentTheme();
          if (APIs.isPiPActive()) {
            void APIs.exitPiP();
            cb.showToast("PiP closed");
          } else {
            void APIs.enterPiP(clockEl, theme)
              .then(() => cb.showToast("Clock floating in PiP"))
              .catch(() => cb.showToast("PiP not supported or blocked"));
          }
        }
      },
      onopenlanguage: () => {
        this.closeSettings();
        cb.openLanguage();
      },
      onopenintegrations: () => {
        this.closeSettings();
        cb.openIntegrations();
      },

      // Sound props
      spatial: Sound.isSpatialEnabled(),
      headTracking: Sound.isHeadTrackingEnabled(),
      headTrackingAvailable: Sound.isHeadTrackingAvailable(),
      breathing: cb.isBreathingBreakEnabled(),
      uiSounds: localStorage.getItem("sc_ui_sounds") !== "0",
      autoThemeAmbience: localStorage.getItem("sc_auto_theme_ambience") === "1",
      musicDeck: MusicDock.isMusicDeckEnabled(),
      musicProvider: MusicDock.getProviderPref(),
      nowPlayingTheme: localStorage.getItem("sc_nowplaying_theme") === "1",
      nowPlayingManual: localStorage.getItem("sc_nowplaying_manual") || "",
      spotifyConnected: Integrations.isSpotifyConnected(),
      activeTracksCount: mixerStatus.count,
      mixerSubtext: mixerStatus.sub,
      ontoggleSpatial: (val: boolean) => {
        Sound.setSpatial(val);
        this.mountOrUpdate();
      },
      ontoggleHeadTracking: async (val: boolean) => {
        if (val && CAPS.deviceOrientationNeedsPermission) {
          const granted = await requestMotionPermission();
          if (!granted) {
            cb.showToast("Motion access declined");
            return;
          }
        }
        Sound.setHeadTracking(val);
        if (val && !Sound.isSpatialEnabled()) {
          cb.showToast("Head tracking on — turn on 3D Spatial Audio above to hear it move");
        }
        this.mountOrUpdate();
      },
      ontoggleBreathing: (val: boolean) => {
        cb.setBreathingBreakEnabled(val);
        localStorage.setItem("sc_breathing_break", val ? "1" : "0");
        this.mountOrUpdate();
      },
      ontoggleUiSounds: (val: boolean) => {
        localStorage.setItem("sc_ui_sounds", val ? "1" : "0");
        cb.showToast(val ? "🔔 UI sounds on" : "🔕 UI sounds off");
        this.mountOrUpdate();
      },
      ontoggleAutoThemeAmbience: (val: boolean) => {
        localStorage.setItem("sc_auto_theme_ambience", val ? "1" : "0");
        cb.showToast(val ? "🎵 Theme ambience auto-play on" : "Theme ambience auto-play off");
        this.mountOrUpdate();
      },
      ontoggleMusicDeck: (val: boolean) => {
        MusicDock.setMusicDeckEnabled(val);
        if (val && MusicDock.getProviderPref() !== "youtube" && Integrations.isSpotifyConnected()) {
          void MusicDock.initSpotifyPlayback();
        }
        cb.showToast(val ? "Music panel enabled" : "Music panel hidden");
        this.mountOrUpdate();
      },
      onchangeMusicProvider: (val: "youtube" | "spotify" | "both") => {
        MusicDock.setProviderPref(val);
        if (MusicDock.isMusicDeckEnabled() && val !== "youtube" && Integrations.isSpotifyConnected()) {
          void MusicDock.initSpotifyPlayback();
        }
        cb.showToast(`Music panel: ${val}`);
        this.mountOrUpdate();
      },
      onopenmixer: () => {
        this.closeSettings();
        cb.openMixer();
      },
      ontoggleNowPlayingTheme: (val: boolean) => {
        localStorage.setItem("sc_nowplaying_theme", val ? "1" : "0");
        cb.showToast(val ? "🎵 Now Playing theme-matching on" : "Now Playing theme-matching off");
        if (val) cb.startNowPlayingPoll();
        else cb.stopNowPlayingPoll();
        this.mountOrUpdate();
      },
      onchangeNowPlayingManual: (val: string) => {
        const trimmed = val.trim();
        localStorage.setItem("sc_nowplaying_manual", trimmed);
        if (trimmed) cb.tryMatchNowPlayingTheme({ title: trimmed, artist: "" }, true);
      },

      // Focus props
      focusLock: cb.isFocusLockEnabled(),
      smartBreak: localStorage.getItem("sc_smart_break") !== "0",
      breakReminderMins: Number.parseInt(localStorage.getItem("sc_break_reminder_mins") || "90", 10),
      idleDetect: localStorage.getItem("sc_idle_detect") === "1",
      zenSound: localStorage.getItem("sc_zen_sound") || "",
      zenDimDelay: localStorage.getItem("sc_zen_dim_delay") || "2500",
      zenRings: localStorage.getItem("sc_zen_rings") !== "0",
      availableSounds: availSounds,
      ontoggleFocusLock: () => {
        cb.toggleFocusLock();
        this.mountOrUpdate();
      },
      ontoggleSmartBreak: (val: boolean) => {
        localStorage.setItem("sc_smart_break", val ? "1" : "0");
        this.mountOrUpdate();
      },
      onchangeBreakReminderMins: (mins: number) => {
        localStorage.setItem("sc_break_reminder_mins", String(mins));
      },
      ontoggleIdleDetect: (val: boolean) => {
        cb.applyIdleDetection(val);
        this.mountOrUpdate();
      },
      onchangeZenSound: (val: string) => {
        if (val) localStorage.setItem("sc_zen_sound", val);
        else localStorage.removeItem("sc_zen_sound");
      },
      onchangeZenDimDelay: (val: string) => {
        localStorage.setItem("sc_zen_dim_delay", val);
      },
      ontoggleZenRings: (val: boolean) => {
        localStorage.setItem("sc_zen_rings", val ? "1" : "0");
        this.mountOrUpdate();
      },
      onopenpomodoro: () => {
        this.closeSettings();
        cb.openPomodoro();
      },

      // Display props
      clockPos: cb.getClockPosition(),
      clockMode: cb.getClockMode(),
      centerMinimal: cb.isCenterMinimal(),
      hideSeconds: cb.getHideSeconds(),
      hideMs: cb.getHideMs(),
      use24Hour: cb.getUse24Hour(),
      calmMode: localStorage.getItem("sc_calm_mode") === "1",
      focusMode: localStorage.getItem("sc_focus_mode") === "1",
      reduceMotion,
      parallax: localStorage.getItem("sc_parallax") !== "0",
      haptics: localStorage.getItem("sc_haptics") !== "0",
      hapticsAvailable: Boolean(CAPS.vibration),
      fps: getFps(),
      tier: getTier(),
      quality: localStorage.getItem("sc_quality") || "",
      forceNoBlur: localStorage.getItem("sc_force_no_blur") === "1",
      onchangeClockPos: (pos: "center" | "top") => {
        cb.applyClockPosition(pos);
        this.mountOrUpdate();
      },
      ontoggleCenterMinimal: (val: boolean) => {
        cb.applyCenterMinimal(val);
        this.mountOrUpdate();
      },
      ontoggleHideSeconds: (val: boolean) => {
        cb.applyHideSeconds(val);
        this.mountOrUpdate();
      },
      ontoggleHideMs: (val: boolean) => {
        cb.applyHideMs(val);
        this.mountOrUpdate();
      },
      ontoggle24Hour: (val: boolean) => {
        cb.applyUse24Hour(val);
        cb.updateClockCanvas();
        this.mountOrUpdate();
      },
      ontoggleCalmMode: (val: boolean) => {
        cb.applyCalmMode(val);
        this.mountOrUpdate();
      },
      ontoggleFocusMode: (val: boolean) => {
        cb.applyFocusMode(val);
        this.mountOrUpdate();
      },
      ontoggleReduceMotion: (val: boolean) => {
        localStorage.setItem("sc_reduce_motion", val ? "1" : "0");
        document.body.classList.toggle("reduced-motion", val);
        this.mountOrUpdate();
      },
      ontoggleParallax: async (val: boolean) => {
        localStorage.setItem("sc_parallax", val ? "1" : "0");
        if (val) {
          if (CAPS.deviceOrientationNeedsPermission) {
            await requestMotionPermission();
          }
          cb.attachGyroParallax();
        }
        this.mountOrUpdate();
      },
      ontoggleHaptics: (val: boolean) => {
        localStorage.setItem("sc_haptics", val ? "1" : "0");
        this.mountOrUpdate();
      },
      onchangeQuality: (val: string) => {
        if (val) setTier(val as QualityTier);
        else setAutoQuality();
        invalidateCache();
        cb.showToast(val ? `Quality set to ${getTier().toUpperCase()}` : `Quality set to Auto (${getTier().toUpperCase()})`);
        this.mountOrUpdate();
      },
      ontoggleForceNoBlur: (val: boolean) => {
        localStorage.setItem("sc_force_no_blur", val ? "1" : "0");
        document.documentElement.classList.toggle("force-no-backdrop-filter", val);
        this.mountOrUpdate();
      },
      oncopydiagnostics: async () => {
        const text = cb.getDiagnosticsText();
        const ok = await cb.copyDiagnosticsText(text);
        cb.showToast(ok ? "📋 Diagnostics copied to clipboard" : "Could not copy diagnostics");
      },

      // Privacy props
      privacyMode: isPriv,
      analyticsTitle: t().analyticsTitle,
      analyticsDesc: descText,
      analyticsBadge: badgeText,
      analyticsOn: isEffectivelyOn,
      showRetryAnalytics: !isPriv && (status === "unavailable" || autoBlocked || pref === "off"),
      showAutoAnalytics: !isPriv && (pref !== "auto" || autoBlocked),
      retryAnalyticsLabel: t().analyticsActionEnable,
      autoAnalyticsLabel: t().analyticsActionAuto,
      analyticsReassurance: t().analyticsReassurance,
      incognito: Privacy.isIncognito(),
      autoClear: Privacy.isAutoClear(),
      ontogglePrivacy: (on: boolean) => {
        cb.togglePrivacy();
        if (on) {
          document.body.classList.add("privacy-activating");
          setTimeout(() => document.body.classList.remove("privacy-activating"), 800);
        }
        this.mountOrUpdate();
      },
      ontoggleAnalytics: (on: boolean) => {
        if (!on) {
          try {
            sessionStorage.setItem("sc_reopen_settings", "privacy");
          } catch {
            // ignore
          }
          cb.saveSessionState();
        }
        setAnalyticsPreference(on ? "on" : "off", cb.isPrivacyMode());
        this.mountOrUpdate();
      },
      onretryAnalytics: () => {
        setAnalyticsPreference("on", cb.isPrivacyMode());
        this.mountOrUpdate();
      },
      onautoAnalytics: () => {
        resetAnalyticsToAuto(cb.isPrivacyMode());
        this.mountOrUpdate();
      },
      ontoggleIncognito: (on: boolean) => {
        Privacy.setIncognito(on);
        cb.showToast(on ? "🕵 Private Focus Log on — log entries not saved" : "Private Focus Log off");
        this.mountOrUpdate();
      },
      ontoggleAutoClear: (on: boolean) => {
        Privacy.setAutoClear(on);
        cb.showToast(on ? "Auto-clear on close enabled" : "Auto-clear disabled");
        this.mountOrUpdate();
      },
      onopendata: () => {
        this.closeSettings();
        cb.openDataPanel();
      },
      onopenlegal: (doc: "privacy" | "terms") => {
        cb.openLegalPanel(doc);
      },
    };
  }

  mountOrUpdate(): void {
    const target = document.getElementById("settingsOverlay");
    if (!target) return;

    const activeEl = document.activeElement as HTMLElement | null;
    let focusSelector: string | null = null;
    if (activeEl && target.contains(activeEl)) {
      if (activeEl.id) {
        focusSelector = `#${activeEl.id}`;
      } else if (activeEl.dataset.tab) {
        focusSelector = `[data-tab="${activeEl.dataset.tab}"]`;
      } else if (activeEl.dataset.mode) {
        focusSelector = `[data-mode="${activeEl.dataset.mode}"]`;
      } else if (activeEl.className) {
        const firstClass = activeEl.className.trim().split(/\s+/)[0];
        if (firstClass) focusSelector = `.${firstClass}`;
      }
    }

    if (this.appInstance) {
      unmount(this.appInstance);
      this.appInstance = null;
    }
    target.innerHTML = "";

    const props = this.buildProps();
    this.appInstance = mount(SettingsDialog, {
      target,
      props,
    });

    if (focusSelector) {
      const el = target.querySelector<HTMLElement>(focusSelector);
      if (el) {
        try {
          el.focus();
        } catch {
          // ignore focus error
        }
      }
    }
  }
}

export const settingsController = new SettingsController();
