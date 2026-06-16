// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'static',

  // Permanent (301) redirects for renamed routes.
  // F1 drivers template was made year-agnostic; its old 2025 slug lives on in
  // links/search results, so point it at the new canonical slug.
  redirects: {
    '/template/bestfavorite-f1-drivers-of-2025-season': '/template/bestfavorite-f1-drivers',
  },

  // English at the root (/template/x), Spanish/French prefixed (/es/…, /fr/…).
  // No pages are duplicated: src/middleware.ts strips the prefix and rewrites
  // to the canonical route, exposing the active locale as Astro.locals.locale.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr', 'zh', 'ms', 'de'],
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