<script lang="ts">
  import {
    commandController,
    TAG_LABELS,
    type PaletteSnapshot,
  } from "../controllers/command-controller";

  let snapshot = $state<PaletteSnapshot>(commandController.getSnapshot());
  let inputEl = $state<HTMLInputElement | null>(null);
  let resultsEl = $state<HTMLElement | null>(null);

  $effect(() => {
    return commandController.subscribe(() => {
      snapshot = commandController.getSnapshot();
    });
  });

  $effect(() => {
    if (snapshot.isOpen) {
      requestAnimationFrame(() => {
        inputEl?.focus();
        if (document.activeElement !== inputEl) {
          setTimeout(() => {
            if (snapshot.isOpen) inputEl?.focus();
          }, 60);
        }
      });
    }
  });

  $effect(() => {
    // Scroll active element into view whenever activeIdx or filtered items change
    const _idx = snapshot.activeIdx;
    if (resultsEl && _idx >= 0) {
      const activeEl = resultsEl.querySelector<HTMLElement>(".cmd-item.active");
      activeEl?.scrollIntoView({ block: "nearest" });
    }
  });

  $effect(() => {
    function onGlobalKeydown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (commandController.getIsOpen()) {
          commandController.close();
        } else {
          commandController.open();
        }
      }
      if (e.key === "/" && document.activeElement === document.body) {
        e.preventDefault();
        commandController.open("/");
      }
    }

    function onCaptureEscape(e: KeyboardEvent) {
      if (!commandController.getIsOpen() || e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      commandController.close();
    }

    window.addEventListener("keydown", onGlobalKeydown);
    document.addEventListener("keydown", onCaptureEscape, true);

    return () => {
      window.removeEventListener("keydown", onGlobalKeydown);
      document.removeEventListener("keydown", onCaptureEscape, true);
    };
  });

  function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      commandController.next();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      commandController.prev();
    } else if (e.key === "Enter") {
      e.preventDefault();
      commandController.selectCurrent();
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      commandController.close();
    }
  }
</script>

<div
  class="cmd-overlay {snapshot.isOpen ? 'open' : ''}"
  id="cmdOverlay"
  role="presentation"
  onclick={handleOverlayClick}
>
  <div
    class="cmd-modal"
    id="cmdModal"
    role="dialog"
    aria-modal="true"
    aria-label="Command Palette"
  >
    <div class="cmd-input-wrap">
      <svg
        class="cmd-search-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        id="cmdInput"
        class="cmd-input"
        placeholder="Search themes, actions, or type / for secrets…"
        aria-label="Search themes, actions, or type / for secrets"
        autocomplete="off"
        spellcheck="false"
        bind:this={inputEl}
        value={snapshot.query}
        oninput={(e) => commandController.setQuery(e.currentTarget.value)}
        onkeydown={handleInputKeydown}
      />
      <button
        class="cmd-secrets-btn"
        id="cmdSecretsBtn"
        type="button"
        title="Show all easter eggs"
        onclick={() => commandController.open("/")}
      >
        🥚 Secrets
      </button>
      <kbd class="cmd-esc-hint">ESC</kbd>
    </div>

    <div class="cmd-results" id="cmdResults" bind:this={resultsEl}>
      {#if snapshot.empty}
        <div class="cmd-empty">
          <div class="cmd-empty-icon">🔍</div>
          <div>No results for "{snapshot.query}"</div>
        </div>
      {:else}
        {#each snapshot.groups as group}
          <div class="cmd-section">{group.label}</div>
          {#each group.items as entry}
            <div
              class="cmd-item {entry.globalIndex === snapshot.activeIdx ? 'active' : ''}"
              data-idx={entry.globalIndex}
              role="button"
              tabindex="0"
              onclick={() => commandController.selectItem(entry.item)}
              onkeydown={(e) => {
                if (e.key === "Enter") commandController.selectItem(entry.item);
              }}
              onmouseenter={() => commandController.setActiveIndex(entry.globalIndex)}
            >
              <div class="cmd-item-icon">
                {#if entry.item.icon && entry.item.icon.trimStart().startsWith("<svg")}
                  {@html entry.item.icon}
                {:else}
                  {entry.item.icon ?? "▸"}
                {/if}
              </div>
              <div class="cmd-item-text">
                <div class="cmd-item-name">
                  {#each entry.nameSegments as seg}
                    {#if seg.match}
                      <mark>{seg.text}</mark>
                    {:else}
                      {seg.text}
                    {/if}
                  {/each}
                </div>
                {#if entry.item.desc}
                  <div class="cmd-item-desc">{entry.item.desc}</div>
                {/if}
              </div>
              <span class="cmd-item-tag tag-{entry.item.tag}">
                {TAG_LABELS[entry.item.tag] ?? entry.item.tag}
              </span>
            </div>
          {/each}
        {/each}
      {/if}
    </div>

    <div class="cmd-footer">
      <span><kbd>↑↓</kbd> navigate</span>
      <span><kbd>↵</kbd> select</span>
      <span><kbd>Esc</kbd> close</span>
      <span class="cmd-footer-tip"
        >Type <code>/</code> to filter secrets ·
        <code>Ctrl+K</code> anywhere to open</span
      >
    </div>
  </div>
</div>
