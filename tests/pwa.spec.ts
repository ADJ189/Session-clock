import { test, expect, waitForBoot } from "./fixtures";

test.describe("PWA / service worker", () => {
  test("registers, activates, and the app still boots after a reload", async ({ page, problems }) => {
    await page.goto("/");
    await waitForBoot(page);

    const active = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });
    expect(active).toBe(true);

    await page.reload();
    await waitForBoot(page);
    expect(problems.pageErrors).toEqual([]);
  });

  test("manifest is valid and icons resolve", async ({ page, request }) => {
    await page.goto("/");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBeTruthy();
    const res = await request.get(href!);
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest.name).toBeTruthy();
    for (const icon of manifest.icons ?? []) {
      const r = await request.get(icon.src);
      expect(r.ok(), `icon ${icon.src}`).toBe(true);
    }
  });

  test("precache manifest is emitted by the build", async ({ request }) => {
    const res = await request.get("/precache-manifest.json");
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.version).toMatch(/^[0-9a-f]{12}$/);
    expect(m.files.length).toBeGreaterThan(0);
  });

  // Chromium only: offline emulation + service workers is unreliable in
  // Playwright's Firefox/WebKit builds, so this would produce false failures.
  test("loads offline after the first visit (Chromium)", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "offline + SW emulation is only reliable in Chromium");
    await page.goto("/");
    await waitForBoot(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Let install-time precaching finish.
    await expect
      .poll(() => page.evaluate(async () => (await caches.keys()).length), { timeout: 15_000 })
      .toBeGreaterThan(0);

    await context.setOffline(true);
    await page.reload();
    await waitForBoot(page);
  });
});
