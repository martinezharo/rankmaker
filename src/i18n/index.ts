/**
 * Translation runtime shared by server (Astro frontmatter / components) and
 * client (bundled `<script>` modules — see `./client.ts`).
 *
 * Usage (server):
 *   const t = useTranslations(Astro.locals.locale);
 *   t('nav.home')                       → "Home"
 *   t('history.count', { n: 3 })        → "3 rankings" (interpolates {n})
 *
 * `en` is the source of truth. Missing keys in `es`/`fr` fall back to `en`, so
 * partial translations never break a page; a truly unknown key returns the key
 * itself (and warns in dev).
 */
import { defaultLocale, isLocale, localeNames, locales, type Locale } from './config';
import { en, type Dict } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { zh } from './locales/zh';
import { ms } from './locales/ms';
import { de } from './locales/de';
import type { LocaleDict } from './types';

export type { Dict };

const dictionaries: Record<Locale, LocaleDict> = { en, es, fr, zh, ms, de };

function lookup(obj: unknown, path: string): unknown {
	return path
		.split('.')
		.reduce<unknown>(
			(acc, key) =>
				acc && typeof acc === 'object'
					? (acc as Record<string, unknown>)[key]
					: undefined,
			obj
		);
}

function interpolate(value: string, vars?: Record<string, string | number>): string {
	if (!vars) return value;
	return value.replace(/\{(\w+)\}/g, (_, key) =>
		key in vars ? String(vars[key]) : `{${key}}`
	);
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

export function useTranslations(locale: Locale): TFunction {
	const dict = dictionaries[locale] ?? en;
	return (key, vars) => {
		let value = lookup(dict, key);
		if (typeof value !== 'string') value = lookup(en, key); // fall back to English
		if (typeof value !== 'string') {
			if (import.meta.env.DEV) {
				// eslint-disable-next-line no-console
				console.warn(`[i18n] missing translation key: "${key}"`);
			}
			return key;
		}
		return interpolate(value, vars);
	};
}

// ── URL helpers (prefix routing) ─────────────────────────────────────────────

/** Prefix an internal path with the locale (no-op for the default locale). */
export function localizePath(path: string, locale: Locale): string {
	if (locale === defaultLocale) return path;
	if (path === '/') return `/${locale}`;
	return path.startsWith('/') ? `/${locale}${path}` : `/${locale}/${path}`;
}

/** The locale encoded in a pathname's first segment (defaults to English). */
export function localeFromPath(pathname: string): Locale {
	const seg = pathname.split('/')[1];
	return isLocale(seg) ? seg : defaultLocale;
}

/** Strip any locale prefix, returning the canonical (English) path. */
export function unlocalizePath(pathname: string): string {
	const seg = pathname.split('/')[1];
	if (isLocale(seg) && seg !== defaultLocale) {
		const rest = pathname.slice(seg.length + 1);
		return rest || '/';
	}
	return pathname;
}

export { defaultLocale, isLocale, localeNames, locales, type Locale };
