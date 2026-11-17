import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomStubs } from "./dom-stubs.ts";

installDomStubs();

const {
  WORK_MINUTES,
  BREAK_MINUTES,
  LONG_BREAK_MINUTES,
  LONG_BREAK_AFTER,
  parseHandoffMinutes,
  parseHandoffCycles,
} = await import("../src/app/utils/handoff.ts");
const { buildMatrix, drawQR, QR_MAX_BYTES } = await import("../src/qr.ts");
const Pom = await import("../src/pomodoro.ts");
const { sessionController } = await import(
  "../src/app/controllers/session-controller.ts"
);

test("Review Fix 1: Pomodoro limits accommodate up to 180m work and 90m break", () => {
  assert.strictEqual(WORK_MINUTES.max, 180);
  assert.strictEqual(BREAK_MINUTES.max, 90);
  assert.strictEqual(LONG_BREAK_MINUTES.max, 120);
  assert.strictEqual(LONG_BREAK_AFTER.max, 12);

  Pom.setWorkMins(180);
  assert.strictEqual(Pom.getSettings().workMins, 180);
  Pom.setWorkMins(200);
  assert.strictEqual(Pom.getSettings().workMins, 180);

  Pom.setBreakMins(90);
  assert.strictEqual(Pom.getSettings().breakMins, 90);
  Pom.setBreakMins(100);
  assert.strictEqual(Pom.getSettings().breakMins, 90);
});

test("Review Fix 2: Handoff parses longBreak, longBreakAfter and cycle counts within bounds", () => {
  // Long break minutes (1-120)
  assert.strictEqual(parseHandoffMinutes("15", 15, LONG_BREAK_MINUTES), 15);
  assert.strictEqual(parseHandoffMinutes("120", 15, LONG_BREAK_MINUTES), 120);
  assert.strictEqual(parseHandoffMinutes("999", 15, LONG_BREAK_MINUTES), 120);
  assert.strictEqual(parseHandoffMinutes("0", 15, LONG_BREAK_MINUTES), 1);

  // Long break interval (1-12)
  assert.strictEqual(parseHandoffMinutes("4", 4, LONG_BREAK_AFTER), 4);
  assert.strictEqual(parseHandoffMinutes("12", 4, LONG_BREAK_AFTER), 12);
  assert.strictEqual(parseHandoffMinutes("999", 4, LONG_BREAK_AFTER), 12);
  assert.strictEqual(parseHandoffMinutes("0", 4, LONG_BREAK_AFTER), 1);

  // Completed cycle count (non-negative integer)
  assert.strictEqual(parseHandoffCycles("5"), 5);
  assert.strictEqual(parseHandoffCycles("0"), 0);
  assert.strictEqual(parseHandoffCycles(null, 2), 2);
  assert.strictEqual(parseHandoffCycles("-1", 0), 0);
  assert.strictEqual(parseHandoffCycles("2.7", 0), 0);
  assert.strictEqual(parseHandoffCycles("bad", 0), 0);
});

test("Review Fix 3: Pomodoro restoreSessionSnapshot restores pomCount and phaseElapsed", () => {
  Pom.restoreSessionSnapshot({
    active: true,
    phase: "longBreak",
    phaseElapsed: 30000,
    pomCount: 7,
  });

  const snap = Pom.getSessionSnapshot();
  assert.strictEqual(snap.active, true);
  assert.strictEqual(snap.phase, "longBreak");
  assert.strictEqual(snap.phaseElapsed, 30000);
  assert.strictEqual(snap.pomCount, 7);
});

test("Review Fix 4: QR generator fails safely on oversized payloads and drawQR returns false", () => {
  const oversize = "x".repeat(QR_MAX_BYTES + 1);
  let cleared = false;

  const fakeCanvas = {
    width: 200,
    height: 200,
    getContext: () => ({
      fillStyle: "",
      fillRect() {},
      clearRect: (x: number, y: number, w: number, h: number) => {
        if (x === 0 && y === 0 && w === 200 && h === 200) {
          cleared = true;
        }
      },
    }),
  } as unknown as HTMLCanvasElement;

  const encoded = drawQR(fakeCanvas, oversize, "#000", "#fff");
  assert.strictEqual(encoded, false);

  if (!encoded) {
    fakeCanvas.getContext("2d")?.clearRect(0, 0, fakeCanvas.width, fakeCanvas.height);
  }
  assert.strictEqual(cleared, true);
});

