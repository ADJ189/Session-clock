<script lang="ts">
  let {
    greeting = "Good morning",
    digitHr = "--",
    digitMin = "--",
    digitSec = "--",
    ampm = "--",
    secMs = ".---",
    dateDis = "—",
    dayPct = "0%",
  }: {
    greeting?: string;
    digitHr?: string;
    digitMin?: string;
    digitSec?: string;
    ampm?: string;
    secMs?: string;
    dateDis?: string;
    dayPct?: string;
  } = $props();
</script>

<p class="greeting" id="greeting">{greeting}</p>

<div class="clock-block" id="clock-block-wrap">
  <div class="clock-row">
    <span class="digit-pair" id="digitHr">{digitHr}</span>
    <span class="clock-colon colon">:</span>
    <span class="digit-pair" id="digitMin">{digitMin}</span>
    <span class="clock-colon colon sep-sec">:</span>
    <span class="digit-pair" id="digitSec">{digitSec}</span>
    <div class="ampm-stack">
      <span class="ampm" id="ampmDis">{ampm}</span>
      <span class="seconds-ms" id="secMs">{secMs}</span>
    </div>
  </div>
</div>

<!-- hidden for JS compat -->
<div id="timeDis" style="display: none" aria-hidden="true"></div>

<p class="date-display" id="dateDis">{dateDis}</p>

<div class="progress-wrap">
  <div class="progress-labels">
    <span>Day Progress</span>
    <span id="dayPct">{dayPct}</span>
  </div>
  <div class="progress-track">
    <div class="progress-fill" id="progressFill" style="width: {dayPct}"></div>
  </div>
</div>
