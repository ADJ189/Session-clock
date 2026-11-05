import { test, expect, waitForBoot } from "./fixtures";

test.describe("optional analytics resilience and privacy settings", () => {
  test("boot succeeds and app remains fully functional when analytics is blocked", async ({
    page,
  }) => {
    // Cross-origin requests (including beacon.min.js) are aborted by fixtures.
    await page.goto("/");
    await waitForBoot(page);

    // App core is fully running
    await expect(page.locator("#clock-block-wrap")).toBeVisible();
    await expect(page.locator("#scBootErr")).toHaveCount(0);

    // Timer controls work normally
    const startBtn = page.locator("#btnStart");
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await page.waitForTimeout(300);
    const resetBtn = page.locator("#btnReset");
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Open Settings -> Privacy tab
    await page.locator("#btnSettings").click();
    await expect(page.locator("#settingsOverlay")).toHaveClass(/open/);

    const privacyTab = page.locator(".settings-tab-btn[data-tab='privacy']");
    await privacyTab.click();

    // Verify Optional Usage Analytics section appears
    const analyticsRow = page.locator(".settings-row", {
      hasText: "Optional Usage Analytics",
    });
    await expect(analyticsRow).toBeVisible();

    // When blocked, badge reports "Off (unavailable)" and explanation is clear
    await expect(analyticsRow.locator(".settings-badge")).toHaveText(
      /Off \(unavailable\)/i,
    );
    await expect(
      page.locator(".settings-row-desc", {
        hasText: /Analytics could not load/i,
      }),
    ).toBeVisible();

    // Privacy reassurance note is present
    await expect(page.locator(".settings-privacy-note")).toBeVisible();
    await expect(page.locator(".settings-privacy-note")).toHaveText(
      /We value your privacy/i,
    );
  });

  test("analytics displays 'On (automatic)' when beacon loads successfully", async ({
    page,
    context,
  }) => {
    // Intercept cloudflare beacon to simulate successful load
    await context.route(
      (url) => url.hostname === "static.cloudflareinsights.com",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "window.__cf_beacon_loaded = true;",
        }),
    );

    await page.goto("/");
    await waitForBoot(page);

    // Open Settings -> Privacy
    await page.locator("#btnSettings").click();
    await page.locator(".settings-tab-btn[data-tab='privacy']").click();

    const analyticsRow = page.locator(".settings-row", {
      hasText: "Optional Usage Analytics",
    });
    await expect(analyticsRow).toBeVisible();

    // Status shows active On (automatic)
    await expect(analyticsRow.locator(".settings-badge")).toHaveText(
      /On \(automatic\)/i,
    );
  });

  test("explicit user Off persists and suppresses beacon loading", async ({
    page,
    context,
  }) => {
    let beaconRequested = false;
    await context.route(
      (url) => url.hostname === "static.cloudflareinsights.com",
      (route) => {
        beaconRequested = true;
        route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "// mock beacon",
        });
      },
    );

    // Pre-set preference to "off" in localStorage
    await page.addInitScript(() => {
      localStorage.setItem("sc_analytics_mode", "off");
    });

    await page.goto("/");
    await waitForBoot(page);

    // Open Settings -> Privacy
    await page.locator("#btnSettings").click();
    await page.locator(".settings-tab-btn[data-tab='privacy']").click();

    const analyticsRow = page.locator(".settings-row", {
      hasText: "Optional Usage Analytics",
    });
    await expect(analyticsRow).toBeVisible();
    await expect(analyticsRow.locator(".settings-badge")).toHaveText(
      /Off \(disabled\)/i,
    );

    // Verify beacon was never requested
    expect(beaconRequested).toBe(false);
  });

  test("Privacy Mode disables analytics and shows Privacy Mode badge", async ({
    page,
  }) => {
    // Pre-set Privacy Mode on
    await page.addInitScript(() => {
      localStorage.setItem("sc_privacy", "1");
    });

    await page.goto("/");
    await waitForBoot(page);

    // Open Settings -> Privacy
    await page.locator("#btnSettings").click();
    await page.locator(".settings-tab-btn[data-tab='privacy']").click();

    const analyticsRow = page.locator(".settings-row", {
      hasText: "Optional Usage Analytics",
    });
    await expect(analyticsRow).toBeVisible();
    await expect(analyticsRow.locator(".settings-badge")).toHaveText(
      /Off \(Privacy Mode\)/i,
    );
    await expect(
      page.locator(".settings-row-desc", {
        hasText: /Disabled by Privacy Mode/i,
      }),
    ).toBeVisible();
  });
});
