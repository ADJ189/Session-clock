import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const checker = path.resolve("scripts/check-svelte-boundaries.mjs");
function check(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boundaries-"));
  try {
    for (const [name, content] of Object.entries({ "index.html": "<main id='app'></main>", "src/main.ts": "", ...files })) {
      const file = path.join(dir, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    const isDeno = typeof (globalThis as { Deno?: unknown }).Deno !== "undefined";
    const args = isDeno ? ["run", "-A", checker] : [checker];
    return spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8" });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("boundary checker counts only actual id attributes", () => {
  assert.equal(check({ "index.html": `<div data-id="same" title="id='same'" id='same'></div><!-- <i id='same'> --><script>"<i id='same'>"</script>` }).status, 0);
  const result = check({ "index.html": `<div data-id='other' ID = "same"></div><i id=same></i>` });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Duplicate ID.*same.*2 times/);
});

test("boundary checker detects builder declarations with varied whitespace", () => {
  for (const declaration of ["function\nbuildSoundUI () {}", "const buildSoundUI=()=>{}", "let\tbuildSoundUI = () => {}", "function*buildSoundUI() {}"] ) {
    const result = check({ "src/main.ts": declaration });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /banned builder: buildSoundUI/);
  }
  assert.equal(check({ "src/main.ts": "const buildSoundUIExtra = 1;" }).status, 0);
});

test("boundary checker scans nested audio modules and canvas engine", () => {
  for (const file of ["src/audio/nested/graph.ts", "src/app/renderer/canvas-engine.ts", "src/sound.ts"]) {
    const result = check({ [file]: `import View from './View.svelte';` });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(file));
  }
});
