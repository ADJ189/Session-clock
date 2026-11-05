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
  // Geometry is read from getBoundingClientRect(). Freezing motion makes
  // the sub-pixel height comparison deterministic on slow CI runners.
  test.use({ reducedMotion: "reduce" });

  test("Settings is stable and Integrations surfaces carry Beta tags", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);

    // Settings button must NOT have a Beta tag and keeps its clean accessible name
    await expect(page.locator("#btnSettings .beta-tag")).toHaveCount(0);
    await expect(page.locator("#btnSettings")).toHaveAccessibleName("Settings");

    await page.locator("#btnSettings").click();
    await expect(page.locator("#settingsOverlay")).toHaveClass(/open/);

    // Settings title must NOT have a Beta tag
    await expect(
      page.locator("#settingsOverlay .modal-title-row .beta-tag"),
    ).toHaveCount(0);
    await expect(
      page.locator("#settingsOverlay .modal-title-row"),
    ).toHaveAccessibleName("Settings");
    await expect(
      page.locator("#settingsOverlay .modal-title-row"),
    ).not.toHaveAccessibleDescription("Beta");

    // The Integrations section in Settings General has a Beta tag
    await expect(
      page.locator("#settingsContent .settings-section-title .beta-tag"),
    ).toHaveText("Beta");
    await expect(page.locator("#betaTagSection")).toBeVisible();

    // Open Integrations modal
    await page.evaluate(() => {
      const sc = (
        window as unknown as {
          SC?: { modals?: { open?: (id: string) => void } };
        }
      ).SC;
      sc?.modals?.open?.("integrationsOverlay");
    });
    await expect(page.locator("#integrationsOverlay")).toHaveClass(/open/);

    // Integrations modal title carries a Beta tag and exposes it as description
    await expect(
      page.locator("#integrationsOverlay .modal-title-row .beta-tag"),
    ).toHaveText("Beta");
    await expect(
      page.locator("#integrationsOverlay .modal-title-row"),
    ).toHaveAccessibleName("Integrations");
    await expect(
      page.locator("#integrationsOverlay .modal-title-row"),
    ).toHaveAccessibleDescription("Beta");

    // Provider cards carry Beta on their headers once each
    const providerHeaders = page.locator("#integrationsContent .int-card-header");
    const count = await providerHeaders.count();
    expect(count).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < count; i++) {
      const header = providerHeaders.nth(i);
      await expect(header.locator(".beta-tag")).toHaveCount(1);
      await expect(header.locator(".beta-tag")).toHaveText("Beta");
      await expect(header).toHaveAccessibleDescription("Beta");
    }

    // Inner forms do NOT duplicate Beta tags on child actions
    await expect(page.locator("#integrationsContent .int-form .beta-tag")).toHaveCount(0);

    // Ensure all Beta tags on the page say "Beta", have no emoji, and have unique IDs
    const tags = await page.locator(".beta-tag").all();
    const ids: string[] = [];
    for (const tag of tags) {
      const text = (await tag.textContent() ?? "").trim();
      expect(text).toBe("Beta");
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      const id = await tag.getAttribute("id");
      if (id) ids.push(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("pill shape and type scale stay consistent across surfaces", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);
    await page.locator("#btnSettings").click();
    await expect(page.locator("#settingsOverlay")).toHaveClass(/open/);

    await page.evaluate(() => {
      const sc = (
        window as unknown as {
          SC?: { modals?: { open?: (id: string) => void } };
        }
      ).SC;
      sc?.modals?.open?.("integrationsOverlay");
    });
    await expect(page.locator("#integrationsOverlay")).toHaveClass(/open/);

    const dialogTags = await readTagsFor(
      page,
      "#integrationsOverlay .modal-title-row .beta-tag, #settingsContent .settings-section-title .beta-tag, .int-card-header .beta-tag",
    );
    expect(dialogTags.length).toBeGreaterThanOrEqual(2);

    for (const tag of dialogTags) {
      // Fully rounded pill, not a sharp rectangle.
      expect(tag.borderRadius).toBeGreaterThanOrEqual(tag.height / 2 - 0.5);
      // Small status type; never a headline.
      expect(tag.fontSize).toBeGreaterThanOrEqual(7);
      expect(tag.fontSize).toBeLessThanOrEqual(14);
    }
  });

  test("stays readable in dark and light themes", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);

    await page.locator("#btnSettings").click();
    await expect(page.locator("#settingsOverlay")).toHaveClass(/open/);

    const dark = await readTags(page);
    for (const tag of dark) {
      expect(contrastRatio(tag.color, tag.background)).toBeGreaterThanOrEqual(4.5);
    }

    await page.addInitScript(() => {
      localStorage.setItem("sc_last_theme", "nordic");
    });
    await page.reload();
    await waitForBoot(page);
    await page.locator("#btnSettings").click();
    await expect(page.locator("#settingsOverlay")).toHaveClass(/open/);
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

    await page.locator("#btnSettings").click();
    await expect(page.locator("#settingsOverlay")).toHaveClass(/open/);

    const tag = page.locator("#settingsContent .settings-section-title .beta-tag").first();
    await expect(tag).toBeVisible();
    const tagBox = (await tag.boundingBox())!;
    expect(tagBox.width).toBeGreaterThan(0);
    expect(tagBox.height).toBeGreaterThan(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
  });
});
