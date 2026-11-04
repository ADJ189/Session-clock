<script lang="ts">
  import type { CmdItem } from "../../cmdpalette";

  let {
    open = false,
    query = "",
    items = [],
    activeIdx = 0,
    oninput,
    onselect,
    onclose,
  }: {
    open?: boolean;
    query?: string;
    items?: CmdItem[];
    activeIdx?: number;
    oninput?: (q: string) => void;
    onselect?: (item: CmdItem) => void;
    onclose?: () => void;
  } = $props();

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onclose?.();
    }
  }
</script>

<div
  class="sc-overlay {open ? 'open' : ''}"
  id="cmdOverlay"
  role="dialog"
  aria-modal="true"
  aria-label="Command palette"
  tabindex="-1"
  onkeydown={onKeydown}
>
  <div class="cmd-palette">
    <div class="cmd-input-wrap">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        id="cmdInput"
        placeholder="Type a command, theme name, or / for secrets…"
        aria-label="Command search"
        autocomplete="off"
        spellcheck="false"
        value={query}
        oninput={(e) => oninput?.(e.currentTarget.value)}
      />
    </div>
    <div class="cmd-results" id="cmdResults" role="listbox">
      {#each items as item, idx (item.id)}
        <div
          class="cmd-item {idx === activeIdx ? 'active' : ''}"
          role="option"
          aria-selected={idx === activeIdx}
          onclick={() => onselect?.(item)}
          onkeydown={(e) => {
            if (e.key === "Enter") onselect?.(item);
          }}
          tabindex="0"
        >
          {#if item.icon}
            <span class="cmd-item-icon">{item.icon}</span>
          {/if}
          <div class="cmd-item-content">
            <span class="cmd-item-name">{item.name}</span>
            {#if item.desc}
              <span class="cmd-item-desc">{item.desc}</span>
            {/if}
          </div>
          <span class="cmd-item-tag">{item.tag}</span>
        </div>
      {/each}
    </div>
  </div>
</div>
