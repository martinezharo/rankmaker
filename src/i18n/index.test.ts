import { describe, expect, it } from 'vitest';
// Importing the server entry point is what registers the dictionaries; the
// translation machinery under test lives in ./index.
import {
	defaultLocale,
	isLocale,
	localeFromPath,
	localizePath,
	unlocalizePath,
	useTranslations,
} from './server';

describe('useTranslations', () => {
	it('resolves a key in the requested locale', () => {
		expect(useTranslations('es')('nav.home')).not.toBe(
			useTranslations('en')('nav.home')
		);
		expect(useTranslations('en')('nav.home')).toBe('Home');
	});

	it('interpolates named placeholders', () => {
		expect(useTranslations('en')('card.ranked', { n: 3 })).toBe('3 ranked');
	});

	it('leaves a placeholder in place when no value is given for it', () => {
		expect(useTranslations('en')('card.ranked')).toBe('{n} ranked');
		expect(useTranslations('en')('card.ranked', { other: 1 })).toBe(
			'{n} ranked'
		);
	});

	it('falls back to English key by key, so a partial locale still renders', () => {
		// `local.*` is one of the namespaces German has not translated yet.
		const german = useTranslations('de');
		expect(german('local.pageTitle')).toBe(
			useTranslations('en')('local.pageTitle')
		);
		expect(german('nav.home')).not.toBe(useTranslations('en')('nav.home'));
	});

	it('returns the key itself for a truly unknown one', () => {
		expect(useTranslations('en')('nope.not.a.key')).toBe('nope.not.a.key');
	});

	it('does not walk into a namespace object as if it were a string', () => {
		expect(useTranslations('en')('nav')).toBe('nav');
	});
});

describe('isLocale', () => {
	it('accepts every supported locale and nothing else', () => {
		expect(isLocale('es')).toBe(true);
		for (const value of ['EN', 'jp', '', null, undefined, 42, 'es-ES']) {
			expect(isLocale(value)).toBe(false);
		}
	});
});

describe('localizePath', () => {
	it('leaves English paths at the root', () => {
		expect(localizePath('/template/x', defaultLocale)).toBe('/template/x');
		expect(localizePath('/', defaultLocale)).toBe('/');
	});

	it('prefixes every other locale', () => {
		expect(localizePath('/template/x', 'es')).toBe('/es/template/x');
		expect(localizePath('/', 'es')).toBe('/es');
	});

	it('tolerates a path without a leading slash', () => {
		expect(localizePath('template/x', 'fr')).toBe('/fr/template/x');
	});
});

describe('localeFromPath', () => {
	it('reads the locale out of the first segment', () => {
		expect(localeFromPath('/es/template/x')).toBe('es');
		expect(localeFromPath('/zh')).toBe('zh');
	});

	it('defaults to English for an unprefixed or unknown path', () => {
		for (const path of ['/', '/template/x', '/jp/template/x', '/en/x']) {
			expect(localeFromPath(path)).toBe(defaultLocale);
		}
	});
});

describe('unlocalizePath', () => {
	it('strips the prefix back to the canonical English path', () => {
		expect(unlocalizePath('/es/template/x')).toBe('/template/x');
		expect(unlocalizePath('/fr')).toBe('/');
	});

	it('leaves an already-canonical path alone', () => {
		expect(unlocalizePath('/template/x')).toBe('/template/x');
		expect(unlocalizePath('/')).toBe('/');
	});

	it('does not strip a path segment that merely looks like a locale', () => {
		// `/de-luxe` is a slug, not the German prefix.
		expect(unlocalizePath('/template/de')).toBe('/template/de');
	});

	it('round-trips with localizePath for every path shape', () => {
		for (const path of ['/', '/template/x', '/search', '/u/alice']) {
			for (const locale of ['es', 'fr', 'zh', 'ms', 'de', 'pt'] as const) {
				expect(unlocalizePath(localizePath(path, locale))).toBe(path);
			}
		}
	});
});
