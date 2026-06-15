// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'static',

  // English at the root (/template/x), Spanish/French prefixed (/es/…, /fr/…).
  // No pages are duplicated: src/middleware.ts strips the prefix and rewrites
  // to the canonical route, exposing the active locale as Astro.locals.locale.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr'],
    routing: { prefixDefaultLocale: false },
  },

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