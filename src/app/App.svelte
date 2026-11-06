<script lang="ts">
  import AppHeader from "./layout/AppHeader.svelte";
  import MainWorkspace from "./layout/MainWorkspace.svelte";
  import QuickActionDock from "./layout/QuickActionDock.svelte";
  import CommandPalette from "./modals/CommandPalette.svelte";

  let {
    // Header props
    weatherText = "Set location",
    infoLabel = "Session Clock",
    showBadge = "",
    clockPosLabel = "⊟ Top",
    onopenthemes,
    onopenweather,
    ontoggleclockpos,
    onopencmd,
    onopenkb,

    // Workspace / Clock props
    greeting = "Good morning",
    digitHr = "--",
    digitMin = "--",
    digitSec = "--",
    ampm = "--",
    secMs = ".---",
    dateDis = "—",
    dayPct = "0%",

    // Session props
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

    // Dock props
    onopensound,
    ontogglezen,
    onopensettings,
  }: {
    weatherText?: string;
    infoLabel?: string;
    showBadge?: string;
    clockPosLabel?: string;
    onopenthemes?: () => void;
    onopenweather?: () => void;
    ontoggleclockpos?: () => void;
    onopencmd?: () => void;
    onopenkb?: () => void;

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

    onopensound?: () => void;
    ontogglezen?: () => void;
    onopensettings?: () => void;
  } = $props();
</script>

<AppHeader
  {weatherText}
  {infoLabel}
  {showBadge}
  {clockPosLabel}
  {onopenthemes}
  {onopenweather}
  {ontoggleclockpos}
  {onopencmd}
  {onopenkb}
/>

<MainWorkspace
  {greeting}
  {digitHr}
  {digitMin}
  {digitSec}
  {ampm}
  {secMs}
  {dateDis}
  {dayPct}
  {pomMode}
  {sessionLabel}
  {sessionTimer}
  {focusInputValue}
  {startLabel}
  {sessionStatus}
  {distractionVisible}
  {distractionCount}
  {quote}
  {meta}
  {ontogglepom}
  {oninputfocus}
  {onstart}
  {onreset}
  {onadddistraction}
/>

<div class="feat-dock" id="featBar">
  <QuickActionDock
    {onopenthemes}
    {onopensound}
    {ontogglezen}
    {onopensettings}
  />
</div>

<CommandPalette />
