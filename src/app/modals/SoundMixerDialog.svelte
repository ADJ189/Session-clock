<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    soundMixerController,
    type SoundMixerSnapshot,
  } from "../controllers/sound-mixer-controller";

  let snapshot = $state<SoundMixerSnapshot>(soundMixerController.getSnapshot());

  $effect(() => {
    const unsub = soundMixerController.subscribe((next) => {
      snapshot = next;
    });
    return unsub;
  });

  onDestroy(() => {
    soundMixerController.stopMeter();
  });
</script>

<div class="sc-modal sc-modal--mixer {snapshot.nightActive ? 'mixer-night' : ''}">
  <div class="modal-header mixer-header">
    <div class="mixer-title">
      <span class="tl-eyebrow">Ambience</span>
      <h2>Sound Mixer</h2>
    </div>
    <div class="mixer-header-actions">
      <button
        class="mixer-night-toggle {snapshot.nightMode === 'on' ? 'active' : ''}"
        id="mixerNightToggle"
        type="button"
        aria-pressed={snapshot.nightMode === "on"}
        title="Night mode: {snapshot.nightMode}"
        onclick={() => soundMixerController.toggleNightMode()}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
        </svg>
        <span class="mixer-night-label">Night</span>
      </button>
      <button
        class="modal-close"
        aria-label="Close"
        type="button"
        onclick={() => soundMixerController.closeModal()}
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
  </div>

  <div class="sound-mixer">
    <section class="mixer-tracks-section" aria-labelledby="mixerTracksTitle">
      <div class="mixer-section-head">
        <div>
          <span class="tl-eyebrow">Layer a mix</span>
          <h3 id="mixerTracksTitle">Ambient tracks</h3>
        </div>
        <span class="mixer-section-note">Tap to play</span>
      </div>

      <div class="sound-tracks" id="soundGrid">
        {#each snapshot.tracks as t (t.id)}
          <div
            class="sound-track {t.active ? 'active' : ''} {t.unavailable ? 'track-unavailable' : ''}"
            style="--int-accent: {t.accent};"
            title={t.unavailable ? t.unavailableTitle : undefined}
          >
            <div class="sound-track-top">
              <div class="sound-track-icon icon-tile">{t.icon}</div>
              <div class="sound-track-info">
                <div class="sound-track-name">{t.name}</div>
                <div class="sound-track-desc">{t.desc}</div>
              </div>
              <button
                class="track-toggle {t.active ? 'on' : ''}"
                data-id={t.id}
                title={t.active ? "Stop" : "Play"}
                disabled={t.unavailable}
                type="button"
                onclick={() => soundMixerController.toggleTrack(t.id)}
              ></button>
            </div>
            <div class="sound-track-vol">
              <input
                type="range"
                class="track-vol-slider"
                min="0"
                max="200"
                value={t.vol}
                data-id={t.id}
                aria-label="{t.name} volume"
                style="--val: {Math.min(100, t.vol / 2)}%"
                oninput={(e) =>
                  soundMixerController.setTrackVolume(
                    t.id,
                    +(e.currentTarget as HTMLInputElement).value,
                  )}
              />
              <span
                class="sound-vol-pct"
                id="tvp_{t.id}"
                style={t.vol > 100 ? "color: var(--clr-accent);" : ""}
              >
                {t.vol}%
              </span>
            </div>
          </div>
        {/each}

        <div class="sound-section-header">
          <span class="sound-section-title">🧠 Binaural Beats</span>
          <span class="sound-section-note">Requires headphones</span>
        </div>

        {#each snapshot.binauralPresets as p (p.id)}
          <div
            class="sound-track binaural-track {p.active ? 'active' : ''} {p.unavailable ? 'track-unavailable' : ''}"
            style="--int-accent: {p.accent};"
            title={p.unavailable ? p.unavailableTitle : undefined}
          >
            <div class="sound-track-top">
              <div class="sound-track-icon icon-tile">{p.icon}</div>
              <div class="sound-track-info">
                <div class="sound-track-name">{p.name}</div>
                <div class="sound-track-desc">{p.desc}</div>
              </div>
              <button
                class="track-toggle {p.active ? 'on' : ''}"
                data-id={p.id}
                title={p.active ? "Stop" : "Play"}
                disabled={p.unavailable}
                type="button"
                onclick={() => soundMixerController.toggleBinaural(p.id)}
              ></button>
            </div>
          </div>
        {/each}

        <div class="sound-presets">
          <button
            class="preset-chip save-btn"
            type="button"
            onclick={() => soundMixerController.promptSavePreset()}
          >
            + Save Mix
          </button>
          {#each snapshot.presets as pr (pr.name)}
            <button
              class="preset-chip"
              type="button"
              title="Click to load, right-click to delete"
              onclick={() => soundMixerController.loadPreset(pr)}
              oncontextmenu={(e) => {
                e.preventDefault();
                soundMixerController.deletePreset(pr.name);
              }}
            >
              {pr.name}
            </button>
          {/each}
        </div>
      </div>
    </section>

    <section class="mix-console" aria-labelledby="mixConsoleTitle">
      <div class="mix-console-head">
        <div>
          <span class="tl-eyebrow">Mix Console</span>
          <h3 id="mixConsoleTitle">Master &amp; playback</h3>
        </div>
        <span class="mix-console-hint">Changes apply live</span>
      </div>

      <div class="mix-console-grid">
        <div class="mix-card mix-card--master">
          <div class="mix-card-head">
            <span class="mix-card-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M4 9v6h4l5 4V5L8 9H4Z" />
                <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />
              </svg>
              Master volume
            </span>
            <output
              class="mix-value"
              id="volLabel"
              for="volSlider"
              style={snapshot.masterVol > 100 ? "color: var(--clr-accent);" : ""}
              title={snapshot.masterVol > 100
                ? "Boosted — compressor prevents clipping"
                : ""}
            >
              {snapshot.masterVol}%
            </output>
          </div>
          <input
            type="range"
            class="sc-range master-vol-slider"
            id="volSlider"
            aria-label="Master volume"
            min="0"
            max="200"
            value={snapshot.masterVol}
            style="--boost-pct: 50%"
            oninput={(e) =>
              soundMixerController.setMasterVolume(
                +(e.currentTarget as HTMLInputElement).value,
              )}
          />
          <div class="mix-scale" aria-hidden="true">
            <span>Quiet</span><span>100%</span><span>Boost</span>
          </div>
        </div>

        <div class="mix-card mix-card--output">
          <div class="mix-card-head">
            <span class="mix-card-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4" />
              </svg>
              Output
            </span>
            <span class="mix-live">Live</span>
          </div>
          <div
            class="mixer-vu-track"
            role="img"
            aria-label="Output level meter"
          >
            <div class="mixer-vu-fill" id="mixerVuFill"></div>
          </div>
          <p class="mix-card-desc">
            Combined level of the tracks currently playing.
          </p>
        </div>

        <div class="mix-card mix-card--fade">
          <div class="mix-card-head">
            <span class="mix-card-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M4 12h10M10 8l4 4-4 4M18 7v10" />
              </svg>
              Fade out
            </span>
            <output class="mix-value" id="fadeLabel" for="fadeSlider">
              {snapshot.fade === 0 ? "Off" : `${snapshot.fade} min`}
            </output>
          </div>
          <input
            type="range"
            class="sc-range fade-slider"
            id="fadeSlider"
            aria-label="Fade out duration in minutes"
            min="0"
            max="60"
            value={snapshot.fade}
            oninput={(e) =>
              soundMixerController.setFade(
                +(e.currentTarget as HTMLInputElement).value,
              )}
          />
          <div class="fade-chips" id="fadeChips" aria-label="Fade out presets">
            {#each [0, 5, 10, 30, 60] as f}
              <button
                type="button"
                class="fade-chip {snapshot.fade === f ? 'active' : ''}"
                data-fade={f}
                aria-pressed={snapshot.fade === f}
                onclick={() => soundMixerController.setFade(f)}
              >
                {f === 0 ? "Off" : `${f}m`}
              </button>
            {/each}
          </div>
          <p class="mix-card-desc">Ease ambience out when stopping.</p>
        </div>
      </div>

      <div class="mixer-scenes">
        <div class="mixer-scenes-hdr">
          <div>
            <span class="tl-eyebrow">Scenes</span>
            <h3>Focus &amp; Break mixes</h3>
          </div>
          <label class="mixer-scene-auto">
            <span>Auto-switch with Pomodoro</span>
            <input
              type="checkbox"
              id="mixerAutoCrossfade"
              checked={snapshot.autoCrossfade}
              onchange={(e) =>
                soundMixerController.setAutoCrossfade(
                  (e.currentTarget as HTMLInputElement).checked,
                )}
            />
            <span class="mixer-switch" aria-hidden="true"></span>
          </label>
        </div>
        <div class="mixer-scenes-row">
          <button
            class="scene-card"
            id="sceneFocusBtn"
            type="button"
            onclick={() => soundMixerController.saveScene("focus")}
          >
            <span class="scene-art scene-art--focus" aria-hidden="true"></span>
            <span class="scene-info">
              <span class="scene-title">Focus mix</span>
              <span class="scene-desc">
                Save this blend as your work preset.
              </span>
            </span>
            <span class="scene-action">Save current mix</span>
          </button>
          <button
            class="scene-card"
            id="sceneBreakBtn"
            type="button"
            onclick={() => soundMixerController.saveScene("break")}
          >
            <span class="scene-art scene-art--break" aria-hidden="true"></span>
            <span class="scene-info">
              <span class="scene-title">Break mix</span>
              <span class="scene-desc">
                Save this blend as your rest preset.
              </span>
            </span>
            <span class="scene-action">Save current mix</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</div>
