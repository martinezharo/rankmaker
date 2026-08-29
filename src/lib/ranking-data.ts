/**
 * The `#ranking-data` payload consumed by the ranking engine
 * (src/scripts/ranking-engine.ts).
 *
 * Both surfaces that can be ranked build it through here so a battle looks
 * identical whichever one it came from: the DB-backed template page
 * (src/pages/template/[slug].astro, server-side) and the guest-local template
 * page (src/pages/local/[id].astro, in the browser from localStorage).
 *
 * The two readers below turn untrusted input — an inlined payload, a result
 * restored from localStorage or from the account — into the `RankingItem`s the
 * session works with. Both drop anything malformed rather than throwing: a
 * corrupted entry must cost the user that option, never the whole page.
 */

import { resolveImageUrl } from './covers';
import type { RankingItem } from './ranking-session';
import { truncateGraphemes } from './text';

export type RankingOption = {
	id: number | string;
	name: string;
	/** Always a usable URL — options without an image get a generated placeholder. */
	image: string;
};

export type RankingData = {
	slug: string;
	title: string;
	cover: string;
	options: RankingOption[];
};

/** How much of an option's name the generated placeholder can show. */
const PLACEHOLDER_NAME_LENGTH = 8;

/**
 * An option's image, falling back to a generated placeholder carrying the
 * start of its name — options are optional-image everywhere (and guests can't
 * upload any), but the battle view always needs something to show.
 *
 * The name is cut by grapheme cluster: cutting by code unit can halve an emoji
 * into a lone surrogate, which makes `encodeURIComponent()` throw and takes the
 * whole page down with it.
 */
export function optionImageUrl(
	image: string | null | undefined,
	name: string
): string {
	return (
		resolveImageUrl(image) ||
		`https://placehold.co/200x200/111118/8400FF?text=${encodeURIComponent(
			truncateGraphemes(name, PLACEHOLDER_NAME_LENGTH)
		)}`
	);
}

export function buildRankingData(input: {
	slug: string;
	title: string;
	cover?: string | null;
	options: { id: number | string; name: string; image?: string | null }[];
}): RankingData {
	return {
		slug: input.slug,
		title: input.title,
		cover: input.cover || '',
		options: input.options.map((option) => ({
			id: option.id,
			name: option.name,
			image: optionImageUrl(option.image, option.name),
		})),
	};
}

/**
* The options the ranking engine should battle, from a `#ranking-data`
* payload. Option ids are coerced to numbers because the engine keys
* comparisons by them; an option without a usable id or name is dropped.
*/
export function rankingItemsFrom(data: RankingData): RankingItem[] {
	return data.options
		.map((item) => ({
			id: Number(item.id),
			name: String(item.name),
			image: item.image ? String(item.image) : null,
		}))
		.filter((item) => Number.isFinite(item.id) && item.name.length > 0);
}

/**
* The options in a stored ranking result — localStorage or the account — as
* engine items. The input is whatever was persisted, possibly by an older
* version of the app, so every field is checked.
*/
export function parseStoredRanking(value: unknown): RankingItem[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (typeof item !== 'object' || item === null) return null;
			const record = item as Record<string, unknown>;
			const id = Number(record.id);
			if (!Number.isFinite(id) || typeof record.name !== 'string') {
				return null;
			}
			return {
				id,
				name: record.name,
				image: typeof record.image === 'string' ? record.image : null,
			};
		})
		.filter((item): item is RankingItem => item !== null);
}
