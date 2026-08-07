/**
 * The `#ranking-data` payload consumed by the ranking engine
 * (src/scripts/ranking-engine.ts).
 *
 * Both surfaces that can be ranked build it through here so a battle looks
 * identical whichever one it came from: the DB-backed template page
 * (src/pages/template/[slug].astro, server-side) and the guest-local template
 * page (src/pages/local/[id].astro, in the browser from localStorage).
 */

import { resolveImageUrl } from './covers';

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

/**
 * An option's image, falling back to a generated placeholder carrying the
 * start of its name — options are optional-image everywhere (and guests can't
 * upload any), but the battle view always needs something to show.
 */
export function optionImageUrl(
	image: string | null | undefined,
	name: string
): string {
	return (
		resolveImageUrl(image) ||
		`https://placehold.co/200x200/111118/8400FF?text=${encodeURIComponent(name.slice(0, 8))}`
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
