// ── Command Registry ──────────────────────────────────────────────────
// Defines commands for both Palette (palette.ts) and Cmd (cmdpalette.ts).
// Keeps definitions declarative and independent of DOM construction.

import * as Palette from "../../palette";
import * as Cmd from "../../cmdpalette";
import { THEMES, THEME_BY_ID } from "../../themes";
import type { Theme } from "../../types";
import { LOGOS } from "../themes/theme-logos";
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

function registerPaletteCommands(ctx: CommandRegistryContext) {
  const cmds: Palette.PaletteCommand[] = [];

  cmds.push(
    {
      id: "start",
      icon: "▶",
      label: "Start Session",
      hint: "Space",
      group: "Session",
      action: () => {
        if (!ctx.sessionRunning()) ctx.startSession();
      },
    },
    {
      id: "pause",
      icon: "⏸",
      label: "Pause Session",
      hint: "Space",
      group: "Session",
      action: () => {
        if (ctx.sessionRunning()) ctx.pauseSession();
      },
    },
    {
      id: "reset",
      icon: "↺",
      label: "Reset Timer",
      hint: "R",
      group: "Session",
      action: () => ctx.resetSession(),
    },
    {
      id: "pom",
      icon: "🍅",
      label: "Toggle Pomodoro",
      hint: "P",
      group: "Session",
      action: () => ctx.togglePomodoro(),
    },
    {
      id: "animedoro",
      icon: "🎬",
      label: "Start Animedoro",
      group: "Session",
      action: () => {
        ctx.startAnimedoro();
        ctx.openModal("pomOverlay");
      },
    },
    {
      id: "pomsettings",
      icon: "⚙️",
      label: "Pomodoro Settings",
      group: "Session",
      action: () => ctx.openModal("pomOverlay"),
    },
  );

  // Themes
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

  // Sound mixer
  cmds.push({
    id: "mixer",
    icon: "🎛️",
    label: "Open Sound Mixer",
    hint: "M",
    group: "Sound",
    action: () => ctx.openModal("soundOverlay"),
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

  // Settings tabs
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

  // Tools & Modals
  cmds.push(
    {
      id: "theme-builder",
      icon: "✨",
      label: "Custom Theme Builder",
      hint: "G",
      group: "Tools",
      action: () => ctx.openThemeBuilder(),
    },
    {
      id: "qr-handoff",
      icon: "📱",
      label: "QR Handoff to Mobile",
      group: "Tools",
      action: () => ctx.openQRHandoff(),
    },
    {
      id: "data-management",
      icon: "💾",
      label: "View & Manage Stored Data",
      group: "Settings",
      action: () => ctx.openDataPanel(),
    },
    {
      id: "privacy-policy",
      icon: "📄",
      label: "Privacy Policy",
      group: "Legal",
      action: () => ctx.openLegalPanel("privacy"),
    },
    {
      id: "terms",
      icon: "📜",
      label: "Terms of Service",
      group: "Legal",
      action: () => ctx.openLegalPanel("terms"),
    },
    {
      id: "language",
      icon: "🌐",
      label: "Change UI Language",
      group: "Settings",
      action: () => ctx.openLanguageModal(),
    },
    {
      id: "shortcuts",
      icon: "⌨️",
      label: "Keyboard Shortcuts",
      hint: "?",
      group: "Tools",
      action: () => ctx.openModal("kbOverlay"),
    },
    {
      id: "zen",
      icon: "🧘",
      label: "Toggle Zen Mode",
      hint: "Z",
      group: "Modes",
      action: () => ctx.toggleZen(),
    },
    {
      id: "kiosk",
      icon: "🖥️",
      label: "Toggle Fullscreen / Kiosk",
      hint: "F",
      group: "Modes",
      action: () => ctx.toggleKiosk(),
    },
    {
      id: "privacy-mode",
      icon: "🛡️",
      label: "Toggle Privacy Mode",
      group: "Settings",
      action: () => ctx.togglePrivacy(),
    },
    {
      id: "integrations",
      icon: "🔗",
      label: "Integrations (Spotify, Notion, etc.)",
      group: "Settings",
      action: () => ctx.openIntegrations(),
    },
  );

  Palette.registerCommands(cmds);
}

function registerCmdPaletteItems(ctx: CommandRegistryContext) {
  const items: Cmd.CmdItem[] = [];

  // Themes
  THEMES.forEach((t) => {
    items.push({
      id: `theme:${t.id}`,
      name: t.name,
      desc: t.tagline ?? t.sub ?? "",
      icon: ctx.logos[t.id] ?? "",
      tag: "theme",
      keywords:
        t.cat + " " + (t.sub ?? "") + " " + (t.quotes?.join(" ") ?? ""),
      action: () => ctx.applyTheme(t),
    });
  });

  // Easter eggs
  const eggs: {
    id: string;
    name: string;
    desc: string;
    icon: string;
    keywords?: string;
    action: () => void;
  }[] = [
    {
      id: "konami",
      name: "Konami Code — 8-BIT Mode",
      icon: "👾",
      desc: "Press ↑↑↓↓←→←→BA on keyboard → unlocks retro 8-bit theme with chiptune",
      keywords: "konami 8bit pixel retro chiptune",
      action: () => {
        if (THEME_BY_ID["8bit"]) ctx.applyTheme(THEME_BY_ID["8bit"]);
        ctx.showToast("👾 8-bit activated! Konami Code again to exit.");
        Sound.playChime();
      },
    },
    {
      id: "matrix-rain",
      name: "Matrix Rain",
      icon: "💊",
      desc: 'Type "matrix" anywhere → green rain cascade fills the screen for 5 seconds',
      keywords: "matrix green rain cascade neo",
      action: () => Easter.triggerMatrixRain(),
    },
    {
      id: "inception-spin",
      name: "Inception Dream Spin",
      icon: "🌀",
      desc: 'Type "inception" → the entire UI spins 360°',
      keywords: "inception spin dream rotate totem",
      action: () => {
        document.body.style.transition =
          "transform 1.2s cubic-bezier(.65,0,.35,1)";
        document.body.style.transform = "rotate(360deg)";
        setTimeout(() => {
          document.body.style.transform = "";
          setTimeout(() => (document.body.style.transition = ""), 1500);
        }, 1300);
      },
    },
    {
      id: "synthwave-sunset",
      name: "Synthwave Sunset Drift",
      icon: "🌅",
      desc: 'Type "sunset" → switches to Outrun with warm dusk ambient drone',
      keywords: "sunset synthwave outrun dusk drift",
      action: () => {
        if (THEME_BY_ID["synthwave"]) ctx.applyTheme(THEME_BY_ID["synthwave"]);
        ctx.showToast("🌅 Cruising into the sunset");
      },
    },
    {
      id: "cyberpunk-glitch",
      name: "Cyberpunk Glitch",
      icon: "⚡",
      desc: 'Type "glitch" → chromatic aberration screen burst',
      keywords: "glitch cyberpunk chromatic aberration neo",
      action: () => {
        document.body.classList.add("tenet-reverse");
        setTimeout(() => document.body.classList.remove("tenet-reverse"), 800);
      },
    },
    {
      id: "coffee-break",
      name: "Coffee Shop Immersion",
      icon: "☕",
      desc: 'Type "coffee" → switches to Cafe theme with coffee shop chatter + rain ambience',
      keywords: "coffee cafe shop chatter rain immersion",
      action: () => {
        if (THEME_BY_ID["cafe"]) ctx.applyTheme(THEME_BY_ID["cafe"]);
        Sound.toggleTrack("coffee");
        ctx.showToast("☕ Coffee shop ambience loaded");
      },
    },
    {
      id: "lofi-beats",
      name: "Lo-Fi Beats Session",
      icon: "🎧",
      desc: 'Type "lofi" → switches to Lo-Fi Beat theme with vinyl crackle + 10Hz alpha binaural',
      keywords: "lofi beats vinyl crackle alpha binaural study",
      action: () => {
        if (THEME_BY_ID["lofi"]) ctx.applyTheme(THEME_BY_ID["lofi"]);
        Sound.toggleTrack("vinyl");
        Sound.playBinaural("alpha");
        ctx.showToast("🎧 Lo-Fi study session ready");
      },
    },
    {
      id: "aurora-borealis",
      name: "Northern Lights",
      icon: "🌌",
      desc: 'Type "aurora" → switches to Aurora theme with night forest ambience',
      keywords: "aurora borealis northern lights night forest",
      action: () => {
        if (THEME_BY_ID["aurora"]) ctx.applyTheme(THEME_BY_ID["aurora"]);
        Sound.toggleTrack("forest");
        ctx.showToast("🌌 Northern lights above");
      },
    },
    {
      id: "deep-space",
      name: "Deep Space Void",
      icon: "🚀",
      desc: 'Type "space" → switches to Deep Field theme with cosmic deep binaural waves',
      keywords: "space deep field cosmic void delta binaural",
      action: () => {
        if (THEME_BY_ID["space"]) ctx.applyTheme(THEME_BY_ID["space"]);
        Sound.playBinaural("delta");
        ctx.showToast("🚀 Entering deep space");
      },
    },
    {
      id: "deep-focus",
      name: "Super Focus Protocol",
      icon: "🎯",
      desc: 'Type "focus" → enters Zen mode, starts 50m session, plays brown noise + gamma waves',
      keywords: "focus super protocol zen brown noise gamma flow",
      action: () => {
        ctx.toggleZen();
        Sound.toggleTrack("brown");
        Sound.playBinaural("gamma");
        ctx.showToast("🎯 Super focus protocol engaged");
      },
    },
    {
      id: "vaporwave-mall",
      name: "Vaporwave Mall",
      icon: "🌴",
      desc: 'Type "vapor" → switches to Vaporwave theme with tape hiss',
      keywords: "vapor vaporwave mall tape hiss arizona iced tea",
      action: () => {
        if (THEME_BY_ID["vaporwave"]) ctx.applyTheme(THEME_BY_ID["vaporwave"]);
        ctx.showToast("🌴 Ａ Ｅ Ｓ Ｔ Ｈ Ｅ Ｔ Ｉ Ｃ");
      },
    },
    {
      id: "midnight-coder",
      name: "Midnight Coder",
      icon: "💻",
      desc: 'Type "midnight" → switches to Terminal theme with mechanical keys + rain',
      keywords: "midnight coder terminal mechanical keys rain hacker",
      action: () => {
        if (THEME_BY_ID["terminal"]) ctx.applyTheme(THEME_BY_ID["terminal"]);
        Sound.toggleTrack("rain");
        ctx.showToast("💻 Midnight hacking mode");
      },
    },
    {
      id: "cabin-snow",
      name: "Winter Cabin",
      icon: "❄️",
      desc: 'Type "snow" → switches to Snowy theme with fireplace + wind ambience',
      keywords: "snow winter cabin fireplace wind cozy",
      action: () => {
        if (THEME_BY_ID["snow"]) ctx.applyTheme(THEME_BY_ID["snow"]);
        Sound.toggleTrack("fire");
        Sound.toggleTrack("wind");
        ctx.showToast("❄️ Cozy cabin session");
      },
    },
    {
      id: "zen-garden",
      name: "Zen Garden",
      icon: "🎋",
      desc: 'Type "garden" → switches to Bonsai theme with stream water + birds ambience',
      keywords: "garden zen bonsai stream water birds peace",
      action: () => {
        if (THEME_BY_ID["bonsai"]) ctx.applyTheme(THEME_BY_ID["bonsai"]);
        Sound.toggleTrack("stream");
        Sound.toggleTrack("birds");
        ctx.showToast("🎋 Peace in the garden");
      },
    },
    {
      id: "rainy-study",
      name: "Rainy Afternoon Study",
      icon: "🌧️",
      desc: 'Type "rainy" → switches to Rainy Window theme with heavy rain + thunder',
      keywords: "rainy study afternoon window heavy thunder",
      action: () => {
        if (THEME_BY_ID["rain"]) ctx.applyTheme(THEME_BY_ID["rain"]);
        Sound.toggleTrack("rain");
        Sound.toggleTrack("thunder");
        ctx.showToast("🌧️ Rain on the window");
      },
    },
    {
      id: "power-nap",
      name: "20-Min Power Nap",
      icon: "💤",
      desc: 'Type "nap" → sets 20-min timer with delta sleep waves, darkens screen',
      keywords: "nap power sleep delta rest recharge",
      action: () => {
        Sound.playBinaural("delta");
        ctx.showToast("💤 20-min power nap initiated");
      },
    },
  ];

  eggs.forEach((egg) => {
    items.push({
      id: `egg:${egg.id}`,
      name: egg.name,
      desc: egg.desc,
      icon: egg.icon,
      tag: "egg",
      keywords: egg.keywords,
      action: egg.action,
    });
  });

  // Actions
  const actions: [string, string, string, string, () => void][] = [
    [
      "start",
      "▶",
      "Start Session Timer",
      "Begin tracking focus time (Space)",
      () => ctx.startSession(),
    ],
    [
      "pause",
      "⏸",
      "Pause Session Timer",
      "Temporarily pause the timer (Space)",
      () => ctx.pauseSession(),
    ],
    [
      "reset",
      "↺",
      "Reset Session Timer",
      "Zero the timer and session count (R)",
      () => ctx.resetSession(),
    ],
    [
      "pom-toggle",
      "🍅",
      "Toggle Pomodoro Mode",
      "Switch between stopwatch & interval timer (P)",
      () => ctx.togglePomodoro(),
    ],
    [
      "zen-toggle",
      "🧘",
      "Zen Mode",
      "Distraction-free study with breathing rings (Z)",
      () => ctx.toggleZen(),
    ],
    [
      "fullscreen",
      "🖥️",
      "Fullscreen / Kiosk Mode",
      "Hide browser chrome and maximize (F)",
      () => ctx.toggleKiosk(),
    ],
    [
      "sound-mixer",
      "🎛️",
      "Open Sound Mixer",
      "Blend 12 ambient sounds + binaural beats (M)",
      () => ctx.openModal("soundOverlay"),
    ],
    [
      "theme-builder",
      "✨",
      "Custom Theme Builder",
      "Create, preview and save your own themes (G)",
      () => ctx.openThemeBuilder(),
    ],
    [
      "shortcuts",
      "⌨️",
      "Keyboard Shortcuts",
      "View all hotkeys (?)",
      () => ctx.openModal("kbOverlay"),
    ],
    [
      "settings-gen",
      "⚙️",
      "Settings: General",
      "Time format, position, weather, auto-start",
      () => ctx.openSettings("general"),
    ],
    [
      "settings-sound",
      "🔊",
      "Settings: Sound",
      "Default mix, crossfade, spatial audio",
      () => ctx.openSettings("sound"),
    ],
    [
      "settings-focus",
      "🎯",
      "Settings: Focus",
      "Pomodoro intervals, focus lock delay, breaks",
      () => ctx.openSettings("focus"),
    ],
    [
      "settings-display",
      "🖥️",
      "Settings: Display",
      "Clock face, calm mode, scanlines, blur, grain",
      () => ctx.openSettings("display"),
    ],
    [
      "settings-privacy",
      "🛡️",
      "Settings: Privacy & Data",
      "Export data, incognito sessions, auto-clear",
      () => ctx.openSettings("privacy"),
    ],
    [
      "handoff",
      "📱",
      "QR Handoff to Mobile",
      "Continue current session on phone or tablet",
      () => ctx.openQRHandoff(),
    ],
    [
      "privacy-toggle",
      "🛡️",
      "Toggle Privacy Mode",
      "Disable weather, sync & fonts",
      () => ctx.togglePrivacy(),
    ],
    [
      "language",
      "🌐",
      "Language",
      "Change UI language (8 languages)",
      () => ctx.openLanguageModal(),
    ],
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
