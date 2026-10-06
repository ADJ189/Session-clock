import { test, expect, waitForBoot } from "./fixtures";

test.describe("session timer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);
  });

  test("start → pause → resume → reset", async ({ page, problems }) => {
    const body = page.locator("body");
    const start = page.locator("#btnStart");
    const timer = page.locator("#sessionTimer");

    await expect(body).not.toHaveClass(/session-running/);

    await start.click();
    await expect(body).toHaveClass(/session-running/);
    // Real async boundary: the display only advances once a second has passed.
    await expect(timer).not.toHaveText("00:00:00", { timeout: 5_000 });

    await start.click(); // pause
    await expect(body).not.toHaveClass(/session-running/);
    const paused = await timer.textContent();
    await page.waitForTimeout(1_300); // must NOT advance while paused
    await expect(timer).toHaveText(paused ?? "");

    await start.click(); // resume
    await expect(body).toHaveClass(/session-running/);

    await page.locator("#btnReset").click();
    await expect(body).not.toHaveClass(/session-running/);
    await expect(timer).toHaveText("00:00:00");
    expect(problems.pageErrors).toEqual([]);
  });

  test("Space toggles the timer", async ({ page }) => {
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Space");
    await expect(page.locator("body")).toHaveClass(/session-running/);
    await page.keyboard.press("Space");
    await expect(page.locator("body")).not.toHaveClass(/session-running/);
  });
});
