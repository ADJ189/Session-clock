<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    id,
    className = "",
    title,
    ariaLabel,
    disabled = false,
    onclick,
    children,
  }: {
    id?: string;
    className?: string;
    title?: string;
    ariaLabel?: string;
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  } = $props();
</script>

<button
  type="button"
  {id}
  class="btn-icon {className}"
  {title}
  aria-label={ariaLabel || title}
  {disabled}
  {onclick}
>
  {@render children?.()}
</button>
