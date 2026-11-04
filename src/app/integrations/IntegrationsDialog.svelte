<script lang="ts">
  import type { Snippet } from "svelte";
  import ModalShell from "../shared/ModalShell.svelte";
  import ProviderCard from "./ProviderCard.svelte";

  export interface ProviderDef {
    id: string;
    name: string;
    icon: string;
    color: string;
    desc: string;
    connected: boolean;
  }

  let {
    open = false,
    providers = [],
    openCardId = null,
    onclose,
    onminimize,
    ontogglecard,
    renderForm,
  }: {
    open?: boolean;
    providers: ProviderDef[];
    openCardId?: string | null;
    onclose: () => void;
    onminimize?: () => void;
    ontogglecard: (id: string) => void;
    renderForm?: (id: string) => Snippet | undefined;
  } = $props();
</script>

<ModalShell
  {open}
  id="integrationsOverlay"
  modalClass="sc-modal--integrations"
  title="🔗 Integrations"
  titleId="integrationsTitle"
  titleBeta={true}
  titleBetaId="betaTagIntegrationsTitle"
  showMinimize={true}
  minimizeId="integrationsMinimize"
  closeId="integrationsClose"
  {onclose}
  {onminimize}
>
  <div id="integrationsContent" style="max-height: 76vh; overflow-y: auto">
    {#each providers as provider (provider.id)}
      <ProviderCard
        id={provider.id}
        name={provider.name}
        icon={provider.icon}
        color={provider.color}
        desc={provider.desc}
        connected={provider.connected}
        open={openCardId === provider.id}
        ontoggle={() => ontogglecard(provider.id)}
      />
    {/each}
  </div>
</ModalShell>
