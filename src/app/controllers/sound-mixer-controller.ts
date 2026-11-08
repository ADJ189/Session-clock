import * as Sound from "../../sound";
import * as APIs from "../../apis";
import { showToast } from "../ui/toast";
import { mount, unmount } from "svelte";
import { safeGet, safeSet } from "../../storage";
import {
  clampFadeMinutes,
  normalizePreset,
  parsePresets,
  parseScene,
  serializePresets,
  serializeScene,
  type MixScene,
  type SoundPreset,
} from "../../audio/settings";

export type { MixScene, SoundPreset };

export interface SoundTrackState {
  id: string;
  name: string;
  icon: string;
  desc: string;
  accent: string;
  active: boolean;
  vol: number; // 0..200
  unavailable: boolean;
  unavailableTitle: string;
}

export interface BinauralTrackState {
  id: string;
  name: string;
  icon: string;
  desc: string;
  accent: string;
  active: boolean;
  unavailable: boolean;
  unavailableTitle: string;
}

export interface SoundMixerSnapshot {
  tracks: SoundTrackState[];
  binauralPresets: BinauralTrackState[];
  presets: SoundPreset[];
  masterVol: number; // 0..200
  fade: number; // minutes
  nightMode: "auto" | "on" | "off";
  nightActive: boolean;
  autoCrossfade: boolean;
}

const PRESETS_KEY = "sc_sound_presets";
const TRACK_IDS: ReadonlySet<string> = new Set(Sound.SOUNDS.map((s) => s.id));

export class SoundMixerController {
  private subscribers = new Set<(snapshot: SoundMixerSnapshot) => void>();
  private appInstance: Record<string, any> | null = null;
  private mixerMeterRaf = 0;
  private trackChangeListeners = new Set<() => void>();

  constructor() {
    Sound.setTrackChangeHandler(() => {
      this.handleTrackChange();
    });
  }

  subscribe(cb: (snapshot: SoundMixerSnapshot) => void): () => void {
    this.subscribers.add(cb);
    cb(this.getSnapshot());
    return () => this.subscribers.delete(cb);
  }

  onTrackChange(cb: () => void): () => void {
    this.trackChangeListeners.add(cb);
    return () => this.trackChangeListeners.delete(cb);
  }

  notify(): void {
    const snap = this.getSnapshot();
    for (const cb of this.subscribers) {
      cb(snap);
    }
  }

  private handleTrackChange(): void {
    this.notify();
    this.updateMediaSession();
    for (const listener of this.trackChangeListeners) {
      listener();
    }
  }

  private updateMediaSession(): void {
    const playing = Sound.SOUNDS.filter((s) => Sound.isPlaying(s.id)).map(
      (s) => s.name,
    );
    if (playing.length > 0) {
      APIs.setupMediaSession(
        playing.join(" + "),
        () =>
          playing.forEach((n) => {
            const s = Sound.SOUNDS.find((x) => x.name === n);
            if (s) Sound.playTrack(s.id);
          }),
        () =>
          Sound.SOUNDS.forEach((s) => {
            if (Sound.isPlaying(s.id)) Sound.stopTrack(s.id);
          }),
        () => Sound.SOUNDS.forEach((s) => Sound.stopTrack(s.id)),
      );
      APIs.updateMediaState("playing");
    } else {
      APIs.clearMediaSession();
    }
  }

  isNightHours(): boolean {
    const h = new Date().getHours();
    return h >= 21 || h < 6;
  }

  getNightMode(): "auto" | "on" | "off" {
    const mode = safeGet("sc_mixer_night");
    if (mode === "on" || mode === "off" || mode === "auto") return mode;
    return "auto";
  }

  isNightActive(): boolean {
    const mode = this.getNightMode();
    return mode === "on" || (mode === "auto" && this.isNightHours());
  }

  toggleNightMode(): void {
    const cur = this.getNightMode();
    const next = cur === "auto" ? "on" : cur === "on" ? "off" : "auto";
    safeSet("sc_mixer_night", next);
    this.notify();
    showToast(`🌙 Mixer night mode: ${next}`);
  }

