<script lang="ts">
  import AppHeader from "./layout/AppHeader.svelte";
  import QuickActionDock from "./layout/QuickActionDock.svelte";

  let {
    weatherText = "Set location",
    infoLabel = "Session Clock",
    showBadge = "",
    clockPosLabel = "⊟ Top",
    onopenthemes,
    onopenweather,
    ontoggleclockpos,
    onopencmd,
    onopenkb,
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
    onopensound?: () => void;
    ontogglezen?: () => void;
    onopensettings?: () => void;
  } = $props();
</script>

<div class="sc-app-shell">
  <!-- Svelte-owned Top Bar Header -->
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

  <!-- Svelte-owned Quick-Action Dock -->
  <QuickActionDock
    {onopenthemes}
    {onopensound}
    {ontogglezen}
    {onopensettings}
  />
</div>
