<script lang="ts">
  import SettingsSection from "../../shared/SettingsSection.svelte";
  import SettingsRow from "../../shared/SettingsRow.svelte";

  let {
    privacyMode = false,
    analyticsTitle = "Optional Usage Analytics",
    analyticsDesc = "Help us improve with privacy-friendly page view stats",
    analyticsBadge = undefined,
    analyticsOn = true,
    showRetryAnalytics = false,
    showAutoAnalytics = false,
    retryAnalyticsLabel = "Enable Analytics",
    autoAnalyticsLabel = "Reset to Auto",
    analyticsReassurance = "We value your privacy. Session Clock uses Cloudflare Web Analytics, which does not use cookies, does not collect personal data, and does not track you across sites.",
    incognito = false,
    autoClear = false,
    ontogglePrivacy,
    ontoggleAnalytics,
    onretryAnalytics,
    onautoAnalytics,
    ontoggleIncognito,
    ontoggleAutoClear,
    onopendata,
    onopenlegal,
  }: {
    privacyMode?: boolean;
    analyticsTitle?: string;
    analyticsDesc?: string;
    analyticsBadge?: string;
    analyticsOn?: boolean;
    showRetryAnalytics?: boolean;
    showAutoAnalytics?: boolean;
    retryAnalyticsLabel?: string;
    autoAnalyticsLabel?: string;
    analyticsReassurance?: string;
    incognito?: boolean;
    autoClear?: boolean;
    ontogglePrivacy: (val: boolean) => void;
    ontoggleAnalytics: (val: boolean) => void;
    onretryAnalytics: () => void;
    onautoAnalytics: () => void;
    ontoggleIncognito: (val: boolean) => void;
    ontoggleAutoClear: (val: boolean) => void;
    onopendata: () => void;
    onopenlegal: (doc: "privacy" | "terms") => void;
  } = $props();
</script>

<SettingsSection title="Privacy Mode">
  <SettingsRow
    label="Privacy Mode"
    description="Disables weather, Google Fonts and analytics — local only"
    btnId="togglePrivacyS"
    checked={privacyMode}
    badge={privacyMode ? "On" : undefined}
    onchange={ontogglePrivacy}
  />
</SettingsSection>

<SettingsSection title={analyticsTitle} id="analyticsSettingsSec">
  <SettingsRow
    label={analyticsTitle}
    description={analyticsDesc}
    badge={analyticsBadge}
    btnId="toggleAnalyticsS"
    checked={analyticsOn}
    onchange={ontoggleAnalytics}
  />
  {#if showRetryAnalytics || showAutoAnalytics}
    <div class="settings-action-grid" style="padding-top: 4px;">
      {#if showRetryAnalytics}
        <button
          type="button"
          class="settings-action-btn"
          id="btnRetryAnalytics"
          onclick={onretryAnalytics}
        >
          🔄 {retryAnalyticsLabel}
        </button>
      {/if}
      {#if showAutoAnalytics}
        <button
          type="button"
          class="settings-action-btn"
          id="btnAutoAnalytics"
          onclick={onautoAnalytics}
        >
          ⚡ {autoAnalyticsLabel}
        </button>
      {/if}
    </div>
  {/if}
  <div class="settings-privacy-note">{analyticsReassurance}</div>
</SettingsSection>

<SettingsSection title="Sessions">
  <SettingsRow
    label="Private Focus Log"
    description="Focus log entries stay in memory only for this tab — other settings/stats still save as usual"
    btnId="toggleIncognito"
    checked={incognito}
    onchange={ontoggleIncognito}
  />
  <SettingsRow
    label="Auto-Clear on Close"
    description="Wipe session log & focus data when tab closes"
    btnId="toggleAutoClear"
    checked={autoClear}
    onchange={ontoggleAutoClear}
  />
</SettingsSection>

<SettingsSection title="Data">
  <button
    type="button"
    class="settings-action-btn settings-action-btn--full"
    onclick={onopendata}
  >
    🛡 View & Manage My Data
  </button>
</SettingsSection>

<SettingsSection title="Legal">
  <button
    type="button"
    class="settings-action-btn settings-action-btn--full"
    onclick={() => onopenlegal("privacy")}
  >
    📄 Privacy Policy
  </button>
  <button
    type="button"
    class="settings-action-btn settings-action-btn--full"
    onclick={() => onopenlegal("terms")}
  >
    📃 Terms of Service
  </button>
</SettingsSection>