  applyNightMode(): void {
    this.notify();
  }

  getSoundPresets(): SoundPreset[] {
    // Validated at the storage boundary: unknown tracks, non-finite gains and
    // over-long names are dropped; corrupt JSON yields [] and never blocks the
    // mixer from opening.
    return parsePresets(safeGet(PRESETS_KEY), TRACK_IDS);
  }

  savePreset(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const presets = this.getSoundPresets();
    const tracks: Record<string, number> = {};
    Sound.SOUNDS.forEach((s) => {
      tracks[s.id] = Sound.getTrackVolume(s.id);
    });
    const preset: SoundPreset = {
      name: trimmed,
      tracks,
      master: Sound.getMasterVolume(),
    };
    const idx = presets.findIndex((p) => p.name === preset.name);
    if (idx >= 0) presets[idx] = preset;
    else presets.push(preset);
    while (presets.length > 5) presets.shift();
    safeSet(PRESETS_KEY, serializePresets(presets));
    this.notify();
    showToast(`Saved "${preset.name}" mix`);
  }

  promptSavePreset(): void {
    const name = prompt('Name this preset (e.g. "Late Night"):');
    if (name && name.trim()) {
      this.savePreset(name.trim());
    }
  }

  loadPreset(preset: SoundPreset): void {
    // Re-validate even though getSoundPresets() already did: a caller can
    // pass a hand-built object. Engine setters clamp again.
    const safe = normalizePreset(preset, TRACK_IDS);
    if (!safe) return;
    Sound.setMasterVolume(safe.master);
    Sound.SOUNDS.forEach((s) => {
      const vol = safe.tracks[s.id];
      if (vol !== undefined) Sound.setTrackVolume(s.id, vol);
    });
    this.notify();
    showToast(`Loaded "${safe.name}"`);
  }

  deletePreset(name: string): void {
    const presets = this.getSoundPresets().filter((pr) => pr.name !== name);
    safeSet(PRESETS_KEY, serializePresets(presets));
    this.notify();
  }

  captureCurrentMix(): MixScene {
    const tracks: Record<string, number> = {};
    Sound.SOUNDS.forEach((s) => {
      if (Sound.isPlaying(s.id)) tracks[s.id] = Sound.getTrackVolume(s.id);
    });
    return { tracks };
  }

  saveScene(key: "focus" | "break"): void {
    const scene = this.captureCurrentMix();
    if (Object.keys(scene.tracks).length === 0) {
      showToast("Play a mix first, then save it as a scene");
      return;
    }
    safeSet(`sc_scene_${key}`, serializeScene(scene));
    showToast(
      `Saved current mix as ${key === "focus" ? "Focus" : "Break"} scene`,
    );
  }

  getScene(key: "focus" | "break"): MixScene | null {
    return parseScene(safeGet(`sc_scene_${key}`), TRACK_IDS);
  }

  crossfadeToScene(key: "focus" | "break"): void {
    if (safeGet("sc_mixer_autofade") !== "1") return;
    const scene = this.getScene(key);
    if (!scene) return;
    // Pass the validated target map straight to the engine. Setting live
    // gains first would make the crossfade start from the target and remove
    // the ramp. An empty map is a valid silence scene: it fades all out.
    Sound.crossfadeTo(scene.tracks, 2500);
  }

  setAutoCrossfade(enabled: boolean): void {
    safeSet("sc_mixer_autofade", enabled ? "1" : "0");
    this.notify();
  }

  getMasterVolume(): number {
    return Math.round(Sound.getMasterVolume() * 100);
  }

  setMasterVolume(pct: number): void {
    const clamped = Math.max(0, Math.min(200, pct));
    Sound.setMasterVolume(clamped / 100);
    this.notify();
  }

  getFade(): number {
    // Single source of truth: the engine owns the persisted value.
    return Sound.getFade();
  }

