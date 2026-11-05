<script lang="ts">
  import type { Snippet } from "svelte";
  import BetaTag from "./BetaTag.svelte";

  let {
    open = false,
    id,
    modalClass = "",
    title,
    titleId,
    titleBeta = false,
    titleBetaId,
    showMinimize = false,
    minimizeId,
    closeId,
    onclose,
    onminimize,
    children,
  }: {
    open?: boolean;
    id: string;
    modalClass?: string;
    title: string;
    titleId?: string;
    titleBeta?: boolean;
    titleBetaId?: string;
    showMinimize?: boolean;
    minimizeId?: string;
    closeId?: string;
    onclose: () => void;
    onminimize?: () => void;
    children?: Snippet;
  } = $props();

  function onOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onclose();
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      onclose();
    }
  }
</script>

<div
  class="sc-overlay {open ? 'open' : ''}"
  {id}
  onclick={onOverlayClick}
  onkeydown={onKeydown}
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  tabindex="-1"
>
  <div class="sc-modal {modalClass}">
    <div class="modal-header">
      <h2
        class="modal-title-row"
        id={titleId}
        aria-label={title}
        aria-describedby={titleBeta ? titleBetaId : undefined}
      >
        {title}
        {#if titleBeta}
          <BetaTag id={titleBetaId} />
        {/if}
      </h2>
      <div class="modal-header-actions">
        {#if showMinimize}
          <button
            class="modal-minimize"
            id={minimizeId}
            aria-label="Minimize"
            title="Minimize"
            onclick={onminimize}
          >
            –
          </button>
        {/if}
        <button
          class="modal-close"
          id={closeId}
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
    </div>
    {@render children?.()}
  </div>
</div>
