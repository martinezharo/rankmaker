import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Cloudflare bindings are reached through `src/lib/runtime.ts` and nowhere else.
 *
 * Two things this guards against, both of which actually happened during the
 * Astro 5 → 7 upgrade:
 *
 *   - `Astro.locals.runtime.env` survived into three pages because they read it
 *     defensively (`(Astro.locals as any)?.runtime?.env?.DB`) inside a
 *     `try`/`catch`. Astro 6 turned that property into a throwing getter, so the
 *     catch swallowed it and the home, search and category listings silently
 *     served official-only templates with every count at zero. Nothing failed;
 *     the pages just quietly got worse.
 *   - Importing `cloudflare:workers` straight into a route works in the Worker
 *     but not under vitest, and spreads the platform coupling that made the
 *     migration a 39-file sweep in the first place.
 */
const SOURCE = /\.(ts|tsx|astro)$/;

/** Every source file except the ones allowed to know about the platform. */
function sourceFiles(): string[] {
	const allowed = new Set([
		// The accessor itself, and the test double vitest aliases it to.
		'src/lib/runtime.ts',
		'src/test/runtime.ts',
		// Declares the `cloudflare:workers` module and the `Env` shape.
		'src/env.d.ts',
		// This file names both patterns in order to forbid them.
		'src/test/runtime-access.test.ts',
	]);
	const found: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir)) {
			const path = join(dir, entry);
			if (statSync(path).isDirectory()) walk(path);
			else if (SOURCE.test(entry)) {
				const rel = relative(process.cwd(), path);
				if (!allowed.has(rel)) found.push(rel);
			}
		}
	};
	walk(join(process.cwd(), 'src'));
	return found;
}

describe('Cloudflare binding access', () => {
	it('never reads Astro.locals.runtime, whose getters throw', () => {
		const offenders = sourceFiles().filter((file) =>
			/locals\s*(?:as\s+\w+\s*)?\)?\s*[?.]*\.?runtime\b/.test(
				readFileSync(file, 'utf8')
			)
		);
		expect(offenders).toEqual([]);
	});

	it('imports cloudflare:workers only in src/lib/runtime.ts', () => {
		const offenders = sourceFiles().filter((file) =>
			/['"]cloudflare:workers['"]/.test(readFileSync(file, 'utf8'))
		);
		expect(offenders).toEqual([]);
	});
});
