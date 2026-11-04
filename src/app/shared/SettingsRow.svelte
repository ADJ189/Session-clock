<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    description,
    badge,
    btnId,
    checked = false,
    id,
    onchange,
    children,
  }: {
    label: string;
    description?: string;
    badge?: string;
    btnId?: string;
    checked?: boolean;
    id?: string;
    onchange?: (checked: boolean) => void;
    children?: Snippet;
  } = $props();
</script>

<div class="settings-row" {id}>
  <div class="settings-row-info">
    <div class="settings-row-top">
      <span class="settings-row-label">{label}</span>
      {#if badge}
        <span class="settings-badge">{badge}</span>
      {/if}
    </div>
    {#if description}
      <span class="settings-row-desc">{description}</span>
    {/if}
  </div>
  {#if children}
    {@render children()}
  {:else if btnId}
    <button
      type="button"
      class="settings-toggle {checked ? 'on' : ''}"
      id={btnId}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onclick={() => onchange?.(!checked)}
    ></button>
  {/if}
</div>
