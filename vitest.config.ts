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
	},
});
