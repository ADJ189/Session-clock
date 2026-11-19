import { test, expect, waitForBoot } from "./fixtures";

async function runCommand(page: import("@playwright/test").Page, name: string) {
  await page.keyboard.press("Control+k");
  await page.locator(".cmd-input").fill(name);
  await page.locator(".cmd-item").filter({ hasText: name }).first().click();
}

test("Super Focus starts a 50-minute focus timer only when stopped", async ({ page }) => {
  await page.goto("/");
  await waitForBoot(page);
  await runCommand(page, "Super Focus Protocol");
  await expect(page.locator("body")).toHaveClass(/zen-mode/);
  await expect(page.locator("#sessionTimer")).toHaveText(/(?:49|50):\d\d/);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("sc_pom") || "{}").workMins)).toBe(50);
  await page.clock.install();
  await page.clock.runFor(4100);
  const before = await page.locator("#sessionTimer").textContent();
  await runCommand(page, "Start Session Timer");
  await expect(page.locator("body")).toHaveClass(/session-running/);
  const seconds = (value: string) => value.trim().split(":").reduce((total, part) => total * 60 + Number(part), 0);
  await expect.poll(async () => seconds((await page.locator("#sessionTimer").textContent())!)).toBeLessThanOrEqual(seconds(before!));
  await runCommand(page, "Pause Session Timer");
  await expect(page.locator("body")).not.toHaveClass(/session-running/);
  await runCommand(page, "Pause Session Timer");
  await expect(page.locator("body")).not.toHaveClass(/session-running/);
});

test("Power Nap starts a countdown and enables Zen dimming", async ({ page }) => {
  await page.goto("/");
  await waitForBoot(page);
  await runCommand(page, "20-Min Power Nap");
  await expect(page.locator("body")).toHaveClass(/zen-mode/);
  await expect(page.locator("#sessionStatusLine")).toContainText(/20-Min Power Nap/);
  await expect(page.locator("#sessionStatusLine")).toContainText(/(?:19m|20m)/);
});

test("word clock advances at rounded minutes and lights nine at rollover", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-06T08:57:00Z") });
  await page.addInitScript(() => localStorage.setItem("sc_clock_mode", "word"));
  await page.goto("/");
  await waitForBoot(page);
  const lit = () => page.locator("#wordClockGrid .wc-lit").allTextContents();
  await expect.poll(async () => (await lit()).join("")).toContain("FIVE");
  await page.clock.setSystemTime(new Date("2026-11-06T08:58:00Z"));
  await expect.poll(async () => (await lit()).join("")).toBe("ITISNINEEOCLOC");
  await page.clock.setSystemTime(new Date("2026-11-06T09:00:00Z"));
  await expect.poll(async () => (await lit()).join("")).toBe("ITISNINEEOCLOC");
  await page.clock.setSystemTime(new Date("2026-11-06T09:03:00Z"));
  await expect.poll(async () => (await lit()).join("")).toBe("ITISFIVEPASTNINE");
});

test("theme class replacement preserves the switching state", async ({ page }) => {
  await page.goto("/");
  await waitForBoot(page);
  await page.evaluate(() => {
    document.body.dataset.switchState = "pending";
    const observer = new MutationObserver(() => {
      if (document.body.classList.contains("theme-sunrise")) {
        document.body.dataset.switchState = String(document.body.classList.contains("theme-switching"));
        observer.disconnect();
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  });
  await runCommand(page, "Sunrise");
  await expect(page.locator("body")).toHaveAttribute("data-switch-state", "true");
});

test("paused non-Pomodoro QR handoff URL sets task without starting timer", async ({ page }) => {
  await page.goto("/?theme=zenith&clock=digital&task=Document+Review");
  await waitForBoot(page);

  await expect(page.locator("#focusInput")).toHaveValue("Document Review");
  await expect(page.locator("body")).not.toHaveClass(/session-running/);
  await expect(page.locator("#btnStart")).toHaveText(/Begin/);
  await expect.poll(() => page.evaluate(() => window.location.search)).toBe("");
});

test("opening QR handoff while paused with task generates URL with task and no ses or pom flags", async ({ page }) => {
  await page.goto("/");
  await waitForBoot(page);

  await page.locator("#focusInput").fill("Plan");
  await runCommand(page, "QR Handoff to Mobile");

  await expect(page.locator("#qrOverlay")).toBeVisible();
  const qrUrl = page.locator("#qrUrl");
  await expect(qrUrl).toContainText("task=Plan");
  const urlText = (await qrUrl.textContent()) || "";
  expect(urlText).not.toContain("ses=1");
  expect(urlText).not.toContain("pom=1");
  expect(urlText).not.toContain("start=1");
});

test("task-only or theme-only URLs do not discard a saved session", async ({ page }) => {
  await page.goto("/");
  await waitForBoot(page);

  await page.evaluate(() => {
    sessionStorage.setItem(
      "sc_saved_session",
      JSON.stringify({ task: "Preserved Task", elapsed: 42_000, running: false })
    );
  });

  await page.goto("/?theme=nord");
  await waitForBoot(page);

  await expect(page.locator("#focusInput")).toHaveValue("Preserved Task");
  await expect(page.locator("#sessionTimer")).toHaveText(/00:00:42/);
});

test("running handoff initializes button with pause action and active status", async ({ page }) => {
  await page.goto("/?theme=zenith&clock=digital&start=1");
  await waitForBoot(page);

  await expect(page.locator("body")).toHaveClass(/session-running/);
  await expect(page.locator("#btnStart")).toHaveText(/Take a Break|Pause/);
  await expect(page.locator("#sessionStatusLine")).not.toContainText("Ready when you are");
});

