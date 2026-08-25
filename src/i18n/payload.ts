/**
 * The translations the browser gets, and how they travel.
 *
 * The server renders in one locale, so that is the only dictionary the page
 * needs — and it needs only the parts the browser can actually reach. Long-form
 * page copy (legal pages, the about page, the SEO blurbs) and the notification
 * email templates are rendered server-side and nothing else, so they are left
 * out; `i18n-payload.test.ts` fails if that stops being true.
 *
 * The dictionary rides inside the HTML rather than in a JS chunk or a separate
 * fetch. Hydrating components need it synchronously — an async dictionary would
 * paint raw keys and then correct itself — and the pages are edge-cached, so it
 * costs no request and compresses with the rest of the document.
 */
import type { Locale } from './config';
import type { LocaleDict } from './types';

/** Element id of the JSON island Layout.astro emits. */
export const I18N_PAYLOAD_ID = 'i18n-data';

/**
 * Namespaces the browser never asks for. Everything not listed here is sent.
 *
 * Deliberately a short, conservative list of long-form server-rendered copy: a
 * namespace wrongly excluded would show visitors raw key names, and the few
 * kilobytes saved by trimming harder are not worth that.
 */
export const SERVER_ONLY_NAMESPACES = [
	'legal',
	'about',
	'seoContent',
	'email',
] as const;

/**
 * The active locale's dictionary, merged over English so the client needs no
 * fallback of its own, minus the server-only namespaces.
 */
export function buildClientDictionary(
	dictionaries: Record<Locale, LocaleDict>,
	locale: Locale
): LocaleDict {
	const merged = deepMerge(
		dictionaries.en as Record<string, unknown>,
		(dictionaries[locale] ?? {}) as Record<string, unknown>
	);
	for (const namespace of SERVER_ONLY_NAMESPACES) delete merged[namespace];
	return merged as LocaleDict;
}

/**
 * Translated locales are allowed to be partial, so a missing branch has to fall
 * through to English rather than blanking the whole namespace.
 */
function deepMerge(
	base: Record<string, unknown>,
	override: Record<string, unknown>
): Record<string, unknown> {
	const out: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(override)) {
		const existing = out[key];
		out[key] =
			isPlainObject(existing) && isPlainObject(value)
				? deepMerge(existing, value)
				: value;
	}
	return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parsed once per document; the island is rewritten on every navigation. */
let cached: { element: Element; dict: LocaleDict } | null = null;

/**
 * Read the dictionary the server inlined. Returns an empty dictionary when
 * there is none — during SSR before `./server.ts` has registered anything, or
 * in a unit test — which makes every key render as itself rather than throw.
 */
export function readInlinedDictionary(): LocaleDict {
	if (typeof document === 'undefined') return {} as LocaleDict;
	const element = document.getElementById(I18N_PAYLOAD_ID);
	if (!element) return {} as LocaleDict;
	// Keyed on the element itself: a View Transitions navigation swaps in a new
	// one (possibly in a different locale), which invalidates the cache.
	if (cached && cached.element === element) return cached.dict;
	try {
		const dict = JSON.parse(element.textContent ?? '{}') as LocaleDict;
		cached = { element, dict };
		return dict;
	} catch {
		return {} as LocaleDict;
	}
}
