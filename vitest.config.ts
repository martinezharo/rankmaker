import { defineConfig } from 'vitest/config';

// Two homes, for one reason.
//
//   src/**/*.test.ts   — colocated with the module under test. This is the
//                        default: a test lives next to its subject.
//   tests/**/*.test.ts — tests for the API routes and other endpoints under
//                        `src/pages`. Astro turns EVERY file in `src/pages`
//                        into a route, so a colocated `foo.test.ts` there is
//                        built and deployed as a live endpoint (and the build
//                        fails trying to prerender it). `tests/` mirrors the
//                        route tree instead; `src/test/no-page-tests.test.ts`
//                        keeps anyone from re-introducing the problem.
//
// Everything runs in a plain Node environment — no Astro or Cloudflare
// pipeline. The D1-backed tests use `src/test/d1.ts`, which applies the real
// migrations to an in-memory SQLite database, so they stay fast and need no
// live D1/KV/R2 binding.
export default defineConfig({
	resolve: {
		alias: {
			// `cloudflare:workers` only resolves inside workerd. Point it at the
			// test double so `src/lib/runtime.ts` — and therefore every route
			// handler — imports its bindings the same way it does in the Worker.
			'cloudflare:workers': new URL(
				'./src/test/runtime.ts',
				import.meta.url
			).pathname,
		},
	},
	test: {
		// Node by default. The browser-side modules (Preact islands and the
		// scripts in `src/scripts`) opt into a DOM with a
		// `// @vitest-environment happy-dom` docblock and `src/test/dom.ts`.
		environment: 'node',
		include: [
			'src/**/*.test.ts',
			'src/**/*.test.tsx',
			'tests/**/*.test.ts',
			'tests/**/*.test.tsx',
		],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts', 'src/**/*.tsx'],
			exclude: [
				'src/**/*.test.ts',
				// Test-only helpers, and files with nothing to execute.
				'src/test/**',
				'src/env.d.ts',
				'src/i18n/locales/**',
			],
			reporter: ['text', 'html'],
			// Floors, not targets: they exist so a change that quietly drops
			// coverage fails CI instead of shipping. Branch floors sit lower
			// than line floors on the browser-side code, where a good deal of
			// the branching is defensive (a missing node, an unavailable API)
			// on paths that only a real browser reaches.
			thresholds: {
				'src/lib/**': { lines: 90, functions: 90, branches: 85 },
				'src/pages/api/**': { lines: 85, functions: 90, branches: 85 },
				'src/components/**': { lines: 90, functions: 90, branches: 65 },
				'src/scripts/**': { lines: 88, functions: 85, branches: 72 },
			},
		},
	},
});
