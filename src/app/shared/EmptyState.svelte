<script lang="ts">
  let {
    icon = "✨",
    title = "",
    description = "",
    actionText = "",
    onaction,
  }: {
    icon?: string;
    title?: string;
    description?: string;
    actionText?: string;
    onaction?: () => void;
  } = $props();
</script>

<div class="sc-empty-state">
  <div class="sc-empty-icon">{icon}</div>
  {#if title}
    <div class="sc-empty-title">{title}</div>
  {/if}
  {#if description}
    <div class="sc-empty-desc">{description}</div>
  {/if}
  {#if actionText && onaction}
    <button type="button" class="btn-primary" onclick={onaction}>
      {actionText}
    </button>
  {/if}
</div>
