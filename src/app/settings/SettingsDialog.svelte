<script lang="ts">
  import SettingsTabBar from "./SettingsTabBar.svelte";
  import GeneralPanel from "./panels/GeneralPanel.svelte";
  import SoundPanel from "./panels/SoundPanel.svelte";
  import FocusPanel from "./panels/FocusPanel.svelte";
  import DisplayPanel from "./panels/DisplayPanel.svelte";
  import PrivacyPanel from "./panels/PrivacyPanel.svelte";
  import type { SoundOption } from "./panels/FocusPanel.svelte";

  let {
    activeTab = "general",
    ontabchange,
    onclose,

    // General props
    activeClockMode = "digital",
    languageLabel = "🌐 English — Change language",
    connectedCount = 0,
    onopenintegrations,
    onopenlanguage,
    onselectpreset,
    onselectclockmode,
    onquickaction,

    // Sound props
    spatial = false,
    headTracking = false,
    headTrackingAvailable = false,
    breathing = false,
    uiSounds = true,
    autoThemeAmbience = false,
    musicDeck = false,
    musicProvider = "youtube",
    nowPlayingTheme = false,
    nowPlayingManual = "",
    spotifyConnected = false,
    activeTracksCount = 0,
    mixerSubtext = "Layer rain, waves, café, vinyl & more",
    ontoggleSpatial,
    ontoggleHeadTracking,
    ontoggleBreathing,
    ontoggleUiSounds,
    ontoggleAutoThemeAmbience,
    ontoggleMusicDeck,
    onchangeMusicProvider,
    onopenmixer,
    ontoggleNowPlayingTheme,
    onchangeNowPlayingManual,

    // Focus props
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

    // Display props
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

    // Privacy props
    privacyMode = false,
    analyticsTitle = "Optional Usage Analytics",
    analyticsDesc = "Help us improve with privacy-friendly page view stats",
    analyticsBadge = undefined,
    analyticsOn = true,
    showRetryAnalytics = false,
    showAutoAnalytics = false,
    retryAnalyticsLabel = "Enable Analytics",
    autoAnalyticsLabel = "Reset to Auto",
    analyticsReassurance = "We value your privacy. Session Clock uses Cloudflare Web Analytics, which does not use cookies, does not collect personal data, and does not track you across sites.",
    incognito = false,
    autoClear = false,
    ontogglePrivacy,
    ontoggleAnalytics,
    onretryAnalytics,
    onautoAnalytics,
    ontoggleIncognito,
    ontoggleAutoClear,
    onopendata,
    onopenlegal,
  }: {
    activeTab: string;
    ontabchange: (tab: string) => void;
    onclose: () => void;

    activeClockMode?: string;
    languageLabel?: string;
    connectedCount?: number;
    onopenintegrations: () => void;
    onopenlanguage: () => void;
    onselectpreset: (id: string) => void;
    onselectclockmode: (mode: string) => void;
    onquickaction?: (id: string) => void;

    spatial?: boolean;
    headTracking?: boolean;
    headTrackingAvailable?: boolean;
    breathing?: boolean;
    uiSounds?: boolean;
    autoThemeAmbience?: boolean;
    musicDeck?: boolean;
    musicProvider?: "youtube" | "spotify" | "both";
    nowPlayingTheme?: boolean;
    nowPlayingManual?: string;
    spotifyConnected?: boolean;
    activeTracksCount?: number;
    mixerSubtext?: string;
    ontoggleSpatial: (val: boolean) => void;
    ontoggleHeadTracking: (val: boolean) => void;
    ontoggleBreathing: (val: boolean) => void;
    ontoggleUiSounds: (val: boolean) => void;
    ontoggleAutoThemeAmbience: (val: boolean) => void;
    ontoggleMusicDeck: (val: boolean) => void;
    onchangeMusicProvider: (val: "youtube" | "spotify" | "both") => void;
    onopenmixer: () => void;
    ontoggleNowPlayingTheme: (val: boolean) => void;
    onchangeNowPlayingManual: (val: string) => void;

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

    privacyMode?: boolean;
    analyticsTitle?: string;
    analyticsDesc?: string;
    analyticsBadge?: string;
    analyticsOn?: boolean;
    showRetryAnalytics?: boolean;
    showAutoAnalytics?: boolean;
    retryAnalyticsLabel?: string;
    autoAnalyticsLabel?: string;
    analyticsReassurance?: string;
    incognito?: boolean;
    autoClear?: boolean;
    ontogglePrivacy: (val: boolean) => void;
    ontoggleAnalytics: (val: boolean) => void;
    onretryAnalytics: () => void;
    onautoAnalytics: () => void;
    ontoggleIncognito: (val: boolean) => void;
    ontoggleAutoClear: (val: boolean) => void;
    onopendata: () => void;
    onopenlegal: (doc: "privacy" | "terms") => void;
  } = $props();
