<script lang="ts">
  import {
    LOCALES_LIST,
    LOCALE_NAMES,
    LOCALE_FLAGS,
    getLocale,
    setLocale,
    type Locale,
  } from "../../i18n";
  import { showToast } from "../ui/toast";

  interface Props {
    onClose?: () => void;
  }

  let { onClose }: Props = $props();
  let currentLocale = $state<Locale>(getLocale());

  function handleSelect(locale: Locale) {
    setLocale(locale);
    currentLocale = locale;
    showToast(`${LOCALE_FLAGS[locale]} Language set to ${LOCALE_NAMES[locale]}`);
  }
</script>

<div
  class="sc-modal sc-modal--language"
  role="dialog"
  aria-modal="true"
  aria-label="Language"
>
  <div class="modal-header">
    <h2>🌐 Language</h2>
    <button
      class="modal-close"
      aria-label="Close"
      type="button"
      onclick={() => onClose?.()}
    >
      ✕
    </button>
  </div>
  <div id="languageContent" style="padding: 16px">
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
      {#each LOCALES_LIST as locale}
        <button
          type="button"
          class="lang-btn {locale === currentLocale ? 'lang-btn--active' : ''}"
          onclick={() => handleSelect(locale)}
        >
          <span class="lang-flag">{LOCALE_FLAGS[locale]}</span>
          <div>
            <div class="lang-name">{LOCALE_NAMES[locale]}</div>
            <div class="lang-code">{locale.toUpperCase()}</div>
          </div>
          {#if locale === currentLocale}
            <span class="lang-check">✓</span>
          {/if}
        </button>
      {/each}
    </div>
    <p class="lang-note">UI language only. Themes and content remain in English.</p>
  </div>
</div>
