/**
 * Translation runtime shared by the server (Astro frontmatter, and components
 * that also render in the browser) and the client.
 *
 * Usage (server):
 *   const t = useTranslations(Astro.locals.locale);
 *   t('nav.home')                       → "Home"
 *   t('card.ranked', { n: 3 })          → "3 ranked" (interpolates {n})
 *
 * ## Why the dictionaries are not imported here
 *
 * This module is reachable from the browser: client scripts import it, and so
 * do the components that hydrate. A static import of the seven locale files
 * would therefore bundle all seven into the client — which is exactly what
 * used to happen, putting ~290KB (91KB gzipped) of translations on every page,
 * six sevenths of them in languages the visitor is not reading.
 *
 * So the dictionaries arrive from whichever side is running:
 *   - the server registers all seven (see `./server.ts`), and
 *   - the browser reads the one the page was rendered in, inlined into the
 *     HTML by Layout.astro (see `./payload.ts`).
 *
 * `en` remains the source of truth: the server-side lookup falls back to it
 * key by key, and the inlined client dictionary is pre-merged over it, so a
 * partial translation never breaks a page. A truly unknown key returns the key
 * itself (and warns in dev).
 */
import { CONTENT_LOCALIZED, defaultLocale, isLocale, localeNames, locales, type Locale } from './config';
import type { Dict } from './locales/en';
import type { LocaleDict } from './types';
import { readInlinedDictionary } from './payload';

export type { Dict };

/** Dictionaries handed over by `./server.ts`. Empty in the browser. */
const registry: Partial<Record<Locale, LocaleDict>> = {};

/** Called once, at module load, by the server-only entry point. */
export function registerDictionaries(
	dictionaries: Record<Locale, LocaleDict>
): void {
	Object.assign(registry, dictionaries);
}

/**
 * The dictionary to translate against, and the one to fall back to.
 *
 * In the browser there is exactly one dictionary — the page's own, already
 * merged over English — so it is its own fallback.
 */
function resolve(locale: Locale): { dict: LocaleDict; fallback: LocaleDict } {
	const registered = registry[locale];
	if (registered) return { dict: registered, fallback: registry[defaultLocale] ?? registered };
	const inlined = readInlinedDictionary();
	return { dict: inlined, fallback: inlined };
}

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
	const { dict, fallback } = resolve(locale);
	return (key, vars) => {
		let value = lookup(dict, key);
		if (typeof value !== 'string') value = lookup(fallback, key); // fall back to English
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

export { CONTENT_LOCALIZED, defaultLocale, isLocale, localeNames, locales, type Locale };
