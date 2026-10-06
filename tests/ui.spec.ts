import { test, expect, waitForBoot } from "./fixtures";

test.describe("command palette", () => {
  test("Ctrl+K opens, Escape closes", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);
    await page.keyboard.press("Control+k");
    await expect(page.locator("#cmdOverlay")).toHaveClass(/open/);
    await expect(page.locator("#cmdInput")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("#cmdOverlay")).not.toHaveClass(/open/);
  });

  test("toolbar button opens it", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);
    await page.locator("#btnCmdPalette").click();
    await expect(page.locator("#cmdOverlay")).toHaveClass(/open/);
  });
});

test.describe("responsive layout", () => {
  const viewports = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 820, height: 1180 },
    { name: "phone", width: 390, height: 844 },
    { name: "small phone", width: 320, height: 568 },
  ];

  for (const vp of viewports) {
    test(`no horizontal overflow at ${vp.name} (${vp.width}×${vp.height})`, async ({
      page,
      isMobile,
    }) => {
      // Mobile projects already run at phone size; resizing them is redundant.
      test.skip(isMobile, "covered by the desktop engines at phone width");
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await waitForBoot(page);
      await expect(page.locator("#btnStart")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
