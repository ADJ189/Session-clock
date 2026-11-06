<script lang="ts">
  import * as Pom from "../../pomodoro";

  interface Props {
    onClose?: () => void;
  }

  let { onClose }: Props = $props();

  let settings = $state(Pom.getSettings());
  let countToday = $state(Pom.todayCount());

  const WORK_OPTS = [15, 20, 25, 30, 45, 60];
  const BREAK_OPTS = [5, 10, 15];
  const LONG_BREAK_OPTS = [10, 15, 20, 30];
  const LONG_AFTER_OPTS = [3, 4, 5, 6];

  export function refresh() {
    settings = Pom.getSettings();
    countToday = Pom.todayCount();
  }

  function setWork(v: number) {
    Pom.updateSettings({ workMins: v });
    refresh();
  }

  function setBreak(v: number) {
    Pom.updateSettings({ breakMins: v });
    refresh();
  }

  function setLongBreak(v: number) {
    Pom.updateSettings({ longBreakMins: v });
    refresh();
  }

  function setLongAfter(v: number) {
    Pom.updateSettings({ longBreakAfter: v });
    refresh();
  }

  function handleCustomInput(
    field: "workMins" | "breakMins" | "longBreakMins",
    rawVal: string,
    min: number,
    max: number
  ) {
    const num = Math.max(min, Math.min(max, Math.round(+rawVal) || min));
    Pom.updateSettings({ [field]: num });
    refresh();
  }
</script>

<div class="sc-modal pom-modal" role="dialog" aria-modal="true" aria-label="Pomodoro">
  <div class="modal-header">
    <h2>🍅 Pomodoro</h2>
    <button
      class="modal-close"
      aria-label="Close"
      type="button"
      onclick={() => onClose?.()}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  </div>
  <div class="pom-section">
    <div class="pom-section-head">
      <span class="pom-section-icon">🎯</span>
      <h3>Work duration</h3>
    </div>
    <div class="pill-group" id="pomWorkBtns">
      {#each WORK_OPTS as v}
        <button
          type="button"
          class="btn {settings.workMins === v ? 'active-btn' : ''}"
          onclick={() => setWork(v)}
        >
          {v}m
        </button>
      {/each}
    </div>
  </div>
  <div class="pom-section">
    <div class="pom-section-head">
      <span class="pom-section-icon">☕</span>
      <h3>Short break</h3>
    </div>
    <div class="pill-group" id="pomBreakBtns">
      {#each BREAK_OPTS as v}
        <button
          type="button"
          class="btn {settings.breakMins === v ? 'active-btn' : ''}"
          onclick={() => setBreak(v)}
        >
          {v}m
        </button>
      {/each}
    </div>
  </div>
  <div class="pom-section">
    <div class="pom-section-head">
      <span class="pom-section-icon">🛋️</span>
      <h3>Long break duration</h3>
    </div>
    <div class="pill-group" id="pomLongBreakMinBtns">
      {#each LONG_BREAK_OPTS as v}
        <button
          type="button"
          class="btn {settings.longBreakMins === v ? 'active-btn' : ''}"
          onclick={() => setLongBreak(v)}
        >
          {v}m
        </button>
      {/each}
    </div>
  </div>
  <div class="pom-section">
    <div class="pom-section-head">
      <span class="pom-section-icon">🔁</span>
      <h3>Long break after</h3>
    </div>
    <div class="pill-group" id="pomLongBtns">
      {#each LONG_AFTER_OPTS as v}
        <button
          type="button"
          class="btn {settings.longBreakAfter === v ? 'active-btn' : ''}"
          onclick={() => setLongAfter(v)}
        >
          {v}
        </button>
      {/each}
    </div>
  </div>
  <div class="pom-section">
    <div class="pom-section-head">
      <span class="pom-section-icon">✏️</span>
      <h3>Custom cycle</h3>
    </div>
    <div class="pom-custom-row" id="pomCustomRow">
      <label>
        <span>Work</span>
        <span class="pom-stepper">
          <input
            type="number"
            id="pomCustomWork"
            min="1"
            max="180"
            step="1"
            value={settings.workMins}
            onchange={(e) => handleCustomInput("workMins", e.currentTarget.value, 1, 180)}
          /><em>min</em>
        </span>
      </label>
      <label>
        <span>Break</span>
        <span class="pom-stepper">
          <input
            type="number"
            id="pomCustomBreak"
            min="1"
            max="90"
            step="1"
            value={settings.breakMins}
            onchange={(e) => handleCustomInput("breakMins", e.currentTarget.value, 1, 90)}
          /><em>min</em>
        </span>
      </label>
      <label>
        <span>Long break</span>
        <span class="pom-stepper">
          <input
            type="number"
            id="pomCustomLong"
            min="1"
            max="120"
            step="1"
            value={settings.longBreakMins}
            onchange={(e) => handleCustomInput("longBreakMins", e.currentTarget.value, 1, 120)}
          /><em>min</em>
        </span>
      </label>
    </div>
  </div>
  <p class="pom-today">
    Completed today: <strong><span id="pomCountToday">{countToday}</span></strong>
  </p>
</div>