  setFade(minutes: number): void {
    Sound.setFade(clampFadeMinutes(minutes));
    this.notify();
  }

  toggleTrack(id: string): void {
    if (!Sound.toggleTrack(id)) {
      showToast("Audio isn't available in this browser");
    }
    this.notify();
  }

  setTrackVolume(id: string, pct: number): void {
    const clamped = Math.max(0, Math.min(200, pct));
    Sound.setTrackVolume(id, clamped / 100);
    this.notify();
  }

  toggleBinaural(id: string): void {
    if (!Sound.toggleBinaural(id)) {
      showToast("Audio isn't available in this browser");
    }
    this.notify();
  }

  startMeter(): void {
    cancelAnimationFrame(this.mixerMeterRaf);
    const fill = document.getElementById("mixerVuFill");
    if (!fill) return;
    const tick = () => {
      const lvl = Sound.getAudioLevel(); // 0..1
      const pct = Math.min(100, Math.pow(lvl, 0.6) * 130);
      fill.style.width = pct.toFixed(1) + "%";
      fill.classList.toggle("hot", pct > 85);
      this.mixerMeterRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  stopMeter(): void {
    cancelAnimationFrame(this.mixerMeterRaf);
  }

  closeModal(): void {
    const modals = (window as unknown as { SC?: { modals?: { close?: (id: string) => void } } })
      .SC?.modals;
    if (modals?.close) {
      modals.close("soundOverlay");
    } else {
      const overlay = document.getElementById("soundOverlay");
      if (overlay) {
        overlay.classList.remove("open");
      }
    }
  }

  getSnapshot(): SoundMixerSnapshot {
    const audioOk = Sound.isAudioAvailable();
    const tracks: SoundTrackState[] = Sound.SOUNDS.map((s) => {
      const vol = Math.round(Sound.getTrackVolume(s.id) * 100);
      let unavailable = false;
      let unavailableTitle = "";
      if (!audioOk) {
        unavailable = true;
        unavailableTitle = "Audio isn't available in this browser";
      } else if (!Sound.isFileTrackSupported(s.id)) {
        unavailable = true;
        unavailableTitle =
          "Needs a browser with Opus audio support (Safari 17+, or current Chrome/Firefox/Edge)";
      }
      return {
        id: s.id,
        name: s.name,
        icon: s.icon,
        desc: s.desc ?? "",
        accent: Sound.SOUND_ACCENT[s.id] || "#8e8e93",
        active: Sound.isPlaying(s.id),
        vol,
        unavailable,
        unavailableTitle,
      };
    });

    const binauralPresets: BinauralTrackState[] = Sound.BINAURAL_PRESETS.map((p) => {
      let unavailable = false;
      let unavailableTitle = "";
      if (!audioOk) {
        unavailable = true;
        unavailableTitle = "Audio isn't available in this browser";
      }
      return {
        id: p.id,
        name: p.name,
        icon: p.icon,
        desc: p.desc,
        accent: "#8e8e93",
        active: Sound.binauralPresetId === p.id,
        unavailable,
        unavailableTitle,
      };
    });

    return {
      tracks,
      binauralPresets,
      presets: this.getSoundPresets(),
      masterVol: this.getMasterVolume(),
      fade: this.getFade(),
      nightMode: this.getNightMode(),
      nightActive: this.isNightActive(),
      autoCrossfade: safeGet("sc_mixer_autofade") === "1",
    };
  }

  async mount(target?: HTMLElement): Promise<void> {
    const el = target || document.getElementById("soundOverlay");
    if (!el) return;
    if (this.appInstance) {
      unmount(this.appInstance);
      this.appInstance = null;
    }
    el.innerHTML = "";
    const { default: SoundMixerDialog } = await import(
      "../modals/SoundMixerDialog.svelte"
    );
    this.appInstance = mount(SoundMixerDialog, {
      target: el,
    });
  }
}

export const soundMixerController = new SoundMixerController();
