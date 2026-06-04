// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'static',

  vite: {
    plugins: [tailwindcss()],
    server: {
      // Miniflare (local D1/KV) writes journal/WAL files under .wrangler/state
      // on every query. Without this, Vite's watcher reloads the page on each
      // write — causing an infinite refresh loop on SSR pages. Dev-only.
      watch: {
        ignored: ['**/.wrangler/**']
      }
    }
  },

  adapter: cloudflare()
});