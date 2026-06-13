import { defineConfig } from 'vitest/config';

// Unit tests cover pure client-side logic extracted from the pages
// (src/scripts/*). They run in a plain Node environment — no Astro/Cloudflare
// pipeline — so they stay fast and have no D1/KV/runtime dependencies.
export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
	},
});
