/**
 * Server-side i18n entry point — the only module that loads every dictionary.
 *
 * Astro frontmatter and server libraries import from here; anything that also
 * runs in the browser imports `./index` instead, which carries the translation
 * machinery but no dictionaries. Keeping the seven locale files behind this
 * boundary is what stops them being bundled into the client (see `./payload.ts`
 * for how the browser gets its own).
 *
 * Registration is a module-load side effect, so the dictionaries are in place
 * before anything renders.
 */
import { registerDictionaries } from './index';
import { buildClientDictionary } from './payload';
import type { Locale } from './config';
import type { LocaleDict } from './types';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { zh } from './locales/zh';
import { ms } from './locales/ms';
import { de } from './locales/de';
import { pt } from './locales/pt';

export const dictionaries: Record<Locale, LocaleDict> = {
	en,
	es,
	fr,
	zh,
	ms,
	de,
	pt,
};

registerDictionaries(dictionaries);

/** The JSON Layout.astro inlines for the browser, for the page's locale. */
export function clientDictionaryFor(locale: Locale): LocaleDict {
	return buildClientDictionary(dictionaries, locale);
}

export * from './index';
export { buildClientDictionary, I18N_PAYLOAD_ID } from './payload';
