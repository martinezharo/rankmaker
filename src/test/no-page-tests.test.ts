import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Astro turns every file under `src/pages` into a route. A test file there is
 * therefore built and deployed as a live endpoint — and `astro build` fails
 * trying to prerender it, which is how this was found. Route tests live in
 * `tests/` instead (see vitest.config.ts).
 */
describe('src/pages', () => {
	it('contains no test files, which Astro would turn into routes', () => {
		const root = join(process.cwd(), 'src/pages');
		const found: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir)) {
				const path = join(dir, entry);
				if (statSync(path).isDirectory()) walk(path);
				else if (/\.test\.(ts|tsx|js)$/.test(entry)) {
					found.push(relative(process.cwd(), path));
				}
			}
		};
		walk(root);
		expect(found).toEqual([]);
	});
});
