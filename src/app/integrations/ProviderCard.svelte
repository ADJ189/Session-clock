<script lang="ts">
  import type { Snippet } from "svelte";
  import BetaTag from "../shared/BetaTag.svelte";

  let {
    id,
    name,
    icon,
    color,
    desc,
    connected = false,
    open = false,
    ontoggle,
    children,
  }: {
    id: string;
    name: string;
    icon: string;
    color: string;
    desc: string;
    connected?: boolean;
    open?: boolean;
    ontoggle?: () => void;
    children?: Snippet;
  } = $props();
</script>

<div
  class="int-card {connected ? 'int-card--on' : ''} {open ? 'int-card--open' : ''}"
  style="--int-accent: {color}"
>
  <button
    type="button"
    class="int-card-header"
    aria-expanded={open}
    aria-label={name}
    aria-describedby="betaTagProvider_{id}"
    onclick={ontoggle}
  >
    <span class="int-tile">{icon}</span>
    <span class="int-info">
      <span class="int-name">
        {name}
        <BetaTag id="betaTagProvider_{id}" />
      </span>
      <span class="int-desc">{desc}</span>
    </span>
    <span class="int-status">
      <span class="int-status-dot" aria-hidden="true"></span>
      {connected ? "Connected" : "Connect"}
    </span>
    <span class="int-chevron" aria-hidden="true">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  </button>
  <div class="int-form-outer">
    <div class="int-form" inert={!open}>
      {@render children?.()}
    </div>
  </div>
</div>
