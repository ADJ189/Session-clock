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
      // Mobile projects (Pixel 7, iPhone 13) run with their real device
      // viewport, touch, and DPR settings. Resizing a desktop browser does not
      // reproduce those, so the mobile projects do one overflow check at their
      // own device size instead of the desktop-resized cases.
      test.skip(
        isMobile && vp.name !== "phone",
        "mobile projects check their device viewport once, in the phone case",
      );
      if (!isMobile) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
      }
      // The device viewport differs from the case label (Pixel 7 is 412px,
      // iPhone 13 is 390px) — guard that it really is phone-sized.
      if (isMobile) {
        expect(page.viewportSize()?.width ?? 0).toBeLessThanOrEqual(430);
      }
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
