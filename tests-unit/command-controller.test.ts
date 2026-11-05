import { test } from "node:test";
import assert from "node:assert/strict";
import {
  score,
  highlightSegments,
  filterAndGroup,
  CommandController,
  type CmdItem,
} from "../src/app/controllers/command-controller";

test("score: matches prefixes, substrings, and fuzzy abbreviations", () => {
  const item: CmdItem = {
    id: "zen",
    name: "Zen Mode",
    desc: "Distraction free study",
    tag: "action",
    action: () => {},
    keywords: "focus calm",
  };

  assert.equal(score(item, ""), 1);
  assert.equal(score(item, "zen"), 100);
  assert.equal(score(item, "mode"), 80);
  assert.equal(score(item, "zm"), 50);
  assert.equal(score(item, "xyz"), 0);
});

test("highlightSegments: splits matched and unmatched segments without html injection", () => {
  const segments = highlightSegments("Session Clock", "clock");
  assert.deepEqual(segments, [
    { text: "Session ", match: false },
    { text: "Clock", match: true },
  ]);

  const noMatch = highlightSegments("Session Clock", "pomodoro");
  assert.deepEqual(noMatch, [{ text: "Session Clock", match: false }]);
});

test("filterAndGroup: groups by tag order and supports '/' secret filter", () => {
  const items: CmdItem[] = [
    { id: "1", name: "Theme 1", tag: "theme", action: () => {} },
    { id: "2", name: "Action 1", tag: "action", action: () => {} },
    { id: "3", name: "Egg 1", tag: "egg", action: () => {} },
    { id: "4", name: "Setting 1", tag: "setting", action: () => {} },
  ];

  const normal = filterAndGroup(items, "");
  assert.equal(normal.filtered.length, 4);
  assert.deepEqual(
    normal.groups.map((g) => g.tag),
    ["action", "theme", "setting", "egg"]
  );

  const secrets = filterAndGroup(items, "/");
  assert.equal(secrets.filtered.length, 1);
  assert.equal(secrets.groups[0].tag, "egg");
  assert.equal(secrets.filtered[0].id, "3");
});

test("CommandController: open, close, navigate, and selection", () => {
  let executed = false;
  const controller = new CommandController();
  const items: CmdItem[] = [
    { id: "1", name: "First", tag: "action", action: () => {} },
    { id: "2", name: "Second", tag: "action", action: () => { executed = true; } },
  ];

  controller.registerItems(items);
  assert.equal(controller.getIsOpen(), false);

  controller.open();
  assert.equal(controller.getIsOpen(), true);
  assert.equal(controller.getSnapshot().activeIdx, 0);

  controller.next();
  assert.equal(controller.getSnapshot().activeIdx, 1);

  controller.prev();
  assert.equal(controller.getSnapshot().activeIdx, 0);

  controller.next();
  controller.selectCurrent();
  assert.equal(executed, true);
  assert.equal(controller.getIsOpen(), false);
});
