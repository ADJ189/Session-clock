<script lang="ts">
  let {
    pomMode = false,
    sessionLabel = "Session Timer",
    sessionTimer = "00:00:00",
    focusInputValue = "",
    startLabel = "Start",
    sessionStatus = "Ready to focus",
    distractionVisible = false,
    distractionCount = "0 today",
    ontogglepom,
    oninputfocus,
    onstart,
    onreset,
    onadddistraction,
  }: {
    pomMode?: boolean;
    sessionLabel?: string;
    sessionTimer?: string;
    focusInputValue?: string;
    startLabel?: string;
    sessionStatus?: string;
    distractionVisible?: boolean;
    distractionCount?: string;
    ontogglepom?: () => void;
    oninputfocus?: (val: string) => void;
    onstart?: () => void;
    onreset?: () => void;
    onadddistraction?: () => void;
  } = $props();
</script>

<div class="session-card">
  <div class="pom-mode-pill" id="pomModePill" onclick={ontogglepom}>
    🍅 Pomodoro
  </div>
  <div class="session-label" id="sessionLabel">{sessionLabel}</div>
  <div id="pomRingWrap">
    <svg
      id="pomRingSvg"
      width="0"
      height="0"
      viewBox="0 0 120 120"
      style="display: none"
    >
      <circle
        cx="60"
        cy="60"
        r="54"
        fill="none"
        stroke="rgba(255,255,255,.08)"
        stroke-width="3"
      />
      <circle
        id="pomRingArc"
        cx="60"
        cy="60"
        r="54"
        fill="none"
        stroke="var(--clr-accent)"
        stroke-width="3"
        stroke-linecap="round"
        stroke-dasharray="339.3"
        stroke-dashoffset="0"
        transform="rotate(-90 60 60)"
        style="transition: stroke-dashoffset 0.5s linear, stroke 0.5s;"
      />
    </svg>
    <div class="session-timer" id="sessionTimer">{sessionTimer}</div>
  </div>
  <div id="focusInputWrap">
    <span id="focusTag">Working on</span>
    <input
      id="focusInput"
      type="text"
      placeholder="what are you working on?"
      aria-label="What are you working on?"
      maxlength="60"
      autocomplete="off"
      value={focusInputValue}
      oninput={(e) => oninputfocus?.(e.currentTarget.value)}
    />
  </div>
  <div class="session-controls">
    <button class="btn btn-primary" id="btnStart" onclick={onstart}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
      {startLabel}
    </button>
    <button class="btn btn-ghost" id="btnReset" onclick={onreset}>
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
      Reset
    </button>
    <button class="btn btn-icon" id="btnPomToggle" title="Pomodoro" onclick={ontogglepom}>
      🍅
    </button>
  </div>
  <div class="session-status-line" id="sessionStatusLine">
    {sessionStatus}
  </div>
  <div class="distraction-row" id="distractionRow" style="display: {distractionVisible ? 'flex' : 'none'}">
    <button
      type="button"
      class="distraction-btn"
      id="btnDistraction"
      title="Log a distraction"
      onclick={onadddistraction}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path
          d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      Distraction
    </button>
    <span class="distraction-count" id="distractionCount">{distractionCount}</span>
  </div>
</div>
