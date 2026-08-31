import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
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