</script>

<div class="sc-modal sc-modal--settings">
  <div class="modal-header">
    <h2 class="modal-title-row" aria-label="Settings">Settings</h2>
    <button
      class="modal-close"
      aria-label="Close"
      onclick={onclose}
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
  <div id="settingsTabBar">
    <SettingsTabBar {activeTab} {ontabchange} />
  </div>
  <div id="settingsContent" class="pane-sliding">
    {#if activeTab === "general"}
      <GeneralPanel
        {activeClockMode}
        {languageLabel}
        {connectedCount}
        {onopenintegrations}
        {onopenlanguage}
        {onselectpreset}
        {onselectclockmode}
        onquickaction={(id) => onquickaction?.(id)}
      />
    {:else if activeTab === "sound"}
      <SoundPanel
        {spatial}
        {headTracking}
        {headTrackingAvailable}
        {breathing}
        {uiSounds}
        {autoThemeAmbience}
        {musicDeck}
        {musicProvider}
        {nowPlayingTheme}
        {nowPlayingManual}
        {spotifyConnected}
        {activeTracksCount}
        {mixerSubtext}
        {ontoggleSpatial}
        {ontoggleHeadTracking}
        {ontoggleBreathing}
        {ontoggleUiSounds}
        {ontoggleAutoThemeAmbience}
        {ontoggleMusicDeck}
        {onchangeMusicProvider}
        {onopenmixer}
        {ontoggleNowPlayingTheme}
        {onchangeNowPlayingManual}
      />
    {:else if activeTab === "focus"}
      <FocusPanel
        {focusLock}
        {smartBreak}
        {breakReminderMins}
        {idleDetect}
        {zenSound}
        {zenDimDelay}
        {zenRings}
        {availableSounds}
        {ontoggleFocusLock}
        {ontoggleSmartBreak}
        {onchangeBreakReminderMins}
        {ontoggleIdleDetect}
        {onchangeZenSound}
        {onchangeZenDimDelay}
        {ontoggleZenRings}
        {onopenpomodoro}
      />
    {:else if activeTab === "display"}
      <DisplayPanel
        {clockPos}
        {clockMode}
        {centerMinimal}
        {hideSeconds}
        {hideMs}
        {use24Hour}
        {calmMode}
        {focusMode}
        {reduceMotion}
        {parallax}
        {haptics}
        {hapticsAvailable}
        {fps}
        {tier}
        {quality}
        {onchangeClockPos}
        {ontoggleCenterMinimal}
        {ontoggleHideSeconds}
        {ontoggleHideMs}
        {ontoggle24Hour}
        {ontoggleCalmMode}
        {ontoggleFocusMode}
        {ontoggleReduceMotion}
        {ontoggleParallax}
        {ontoggleHaptics}
        {onchangeQuality}
      />
    {:else if activeTab === "privacy"}
      <PrivacyPanel
        {privacyMode}
        {analyticsTitle}
        {analyticsDesc}
        {analyticsBadge}
        {analyticsOn}
        {showRetryAnalytics}
        {showAutoAnalytics}
        {retryAnalyticsLabel}
        {autoAnalyticsLabel}
        {analyticsReassurance}
        {incognito}
        {autoClear}
        {ontogglePrivacy}
        {ontoggleAnalytics}
        {onretryAnalytics}
        {onautoAnalytics}
        {ontoggleIncognito}
        {ontoggleAutoClear}
        {onopendata}
        {onopenlegal}
      />
    {/if}
    <div style="height: 12px;"></div>
  </div>
</div>
