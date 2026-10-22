// Developer-only: captures a small static thumbnail of every built-in theme's
// real scene (#bgCanvas) for the Theme Library, and rewrites
// src/themepreviews.ts with the ids that now have an image.
//
//   npm run dev                      # in one terminal
//   npm run previews                 # in another
//   ONLY=aurora,mrrobot npm run previews     # just these ids
//   BASE_URL=http://127.0.0.1:5173 CHROME_PATH=/path/to/chrome npm run previews
//
// Output: public/theme-previews/<id>.webp (400×225). Nothing here runs at
// app startup; commit the generated files and review them as a contact sheet.

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "theme-previews");
const base = process.env.BASE_URL ?? "http://127.0.0.1:5173";
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const W = 400;
const H = 225;

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
});
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("sc_onboarded_v2", "1");
  } catch {}
});

// The catalogue is the single source of truth for which ids exist.
const probe = await ctx.newPage();
await probe.goto(base);
const ids = await probe.evaluate(async () => {
  const m = await import("/src/themes.ts");
  return m.THEMES.map((t) => t.id);
});
await probe.close();

const done = [];
for (const id of ids) {
  if (only && !only.has(id)) continue;
  const page = await ctx.newPage();
  await page.addInitScript(
    (tid) => localStorage.setItem("sc_last_theme", tid),
    id,
  );
  try {
    await page.goto(base, { waitUntil: "load" });
    await page.waitForSelector("#splashScreen", {
      state: "detached",
      timeout: 20000,
    });
    await page.waitForTimeout(Number(process.env.SETTLE_MS ?? 2200)); // let the scene settle past its first frames
    const data = await page.evaluate(
      ([w, h]) => {
        const src = document.getElementById("bgCanvas");
        if (!src || !src.width || !src.height) return null;
        const out = document.createElement("canvas");
        out.width = w;
        out.height = h;
        const c = out.getContext("2d");
        // Cover-crop the viewport-sized canvas to 16:9.
        const s = Math.max(w / src.width, h / src.height);
        const dw = src.width * s;
        const dh = src.height * s;
        c.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
        return out.toDataURL("image/webp", 0.78);
      },
      [W, H],
    );
    if (!data || !data.startsWith("data:image/webp"))
      throw new Error("no canvas data");
    writeFileSync(
      join(outDir, `${id}.webp`),
      Buffer.from(data.split(",")[1], "base64"),
    );
    done.push(id);
    process.stdout.write(`✓ ${id}\n`);
  } catch (e) {
    process.stdout.write(`✗ ${id}: ${e.message}\n`);
  }
  await page.close();
}
await browser.close();

// Merge with thumbnails already on disk so partial runs (ONLY=…) never drop ids.
const { readdirSync } = await import("node:fs");
const onDisk = readdirSync(outDir)
  .filter((f) => f.endsWith(".webp") && statSync(join(outDir, f)).size > 0)
  .map((f) => f.replace(/\.webp$/, ""))
  .filter((id) => ids.includes(id))
  .sort();
writeFileSync(
  join(root, "src", "themepreviews.ts"),
  `// Theme ids that have a generated thumbnail at public/theme-previews/<id>.webp.
// Rewritten by \`npm run previews\` (scripts/gen-theme-previews.mjs). Themes not
// listed here render the CSS gradient preview, so an empty set is valid and
// causes no failed image requests.
export const PREVIEW_IDS: ReadonlySet<string> = new Set<string>([
${onDisk.map((i) => `  ${JSON.stringify(i)},`).join("\n")}
]);
`,
);
console.log(`\n${done.length} captured, ${onDisk.length} previews on disk.`);
