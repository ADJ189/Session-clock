import { test, expect, waitForBoot } from "./fixtures";

test.describe("startup", () => {
  test("boots cleanly: no exceptions, no failed own assets, no boot-error screen", async ({
    page,
    problems,
  }) => {
    await page.goto("/");
    await waitForBoot(page);

    expect(problems.pageErrors).toEqual([]);
    expect(problems.failedRequests).toEqual([]);
    expect(problems.consoleErrors).toEqual([]);
    await expect(page).toHaveTitle("Session Clock");
  });

  test("splash is shown, then goes away", async ({ page }) => {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator("#splashScreen")).toBeVisible();
    await expect(page.locator("#splashScreen")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.locator("#mainUI")).toBeVisible();
  });

  test("splash logo stays at its CSS size (inline CSS, not the 664×693 PNG)", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "commit" });
    const logo = page.locator(".splash-mark-base").first();
    await expect(logo).toBeVisible();
    const box = await logo.boundingBox();
    expect(box).not.toBeNull();
    // Inline CSS caps the mark at min(30vw, 132px) wrapper width.
    expect(box!.width).toBeLessThanOrEqual(140);
    expect(box!.height).toBeLessThanOrEqual(150);
  });

  test("a blocked stylesheet/font does not take the app down", async ({
    page,
    context,
    problems,
  }) => {
    await context.route(/\.css(\?|$)/, (route) => route.abort());
    await page.goto("/");
    await waitForBoot(page);
    expect(problems.pageErrors).toEqual([]);
  });

  test("a failed app script shows the recoverable boot-error screen", async ({
    page,
    context,
  }) => {
    await context.route(/\/assets\/.*\.js(\?|$)/, (route) => route.abort());
    await page.goto("/");
    const err = page.locator("#scBootErr");
    await expect(err).toBeVisible({ timeout: 15_000 });
    await expect(err.getByRole("button", { name: "Reload" })).toBeVisible();
    await expect(
      err.getByRole("button", { name: /Reset local app data/ }),
    ).toBeVisible();
  });

  test("repeated cold loads stay stable", async ({ page, problems }) => {
    for (let i = 0; i < 4; i++) {
      await page.goto("/");
      await waitForBoot(page);
      await page.reload();
      await waitForBoot(page);
    }
    expect(problems.pageErrors).toEqual([]);
  });

  test.describe("first run", () => {
    test.use({ firstRun: true });

    test("shows the onboarding overlay for a brand-new visitor", async ({
      page,
    }) => {
      await page.goto("/");
      await waitForBoot(page);
      await expect(page.locator("#onboardOverlay")).toHaveClass(/open/);
    });
  });
});
