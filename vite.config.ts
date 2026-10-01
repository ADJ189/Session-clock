import { defineConfig } from "vite";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Every non-hashed file sw.js's PRECACHE array names by exact path (besides
// '/' itself, which resolves to index.html) — kept here as the single
// source of truth so the version hash below and sw.js's own PRECACHE list
// can't silently drift apart from each other.
const STATIC_PRECACHE_FILES = [
  "index.html",
  "splash-base.png",
  "splash-triangle.png",
];

// Emits dist/precache-manifest.json listing every built JS/CSS/asset file
// (Finding SW4 — the service worker's hand-written PRECACHE list only
// ever covered the app shell, never the actual hashed Vite output, so
// first-load offline startup depended on whatever the runtime cache-first
// strategy happened to have already fetched). sw.js's install handler
// fetches this at install time and precaches everything in it. The
// `version` field is a hash of the emitted filenames themselves — since
// every filename is already content-hashed, this changes if and only if
// the build output actually changed, and sw.js uses it as the Cache
// Storage cache name so a new deploy invalidates the old cache
// automatically instead of relying on someone remembering to bump a
// version string by hand.
function precacheManifestPlugin() {
  let hashedFiles: string[] = [];
  return {
    name: "precache-manifest",
    generateBundle(
      _options: unknown,
      bundle: Record<string, { fileName: string }>,
    ) {
      // Only the hashed JS/CSS/asset output Rollup itself produced — not
      // index.html (Vite's HTML plugin finalizes it separately, later in
      // the pipeline, so it isn't in `bundle` here) and not anything from
      // public/ (copied straight to dist outside Rollup entirely). Both of
      // those are folded into `version` below instead, once they actually
      // exist on disk.
      hashedFiles = Object.values(bundle)
        .map((f) => "/" + f.fileName)
        .filter((f) => !f.endsWith(".map"))
        .sort();
    },
    // Deferred to closeBundle, the last hook in the output phase, so that
    // Vite's HTML finalization and its public/ dir copy (both of which run
    // outside Rollup's own bundle) have already landed on disk — confirmed
    // by the sw.js stamping below, which already depended on that same
    // ordering. Computing `version` here, instead of from the hashed
    // bundle filenames alone (as before), fixes a real gap: a deploy that
    // only edits index.html's own markup, or one of the exact files
    // sw.js's hand-written PRECACHE array names byte-for-byte
    // (splash-base.png/splash-triangle.png — non-hashed, so their
    // filenames never change), left `version` identical to the previous
    // build. That meant no new cache generation and — once sw.js's own
    // bytes were made version-derived — no new install either, so those
    // precached items could stay stale for a returning visitor until
    // something else forced a refetch.
    closeBundle() {
      const distDir = resolve(process.cwd(), "dist");
      const swPath = resolve(distDir, "sw.js");
      if (!existsSync(swPath) || !hashedFiles.length) return;

      const hash = createHash("sha256").update(hashedFiles.join("\n"));
      for (const name of STATIC_PRECACHE_FILES) {
        const p = resolve(distDir, name);
        if (existsSync(p)) hash.update(readFileSync(p));
      }
      const version = hash.digest("hex").slice(0, 12);

      writeFileSync(
        resolve(distDir, "precache-manifest.json"),
        JSON.stringify({ version, files: hashedFiles }, null, 2),
      );

      // Browsers only re-run a service worker's `install` handler when a
      // byte-for-byte comparison of the script against the currently
      // installed one comes out different — they never look at what the
      // script fetches at runtime. Since public/sw.js was copied to dist
      // verbatim, its bytes never changed between deploys, so a returning
      // visitor's browser saw an identical script and never reinstalled —
      // buildPrecacheList()'s manifest fetch never ran again, so they
      // stayed on whichever cache (possibly FALLBACK_CACHE, if their very
      // first visit's manifest fetch ever failed) they got the first
      // time. Stamping the same version computed above into the emitted
      // sw.js makes its bytes change exactly when precached content
      // actually changed, which is what triggers the update.
      const src = readFileSync(swPath, "utf8");
      if (src.startsWith("// build:")) return; // already stamped this run
      writeFileSync(swPath, `// build:${version}\n${src}`);
    },
  };
}

export default defineConfig({
  publicDir: "public",
  plugins: [precacheManifestPlugin()],
  build: {
    outDir: "dist",
    // Chrome 87+, Firefox 78+, Safari 14+, Edge 88+
    target: ["es2020", "chrome87", "firefox78", "safari14", "edge88"],
    // esbuild's minifier is 10-100x faster than terser for builds of this
    // size, and its `drop` option covers the console/debugger stripping
    // terser was previously used for — no functional difference, much
    // quicker CI/CD builds on Cloudflare Pages.
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
      },
    },
  },
  esbuild: {
    drop: ["console", "debugger"],
  },
  server: {
    port: 5173,
    open: true,
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
});
