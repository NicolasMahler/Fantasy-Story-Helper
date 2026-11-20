/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages serves the site under /<repo-name>/; the deploy workflow sets BASE_PATH. Locally it is "/".
  base: process.env.BASE_PATH ?? "/",
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt', // new versions wait until the user taps Reload (see src/lib/update.svelte.ts)
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Fantasy Helper',
        short_name: 'Fantasy Helper',
        description: 'A reading companion for long fantasy series.',
        theme_color: '#211b16',
        background_color: '#211b16',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  // sqlite-wasm loads its .wasm relative to its own module; pre-bundling breaks that.
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
