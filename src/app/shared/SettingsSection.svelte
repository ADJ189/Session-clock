<script lang="ts">
  import type { Snippet } from "svelte";
  import BetaTag from "./BetaTag.svelte";

  let {
    title,
    beta = false,
    betaId = "betaTagSection",
    id,
    children,
  }: {
    title: string;
    beta?: boolean;
    betaId?: string;
    id?: string;
    children?: Snippet;
  } = $props();
</script>

<div class="settings-section" {id}>
  <div class="settings-section-title">
    {title}
    {#if beta}
      <BetaTag id={betaId} />
    {/if}
  </div>
  {@render children?.()}
</div>
