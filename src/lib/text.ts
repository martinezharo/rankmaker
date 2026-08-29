/**
 * Shortening user-authored text without breaking it.
 *
 * Names reach us from the template form, from localStorage and from D1, and
 * anything a user can type includes emoji. JavaScript strings are UTF-16, so
 * the obvious `name.slice(0, n)` counts code units, not characters: it happily
 * cuts an emoji in half and leaves a lone surrogate behind. That is not merely
 * ugly — `encodeURIComponent()` throws `URIError` on a lone surrogate, so a
 * halved flag in an option name used to 500 the whole template page.
 *
 * Truncating by grapheme cluster instead keeps every emoji whole, flags and
 * ZWJ sequences included, and can never produce a lone surrogate.
 */

let cachedSegmenter: Intl.Segmenter | null = null;

/**
 * The shared grapheme segmenter, or `null` where `Intl.Segmenter` is missing.
 * Availability is re-checked per call (it is cheap, and the constructor is
 * not) so a browser without it degrades instead of throwing.
 */
function graphemeSegmenter(): Intl.Segmenter | null {
	if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') {
		return null;
	}
	cachedSegmenter ??= new Intl.Segmenter(undefined, {
		granularity: 'grapheme',
	});
	return cachedSegmenter;
}

/**
 * The first `max` characters of `value`, counting what a reader would call a
 * character: an emoji stays whole rather than being split into surrogates.
 *
 * Without `Intl.Segmenter` this falls back to counting code points, which
 * still never splits a surrogate pair — a multi-code-point emoji may lose its
 * tail, but the result is always a well-formed string.
 */
export function truncateGraphemes(value: string, max: number): string {
	if (max <= 0) return '';
	// A string can never hold more graphemes than UTF-16 code units, so a
	// short enough one needs no segmenting at all.
	if (value.length <= max) return value;

	const segmenter = graphemeSegmenter();
	if (!segmenter) return Array.from(value).slice(0, max).join('');

	const kept: string[] = [];
	for (const { segment } of segmenter.segment(value)) {
		kept.push(segment);
		if (kept.length === max) break;
	}
	return kept.join('');
}
