<script lang="ts">
  import * as Privacy from "../../privacy";
  import * as Motion from "../../motion";
  import { haptic } from "../../platform";
  import { showToast } from "../ui/toast";

  let incognito = $state(Privacy.isIncognito());
  let autoClear = $state(Privacy.isAutoClear());
  let revision = $state(0);

  function refresh() {
    incognito = Privacy.isIncognito();
    autoClear = Privacy.isAutoClear();
    revision++;
  }

  const totalBytes = $derived.by(() => {
    // depend on revision to re-calculate
    void revision;
    return Privacy.getTotalSize();
  });

  const categories = $derived.by(() => {
    void revision;
    return Privacy.DATA_CATEGORIES.map((cat) => ({
      ...cat,
      size: Privacy.getCategorySize(cat),
    }));
  });

  function toggleIncognito() {
    Privacy.setIncognito(!incognito);
    incognito = Privacy.isIncognito();
    showToast(
      incognito ? "🕵 Private Focus Log on" : "Private Focus Log off",
    );
  }

  function toggleAutoClear() {
    Privacy.setAutoClear(!autoClear);
    autoClear = Privacy.isAutoClear();
    showToast(autoClear ? "Auto-clear enabled" : "Auto-clear disabled");
  }

  function handleExport() {
    Privacy.exportAllData();
    showToast("Data exported as JSON");
  }

  function holdAction(
    node: HTMLElement,
    opts: { duration?: number; onStart?: () => void; onConfirm: () => void },
  ) {
    Motion.bindHoldToConfirm(node, opts.onConfirm, {
      duration: opts.duration,
      onStart: opts.onStart,
    });
  }

  function closeModal() {
    const modals = (
      window as unknown as {
        SC?: { modals?: { close?: (id: string) => void } };
      }
    ).SC?.modals;
    if (modals?.close) {
      modals.close("dataOverlay");
    } else {
      document.getElementById("dataOverlay")?.classList.remove("open");
    }
  }
</script>

<div class="sc-modal sc-modal--settings">
  <div class="modal-header">
    <h2>🔐 Your Data</h2>
    <button
      class="modal-close"
      aria-label="Close"
      type="button"
      onclick={closeModal}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  </div>

  <div id="dataContent">
    <div class="data-summary">
      <p class="data-total">
        Total stored: {Privacy.formatBytes(totalBytes)} — all on your device, never sent anywhere.
      </p>

      <div class="settings-row">
        <div class="settings-row-info">
          <span class="settings-row-label">🕵 Private Focus Log</span>
          <span class="settings-row-desc">
            Focus log entries stay in memory only for this tab — other settings/stats still save as usual
          </span>
        </div>
        <button
          class="settings-toggle {incognito ? 'on' : ''}"
          role="switch"
          aria-checked={incognito}
          aria-label="Private Focus Log"
          type="button"
          onclick={toggleIncognito}
        ></button>
      </div>

      <div class="settings-row">
        <div class="settings-row-info">
          <span class="settings-row-label">🗑 Auto-Clear on Close</span>
          <span class="settings-row-desc">
            Wipe session log & focus data when you close the tab
          </span>
        </div>
        <button
          class="settings-toggle {autoClear ? 'on' : ''}"
          role="switch"
          aria-checked={autoClear}
          aria-label="Auto-Clear on Close"
          type="button"
          onclick={toggleAutoClear}
        ></button>
      </div>
    </div>

    <div class="settings-section-title">Data Categories</div>

    {#each categories as cat (cat.id)}
      <div class="data-cat-row">
        <div class="data-cat-info">
          <span class="data-cat-icon">{cat.icon}</span>
          <div>
            <span class="data-cat-name">
              {cat.label}
              {#if cat.sensitive}
                <span class="data-sensitive-badge">Personal</span>
              {/if}
            </span>
            <span class="data-cat-desc">{cat.desc}</span>
          </div>
        </div>

        <div class="data-cat-right">
          <span class="data-cat-size">
            {cat.size > 0 ? Privacy.formatBytes(cat.size) : "empty"}
          </span>
          <button
            class="data-del-btn hold-confirm-btn"
            disabled={cat.size === 0}
            type="button"
            use:holdAction={{
              onStart: () => haptic(6),
              onConfirm: () => {
                haptic(18);
                Privacy.deleteCategory(cat);
                showToast(`${cat.icon} ${cat.label} cleared`);
                refresh();
              },
            }}
          >
            <span class="hold-confirm-fill"></span>
            <span class="hold-confirm-label">Hold to Clear</span>
          </button>
        </div>
      </div>
    {/each}

    <div class="data-actions">
      <button class="btn btn-ghost" type="button" onclick={handleExport}>
        ⬇ Export All Data
      </button>

      <button
        class="btn btn-ghost data-nuke-btn hold-confirm-btn"
        type="button"
        use:holdAction={{
          duration: 1100,
          onStart: () => haptic(6),
          onConfirm: () => {
            haptic(24);
            Privacy.deleteAll();
            showToast("All data deleted");
            refresh();
          },
        }}
      >
        <span class="hold-confirm-fill"></span>
        <span class="hold-confirm-label">🗑 Hold to Delete Everything</span>
      </button>
    </div>
  </div>
</div>
