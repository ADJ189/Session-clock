<script lang="ts">
  interface ShortcutItem {
    key: string;
    desc: string;
  }

  interface Props {
    shortcuts?: ShortcutItem[];
    onClose?: () => void;
  }

  const DEFAULT_SHORTCUTS: ShortcutItem[] = [
    { key: "Space", desc: "Start / Pause session timer" },
    { key: "R", desc: "Reset timer" },
    { key: "T", desc: "Cycle to next theme" },
    { key: "Ctrl+K", desc: "Command palette" },
    { key: "/", desc: "Easter egg search" },
    { key: "F", desc: "Toggle fullscreen / kiosk" },
    { key: "P", desc: "Toggle Pomodoro mode" },
    { key: "M", desc: "Open ambient sound mixer" },
    { key: "K", desc: "Open the theme library" },
    { key: "Z", desc: "Zen Mode — distraction-free study" },
    { key: "G", desc: "Open custom theme builder" },
    { key: "?", desc: "Show shortcuts" },
    { key: "Escape", desc: "Close any open panel" },
  ];

  let { shortcuts = DEFAULT_SHORTCUTS, onClose }: Props = $props();
</script>

<div
  class="sc-modal sc-modal--narrow"
  role="dialog"
  aria-modal="true"
  aria-label="Keyboard Shortcuts"
>
  <div class="modal-header">
    <h2>⌨️ Shortcuts</h2>
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
  <div class="kb-grid" id="kbGrid">
    {#each shortcuts as item}
      <kbd>{item.key}</kbd>
      <span class="kb-desc">{item.desc}</span>
    {/each}
  </div>
</div>
