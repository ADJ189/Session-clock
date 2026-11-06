// ── Command Registry ──────────────────────────────────────────────────
// Defines commands for both Palette (palette.ts) and Cmd (cmdpalette.ts).
// Keeps definitions declarative and independent of DOM construction.

import * as Palette from "../../palette";
import * as Cmd from "../../cmdpalette";
import { THEMES, THEME_BY_ID } from "../../themes";
import type { Theme } from "../../types";
import * as Sound from "../../sound";
import * as Easter from "../../easter";

export interface CommandRegistryContext {
  sessionRunning: () => boolean;
  startSession: () => void;
  pauseSession: () => void;
  resetSession: () => void;
  togglePomodoro: () => void;
  startAnimedoro: () => void;
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
  openSettings: (tab?: string) => void;
  openThemeBuilder: () => void;
  openQRHandoff: () => void;
  openDataPanel: () => void;
  openLegalPanel: (doc: "privacy" | "terms") => void;
  openLanguageModal: () => void;
  openIntegrations: () => void;
  applyTheme: (theme: Theme, skipTransition?: boolean) => void;
  setClockMode: (mode: any) => void;
  applyClockPosition: (pos: "top" | "center") => void;
  toggleKiosk: () => void;
  togglePresent: () => void;
  toggleZen: () => void;
  togglePrivacy: () => void;
  showToast: (msg: string, dur?: number) => void;
  logos: Record<string, string>;
}

export function registerAllCommands(ctx: CommandRegistryContext) {
  registerPaletteCommands(ctx);
  registerCmdPaletteItems(ctx);
}

type PaletteTuple = [
  id: string,
  icon: string,
  label: string,
  group: string,
  hint?: string,
  action?: () => void,
];

function registerPaletteCommands(ctx: CommandRegistryContext) {
  const cmds: Palette.PaletteCommand[] = [];

  const staticCmds: PaletteTuple[] = [
    ["start", "▶", "Start Session", "Session", "Space", () => { if (!ctx.sessionRunning()) ctx.startSession(); }],
    ["pause", "⏸", "Pause Session", "Session", "Space", () => { if (ctx.sessionRunning()) ctx.pauseSession(); }],
    ["reset", "↺", "Reset Timer", "Session", "R", () => ctx.resetSession()],
    ["pom", "🍅", "Toggle Pomodoro", "Session", "P", () => ctx.togglePomodoro()],
    ["animedoro", "🎬", "Start Animedoro", "Session", undefined, () => { ctx.startAnimedoro(); ctx.openModal("pomOverlay"); }],
    ["pomsettings", "⚙️", "Pomodoro Settings", "Session", undefined, () => ctx.openModal("pomOverlay")],
    ["mixer", "🎛️", "Open Sound Mixer", "Sound", "M", () => ctx.openModal("soundOverlay")],
    ["theme-builder", "✨", "Custom Theme Builder", "Tools", "G", () => ctx.openThemeBuilder()],
    ["qr-handoff", "📱", "QR Handoff to Mobile", "Tools", undefined, () => ctx.openQRHandoff()],
    ["data-management", "💾", "View & Manage Stored Data", "Settings", undefined, () => ctx.openDataPanel()],
    ["privacy-policy", "📄", "Privacy Policy", "Legal", undefined, () => ctx.openLegalPanel("privacy")],
    ["terms", "📜", "Terms of Service", "Legal", undefined, () => ctx.openLegalPanel("terms")],
    ["language", "🌐", "Change UI Language", "Settings", undefined, () => ctx.openLanguageModal()],
    ["shortcuts", "⌨️", "Keyboard Shortcuts", "Tools", "?", () => ctx.openModal("kbOverlay")],
    ["zen", "🧘", "Toggle Zen Mode", "Modes", "Z", () => ctx.toggleZen()],
    ["kiosk", "🖥️", "Toggle Fullscreen / Kiosk", "Modes", "F", () => ctx.toggleKiosk()],
    ["privacy-mode", "🛡️", "Toggle Privacy Mode", "Settings", undefined, () => ctx.togglePrivacy()],
    ["integrations", "🔗", "Integrations (Spotify, Notion, etc.)", "Settings", undefined, () => ctx.openIntegrations()],
  ];

  staticCmds.forEach(([id, icon, label, group, hint, action]) => {
    cmds.push({ id, icon, label, group, hint, action: action! });
  });

  THEMES.forEach((t) => {
    cmds.push({
      id: `theme:${t.id}`,
      icon: "🎨",
      label: t.name,
      hint: t.tagline ?? t.sub ?? "",
      group: "Themes",
      keywords: [t.cat, t.sub ?? "", ...(t.quotes ?? [])].filter(Boolean),
      action: () => ctx.applyTheme(t),
    });
  });

  Sound.SOUNDS.forEach((s) => {
    cmds.push({
      id: `sound:${s.id}`,
      icon: s.icon,
      label: `Sound: ${s.name}`,
      group: "Sound",
      action: () => Sound.toggleTrack(s.id),
    });
  });

  Sound.BINAURAL_PRESETS.forEach((p) => {
    cmds.push({
      id: `binaural:${p.id}`,
      icon: "🧠",
      label: `Binaural: ${p.name}`,
      hint: `${p.beat} Hz (${p.carrier} Hz carrier)`,
      group: "Sound",
      action: () => Sound.playBinaural(p.id),
    });
  });

  (["general", "sound", "focus", "display", "privacy"] as const).forEach(
    (tab) => {
      cmds.push({
        id: `settings:${tab}`,
        icon: "⚙️",
        label: `Settings → ${tab.charAt(0).toUpperCase() + tab.slice(1)}`,
        group: "Settings",
        action: () => ctx.openSettings(tab),
      });
    },
  );

  Palette.registerCommands(cmds);
}

