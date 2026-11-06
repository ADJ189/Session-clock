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
  // Walk the markup directly so comments and raw-text element bodies cannot
  // masquerade as attributes. Parsing instead of regex-stripping avoids
  // incomplete multi-character sanitization: deleting a matched script/style
  // block can splice its own delimiters back into a new tag.
  const idRegex = /\b([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+)))?/g;
  const rawTextElements = new Set(["script", "style", "textarea", "title"]);
  const ids = new Map();
  let pos = 0;
  while (pos < indexHtml.length) {
    const start = indexHtml.indexOf("<", pos);
    if (start === -1) break;

    if (indexHtml.startsWith("<!--", start)) {
      const end = indexHtml.indexOf("-->", start + 4);
      pos = end === -1 ? indexHtml.length : end + 3;
      continue;
    }

    const marker = indexHtml[start + 1];
    if (marker === "!" || marker === "?" || marker === "/") {
      const end = indexHtml.indexOf(">", start + 2);
      pos = end === -1 ? indexHtml.length : end + 1;
      continue;
    }

    let nameEnd = start + 1;
    while (nameEnd < indexHtml.length && /[a-z0-9-]/i.test(indexHtml[nameEnd])) {
      nameEnd++;
    }
    if (nameEnd === start + 1) {
      pos = start + 1;
      continue;
    }
    const tagName = indexHtml.slice(start + 1, nameEnd).toLowerCase();

    // Find the end of the opening tag without treating ">" inside a quoted
    // attribute value as the tag terminator.
    let attrEnd = nameEnd;
    let quote = null;
    while (attrEnd < indexHtml.length) {
      const ch = indexHtml[attrEnd];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === ">") {
        break;
      }
      attrEnd++;
    }
    if (attrEnd >= indexHtml.length) break;

    const attributes = indexHtml.slice(nameEnd, attrEnd);
    for (const attribute of attributes.matchAll(idRegex)) {
      if (attribute[1].toLowerCase() !== "id") continue;
      const id = attribute[2] ?? attribute[3] ?? attribute[4] ?? "";
      ids.set(id, (ids.get(id) || 0) + 1);
    }

    pos = attrEnd + 1;
    if (rawTextElements.has(tagName)) {
      const closing = new RegExp(`</${tagName}\\s*>`, "i");
      const rest = indexHtml.slice(pos);
      const found = closing.exec(rest);
      pos = found ? pos + found.index + found[0].length : indexHtml.length;
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
        const rel = path.relative(rootDir, ef).replace(/\\/g, "/");
        errors.push(`Engine file "${rel}" imports a .svelte component`);
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
