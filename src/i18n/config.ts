/**
 * i18n configuration — the single source of truth for supported locales.
 *
 * Routing uses a URL prefix: English (the default) lives at the root
 * (`/template/x`), Spanish and French are prefixed (`/es/template/x`,
 * `/fr/template/x`). See `astro.config.mjs` (`i18n` block) and
 * `src/middleware.ts` (the prefix → rewrite step that sets `locals.locale`).
 */
export const locales = ['en', 'es', 'fr', 'zh', 'ms', 'de'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** Human-readable names for the language switcher. */
export const localeNames: Record<Locale, string> = {
	en: 'English',
	es: 'Español',
	fr: 'Français',
	zh: '中文',
	ms: 'Melayu',
	de: 'Deutsch',
};

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
