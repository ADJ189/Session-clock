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
  const idRegex = /\bid=["']([^"']+)["']/g;
  const ids = new Map();
  let match;
  while ((match = idRegex.exec(indexHtml)) !== null) {
    const id = match[1];
    ids.set(id, (ids.get(id) || 0) + 1);
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
    if (mainTs.includes(`function ${b}`) || mainTs.includes(`const ${b} =`)) {
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
