import { test } from "node:test";
import assert from "node:assert/strict";
import { installDomStubs } from "./dom-stubs.ts";

installDomStubs();

// In-memory localStorage with a switch that can make writes fail, so the
// legacy-migration path can be tested for "persist failed -> keep the stray
// key" as well as the happy path.
const memStore = new Map<string, string>();
let failKey: string | null = null;
// Define the property rather than assigning: some runtimes expose a read-only
// `localStorage` accessor.
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  enumerable: true,
  value: {
    getItem: (k: string) => memStore.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failKey === k) throw new Error("QuotaExceededError");
      memStore.set(k, String(v));
    },
    removeItem: (k: string) => {
      memStore.delete(k);
    },
    clear: () => {
      memStore.clear();
    },
  },
});

// pomodoro.ts imports sound.ts (and through it platform.ts), so the minimal
// browser surface has to exist before the module graph is evaluated.
const Pom = await import("../src/pomodoro.ts");

const el = () =>
  ({
    style: {},
    textContent: "",
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {},
  }) as unknown as HTMLElement;

function boot(): void {
  Pom.init({
    isRunning: () => false,
    getStart: () => 0,
    timer: el(),
    arc: el() as unknown as SVGCircleElement,
    ring: el() as unknown as SVGSVGElement,
    pill: el(),
    label: el(),
    onPhase: () => {},
  });
}

function resetStorage(): void {
  memStore.clear();
  failKey = null;
}

test("stored pomodoro settings are sanitized on load", () => {
  resetStorage();
  memStore.set(
    "sc_pom",
    JSON.stringify({
      workMins: 500,
      breakMins: 0,
      longBreakMins: "not a number",
      longBreakAfter: 99,
    }),
  );
  boot();
  assert.deepStrictEqual(Pom.getSettings(), {
    workMins: 180,
    breakMins: 1,
    longBreakMins: 15,
    longBreakAfter: 12,
  });
});

test("pomodoro setters and updateSettings enforce the shared bounds", () => {
  resetStorage();
  boot();

  Pom.setWorkMins(0);
  assert.strictEqual(Pom.getSettings().workMins, 1);
  Pom.setWorkMins(999);
  assert.strictEqual(Pom.getSettings().workMins, 180);
  Pom.setBreakMins(0);
  assert.strictEqual(Pom.getSettings().breakMins, 1);
  Pom.setBreakMins(999);
  assert.strictEqual(Pom.getSettings().breakMins, 90);

  // Invalid (non-finite) values fall back to the defaults rather than being
  // clamped to an edge.
  Pom.updateSettings({ workMins: Number.NaN });
  assert.strictEqual(Pom.getSettings().workMins, 25);
  Pom.updateSettings({ breakMins: Number.POSITIVE_INFINITY });
  assert.strictEqual(Pom.getSettings().breakMins, 5);

  Pom.updateSettings({ workMins: 45.6 });
  assert.strictEqual(Pom.getSettings().workMins, 46);
});

test("restoreSessionSnapshot ignores invalid phase and non-finite values", () => {
  resetStorage();
  boot();

  Pom.restoreSessionSnapshot({
    active: true,
    phase: "work",
    phaseElapsed: 45000,
    pomCount: 2,
  });
  let snap = Pom.getSessionSnapshot();
  assert.strictEqual(snap.phase, "work");
  assert.ok(snap.phaseElapsed >= 45000);
  assert.strictEqual(snap.pomCount, 2);

  Pom.restoreSessionSnapshot({
    phase: "rest" as unknown as "work",
    phaseElapsed: Number.NaN,
    pomCount: -5,
  });
  snap = Pom.getSessionSnapshot();
  assert.strictEqual(snap.phase, "work", "invalid phase must be ignored");
  assert.ok(snap.phaseElapsed >= 45000, "non-finite elapsed must be ignored");
  assert.strictEqual(snap.pomCount, 0, "negative counts are clamped");

  Pom.setActive(false);
});

test("legacy sc_pom_settings is removed only after a successful persist", () => {
  resetStorage();
  memStore.set("sc_pom_settings", JSON.stringify({ workMins: 45 }));
  boot();

  assert.strictEqual(Pom.getSettings().workMins, 45);
  assert.strictEqual(memStore.has("sc_pom_settings"), false);
  const canonical = JSON.parse(memStore.get("sc_pom") ?? "{}");
  assert.strictEqual(canonical.workMins, 45);
});

test("legacy sc_pom_settings survives a failed persist and retries later", () => {
  resetStorage();
  memStore.set("sc_pom_settings", JSON.stringify({ workMins: 45 }));
  failKey = "sc_pom";
  boot();

  assert.strictEqual(Pom.getSettings().workMins, 45);
  assert.strictEqual(
    memStore.has("sc_pom_settings"),
    true,
    "stray key must not be deleted when the recovered value was never saved",
  );

  // Writes work again: the next load completes the migration.
  failKey = null;
  boot();
  assert.strictEqual(memStore.has("sc_pom_settings"), false);
  assert.strictEqual(
    JSON.parse(memStore.get("sc_pom") ?? "{}").workMins,
    45,
  );
});

test("legacy migration ignores non-numeric stray values", () => {
  resetStorage();
  memStore.set(
    "sc_pom_settings",
    JSON.stringify({ workMins: "45", breakMins: null }),
  );
  boot();

  assert.strictEqual(Pom.getSettings().workMins, 25);
  assert.strictEqual(Pom.getSettings().breakMins, 5);
  // No recovery happened, so nothing needed persisting and the key is dropped.
  assert.strictEqual(memStore.has("sc_pom_settings"), false);
});
