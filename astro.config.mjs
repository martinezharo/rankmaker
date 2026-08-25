// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
  output: 'static',

  // Preact backs the card/grid/ranking components. Most render server-side
  // only (no client: directive → zero JS shipped); the islands that do hydrate
  // are the ones that need real state — the ranking engine and the listing
  // grid's mature-content merge.
  integrations: [preact()],

  // Permanent (301) redirects for renamed routes.
  // F1 drivers template was made year-agnostic; its old 2025 slug lives on in
  // links/search results, so point it at the new canonical slug.
  // /explore was the PHP-era browse page (still in Bing's index → 404 on
  // click); it's /search now.
  redirects: {
    '/template/bestfavorite-f1-drivers-of-2025-season': '/template/bestfavorite-f1-drivers',
    '/explore': '/search',
  },

  // English at the root; translated locales use a prefix (/es/…, /fr/…, /pt/…).
  // No pages are duplicated: src/middleware.ts strips the prefix and rewrites
  // to the canonical route, exposing the active locale as Astro.locals.locale.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr', 'zh', 'ms', 'de', 'pt'],
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

  adapter: cloudflare({
    platformProxy: {
      remoteBindings: false
    }
  })
});
