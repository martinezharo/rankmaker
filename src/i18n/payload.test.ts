import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildClientDictionary, SERVER_ONLY_NAMESPACES } from './payload';
import { dictionaries } from './server';
import { locales } from './config';

const SRC = new URL('..', import.meta.url).pathname;

function walk(dir: string, match: (path: string) => boolean): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(path, match));
		else if (match(path)) out.push(path);
	}
	return out;
}

describe('buildClientDictionary', () => {
	it('drops the server-only namespaces', () => {
		const dict = buildClientDictionary(dictionaries, 'en') as Record<string, unknown>;
		for (const namespace of SERVER_ONLY_NAMESPACES) {
			expect(dict[namespace]).toBeUndefined();
		}
	});

	it('keeps everything else', () => {
		const dict = buildClientDictionary(dictionaries, 'en') as Record<string, unknown>;
		const expected = Object.keys(dictionaries.en).filter(
			(k) => !SERVER_ONLY_NAMESPACES.includes(k as never)
		);
		expect(Object.keys(dict).sort()).toEqual(expected.sort());
	});

	it('merges the locale over English, so a partial translation still resolves', () => {
		const dict = buildClientDictionary(dictionaries, 'es') as Record<string, never>;
		// Spanish supplies its own strings…
		expect(dict['nav']).not.toEqual(dictionaries.en['nav' as never]);
		// …and every English key is still present to fall back on, which is why
		// the client needs no fallback dictionary of its own.
		for (const namespace of Object.keys(dictionaries.en)) {
			if (SERVER_ONLY_NAMESPACES.includes(namespace as never)) continue;
			expect(dict[namespace as never]).toBeDefined();
		}
	});

	it('builds for every supported locale', () => {
		for (const locale of locales) {
			expect(Object.keys(buildClientDictionary(dictionaries, locale)).length).toBeGreaterThan(0);
		}
	});

	it('is a fraction of the full dictionary', () => {
		const full = JSON.stringify(dictionaries.en).length;
		const client = JSON.stringify(buildClientDictionary(dictionaries, 'en')).length;
		// Guards the win: `legal` alone is ~40% of the dictionary.
		expect(client).toBeLessThan(full * 0.6);
	});
});

describe('the server-only namespaces really are server-only', () => {
	/**
	 * Files whose translation keys can reach the browser. .astro files are
	 * excluded here and checked separately below — their frontmatter is server
	 * side, so a bare mention proves nothing.
	 */
	const clientFiles = [
		...walk(join(SRC, 'scripts'), (p) => p.endsWith('.ts') && !p.endsWith('.test.ts')),
		...walk(join(SRC, 'components'), (p) => p.endsWith('.tsx')),
	];

	it.each(SERVER_ONLY_NAMESPACES)(
		'%s is not referenced from client modules',
		(namespace) => {
			const offenders = clientFiles.filter((path) =>
				new RegExp(`[\`'"]${namespace}\\.`).test(readFileSync(path, 'utf8'))
			);
			expect(offenders.map((p) => relative(SRC, p))).toEqual([]);
		}
	);

	/**
	 * The excluded namespaces are long-form page copy and email templates. Each
	 * belongs to a known surface; anything else using one is the signal that it
	 * is no longer server-only and must come out of SERVER_ONLY_NAMESPACES.
	 */
	const ALLOWED: Record<string, string[]> = {
		legal: [
			'pages/cookie-policy.astro',
			'pages/legal-notice.astro',
			'pages/privacy-policy.astro',
			'pages/terms-of-use.astro',
		],
		about: ['pages/about.astro'],
		// index.astro reuses the cover's alt text as the ImageObject caption in
		// its structured data — frontmatter only, so still server-side.
		seoContent: ['components/SEOContent.astro', 'pages/index.astro'],
		email: ['lib/notifications.ts'],
	};

	it.each(SERVER_ONLY_NAMESPACES)('%s is used only where expected', (namespace) => {
		const files = [
			...walk(join(SRC, 'pages'), (p) => p.endsWith('.astro') || p.endsWith('.ts')),
			...walk(join(SRC, 'components'), (p) => p.endsWith('.astro')),
			...walk(join(SRC, 'lib'), (p) => p.endsWith('.ts') && !p.endsWith('.test.ts')),
			...walk(join(SRC, 'layouts'), (p) => p.endsWith('.astro')),
		];
		const users = files
			.filter((path) =>
				new RegExp(`[\`'"]${namespace}\\.`).test(readFileSync(path, 'utf8'))
			)
			.map((p) => relative(SRC, p))
			.sort();
		expect(users).toEqual((ALLOWED[namespace] ?? []).sort());
	});
});
