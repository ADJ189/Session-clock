// Architecture boundary checker for Session Clock Svelte migration
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const mainTsPath = path.join(rootDir, "src", "main.ts");
const indexHtmlPath = path.join(rootDir, "index.html");

let errors = [];

function check() {
  const indexHtml = fs.readFileSync(indexHtmlPath, "utf8");

  // Rule 5: Check for duplicate IDs in index.html
  // Tokenize tags and their attributes so data-id and quoted attribute text
  // cannot masquerade as an id. Skip comments and raw-text elements.
  const tagRegex = /<!--[\s\S]*?-->|<([a-z][^\s/>]*)(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
  const idRegex = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  const ids = new Map();
  let match;
  while ((match = tagRegex.exec(indexHtml)) !== null) {
    if (!match[1]) continue;
    const attributes = match[0].slice(match[1].length + 1, -1);
    for (const attribute of attributes.matchAll(idRegex)) {
      if (attribute[1].toLowerCase() !== "id") continue;
      const id = attribute[2] ?? attribute[3] ?? attribute[4] ?? "";
      ids.set(id, (ids.get(id) || 0) + 1);
    }
    if (/^(script|style)$/i.test(match[1])) {
      const end = new RegExp(`</${match[1]}\\s*>`, "gi");
      end.lastIndex = tagRegex.lastIndex;
      if (end.exec(indexHtml)) tagRegex.lastIndex = end.lastIndex;
    }
  }

  for (const [id, count] of ids.entries()) {
    if (count > 1) {
      errors.push(`Duplicate ID in index.html: "${id}" appears ${count} times`);
    }
  }

  // Rule: Check main.ts line count and banned builders
  const mainTs = fs.readFileSync(mainTsPath, "utf8");
  const lines = mainTs.split("\n").length;
  if (lines > 100) {
    errors.push(`src/main.ts exceeds 100 lines: currently ${lines} lines`);
  }
  const bannedBuilders = ["buildSoundUI", "buildColorRows", "buildDataPanel", "buildLegalPanel", "buildLanguageUI", "buildSettingsUI"];
  for (const b of bannedBuilders) {
    if (new RegExp(`\\b(?:function(?:\\s+|\\s*\\*\\s*)${b}\\s*\\(|(?:const|let)\\s+${b}\\b)`).test(mainTs)) {
      errors.push(`src/main.ts still contains banned builder: ${b}`);
    }
  }

  // Rule 3: Check engine files do not import .svelte files
  const engineFiles = [
    path.join(rootDir, "src", "sound.ts"),
    path.join(rootDir, "src", "auth.ts"),
    path.join(rootDir, "src", "pomodoro.ts"),
    path.join(rootDir, "src", "renderer.ts"),
    path.join(rootDir, "src", "storage.ts"),
    path.join(rootDir, "src", "platform.ts"),
  ];
  function collectAudioFiles(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) collectAudioFiles(file);
      else if (entry.name.endsWith(".ts")) engineFiles.push(file);
    }
  }
  collectAudioFiles(path.join(rootDir, "src", "audio"));
  engineFiles.push(path.join(rootDir, "src", "app", "renderer", "canvas-engine.ts"));
  for (const ef of engineFiles) {
    if (fs.existsSync(ef)) {
      const content = fs.readFileSync(ef, "utf8");
      if (content.includes(".svelte")) {
        errors.push(`Engine file "${path.relative(rootDir, ef)}" imports a .svelte component`);
      }
    }
  }

  if (errors.length > 0) {
    console.error("Architecture boundary violations found:");
    errors.forEach(e => console.error(" - " + e));
    process.exit(1);
  } else {
    console.log("✓ Architecture boundary checks passed.");
  }
}

check();