type EggTuple = [
  id: string,
  icon: string,
  name: string,
  desc: string,
  keywords: string,
  theme?: string,
  tracks?: string[],
  binaural?: string,
  toast?: string,
  custom?: () => void,
];

function registerCmdPaletteItems(ctx: CommandRegistryContext) {
  const items: Cmd.CmdItem[] = [];

  THEMES.forEach((t) => {
    items.push({
      id: `theme:${t.id}`,
      name: t.name,
      desc: t.tagline ?? t.sub ?? "",
      icon: ctx.logos[t.id] ?? "",
      tag: "theme",
      keywords: `${t.cat} ${t.sub ?? ""} ${t.quotes?.join(" ") ?? ""}`,
      action: () => ctx.applyTheme(t),
    });
  });

  const eggs: EggTuple[] = [
    [
      "konami", "👾", "Konami Code — 8-BIT Mode",
      "Press ↑↑↓↓←→←→BA on keyboard → unlocks retro 8-bit theme with chiptune",
      "konami 8bit pixel retro chiptune",
      undefined, undefined, undefined, undefined,
      () => {
        if (THEME_BY_ID["8bit"]) ctx.applyTheme(THEME_BY_ID["8bit"]);
        ctx.showToast("👾 8-bit activated! Konami Code again to exit.");
        Sound.playChime();
      },
    ],
    [
      "matrix-rain", "💊", "Matrix Rain",
      'Type "matrix" anywhere → green rain cascade fills the screen for 5 seconds',
      "matrix green rain cascade neo",
      undefined, undefined, undefined, undefined,
      () => Easter.triggerMatrixRain(),
    ],
    [
      "inception-spin", "🌀", "Inception Dream Spin",
      'Type "inception" → the entire UI spins 360°',
      "inception spin dream rotate totem",
      undefined, undefined, undefined, undefined,
      () => {
        document.body.style.transition = "transform 1.2s cubic-bezier(.65,0,.35,1)";
        document.body.style.transform = "rotate(360deg)";
        setTimeout(() => {
          document.body.style.transform = "";
          setTimeout(() => (document.body.style.transition = ""), 1500);
        }, 1300);
      },
    ],
    ["synthwave-sunset", "🌅", "Synthwave Sunset Drift", 'Type "sunset" → switches to Outrun with warm dusk ambient drone', "sunset synthwave outrun dusk drift", "synthwave", undefined, undefined, "🌅 Cruising into the sunset"],
    [
      "cyberpunk-glitch", "⚡", "Cyberpunk Glitch",
      'Type "glitch" → chromatic aberration screen burst',
      "glitch cyberpunk chromatic aberration neo",
      undefined, undefined, undefined, undefined,
      () => {
        document.body.classList.add("tenet-reverse");
        setTimeout(() => document.body.classList.remove("tenet-reverse"), 800);
      },
    ],
    ["coffee-break", "☕", "Coffee Shop Immersion", 'Type "coffee" → switches to Cafe theme with coffee shop chatter + rain ambience', "coffee cafe shop chatter rain immersion", "cafe", ["coffee"], undefined, "☕ Coffee shop ambience loaded"],
    ["lofi-beats", "🎧", "Lo-Fi Beats Session", 'Type "lofi" → switches to Lo-Fi Beat theme with vinyl crackle + 10Hz alpha binaural', "lofi beats vinyl crackle alpha binaural study", "lofi", ["vinyl"], "alpha", "🎧 Lo-Fi study session ready"],
    ["aurora-borealis", "🌌", "Northern Lights", 'Type "aurora" → switches to Aurora theme with night forest ambience', "aurora borealis northern lights night forest", "aurora", ["forest"], undefined, "🌌 Northern lights above"],
    ["deep-space", "🚀", "Deep Space Void", 'Type "space" → switches to Deep Field theme with cosmic deep binaural waves', "space deep field cosmic void delta binaural", "space", undefined, "delta", "🚀 Entering deep space"],
    [
      "deep-focus", "🎯", "Super Focus Protocol",
      'Type "focus" → enters Zen mode, starts 50m session, plays brown noise + gamma waves',
      "focus super protocol zen brown noise gamma flow",
      undefined, undefined, undefined, undefined,
      () => {
        ctx.toggleZen();
        Sound.toggleTrack("brown");
        Sound.playBinaural("gamma");
        ctx.showToast("🎯 Super focus protocol engaged");
      },
    ],
    ["vaporwave-mall", "🌴", "Vaporwave Mall", 'Type "vapor" → switches to Vaporwave theme with tape hiss', "vapor vaporwave mall tape hiss arizona iced tea", "vaporwave", undefined, undefined, "🌴 Ａ Ｅ Ｓ Ｔ Ｈ Ｅ Ｔ Ｉ Ｃ"],
    ["midnight-coder", "💻", "Midnight Coder", 'Type "midnight" → switches to Terminal theme with mechanical keys + rain', "midnight coder terminal mechanical keys rain hacker", "terminal", ["rain"], undefined, "💻 Midnight hacking mode"],
    ["cabin-snow", "❄️", "Winter Cabin", 'Type "snow" → switches to Snowy theme with fireplace + wind ambience', "snow winter cabin fireplace wind cozy", "snow", ["fire", "wind"], undefined, "❄️ Cozy cabin session"],
    ["zen-garden", "🎋", "Zen Garden", 'Type "garden" → switches to Bonsai theme with stream water + birds ambience', "garden zen bonsai stream water birds peace", "bonsai", ["stream", "birds"], undefined, "🎋 Peace in the garden"],
    ["rainy-study", "🌧️", "Rainy Afternoon Study", 'Type "rainy" → switches to Rainy Window theme with heavy rain + thunder', "rainy study afternoon window heavy thunder", "rain", ["rain", "thunder"], undefined, "🌧️ Rain on the window"],
    ["power-nap", "💤", "20-Min Power Nap", 'Type "nap" → sets 20-min timer with delta sleep waves, darkens screen', "nap power sleep delta rest recharge", undefined, undefined, "delta", "💤 20-min power nap initiated"],
  ];

  eggs.forEach(([id, icon, name, desc, keywords, theme, tracks, binaural, toast, custom]) => {
    items.push({
      id: `egg:${id}`,
      name,
      desc,
      icon,
      tag: "egg",
      keywords,
      action: () => {
        if (custom) {
          custom();
          return;
        }
        if (theme && THEME_BY_ID[theme]) ctx.applyTheme(THEME_BY_ID[theme]);
        tracks?.forEach((t) => Sound.toggleTrack(t));
        if (binaural) Sound.playBinaural(binaural);
        if (toast) ctx.showToast(toast);
      },
    });
  });

  type CmdActionTuple = [id: string, icon: string, name: string, desc: string, action: () => void];
  const actions: CmdActionTuple[] = [
    ["start", "▶", "Start Session Timer", "Begin tracking focus time (Space)", () => ctx.startSession()],
    ["pause", "⏸", "Pause Session Timer", "Temporarily pause the timer (Space)", () => ctx.pauseSession()],
    ["reset", "↺", "Reset Session Timer", "Zero the timer and session count (R)", () => ctx.resetSession()],
    ["pom-toggle", "🍅", "Toggle Pomodoro Mode", "Switch between stopwatch & interval timer (P)", () => ctx.togglePomodoro()],
    ["zen-toggle", "🧘", "Zen Mode", "Distraction-free study with breathing rings (Z)", () => ctx.toggleZen()],
    ["fullscreen", "🖥️", "Fullscreen / Kiosk Mode", "Hide browser chrome and maximize (F)", () => ctx.toggleKiosk()],
    ["sound-mixer", "🎛️", "Open Sound Mixer", "Blend 12 ambient sounds + binaural beats (M)", () => ctx.openModal("soundOverlay")],
    ["theme-builder", "✨", "Custom Theme Builder", "Create, preview and save your own themes (G)", () => ctx.openThemeBuilder()],
    ["shortcuts", "⌨️", "Keyboard Shortcuts", "View all hotkeys (?)", () => ctx.openModal("kbOverlay")],
    ["settings-gen", "⚙️", "Settings: General", "Time format, position, weather, auto-start", () => ctx.openSettings("general")],
    ["settings-sound", "🔊", "Settings: Sound", "Default mix, crossfade, spatial audio", () => ctx.openSettings("sound")],
    ["settings-focus", "🎯", "Settings: Focus", "Pomodoro intervals, focus lock delay, breaks", () => ctx.openSettings("focus")],
    ["settings-display", "🖥️", "Settings: Display", "Clock face, calm mode, scanlines, blur, grain", () => ctx.openSettings("display")],
    ["settings-privacy", "🛡️", "Settings: Privacy & Data", "Export data, incognito sessions, auto-clear", () => ctx.openSettings("privacy")],
    ["handoff", "📱", "QR Handoff to Mobile", "Continue current session on phone or tablet", () => ctx.openQRHandoff()],
    ["privacy-toggle", "🛡️", "Toggle Privacy Mode", "Disable weather, sync & fonts", () => ctx.togglePrivacy()],
    ["language", "🌐", "Language", "Change UI language (8 languages)", () => ctx.openLanguageModal()],
    [
      "random",
      "🎲",
      "Random Theme",
      "Shuffle to a random theme",
      () => {
        const t = THEMES[Math.floor(Math.random() * THEMES.length)]!;
        ctx.applyTheme(t);
      },
    ],
  ];

  actions.forEach(([id, icon, name, desc, action]) => {
    items.push({
      id: `action:${id}`,
      name,
      desc,
      icon,
      tag: "action",
      action,
    });
  });

  Cmd.registerItems(items);
}
