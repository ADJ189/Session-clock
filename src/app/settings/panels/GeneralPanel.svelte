<script lang="ts">
  import SettingsSection from "../../shared/SettingsSection.svelte";

  export interface PresetItem {
    id: string;
    icon: string;
    accent: string;
    label: string;
    blurb: string;
  }

  let {
    activeClockMode = "digital",
    languageLabel = "🌐 English — Change language",
    connectedCount = 0,
    onselectpreset,
    onselectclockmode,
    onquickaction,
    onopenlanguage,
    onopenintegrations,
  }: {
    activeClockMode?: string;
    languageLabel?: string;
    connectedCount?: number;
    onselectpreset: (id: string) => void;
    onselectclockmode: (mode: string) => void;
    onquickaction: (action: string) => void;
    onopenlanguage: () => void;
    onopenintegrations: () => void;
  } = $props();

  const PRESETS: PresetItem[] = [
    {
      id: "student",
      icon: "📚",
      accent: "#bf5af2",
      label: "Student",
      blurb: "25/5 Pomodoro · library ambience · break reminders",
    },
    {
      id: "office",
      icon: "💼",
      accent: "#0a84ff",
      label: "Office Worker",
      blurb: "50/10 sessions · café ambience · fewer nudges",
    },
    {
      id: "deepwork",
      icon: "🌙",
      accent: "#5e5ce6",
      label: "Deep Work",
      blurb: "90/15 long blocks · brown noise · no interruptions",
    },
    {
      id: "minimal",
      icon: "🧘",
      accent: "#8e8e93",
      label: "Minimalist",
      blurb: "25/5 · silent · Calm Mode · nothing else on",
    },
  ];

  const CLOCK_MODES = [
    { mode: "digital", label: "Digital", icon: "🔢", desc: "Classic digits" },
    { mode: "analogue", label: "Analogue", icon: "🕐", desc: "Sweep hands" },
    { mode: "flip", label: "Flip", icon: "📅", desc: "3D card flip" },
    { mode: "word", label: "Word", icon: "📝", desc: "It is half past" },
    { mode: "minimal", label: "Minimal", icon: "○", desc: "Hour only, huge" },
    { mode: "segment", label: "Segment", icon: "📟", desc: "LED 7-segment" },
  ];

  const QUICK_ACTIONS = [
    { id: "custom-theme", label: "🎨 Custom Theme" },
    { id: "qr-handoff", label: "📱 QR Handoff" },
    { id: "animedoro", label: "🎬 Animedoro" },
    { id: "kiosk", label: "⛶ Kiosk Mode" },
    { id: "present", label: "📺 Present" },
    { id: "pip", label: "🖼 Picture-in-Picture" },
  ];
</script>

<SettingsSection title="Presets">
  <p class="settings-hint">
    Bundles Pomodoro timing, ambient sound, and a few Focus/Display settings for a use case. Anything can still be changed individually afterward.
  </p>
  <div class="preset-grid">
    {#each PRESETS as p (p.id)}
      <button
        type="button"
        class="preset-card"
        style="--int-accent: {p.accent}"
        onclick={() => onselectpreset(p.id)}
      >
        <span class="preset-icon icon-tile">{p.icon}</span>
        <span class="preset-label">{p.label}</span>
        <span class="preset-blurb">{p.blurb}</span>
      </button>
    {/each}
  </div>
</SettingsSection>

<SettingsSection title="Clock Style">
  <div class="clock-mode-grid">
    {#each CLOCK_MODES as cm (cm.mode)}
      <button
        type="button"
        class="clock-mode-btn {cm.mode === activeClockMode ? 'active' : ''}"
        data-mode={cm.mode}
        onclick={() => onselectclockmode(cm.mode)}
      >
        <span class="cmb-icon">{cm.icon}</span>
        <span class="cmb-label">{cm.label}</span>
        <span class="cmb-desc">{cm.desc}</span>
      </button>
    {/each}
  </div>
</SettingsSection>

<SettingsSection title="Quick Actions">
  <div class="settings-action-grid">
    {#each QUICK_ACTIONS as qa (qa.id)}
      <button
        type="button"
        class="settings-action-btn"
        onclick={() => onquickaction(qa.id)}
      >
        {qa.label}
      </button>
    {/each}
  </div>
</SettingsSection>

<SettingsSection title="Language">
  <button
    type="button"
    class="settings-action-btn settings-action-btn--full"
    onclick={onopenlanguage}
  >
    {languageLabel}
  </button>
</SettingsSection>

<SettingsSection title="Integrations" beta={true} betaId="betaTagSection">
  <button
    type="button"
    class="settings-action-btn settings-action-btn--full"
    onclick={onopenintegrations}
  >
    {connectedCount > 0
      ? `🔗 ${connectedCount} integration${connectedCount > 1 ? "s" : ""} connected — Manage`
      : "🔗 Connect Spotify, Calendar, Notion, Todoist…"}
  </button>
</SettingsSection>
