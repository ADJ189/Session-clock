import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  let version = '';
  return {
    name: 'precache-manifest',
    generateBundle(_options: unknown, bundle: Record<string, { fileName: string }>) {
      const files = Object.values(bundle)
        .map(f => '/' + f.fileName)
        .filter(f => !f.endsWith('.map'))
        .sort();
      version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.json',
        source: JSON.stringify({ version, files }, null, 2),
      });
    },
    // Browsers only re-run a service worker's `install` handler when a
    // byte-for-byte comparison of the script against the currently
    // installed one comes out different — they never look at what the
    // script fetches at runtime. Since public/sw.js was copied to dist
    // verbatim, its bytes never changed between deploys, so a returning
    // visitor's browser saw an identical script and never reinstalled —
    // buildPrecacheList()'s manifest fetch never ran again, so they stayed
    // on whichever cache (possibly FALLBACK_CACHE, if their very first
    // visit's manifest fetch ever failed) they got the first time. Stamping
    // the same content-derived version this plugin already computes into
    // the emitted sw.js makes its bytes change exactly when the build
    // output actually changed, which is what triggers the update.
    closeBundle() {
      const swPath = resolve(process.cwd(), 'dist/sw.js');
      if (!existsSync(swPath) || !version) return;
      const src = readFileSync(swPath, 'utf8');
      if (src.startsWith('// build:')) return; // already stamped this run
      writeFileSync(swPath, `// build:${version}\n${src}`);
    },
  };
}

export default defineConfig({
  publicDir: 'public',
  plugins: [precacheManifestPlugin()],
  build: {
    outDir: 'dist',
    // Chrome 87+, Firefox 78+, Safari 14+, Edge 88+
    target: ['es2020', 'chrome87', 'firefox78', 'safari14', 'edge88'],
    // esbuild's minifier is 10-100x faster than terser for builds of this
    // size, and its `drop` option covers the console/debugger stripping
    // terser was previously used for — no functional difference, much
    // quicker CI/CD builds on Cloudflare Pages.
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
  server: {
    port: 5173,
    open: true,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },
});
