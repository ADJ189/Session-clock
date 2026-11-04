<script lang="ts">
  import ClockSurface from "../clock/ClockSurface.svelte";
  import SessionCard from "../session/SessionCard.svelte";
  import QuoteArea from "../session/QuoteArea.svelte";

  let {
    greeting = "Good morning",
    digitHr = "--",
    digitMin = "--",
    digitSec = "--",
    ampm = "--",
    secMs = ".---",
    dateDis = "—",
    dayPct = "0%",
    pomMode = false,
    sessionLabel = "Session Timer",
    sessionTimer = "00:00:00",
    focusInputValue = "",
    startLabel = "Start",
    sessionStatus = "Ready to focus",
    distractionVisible = false,
    distractionCount = "0 today",
    quote = "",
    meta = "",
    ontogglepom,
    oninputfocus,
    onstart,
    onreset,
    onadddistraction,
  }: {
    greeting?: string;
    digitHr?: string;
    digitMin?: string;
    digitSec?: string;
    ampm?: string;
    secMs?: string;
    dateDis?: string;
    dayPct?: string;
    pomMode?: boolean;
    sessionLabel?: string;
    sessionTimer?: string;
    focusInputValue?: string;
    startLabel?: string;
    sessionStatus?: string;
    distractionVisible?: boolean;
    distractionCount?: string;
    quote?: string;
    meta?: string;
    ontogglepom?: () => void;
    oninputfocus?: (val: string) => void;
    onstart?: () => void;
    onreset?: () => void;
    onadddistraction?: () => void;
  } = $props();
</script>

<main class="main" id="mainUI">
  <ClockSurface
    {greeting}
    {digitHr}
    {digitMin}
    {digitSec}
    {ampm}
    {secMs}
    {dateDis}
    {dayPct}
  />

  <SessionCard
    {pomMode}
    {sessionLabel}
    {sessionTimer}
    {focusInputValue}
    {startLabel}
    {sessionStatus}
    {distractionVisible}
    {distractionCount}
    {ontogglepom}
    {oninputfocus}
    {onstart}
    {onreset}
    {onadddistraction}
  />

  <QuoteArea {quote} {meta} />
</main>
