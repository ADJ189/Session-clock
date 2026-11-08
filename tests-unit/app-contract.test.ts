import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("contract: index.html has no duplicate IDs", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const idRegex = /\bid=["']([^"']+)["']/g;
  const ids = new Map<string, number>();
  let match;
  while ((match = idRegex.exec(html)) !== null) {
    const id = match[1];
    ids.set(id, (ids.get(id) || 0) + 1);
  }
  const duplicates = [...ids.entries()].filter(([, count]) => count > 1);
  assert.deepStrictEqual(duplicates, [], `Found duplicate IDs: ${JSON.stringify(duplicates)}`);
});

test("contract: App.svelte and child components define required shell elements", () => {
  const header = fs.readFileSync("src/app/layout/AppHeader.svelte", "utf8");
  const workspace = fs.readFileSync("src/app/layout/MainWorkspace.svelte", "utf8");
  const clock = fs.readFileSync("src/app/clock/ClockSurface.svelte", "utf8");
  const session = fs.readFileSync("src/app/session/SessionCard.svelte", "utf8");
  const dock = fs.readFileSync("src/app/layout/QuickActionDock.svelte", "utf8");
  const quote = fs.readFileSync("src/app/session/QuoteArea.svelte", "utf8");

  const combined = header + workspace + clock + session + dock + quote;

  const requiredIds = [
    "topbarThemesBtn",
    "weatherPill",
    "weatherIcon",
    "weatherText",
    "infoLabel",
    "showBadge",
    "clockPosPill",
    "btnCmdPalette",
    "btnKbShortcuts",
    "greeting",
    "clock-block-wrap",
    "digitHr",
    "digitMin",
    "digitSec",
    "ampmDis",
    "secMs",
    "timeDis",
    "dateDis",
    "dayPct",
    "progressFill",
    "sessionLabel",
    "pomRingSvg",
    "pomRingArc",
    "sessionTimer",
    "focusInput",
    "btnStart",
    "btnReset",
    "btnPomToggle",
    "sessionStatusLine",
    "btnDistraction",
    "distractionRow",
    "distractionCount",
    "quoteText",
    "litMeta",
    "btnDockThemes",
    "btnSound",
    "btnZen",
    "btnSettings"
  ];

  for (const id of requiredIds) {
    assert.ok(combined.includes(`id="${id}"`), `Missing required ID: "${id}" in Svelte shell components`);
  }
});

test("contract: SoundMixerDialog defines required mixer IDs", () => {
  const mixer = fs.readFileSync("src/app/modals/SoundMixerDialog.svelte", "utf8");
  const requiredMixerIds = [
    "mixerNightToggle",
    "soundGrid",
    "volLabel",
    "volSlider",
    "mixerVuFill",
    "fadeLabel",
    "fadeSlider",
    "fadeChips",
    "mixerAutoCrossfade",
    "sceneFocusBtn",
    "sceneBreakBtn",
  ];
  for (const id of requiredMixerIds) {
    assert.ok(mixer.includes(`id="${id}"`), `Missing required ID: "${id}" in SoundMixerDialog.svelte`);
  }
});

test("contract: CustomThemeBuilderDialog defines required theme builder IDs", () => {
  const tb = fs.readFileSync("src/app/modals/CustomThemeBuilderDialog.svelte", "utf8");
  const requiredThemeBuilderIds = [
    "colorRows",
    "picker-hex",
    "picker-rgb",
    "picker-hsl",
    "themeImportCode",
    "savedThemeRow",
  ];
  for (const id of requiredThemeBuilderIds) {
    assert.ok(tb.includes(`id="${id}"`), `Missing required ID: "${id}" in CustomThemeBuilderDialog.svelte`);
  }
});

test("contract: DataManagementDialog defines required data IDs", () => {
  const dm = fs.readFileSync("src/app/modals/DataManagementDialog.svelte", "utf8");
  assert.ok(dm.includes('id="dataContent"'), 'Missing id="dataContent" in DataManagementDialog.svelte');
});

test("contract: LegalDialog defines required legal IDs", () => {
  const legal = fs.readFileSync("src/app/modals/LegalDialog.svelte", "utf8");
  assert.ok(legal.includes('id="legalTitle"'), 'Missing id="legalTitle" in LegalDialog.svelte');
  assert.ok(legal.includes('id="legalUpdated"'), 'Missing id="legalUpdated" in LegalDialog.svelte');
  assert.ok(legal.includes('id="legalContent"'), 'Missing id="legalContent" in LegalDialog.svelte');
});

test("contract: LanguageDialog defines required language IDs", () => {
  const lang = fs.readFileSync("src/app/modals/LanguageDialog.svelte", "utf8");
  assert.ok(lang.includes('id="languageContent"'), 'Missing id="languageContent" in LanguageDialog.svelte');
});

test("contract: KeyboardShortcutsDialog defines required kb IDs", () => {
  const kb = fs.readFileSync("src/app/modals/KeyboardShortcutsDialog.svelte", "utf8");
  assert.ok(kb.includes('id="kbGrid"'), 'Missing id="kbGrid" in KeyboardShortcutsDialog.svelte');
});

test("contract: PomodoroDialog defines required pomodoro IDs", () => {
  const pom = fs.readFileSync("src/app/modals/PomodoroDialog.svelte", "utf8");
  const requiredPomIds = [
    "pomWorkBtns",
    "pomBreakBtns",
    "pomLongBreakMinBtns",
    "pomLongBtns",
    "pomCustomWork",
    "pomCustomBreak",
    "pomCustomLong",
    "pomCountToday",
  ];
  for (const id of requiredPomIds) {
    assert.ok(pom.includes(`id="${id}"`), `Missing required ID: "${id}" in PomodoroDialog.svelte`);
  }
});

test("contract: CommandPalette defines required palette IDs", () => {
  const cmd = fs.readFileSync("src/app/modals/CommandPalette.svelte", "utf8");
  const requiredCmdIds = [
    "cmdOverlay",
    "cmdModal",
    "cmdInput",
    "cmdSecretsBtn",
    "cmdResults",
  ];
  for (const id of requiredCmdIds) {
    assert.ok(cmd.includes(`id="${id}"`), `Missing required ID: "${id}" in CommandPalette.svelte`);
  }
});
