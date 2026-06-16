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

/**
 * Whether page *content* (template titles/descriptions/options, not just the UI
 * chrome) is actually localized per locale.
 *
 * Currently `false`: the UI is translated, but template content is English on
 * every locale URL, so `/es/template/x` … are near-duplicates of the English
 * page. While this is false, multilingual SEO signals are suppressed to avoid
 * duplicate content and to concentrate Google's crawl budget on the English
 * URLs (the domain is crawled sparingly):
 *   - the sitemap lists English URLs only (no per-locale entries),
 *   - pages emit no `hreflang` alternates,
 *   - locale variants canonicalize to their English URL.
 *
 * Flip to `true` once content is genuinely localized (e.g. auto-translated
 * user content + translated JSON templates) to restore full multilingual SEO
 * in one switch — see `Layout.astro` and `sitemap.xml.ts`.
 */
export const CONTENT_LOCALIZED = false;

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
