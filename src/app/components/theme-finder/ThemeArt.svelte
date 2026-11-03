<script lang="ts">
  import type { Theme } from "../../../types";
  import { PREVIEW_IDS, themePreviewUrl } from "../../../themepreviews";
  import { mark } from "./mark";

  let {
    theme,
    markClass,
    fillMark,
  }: {
    theme: Theme;
    markClass: string;
    fillMark: (el: HTMLElement, theme: Theme) => void;
  } = $props();

  // Generated thumbnails are optional. A missing/failed image leaves the
  // layered CSS scene in place — a designed fallback, never a broken-image
  // icon. Tracking the failed id (rather than a boolean) resets the fallback
  // automatically when the component is reused for another theme.
  let failedId = $state<string | null>(null);
  const showPreview = $derived(
    PREVIEW_IDS.has(theme.id) && failedId !== theme.id,
  );
  const previewUrl = $derived(themePreviewUrl(theme.id));
</script>

<span class="tl-scene" aria-hidden="true"></span>
{#if showPreview}
  <img
    class="tl-img"
    alt=""
    loading="lazy"
    decoding="async"
    src={previewUrl}
    onerror={() => {
      failedId = theme.id;
    }}
  />
{/if}
<span class={markClass} use:mark={{ theme, fillMark }}></span>
