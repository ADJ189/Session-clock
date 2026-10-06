import { test, expect, waitForBoot } from "./fixtures";

test.describe("storage resilience", () => {
  const corrupted: Array<[string, string]> = [
    ["malformed JSON", "{broken-json"],
    ["wrong shape (object, not array)", '{"a":1}'],
    ["JSON null", "null"],
    ["empty string", ""],
  ];

  for (const [label, value] of corrupted) {
    test(`survives sc_focus_log = ${label}`, async ({ page, problems }) => {
      await page.addInitScript(
        ([k, v]) => localStorage.setItem(k, v),
        ["sc_focus_log", value] as [string, string],
      );
      await page.goto("/");
      await waitForBoot(page);
      expect(problems.pageErrors).toEqual([]);
    });
  }

  test("a malformed focus log is repaired (removed) rather than left to break later", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem("sc_focus_log", "{broken-json");
      }
    });
    await page.goto("/");
    await waitForBoot(page);
    const raw = await page.evaluate(() => localStorage.getItem("sc_focus_log"));
    // Either removed, or replaced with valid JSON — never still the garbage.
    if (raw !== null) expect(() => JSON.parse(raw)).not.toThrow();
  });

  test("survives an unknown/invalid saved theme id", async ({ page, problems }) => {
    await page.addInitScript(() => localStorage.setItem("sc_last_theme", "no-such-theme"));
    await page.goto("/");
    await waitForBoot(page);
    expect(problems.pageErrors).toEqual([]);
  });

  test("survives localStorage throwing on every access (privacy modes / webviews)", async ({
    page,
    problems,
  }) => {
    await page.addInitScript(() => {
      const boom = () => {
        throw new DOMException("denied", "SecurityError");
      };
      for (const name of ["getItem", "setItem", "removeItem", "clear", "key"] as const) {
        Object.defineProperty(Storage.prototype, name, { value: boom, configurable: true });
      }
    });
    await page.goto("/");
    await waitForBoot(page);
    expect(problems.pageErrors).toEqual([]);
  });

  test("saved theme survives a reload", async ({ page }) => {
    await page.goto("/");
    await waitForBoot(page);
    const before = await page.evaluate(() => localStorage.getItem("sc_last_theme"));
    expect(before).not.toBeNull();
    await page.reload();
    await waitForBoot(page);
    expect(await page.evaluate(() => localStorage.getItem("sc_last_theme"))).toBe(before);
  });
});
