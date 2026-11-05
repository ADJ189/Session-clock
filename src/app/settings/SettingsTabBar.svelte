<script lang="ts">
  export interface SettingsTab {
    id: string;
    icon: string;
    label: string;
    accent: string;
  }

  let {
    activeTab,
    ontabchange,
  }: {
    activeTab: string;
    ontabchange: (id: string) => void;
  } = $props();

  const tabs: SettingsTab[] = [
    { id: "general", icon: "⚙", label: "General", accent: "#8e8e93" },
    { id: "sound", icon: "🎵", label: "Sound", accent: "#ff375f" },
    { id: "focus", icon: "⏱", label: "Focus", accent: "#5e5ce6" },
    { id: "display", icon: "🎨", label: "Display", accent: "#0a84ff" },
    { id: "privacy", icon: "🔒", label: "Privacy", accent: "#30d158" },
  ];
</script>

<div class="settings-tab-bar">
  {#each tabs as t (t.id)}
    <button
      type="button"
      class="settings-tab-btn {t.id === activeTab ? 'active' : ''}"
      data-tab={t.id}
      style="--int-accent: {t.accent}"
      onclick={() => ontabchange(t.id)}
    >
      <span class="stb-icon icon-tile icon-tile--sm">{t.icon}</span>
      <span class="stb-label">{t.label}</span>
    </button>
  {/each}
</div>
