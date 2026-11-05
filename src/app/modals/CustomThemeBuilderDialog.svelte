<script lang="ts">
  import {
    themeBuilderController,
    THEME_FIELDS,
    QUICK_PICKS,
    type ThemeBuilderSnapshot,
  } from "../controllers/theme-builder-controller";
  import { hslToHex } from "../utils/color";
  import { showToast } from "../ui/toast";

  let snapshot = $state<ThemeBuilderSnapshot>(
    themeBuilderController.getSnapshot(),
  );
  let importCode = $state("");

  let gradCanvas: HTMLCanvasElement | null = $state(null);
  let hueCanvas: HTMLCanvasElement | null = $state(null);

  const canvasSize = Math.min(
    280,
    (typeof window !== "undefined" ? window.innerWidth : 320) - 60,
  );
  const gradHeight = Math.floor(canvasSize * 0.55);

  $effect(() => {
    const unsub = themeBuilderController.subscribe((next) => {
      snapshot = next;
    });
    return unsub;
  });

  const activeFieldDef = $derived(
    THEME_FIELDS.find((f) => f.key === snapshot.activeField) || THEME_FIELDS[0],
  );

  function drawGradCanvas(hue: number, sat: number, lit: number, hex: string) {
    if (!gradCanvas) return;
    const ctx = gradCanvas.getContext("2d");
    if (!ctx) return;
    const W = gradCanvas.width;
    const H = gradCanvas.height;

    // Saturation gradient (left=white, right=hue)
    const satGrad = ctx.createLinearGradient(0, 0, W, 0);
    satGrad.addColorStop(0, "white");
    satGrad.addColorStop(1, `hsl(${hue},100%,50%)`);
    ctx.fillStyle = satGrad;
    ctx.fillRect(0, 0, W, H);

    // Lightness gradient (top=transparent, bottom=black)
    const litGrad = ctx.createLinearGradient(0, 0, 0, H);
    litGrad.addColorStop(0, "transparent");
    litGrad.addColorStop(1, "black");
    ctx.fillStyle = litGrad;
    ctx.fillRect(0, 0, W, H);

    // Draw current position cursor
    const cx = (sat / 100) * W;
    const cy = (1 - lit / 100) * H;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.strokeStyle = lit > 50 ? "rgba(0,0,0,.6)" : "rgba(255,255,255,.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = hex;
    ctx.fill();
  }

  function drawHueStrip(hue: number) {
    if (!hueCanvas) return;
    const ctx = hueCanvas.getContext("2d");
    if (!ctx) return;
    const W = hueCanvas.width;
    const H = hueCanvas.height;

    const hueGrad = ctx.createLinearGradient(0, 0, W, 0);
    for (let i = 0; i <= 360; i += 30) {
      hueGrad.addColorStop(i / 360, `hsl(${i},100%,50%)`);
    }
    ctx.fillStyle = hueGrad;
    ctx.fillRect(0, 0, W, H);

    // Cursor
    const cx = (hue / 360) * W;
    ctx.beginPath();
    ctx.arc(cx, H / 2, H / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  $effect(() => {
    // Redraw whenever canvas elements or active colors change
    if (gradCanvas && hueCanvas) {
      const [h, s, l] = snapshot.hsl;
      drawGradCanvas(h, s, l, snapshot.activeHex);
      drawHueStrip(h);
    }
  });

  // Pointer drag bindings
  $effect(() => {
    if (!gradCanvas || !hueCanvas) return;
    const controller = new AbortController();
    const { signal } = controller;

    let gradDragging = false;
    let hueDragging = false;

    const updateFromGrad = (e: MouseEvent | Touch) => {
      if (!gradCanvas) return;
      const r = gradCanvas.getBoundingClientRect();
      const xPct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      const yPct = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      const newS = Math.round(xPct * 100);
      const newL = Math.round((1 - yPct) * 100);
      const hex = hslToHex(snapshot.hsl[0], newS, newL);
      themeBuilderController.setDraftColor(hex);
    };

    const updateFromHue = (e: MouseEvent | Touch) => {
      if (!hueCanvas) return;
      const r = hueCanvas.getBoundingClientRect();
      const xPct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      const newH = Math.round(xPct * 360);
      const hex = hslToHex(newH, snapshot.hsl[1], snapshot.hsl[2]);
      themeBuilderController.setDraftColor(hex);
    };

    gradCanvas.addEventListener(
      "mousedown",
      (e) => {
        gradDragging = true;
        updateFromGrad(e);
      },
      { signal },
    );
    gradCanvas.addEventListener(
      "touchstart",
      (e) => {
        gradDragging = true;
        if (e.touches[0]) updateFromGrad(e.touches[0]);
      },
      { passive: true, signal },
    );

    hueCanvas.addEventListener(
      "mousedown",
      (e) => {
        hueDragging = true;
        updateFromHue(e);
      },
      { signal },
    );
    hueCanvas.addEventListener(
      "touchstart",
      (e) => {
        hueDragging = true;
        if (e.touches[0]) updateFromHue(e.touches[0]);
      },
      { passive: true, signal },
    );

    window.addEventListener(
      "mousemove",
      (e) => {
        if (gradDragging) updateFromGrad(e);
        if (hueDragging) updateFromHue(e);
      },
      { signal },
    );
    window.addEventListener(
      "mouseup",
      () => {
        gradDragging = false;
        hueDragging = false;
      },
      { signal },
    );
    window.addEventListener(
      "touchend",
      () => {
        gradDragging = false;
        hueDragging = false;
      },
      { passive: true, signal },
    );
    gradCanvas.addEventListener(
      "touchmove",
      (e) => {
        if (gradDragging && e.touches[0]) updateFromGrad(e.touches[0]);
      },
      { passive: true, signal },
    );
    hueCanvas.addEventListener(
      "touchmove",
      (e) => {
        if (hueDragging && e.touches[0]) updateFromHue(e.touches[0]);
      },
      { passive: true, signal },
    );

    return () => {
      controller.abort();
    };
  });
</script>

<div class="sc-modal">
  <div class="modal-header">
    <h2>🎨 Custom Theme</h2>
    <button
      class="modal-close"
      aria-label="Close"
      type="button"
      onclick={() => themeBuilderController.closeModal()}
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

  <h3>Colors</h3>
  <div id="colorRows">
    <!-- Swatch bar -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;padding:0 22px 16px;">
      {#each THEME_FIELDS as f}
        <button
          class="color-swatch-pill {f.key === snapshot.activeField ? 'active' : ''}"
          data-key={f.key}
          type="button"
          onclick={() => themeBuilderController.setActiveField(f.key)}
        >
          <span
            style="width:14px;height:14px;border-radius:50%;background:{snapshot.fieldHexes[f.key]};flex-shrink:0;box-shadow:0 0 0 1.5px rgba(255,255,255,.15);"
          ></span>
          <span style="font-size:.62rem;font-weight:600;">{f.label}</span>
        </button>
      {/each}
    </div>

    <!-- Active field info & picker -->
    <div style="padding:0 22px;">
      <div
        style="font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;opacity:.45;margin-bottom:12px;"
      >
        {activeFieldDef.icon} {activeFieldDef.label} — {activeFieldDef.hint}
      </div>

      <!-- Saturation / Lightness canvas -->
      <canvas
        bind:this={gradCanvas}
        width={canvasSize}
        height={gradHeight}
        style="width:100%;border-radius:10px;cursor:crosshair;display:block;margin-bottom:10px;touch-action:none;"
      ></canvas>

      <!-- Hue strip canvas -->
      <canvas
        bind:this={hueCanvas}
        width={canvasSize}
        height={18}
        style="width:100%;border-radius:6px;cursor:crosshair;display:block;margin-bottom:10px;touch-action:none;"
      ></canvas>

      <!-- Hex / RGB / HSL inputs -->
      <div
        style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px;"
      >
        <div style="display:flex;flex-direction:column;gap:3px;">
          <label
            style="font-size:.5rem;opacity:.4;letter-spacing:.08em;text-transform:uppercase;"
            for="picker-hex"
          >
            Hex
          </label>
          <input
            id="picker-hex"
            style="padding:6px 8px;border-radius:7px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:var(--clr-text);font-family:monospace;font-size:.68rem;width:100%;box-sizing:border-box;"
            value={snapshot.activeHex}
            onchange={(e) =>
              themeBuilderController.setHex(
                (e.currentTarget as HTMLInputElement).value.trim(),
              )}
          />
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          <label
            style="font-size:.5rem;opacity:.4;letter-spacing:.08em;text-transform:uppercase;"
            for="picker-rgb"
          >
            RGB
          </label>
          <input
            id="picker-rgb"
            style="padding:6px 8px;border-radius:7px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:var(--clr-text);font-family:monospace;font-size:.68rem;width:100%;box-sizing:border-box;"
            value="{snapshot.rgb[0]}, {snapshot.rgb[1]}, {snapshot.rgb[2]}"
            onchange={(e) =>
              themeBuilderController.setRgb(
                (e.currentTarget as HTMLInputElement).value.trim(),
              )}
          />
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          <label
            style="font-size:.5rem;opacity:.4;letter-spacing:.08em;text-transform:uppercase;"
            for="picker-hsl"
          >
            HSL
          </label>
          <input
            id="picker-hsl"
            style="padding:6px 8px;border-radius:7px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:var(--clr-text);font-family:monospace;font-size:.68rem;width:100%;box-sizing:border-box;"
            value="{snapshot.hsl[0]}, {snapshot.hsl[1]}%, {snapshot.hsl[2]}%"
            onchange={(e) =>
              themeBuilderController.setHsl(
                (e.currentTarget as HTMLInputElement).value.trim(),
              )}
          />
        </div>
      </div>

      <!-- Quick picks -->
      <div
        style="font-size:.52rem;opacity:.35;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;"
      >
        Quick picks
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">
        {#each QUICK_PICKS as c}
          <button
            type="button"
            style="width:22px;height:22px;border-radius:50%;background:{c};border:2px solid rgba(255,255,255,.15);cursor:pointer;transition:transform .15s;flex-shrink:0;"
            title={c}
            onclick={() => themeBuilderController.setDraftColor(c)}
          ></button>
        {/each}
      </div>
    </div>
  </div>

  <div class="modal-actions">
    <button
      class="btn btn-primary"
      type="button"
      onclick={() => themeBuilderController.preview()}
    >
      Preview
    </button>
    <button
      class="btn btn-ghost"
      type="button"
      onclick={() => themeBuilderController.save()}
    >
      Save
    </button>
    <button
      class="btn btn-ghost"
      type="button"
      onclick={() => themeBuilderController.reset()}
    >
      Reset
    </button>
  </div>

  <h3>Share</h3>
  <div class="theme-share-row">
    <button
      class="btn btn-ghost"
      type="button"
      onclick={() => themeBuilderController.export()}
    >
      📋 Copy theme code
    </button>
    <div class="theme-import-row">
      <input
        type="text"
        id="themeImportCode"
        placeholder="Paste a theme code…"
        autocomplete="off"
        spellcheck="false"
        bind:value={importCode}
      />
      <button
        class="btn btn-ghost"
        type="button"
        onclick={() => {
          if (!importCode.trim()) {
            showToast("Paste a theme code first");
            return;
          }
          if (themeBuilderController.import(importCode)) {
            importCode = "";
          }
        }}
      >
        Import
      </button>
    </div>
  </div>

  <h3>Saved Themes</h3>
  <div class="saved-theme-row" id="savedThemeRow">
    {#if !snapshot.savedThemes.length}
      <span style="font-size:.65rem;opacity:.3;color:var(--clr-text)">
        No saved themes yet
      </span>
    {:else}
      {#each snapshot.savedThemes as item}
        <button
          type="button"
          class="saved-swatch"
          style="background:{item.draft.accent};border:none;cursor:pointer;"
          title={item.name}
          onclick={() => themeBuilderController.loadSaved(item)}
        ></button>
      {/each}
    {/if}
  </div>
</div>