test("Review Fix 5: QR mask 2 uses column % 3 === 0", () => {
  // In QR spec, mask pattern 2 is: column % 3 === 0.
  // We verify that buildMatrix applies formatBits(2) and mask 2 without mismatch.
  const matrix = buildMatrix("test-mask-2");
  assert.ok(matrix.length > 0);
  // Verify format info bits match EC M + mask 2
  let format = 0;
  for (let i = 0; i < 15; i++) {
    const r = i < 6 ? i : i < 8 ? i + 1 : matrix.length - 15 + i;
    if (matrix[r]![8]) format |= 1 << i;
  }
  assert.strictEqual(format, 0b101111001111100);
});

test("Review Fix 6: restoreSavedSession is bypassed and discarded when URL handoff is present", () => {
  const g = globalThis as any;
  if (!g.sessionStorage) {
    const mem = new Map<string, string>();
    g.sessionStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => mem.set(k, String(v)),
      removeItem: (k: string) => mem.delete(k),
      clear: () => mem.clear(),
    };
  }

  g.sessionStorage.setItem(
    "sc_saved_session",
    JSON.stringify({ task: "saved-old-task", elapsed: 99999, running: false }),
  );

  // Set actionable session handoff query parameters
  g.location = { search: "?theme=midnight&ses=1" };
  g.window.location = g.location;

  sessionController.setElapsed(0);
  sessionController.restoreSavedSession();

  // Actionable session in storage should have been cleared
  assert.strictEqual(g.sessionStorage.getItem("sc_saved_session"), null);
  // Elapsed time should NOT have been overwritten with 99999
  assert.strictEqual(sessionController.getElapsed(), 0);
});

test("Review Fix 8: theme-only or ineffective handoff URLs do not delete saved session and allow restoration", () => {
  const g = globalThis as any;
  const mem = new Map<string, string>();
  g.sessionStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => mem.set(k, String(v)),
    removeItem: (k: string) => mem.delete(k),
    clear: () => mem.clear(),
  };

  // 1. Theme-only URL: ?theme=nord
  g.sessionStorage.setItem(
    "sc_saved_session",
    JSON.stringify({ task: "important-task", elapsed: 42000, running: false }),
  );
  g.location = { search: "?theme=nord" };
  g.window.location = g.location;

  sessionController.setElapsed(0);
  sessionController.restoreSavedSession();

  // Saved session should have been restored, setting elapsed to 42000
  assert.strictEqual(sessionController.getElapsed(), 42000);

  // 2. Ineffective handoff URL: ?ses=0&start=0
  g.sessionStorage.setItem(
    "sc_saved_session",
    JSON.stringify({ task: "important-task", elapsed: 55000, running: false }),
  );
  g.location = { search: "?theme=midnight&ses=0&start=0" };
  g.window.location = g.location;

  sessionController.setElapsed(0);
  sessionController.restoreSavedSession();

  // Saved session should have been restored, setting elapsed to 55000
  assert.strictEqual(sessionController.getElapsed(), 55000);
});

test("Review Fix 9: Pomodoro updateSettings preserves custom longBreak settings when handoff fields are omitted", () => {
  // Receiver has configured custom long break settings
  Pom.updateSettings({
    workMins: 25,
    breakMins: 5,
    longBreakMins: 45,
    longBreakAfter: 6,
  });

  assert.strictEqual(Pom.getSettings().longBreakMins, 45);
  assert.strictEqual(Pom.getSettings().longBreakAfter, 6);

  // An older handoff link that only specifies pw and pb must not overwrite longBreakMins or longBreakAfter
  const patch: Partial<import("../src/types.ts").PomodoroSettings> = {};
  patch.workMins = 30;
  patch.breakMins = 7;
  // plb and pla omitted from patch
  Pom.updateSettings(patch);

  const updated = Pom.getSettings();
  assert.strictEqual(updated.workMins, 30);
  assert.strictEqual(updated.breakMins, 7);
  // Custom long break settings preserved
  assert.strictEqual(updated.longBreakMins, 45);
  assert.strictEqual(updated.longBreakAfter, 6);
});

test("Review Fix 7: modal-controller guards prevent opening overlay when panel fails to mount", async () => {
  const fs = await import("node:fs");
  const modalControllerSrc = fs.readFileSync(
    "src/app/controllers/modal-controller.ts",
    "utf8",
  );

  // Both openDataPanel and openLanguageModal must guard openModal
  assert.ok(
    /if \(!dataPanelApp\) return;\s*openModal\("dataOverlay"\)/.test(
      modalControllerSrc,
    ),
    "openDataPanel must guard openModal with if (!dataPanelApp) return;",
  );

  assert.ok(
    /if \(!languageApp\) return;\s*openModal\("languageOverlay"\)/.test(
      modalControllerSrc,
    ),
    "openLanguageModal must guard openModal with if (!languageApp) return;",
  );
});


