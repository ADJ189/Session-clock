<script lang="ts">
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
  } = $props();
</script>

<header class="topbar">
  <div class="topbar-left">
    <button
      type="button"
      class="topbar-themes-btn"
      id="topbarThemesBtn"
      title="Themes"
      onclick={onopenthemes}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        />
      </svg>
      Themes
    </button>
    <button
      type="button"
      id="weatherPill"
      class="topbar-pill weather-pill"
      aria-label="Open weather"
      title="Weather"
      onclick={onopenweather}
    >
      <span id="weatherIcon" class="weather-icon-default" aria-hidden="true">
        <svg
          viewBox="0 0 24 16"
          width="17"
          height="12"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M6.5 13.5a4.2 4.2 0 0 1-.4-8.38A5 5 0 0 1 15.7 4.1 4 4 0 0 1 17.5 12"
          />
          <path d="M6.5 13.5h11" />
        </svg>
      </span>
      <span id="weatherText">{weatherText}</span>
    </button>
    <div class="info-strip">
      <div class="info-slide" id="infoSlide">
        <span class="info-dot"></span>
        <span id="infoLabel">{infoLabel}</span>
      </div>
    </div>
  </div>
  <div id="showBadge" class="showbadge">{showBadge}</div>
  <div class="topbar-right">
    <button
      type="button"
      class="clock-pos-pill"
      id="clockPosPill"
      title="Toggle clock position"
      onclick={ontoggleclockpos}
    >
      {clockPosLabel}
    </button>
    <a
      class="topbar-icon-btn"
      href="https://github.com/ADJ189/Session-clock"
      target="_blank"
      rel="noopener noreferrer"
      referrerpolicy="no-referrer"
      title="Session Clock repository on GitHub"
      aria-label="Open the Session Clock GitHub repository"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"
        />
      </svg>
    </a>
    <button
      type="button"
      class="topbar-icon-btn cmd-trigger-btn"
      id="btnCmdPalette"
      title="Command palette · Ctrl+K · Type / for secrets"
      onclick={onopencmd}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <span class="cmd-btn-label">⌘K</span>
    </button>
    <button
      type="button"
      class="topbar-icon-btn"
      id="btnKbShortcuts"
      title="Keyboard shortcuts (?)"
      onclick={onopenkb}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12" />
      </svg>
    </button>
  </div>
</header>
