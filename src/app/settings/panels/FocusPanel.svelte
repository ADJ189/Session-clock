<script lang="ts">
  import SettingsSection from "../../shared/SettingsSection.svelte";
  import SettingsRow from "../../shared/SettingsRow.svelte";

  export interface SoundOption {
    id: string;
    name: string;
    icon: string;
  }

  let {
    focusLock = false,
    smartBreak = true,
    breakReminderMins = 90,
    idleDetect = false,
    zenSound = "",
    zenDimDelay = "2500",
    zenRings = true,
    availableSounds = [],
    ontoggleFocusLock,
    ontoggleSmartBreak,
    onchangeBreakReminderMins,
    ontoggleIdleDetect,
    onchangeZenSound,
    onchangeZenDimDelay,
    ontoggleZenRings,
    onopenpomodoro,
  }: {
    focusLock?: boolean;
    smartBreak?: boolean;
    breakReminderMins?: number;
    idleDetect?: boolean;
    zenSound?: string;
    zenDimDelay?: string;
    zenRings?: boolean;
    availableSounds?: SoundOption[];
    ontoggleFocusLock: (val: boolean) => void;
    ontoggleSmartBreak: (val: boolean) => void;
    onchangeBreakReminderMins: (mins: number) => void;
    ontoggleIdleDetect: (val: boolean) => void;
    onchangeZenSound: (soundId: string) => void;
    onchangeZenDimDelay: (delay: string) => void;
    ontoggleZenRings: (val: boolean) => void;
    onopenpomodoro: () => void;
  } = $props();

  const REMINDER_OPTIONS = [30, 45, 60, 90, 120];
  const ZEN_DELAY_OPTIONS = [
    { value: "1500", label: "Fast · 1.5s" },
    { value: "2500", label: "Normal · 2.5s" },
    { value: "4000", label: "Slow · 4s" },
  ];
</script>

<SettingsSection title="Pomodoro & Sessions">
  <SettingsRow
    label="Focus Lock Delay"
    description="3-second intentional friction before opening panels during Pomodoro"
    btnId="toggleFocusLockS"
    checked={focusLock}
    onchange={ontoggleFocusLock}
  />
  <SettingsRow
    label="Smart Break Reminder"
    description="Nudges you with a toast + notification during long, non-Pomodoro sessions"
    btnId="toggleSmartBreak"
    checked={smartBreak}
    onchange={ontoggleSmartBreak}
  />
  <div class="settings-row">
    <div class="settings-row-info">
      <div class="settings-row-top">
        <span class="settings-row-label">Remind me after</span>
      </div>
    </div>
    <select
      class="settings-select"
      aria-label="Remind me after"
      value={String(breakReminderMins)}
      onchange={(e) => onchangeBreakReminderMins(Number.parseInt(e.currentTarget.value, 10))}
    >
      {#each REMINDER_OPTIONS as m}
        <option value={String(m)}>{m} min</option>
      {/each}
    </select>
  </div>
  <SettingsRow
    label="Idle Nudge"
    description={'After 15 min with no input, a gentle "still there?" toast — never pauses or alters your timer'}
    btnId="toggleIdleDetect"
    checked={idleDetect}
    onchange={ontoggleIdleDetect}
  />
</SettingsSection>

<SettingsSection title="Zen Mode">
  <div class="settings-row">
    <div class="settings-row-info">
      <div class="settings-row-top">
        <span class="settings-row-label">Ambient Sound</span>
      </div>
      <span class="settings-row-desc">
        Auto-plays when you enter Zen Mode, stops when you leave — only if nothing is already playing.
      </span>
    </div>
    <select
      class="settings-select"
      aria-label="Zen Mode ambient sound"
      value={zenSound}
      onchange={(e) => onchangeZenSound(e.currentTarget.value)}
    >
      <option value="">None</option>
      {#each availableSounds as s}
        <option value={s.id}>{s.icon} {s.name}</option>
      {/each}
    </select>
  </div>

  <div class="settings-row">
    <div class="settings-row-info">
      <div class="settings-row-top">
        <span class="settings-row-label">Cursor Auto-Hide</span>
      </div>
      <span class="settings-row-desc">
        How long the cursor and a faint exit hint stay visible after you stop moving the mouse.
      </span>
    </div>
    <select
      class="settings-select"
      aria-label="Zen Mode cursor auto-hide delay"
      value={zenDimDelay}
      onchange={(e) => onchangeZenDimDelay(e.currentTarget.value)}
    >
      {#each ZEN_DELAY_OPTIONS as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>

  <SettingsRow
    label="Breathing Rings"
    description="The slow pulsing rings around the clock while in Zen Mode"
    btnId="toggleZenRings"
    checked={zenRings}
    onchange={ontoggleZenRings}
  />
</SettingsSection>

<SettingsSection title="Timer">
  <button
    type="button"
    class="settings-action-btn settings-action-btn--full"
    onclick={onopenpomodoro}
  >
    ⏱ Pomodoro Settings
  </button>
</SettingsSection>
