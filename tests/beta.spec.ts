import { test, expect, waitForBoot, contrastRatio } from "./fixtures";

/** Reads each tag's text, geometry and composed foreground/background. */
async function readTags(page: import("@playwright/test").Page, selector = ".beta-tag") {
  return readTagsFor(page, selector);
}

async function readTagsFor(page: import("@playwright/test").Page, selector: string) {
  return page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      // Compose the tag fill over the nearest opaque ancestor so the
      // contrast check measures what a reader actually sees.
      const parse = (value: string) => {
        const parts = (value.match(/[\d.]+/g) ?? []).map(Number);
        return {
          r: parts[0] ?? 0,
          g: parts[1] ?? 0,
          b: parts[2] ?? 0,
          a: parts.length > 3 ? parts[3]! : 1,
        };
      };
      let backdrop = { r: 0, g: 0, b: 0, a: 0 };
      let node: Element | null = el;
      while (node) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg.a > 0) {
          const alpha = bg.a + backdrop.a * (1 - bg.a);
          backdrop = {
            r: (bg.r * bg.a + backdrop.r * backdrop.a * (1 - bg.a)) / alpha,
            g: (bg.g * bg.a + backdrop.g * backdrop.a * (1 - bg.a)) / alpha,
            b: (bg.b * bg.a + backdrop.b * backdrop.a * (1 - bg.a)) / alpha,
            a: alpha,
          };
          if (alpha >= 0.999) break;
        }
        node = node.parentElement;
      }
      const fg = parse(s.color);
      return {
        text: (el.textContent ?? "").trim(),
        height: rect.height,
        width: rect.width,
        borderRadius: parseFloat(s.borderRadius),
        fontSize: parseFloat(s.fontSize),
        color: `rgb(${fg.r}, ${fg.g}, ${fg.b})`,
        background: `rgb(${backdrop.r}, ${backdrop.g}, ${backdrop.b})`,
        visible: rect.width > 0 && rect.height > 0,
      };
    }),
  );
}

test.describe("Beta status tag", () => {
  // Geometry is read from getBoundingClientRect(). The Settings dialog scales
  // in over 0.5s and its sections stagger with their own scale/translate, so a
  // measurement taken mid-animation differs between surfaces by a fraction of a
  // pixel. Freezing motion makes the sub-pixel height comparison deterministic
  // on slow CI runners without changing the pill's layout.
  test.use({ reducedMotion: "reduce" });

  test("appears in exactly four places and always says Beta", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);
    // The Integrations section (with the fourth tag) is built when Settings
    // first opens, so the full surface count is only observable afterwards.
    await page.locator("#btnSettings").click();
    await expect(page.locator("#settingsOverlay")).toHaveClass(/open/);

    // Static shells (settings + integrations titles), the Settings dock label
    // and the Integrations settings section.
    await expect(page.locator(".beta-tag")).toHaveCount(4);
    await expect(page.locator("#btnSettings .beta-tag")).toHaveText("Beta");
    await expect(
      page.locator("#settingsOverlay .modal-title-row .beta-tag"),
    ).toHaveText("Beta");
    await expect(
      page.locator("#integrationsOverlay .modal-title-row .beta-tag"),
    ).toHaveText("Beta");
    await expect(
      page.locator("#settingsContent .settings-section-title .beta-tag"),
    ).toHaveText("Beta");

    for (const tag of await readTags(page)) {
      expect(tag.text).toBe("Beta");
      expect(tag.text).not.toMatch(/\p{Extended_Pictographic}/u);
    }

    // The visible Beta tag must not rename the controls: each keeps its
    // original accessible name, with Beta exposed as the description.
    await expect(page.locator("#btnSettings")).toHaveAccessibleName("Settings");
    await expect(page.locator("#btnSettings")).toHaveAccessibleDescription(
      "Beta",
    );
    await expect(
      page.locator("#settingsOverlay .modal-title-row"),
    ).toHaveAccessibleName("Settings");
    await expect(
      page.locator("#settingsOverlay .modal-title-row"),
    ).toHaveAccessibleDescription("Beta");

    // The Integrations heading lives in a hidden overlay until the panel opens;
    // hidden nodes are excluded from the accessibility tree, so open it before
    // asserting its computed name/description.
    await page.evaluate(() => {
      const sc = (
        window as unknown as {
          SC?: { modals?: { open?: (id: string) => void } };
        }
      ).SC;
      sc?.modals?.open?.("integrationsOverlay");
    });
    await expect(page.locator("#integrationsOverlay")).toHaveClass(/open/);
    await expect(
      page.locator("#integrationsOverlay .modal-title-row"),
    ).toHaveAccessibleName("Integrations");
    await expect(
      page.locator("#integrationsOverlay .modal-title-row"),
    ).toHaveAccessibleDescription("Beta");
  });

  test("pill shape and type scale stay consistent across surfaces", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);
    await page.locator("#btnSettings").click();
    await expect(page.locator("#settingsOverlay")).toHaveClass(/open/);

    const dialogTags = await readTagsFor(
      page,
      "#settingsOverlay .modal-title-row .beta-tag, #settingsContent .settings-section-title .beta-tag",
    );
    const dock = (await readTagsFor(page, "#btnSettings .beta-tag"))[0]!;
    expect(dialogTags).toHaveLength(2);

    for (const tag of [...dialogTags, dock]) {
      // Fully rounded pill, not a rounded rectangle.
      expect(tag.borderRadius).toBeGreaterThanOrEqual(tag.height / 2 - 0.5);
      // Small status type; never a headline.
      expect(tag.fontSize).toBeGreaterThanOrEqual(7);
      expect(tag.fontSize).toBeLessThanOrEqual(12);
    }

    // Both dialog placements share one height. The dock tag is allowed to be a
    // touch tighter so it fits the compact button, but never larger.
    expect(
      Math.abs(dialogTags[0]!.height - dialogTags[1]!.height),
    ).toBeLessThanOrEqual(0.5);
    expect(dock.height).toBeLessThanOrEqual(dialogTags[0]!.height + 0.5);
  });

  test("stays readable in dark and light themes", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);

    const dark = await readTags(page);
    for (const tag of dark) {
      expect(contrastRatio(tag.color, tag.background)).toBeGreaterThanOrEqual(4.5);
    }

    await page.addInitScript(() => {
      localStorage.setItem("sc_last_theme", "nordic");
    });
    await page.reload();
    await waitForBoot(page);
    await expect(page.locator("body.light-theme")).toHaveCount(1);

    const light = await readTags(page);
    for (const tag of light) {
      expect(contrastRatio(tag.color, tag.background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("survives a 320px viewport without clipping @mobile", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");
    await waitForBoot(page);

    await expect(page.locator("#btnSettings .beta-tag")).toBeVisible();
    const dock = page.locator("#btnSettings");
    const tag = page.locator("#btnSettings .beta-tag");
    const dockBox = (await dock.boundingBox())!;
    const tagBox = (await tag.boundingBox())!;
    expect(tagBox.x).toBeGreaterThanOrEqual(dockBox.x - 0.5);
    expect(tagBox.x + tagBox.width).toBeLessThanOrEqual(dockBox.x + dockBox.width + 0.5);
    expect(tagBox.y).toBeGreaterThanOrEqual(dockBox.y - 0.5);
    expect(tagBox.y + tagBox.height).toBeLessThanOrEqual(dockBox.y + dockBox.height + 0.5);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
  });
});
