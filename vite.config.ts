import { defineConfig } from 'vite';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    // Chrome 87+, Firefox 78+, Safari 14+, Edge 88+
    target: ['es2020', 'chrome87', 'firefox78', 'safari14', 'edge88'],
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 3,
        pure_funcs: ['console.log', 'console.warn', 'console.info'],
        unsafe_math: true,
        toplevel: true,
      },
      mangle: {
        toplevel: true,
        safari10: true,
      },
      format: { comments: false },
    },
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