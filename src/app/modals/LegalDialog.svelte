<script lang="ts">
  import { LEGAL_DOCS } from "../../legal";

  interface Props {
    initialDoc?: "privacy" | "terms";
    onClose?: () => void;
  }

  let { initialDoc = "privacy", onClose }: Props = $props();
  let selectedDoc = $state<"privacy" | "terms" | null>(null);
  let activeDoc = $derived(selectedDoc ?? initialDoc);

  let currentDoc = $derived(LEGAL_DOCS[activeDoc] || LEGAL_DOCS.privacy);

  export function setDoc(doc: "privacy" | "terms") {
    selectedDoc = doc;
  }
</script>

<div
  class="sc-modal sc-modal--settings"
  role="dialog"
  aria-modal="true"
  aria-labelledby="legalTitle"
>
  <div class="modal-header">
    <div>
      <h2 id="legalTitle">{currentDoc.title}</h2>
      <p class="legal-updated" id="legalUpdated">Last updated: {currentDoc.updated}</p>
    </div>
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
  <div id="legalContent">
    <div class="legal-tab-bar">
      <button
        type="button"
        class="legal-tab {activeDoc === 'privacy' ? 'active' : ''}"
        onclick={() => (activeDoc = "privacy")}
      >
        Privacy Policy
      </button>
      <button
        type="button"
        class="legal-tab {activeDoc === 'terms' ? 'active' : ''}"
        onclick={() => (activeDoc = "terms")}
      >
        Terms of Service
      </button>
    </div>
    <div class="legal-body">
      {#each currentDoc.sections as sec}
        <h3 class="legal-section-title">{sec.heading}</h3>
        {#each sec.paragraphs as p}
          <p class="legal-paragraph">{p}</p>
        {/each}
        {#if sec.bullets && sec.bullets.length}
          <ul class="legal-bullets">
            {#each sec.bullets as li}
              <li>{li}</li>
            {/each}
          </ul>
        {/if}
      {/each}
    </div>
  </div>
</div>
