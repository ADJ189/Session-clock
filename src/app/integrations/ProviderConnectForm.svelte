<script lang="ts">
  let {
    providerId,
    providerName,
    connected = false,
    ondisconnect,
    onconnect,
  }: {
    providerId: string;
    providerName: string;
    connected?: boolean;
    ondisconnect: () => void;
    onconnect?: () => void;
  } = $props();
</script>

{#if connected}
  <button
    type="button"
    class="int-disconnect-btn"
    onclick={ondisconnect}
  >
    Disconnect {providerName}
  </button>
{:else}
  <div class="int-setup-wrap">
    <button
      type="button"
      class="int-connect-btn"
      onclick={onconnect}
    >
      Connect with {providerName}
    </button>
  </div>
{/if}
