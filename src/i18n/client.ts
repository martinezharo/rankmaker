/**
 * Client-side translation entry point for bundled `<script>` modules.
 *
 * Client scripts can't read `Astro.locals.locale`, so the active locale is
 * taken from `<html lang>` (set by Layout.astro from the resolved locale).
 *
 * Usage:
 *   import { clientT } from '../i18n/client';
 *   const t = clientT();
 *   button.textContent = t('common.save');
 */
import { defaultLocale, isLocale, type Locale } from './config';
import { useTranslations, type TFunction } from './index';

export function getClientLocale(): Locale {
	const lang = typeof document !== 'undefined' ? document.documentElement.lang : '';
	return isLocale(lang) ? lang : defaultLocale;
}

/** A `t` bound to the document's current locale. Call after the DOM exists. */
export function clientT(): TFunction {
	return useTranslations(getClientLocale());
}

export { getClientLocale as currentLocale };
