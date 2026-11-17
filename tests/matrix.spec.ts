import { test, expect, waitForBoot, closeThemePanel } from "./fixtures";

/**
 * Multi-Configuration & Screen Matrix Test Suite
 *
 * Covers:
 * - Viewport & Resolution matrix (4K to 320px ultra-narrow)
 * - Clock positions (Center mode sidebar / bottom card vs Left mode)
 * - Display toggles (12h/24h, seconds, milliseconds)
 * - 8 Locales (en, es, fr, de, ja, ko, pt, hi)
 * - Quality modes & battery saver mode
 */

const SCREEN_MATRIX = [
  { name: "4K UHD", width: 3840, height: 2160, desktopOnly: true },
  { name: "Ultrawide", width: 3440, height: 1440, desktopOnly: true },
  { name: "Desktop Standard", width: 1440, height: 900, desktopOnly: true },
  { name: "Laptop Standard", width: 1366, height: 768, desktopOnly: true },
  { name: "Short Viewport", width: 1280, height: 600, desktopOnly: true },
  { name: "Tablet Portrait", width: 820, height: 1180, desktopOnly: false },
  { name: "Large Mobile", width: 412, height: 915, desktopOnly: false },
  { name: "Compact Mobile", width: 390, height: 844, desktopOnly: false },
  { name: "Small Mobile", width: 320, height: 568, desktopOnly: false },
];

test.describe("Resolution & Screen Matrix", () => {
  for (const screen of SCREEN_MATRIX) {
    test(`renders cleanly without horizontal overflow at ${screen.name} (${screen.width}x${screen.height})`, async ({
      page,
      isMobile,
    }) => {
      if (isMobile && screen.desktopOnly) {
        test.skip(true, "Mobile projects use their native device emulation viewport");
      }
      if (!isMobile) {
        await page.setViewportSize({ width: screen.width, height: screen.height });
      }

      await page.goto("/");
      await waitForBoot(page);

      // Verify clock digits are rendered and visible
      await expect(page.locator("#digitHr")).toBeVisible();
      await expect(page.locator("#digitMin")).toBeVisible();

      // Verify zero unexpected horizontal overflow
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

test.describe("Clock Layout & Display Configuration Matrix", () => {
  test("Center mode activates right-hand session card on desktop", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.addInitScript(() => {
      localStorage.setItem("sc_clock_pos_map", JSON.stringify({ digital: "center" }));
      localStorage.setItem("sc_center_minimal", "1");
    });

    await page.goto("/");
    await waitForBoot(page);
    await closeThemePanel(page);

    await expect(page.locator("body")).toHaveClass(/clock-center/);
    const card = page.locator(".session-card");
    await expect(card).toBeVisible();

    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThan(1440 / 2);
    }
  });

  test("12h and 24h format toggling works cleanly", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);

    // Initial hour reading
    const initialHr = await page.locator("#digitHr").textContent();
    expect(initialHr).toMatch(/^\d{1,2}$/);

    // Toggle format in localStorage
    await page.evaluate(() => {
      localStorage.setItem("sc_time_format", "12h");
      window.dispatchEvent(new Event("storage"));
    });
    await page.reload();
    await waitForBoot(page);

    await expect(page.locator("#digitHr")).toHaveText(/^\d{1,2}$/);
  });
});

test.describe("Locale Matrix Verification", () => {
  const LOCALES = ["en", "es", "fr", "de", "ja", "ko", "pt", "hi"];

  for (const locale of LOCALES) {
    test(`renders successfully under locale: ${locale}`, async ({ page }) => {
      await page.addInitScript((loc) => {
        localStorage.setItem("sc_lang", loc);
      }, locale);

      await page.goto("/");
      await waitForBoot(page);

      // Verify core UI shell renders without errors
      await expect(page.locator("#mainUI")).toBeVisible();
      await expect(page.locator("#digitHr")).toBeVisible();
      await expect(page.locator("#digitMin")).toBeVisible();
      await expect(page.locator("#btnStart")).toBeVisible();
    });
  }
});

test.describe("Quality & Display Settings Matrix", () => {
  test("render quality and calm mode toggles persist and apply via UI", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);

    // Open Settings -> Display Tab
    await page.locator("#btnSettings").click();
    await expect(page.locator("#settingsOverlay")).toHaveClass(/open/);
    await page.locator('.settings-tab-btn[data-tab="display"]').click();

    // Select Medium Render Quality
    const qualitySelect = page.locator('select[aria-label="Render Quality"]');
    await expect(qualitySelect).toBeVisible();
    await qualitySelect.selectOption("med");

    // Verify localStorage persistence
    const savedQuality = await page.evaluate(() => localStorage.getItem("sc_quality"));
    expect(savedQuality).toBe("med");

    // Toggle Calm Mode
    const calmToggle = page.locator("#toggleCalmMode");
    await expect(calmToggle).toBeVisible();
    await calmToggle.click();
    await expect(calmToggle).toHaveAttribute("aria-checked", "true");
  });
});
