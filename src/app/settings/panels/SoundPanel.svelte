<script lang="ts">
  import SettingsSection from "../../shared/SettingsSection.svelte";
  import SettingsRow from "../../shared/SettingsRow.svelte";

  let {
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
  }: {
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
  } = $props();
</script>

<SettingsSection title="Audio">
  <SettingsRow
    label="3D Spatial Audio"
    description="Sounds pan independently — best with headphones"
    badge="ILD+ITD"
    btnId="toggleSpatial"
    checked={spatial}
    onchange={ontoggleSpatial}
  />
  {#if headTrackingAvailable}
    <SettingsRow
      label="Head Tracking"
      description="Turn your phone and the soundstage stays anchored in place, like AirPods spatial audio"
      btnId="toggleHeadTracking"
      checked={headTracking}
      onchange={ontoggleHeadTracking}
    />
  {/if}
  <SettingsRow
    label="Box Breathing on Break"
    description="Guided breathing overlay during Pomodoro breaks"
    btnId="toggleBreathing"
    checked={breathing}
    onchange={ontoggleBreathing}
  />
  <SettingsRow
    label="UI Sound Effects"
    description="Subtle click, chime, and interaction sounds"
    btnId="toggleUiSounds"
    checked={uiSounds}
    onchange={ontoggleUiSounds}
  />
  <SettingsRow
    label="Auto-play Theme Ambience"
    description="Some themes (like Common Room) can auto-start matching ambient sounds when selected"
    btnId="toggleAutoThemeAmbience"
    checked={autoThemeAmbience}
    onchange={ontoggleAutoThemeAmbience}
  />
</SettingsSection>

<SettingsSection title="Music Panel">
  <SettingsRow
    label="Show Music Panel"
    description="Adds an optional floating player for YouTube (default) or Spotify. Hidden entirely until you turn it on"
    btnId="toggleMusicDeck"
    checked={musicDeck}
    onchange={ontoggleMusicDeck}
  />
  <div class="settings-row">
    <div class="settings-row-info">
      <div class="settings-row-top">
        <span class="settings-row-label">Providers</span>
      </div>
      <span class="settings-row-desc">
        YouTube is the default. Spotify's connect prompt only appears when Spotify is selected.
      </span>
    </div>
    <select
      class="settings-select"
      aria-label="Music providers"
      value={musicProvider}
      onchange={(e) => onchangeMusicProvider(e.currentTarget.value as "youtube" | "spotify" | "both")}
    >
      <option value="youtube">YouTube</option>
      <option value="spotify">Spotify</option>
      <option value="both">Both</option>
    </select>
  </div>
</SettingsSection>

<SettingsSection title="Mixer">
  <button
    type="button"
    class="mixer-launch-card"
    id="mixerLaunchCard"
    onclick={onopenmixer}
  >
    <div class="mixer-launch-icon">
      <span class="mixer-eq-bar"></span>
      <span class="mixer-eq-bar"></span>
      <span class="mixer-eq-bar"></span>
      <span class="mixer-eq-bar"></span>
    </div>
    <div class="mixer-launch-info">
      <div class="mixer-launch-title">
        <span>Ambient Sound Mixer</span>
        {#if activeTracksCount > 0}
          <span class="mixer-launch-badge">{activeTracksCount} playing</span>
        {/if}
      </div>
      <div class="mixer-launch-sub">{mixerSubtext}</div>
    </div>
    <span class="mixer-launch-chevron">›</span>
  </button>
</SettingsSection>

<SettingsSection title="Now Playing → Theme">
  <SettingsRow
    label="Auto-switch Theme"
    description="When Spotify (or a manually-entered track) matches a soundtrack, switch to that theme"
    btnId="toggleNowPlayingTheme"
    checked={nowPlayingTheme}
    onchange={ontoggleNowPlayingTheme}
  />
  <div class="settings-row">
    <input
      type="text"
      class="np-manual-input"
      placeholder="What's playing? (any player — song, artist, or soundtrack)"
      aria-label="What's playing"
      value={nowPlayingManual}
      onchange={(e) => onchangeNowPlayingManual(e.currentTarget.value)}
      onkeydown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  </div>
  <p class="settings-hint">
    {spotifyConnected
      ? "✓ Spotify connected — this checks automatically too."
      : "Connect Spotify in General → Integrations for automatic detection, or just type here."}
  </p>
</SettingsSection>
