/**
 * Guards on the translation dictionaries themselves.
 *
 * Locales are deliberately *partial* — `LocaleDict` is a loose mirror of the
 * English `Dict` and `useTranslations` falls back to English key by key, so an
 * untranslated string is a missing translation, not a broken page. What is NOT
 * safe is a key that exists but is wrong in a way TypeScript cannot see: a
 * renamed placeholder renders `{count}` to the reader, an empty string renders
 * nothing at all, and a key referenced from code but absent from English
 * renders the key itself. Those are the failures these tests catch.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dictionaries } from './server';
import { locales, localeNames, defaultLocale } from './config';

type Flat = Record<string, string>;

function flatten(value: unknown, prefix = ''): Flat {
	const out: Flat = {};
	for (const [key, child] of Object.entries(
		(value ?? {}) as Record<string, unknown>
	)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof child === 'string') out[path] = child;
		else if (child && typeof child === 'object') {
			Object.assign(out, flatten(child, path));
		}
	}
	return out;
}

/** The `{name}` placeholders in a string, sorted so order does not matter. */
function placeholders(value: string): string[] {
	return [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

const english = flatten(dictionaries[defaultLocale]);
const translated = locales.filter((l) => l !== defaultLocale);

describe('the locale registry', () => {
	it('has a dictionary and a display name for every supported locale', () => {
		for (const locale of locales) {
			expect(dictionaries[locale], `dictionary for ${locale}`).toBeTruthy();
			expect(localeNames[locale], `name for ${locale}`).toBeTruthy();
		}
	});

	it('registers nothing that is not a supported locale', () => {
		expect(Object.keys(dictionaries).sort()).toEqual([...locales].sort());
	});

	it('has a locale file on disk for each of them', () => {
		const files = readdirSync(join(process.cwd(), 'src/i18n/locales'))
			.filter((f) => f.endsWith('.ts'))
			.map((f) => f.replace(/\.ts$/, ''));
		expect(files.sort()).toEqual([...locales].sort());
	});

	it('has a non-trivial English dictionary — the source of truth', () => {
		expect(Object.keys(english).length).toBeGreaterThan(100);
	});
});

describe.each(translated)('the %s dictionary', (locale) => {
	const dict = flatten(dictionaries[locale]);

	it('only defines keys English also defines', () => {
		// An orphan key is dead weight, and usually the leftover half of an
		// English rename — meaning the *renamed* key now silently falls back.
		expect(Object.keys(dict).filter((key) => !(key in english))).toEqual([]);
	});

	it('keeps every placeholder English uses, so nothing renders as {n}', () => {
		const mismatched = Object.keys(dict)
			.filter((key) => key in english)
			.filter(
				(key) =>
					placeholders(english[key]).join(',') !==
					placeholders(dict[key]).join(',')
			)
			.map(
				(key) =>
					`${key}: en {${placeholders(english[key])}} vs ${locale} {${placeholders(dict[key])}}`
			);
		expect(mismatched).toEqual([]);
	});

	it('has no blank translations, which would render as empty UI', () => {
		expect(
			Object.entries(dict)
				.filter(([, value]) => value.trim() === '')
				.map(([key]) => key)
		).toEqual([]);
	});

	it('translates the chrome every page shows', () => {
		// A page can fall back for a rare string, but not for its own navigation.
		for (const key of Object.keys(english).filter((k) =>
			k.startsWith('nav.')
		)) {
			expect(dict[key], `${locale} is missing ${key}`).toBeTruthy();
		}
	});
});

describe('translation keys referenced from the code', () => {
	/** Every source file that could call `t(...)`. */
	function sourceFiles(dir: string, out: string[] = []): string[] {
		for (const entry of readdirSync(dir)) {
			const path = join(dir, entry);
			if (statSync(path).isDirectory()) {
				if (entry !== 'locales') sourceFiles(path, out);
			} else if (/\.(ts|tsx|astro)$/.test(path) && !path.endsWith('.test.ts')) {
				out.push(path);
			}
		}
		return out;
	}

	it('all exist in the English dictionary', () => {
		// Only statically written keys can be checked; the handful of computed
		// ones (template literals) are covered by their own module's tests.
		const pattern = /\bt\(\s*(['"])([a-zA-Z][\w.]*)\1/g;
		const unknown: string[] = [];
		for (const file of sourceFiles(join(process.cwd(), 'src'))) {
			const source = readFileSync(file, 'utf8');
			for (const [, , key] of source.matchAll(pattern)) {
				// A dotted path is unambiguously a translation key; a bare word
				// is more likely some other one-argument call.
				if (key.includes('.') && !(key in english)) {
					unknown.push(`${relative(process.cwd(), file)}: ${key}`);
				}
			}
		}
		expect(unknown).toEqual([]);
	});
});
