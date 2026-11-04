<script lang="ts">
  import SettingsSection from "../../shared/SettingsSection.svelte";
  import SettingsRow from "../../shared/SettingsRow.svelte";

  let {
    clockPos = "center",
    clockMode = "digital",
    centerMinimal = false,
    hideSeconds = false,
    hideMs = false,
    use24Hour = false,
    calmMode = false,
    focusMode = false,
    reduceMotion = false,
    parallax = true,
    haptics = true,
    hapticsAvailable = true,
    fps = 60,
    tier = "high",
    quality = "",
    forceNoBlur = false,
    onchangeClockPos,
    ontoggleCenterMinimal,
    ontoggleHideSeconds,
    ontoggleHideMs,
    ontoggle24Hour,
    ontoggleCalmMode,
    ontoggleFocusMode,
    ontoggleReduceMotion,
    ontoggleParallax,
    ontoggleHaptics,
    onchangeQuality,
    ontoggleForceNoBlur,
    oncopydiagnostics,
  }: {
    clockPos?: "center" | "top";
    clockMode?: string;
    centerMinimal?: boolean;
    hideSeconds?: boolean;
    hideMs?: boolean;
    use24Hour?: boolean;
    calmMode?: boolean;
    focusMode?: boolean;
    reduceMotion?: boolean;
    parallax?: boolean;
    haptics?: boolean;
    hapticsAvailable?: boolean;
    fps?: number;
    tier?: string;
    quality?: string;
    forceNoBlur?: boolean;
    onchangeClockPos: (pos: "center" | "top") => void;
    ontoggleCenterMinimal: (val: boolean) => void;
    ontoggleHideSeconds: (val: boolean) => void;
    ontoggleHideMs: (val: boolean) => void;
    ontoggle24Hour: (val: boolean) => void;
    ontoggleCalmMode: (val: boolean) => void;
    ontoggleFocusMode: (val: boolean) => void;
    ontoggleReduceMotion: (val: boolean) => void;
    ontoggleParallax: (val: boolean) => void;
    ontoggleHaptics: (val: boolean) => void;
    onchangeQuality: (val: string) => void;
    ontoggleForceNoBlur: (val: boolean) => void;
    oncopydiagnostics: () => void;
  } = $props();
</script>

<SettingsSection title="Layout">
  <div class="settings-row">
    <div class="settings-row-info">
      <div class="settings-row-top">
        <span class="settings-row-label">Clock Position</span>
      </div>
      <div class="settings-row-desc">
        Top: classic layout. Centre: full-viewport clock. Applies to the {clockMode} style only.
      </div>
    </div>
    <div class="settings-seg">
      <button
        type="button"
        class="settings-seg-btn {clockPos === 'top' ? 'active' : ''}"
        onclick={() => onchangeClockPos('top')}
      >
        ⊟ Top
      </button>
      <button
        type="button"
        class="settings-seg-btn {clockPos === 'center' ? 'active' : ''}"
        onclick={() => onchangeClockPos('center')}
      >
        ⊞ Centre
      </button>
    </div>
  </div>
  <SettingsRow
    label="Minimal Session Panel"
    description="In Centre mode, shrink the session timer, dock it to the side, and hide the day-progress bar and quote — keeps the clock the focal point"
    btnId="toggleCenterMinimal"
    checked={centerMinimal}
    onchange={ontoggleCenterMinimal}
  />
</SettingsSection>

<SettingsSection title="Digits">
  <SettingsRow
    label="Hide Seconds"
    description="Drop the seconds digits/hand across every clock style — just hours and minutes"
    btnId="toggleHideSeconds"
    checked={hideSeconds}
    onchange={ontoggleHideSeconds}
  />
  <SettingsRow
    label="Hide Milliseconds"
    description="Hide the fractional-second readout under the clock (kept even with seconds shown, unless this is on)"
    btnId="toggleHideMs"
    checked={hideMs}
    onchange={ontoggleHideMs}
  />
  <SettingsRow
    label="24-Hour Time"
    description="Show hours as 00–23 with no AM/PM — applies to Digital, Minimal, Flip and Segment styles"
    btnId="toggle24Hour"
    checked={use24Hour}
    onchange={ontoggle24Hour}
  />
</SettingsSection>

<SettingsSection title="Simplify">
  <SettingsRow
    label="Calm Mode"
    description="One switch for less visual intensity — reduces motion, turns off parallax, and lowers render quality"
    btnId="toggleCalmMode"
    checked={calmMode}
    onchange={ontoggleCalmMode}
  />
  <SettingsRow
    label="Focus Mode"
    description="Fades away buttons and chrome after a few idle seconds; move the mouse to bring them back"
    btnId="toggleFocusModeS"
    checked={focusMode}
    onchange={ontoggleFocusMode}
  />
</SettingsSection>

<SettingsSection title="Motion & Animations">
  <SettingsRow
    label="Reduce Motion"
    description="Simpler transitions, no parallax, no particle animations"
    btnId="toggleReduceMotion"
    checked={reduceMotion}
    onchange={ontoggleReduceMotion}
  />
  <SettingsRow
    label="Parallax Depth"
    description="Canvas layers shift with mouse/gyroscope movement"
    btnId="toggleParallax"
    checked={parallax}
    onchange={ontoggleParallax}
  />
  {#if hapticsAvailable}
    <SettingsRow
      label="Haptic Feedback"
      description="A light tap on buttons, toggles and sliders, plus session start/complete and milestones"
      btnId="toggleHaptics"
      checked={haptics}
      onchange={ontoggleHaptics}
    />
  {/if}
</SettingsSection>

<SettingsSection title="Performance">
  <div class="settings-row">
    <div class="settings-row-info">
      <div class="settings-row-top">
        <span class="settings-row-label">Render Quality</span>
        <span class="settings-badge">{fps} fps</span>
      </div>
      <span class="settings-row-desc">
        {quality ? `Quality: ${tier.toUpperCase()}` : `Auto-detected: ${tier.toUpperCase()}`}
      </span>
    </div>
    <select
      class="settings-select"
      aria-label="Render Quality"
      value={quality}
      onchange={(e) => onchangeQuality(e.currentTarget.value)}
    >
      <option value="">Auto</option>
      <option value="high">High</option>
      <option value="med">Med</option>
      <option value="low">Low</option>
    </select>
  </div>
</SettingsSection>

<SettingsSection title="Compatibility">
  <SettingsRow
    label="Force Simplified Surfaces"
    description="Disables frosted-glass backdrop blurs for smoother performance on low-power devices"
    btnId="toggleForceNoBlur"
    checked={forceNoBlur}
    onchange={ontoggleForceNoBlur}
  />
  <button
    type="button"
    class="settings-action-btn settings-action-btn--full"
    id="btnCopyDiagnostics"
    onclick={oncopydiagnostics}
  >
    📋 Copy Diagnostics
  </button>
</SettingsSection>
