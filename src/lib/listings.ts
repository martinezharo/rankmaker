/**
 * Shared shaping for every template listing (home sections, /search,
 * /category/[name], profiles).
 *
 * These pages all start from the same three D1 reads — the browse list, the
 * ranking counts and the vote scores — and then decorate, sort, filter and
 * group them. That work used to be copy-pasted into each page's frontmatter,
 * which is how /search's client-side grid drifted from the server's.
 *
 * It lives here because the *client* runs it too: publicly cached listings
 * render the canonical, mature-free variant, and a viewer who opted into
 * mature content re-derives their own variant in the browser from
 * `/api/templates/browse`. Server and client must agree on the ordering, so
 * there can only be one implementation of it.
 */
import type { Template } from './templates';
import { slugValue, type SlugValues } from './slug';

/**
 * The card-shaped subset of a template. Listings never need `options` or the
 * timestamps, and this is what crosses the wire to the browse endpoint.
 */
export interface ListingItem {
	slug: string;
	title: string;
	description: string | null;
	category: string | null;
	cover_image: string | null;
	collage: string[];
	times_ranked: number;
	votes: number;
	/** Option names, used by /search's client-side text filter. */
	optionNames: string;
	creator: Template['creator'];
	is_mature: boolean;
}

export function toListingItem(template: Template): ListingItem {
	return {
		slug: template.slug,
		title: template.title,
		description: template.description,
		category: template.category,
		cover_image: template.cover_image,
		collage: template.collage,
		times_ranked: template.times_ranked,
		votes: template.votes ?? 0,
		optionNames: template.optionNames ?? '',
		creator: template.creator,
		is_mature: template.is_mature,
	};
}

/** The live D1 aggregates a listing is decorated with. */
export type LiveNumbers = { counts?: SlugValues; votes?: SlugValues };

/**
 * Merge the live D1 numbers onto a template.
 *
 * D1 is the only source of these numbers: a template carries 0 until this
 * runs, so a slug missing from the map means "nobody has ranked it", not
 * "keep what it had". The maps are optional only because a page whose D1 read
 * failed still renders — then the zeros stand rather than a stale figure.
 *
 * Every surface that shows a ranked count or a vote score goes through here,
 * so they cannot drift apart: the home grid, /search, a category page, a
 * profile, the saved list, the "Following" row and the recommendations.
 */
export function withLiveNumbers<T extends Template>(
	template: T,
	{ counts, votes }: LiveNumbers = {}
): T {
	return {
		...template,
		times_ranked: counts
			? slugValue(counts, template.slug)
			: template.times_ranked,
		votes: votes ? slugValue(votes, template.slug) : (template.votes ?? 0),
	};
}

/**
 * Merge the live D1 numbers into the browse list and put the most-ranked
 * first — the ordering every listing shows.
 */
export function decorateListing(
	templates: Template[],
	live: LiveNumbers = {}
): ListingItem[] {
	return templates
		.map((template) => toListingItem(withLiveNumbers(template, live)))
		.sort((a, b) => b.times_ranked - a.times_ranked);
}

/** The listing narrowed to one category, order preserved. */
export function filterByCategory(
	items: ListingItem[],
	category: string
): ListingItem[] {
	return items.filter((item) => item.category === category);
}

/**
 * Home-page grouping: the `perCategory` most-ranked templates of each
 * category, keyed by category name.
 */
export function groupByCategory(
	items: ListingItem[],
	categories: readonly { name: string }[],
	perCategory: number
): Record<string, ListingItem[]> {
	const grouped: Record<string, ListingItem[]> = {};
	for (const category of categories) {
		grouped[category.name] = filterByCategory(items, category.name).slice(
			0,
			perCategory
		);
	}
	return grouped;
}

/**
 * Total rankings played across every template of each category, keyed by
 * category name. Categories nobody has ranked are simply absent.
 */
export function categoryRankedTotals(
	items: ListingItem[]
): Record<string, number> {
	const totals: Record<string, number> = {};
	for (const item of items) {
		if (!item.category) continue;
		totals[item.category] = (totals[item.category] ?? 0) + item.times_ranked;
	}
	return totals;
}

/**
 * The categories, busiest first — the home page shows the ones people
 * actually rank at the top instead of a fixed editorial order.
 *
 * The totals are summed over the *whole* listing, not the handful of cards a
 * row ends up showing, so `groupByCategory`'s cap does not skew the order.
 * Ties keep the declared order of `CATEGORIES`, which makes the ordering
 * deterministic on a cold database where every total is zero.
 */
export function sortCategoriesByRanked<T extends { name: string }>(
	items: ListingItem[],
	categories: readonly T[]
): T[] {
	const totals = categoryRankedTotals(items);
	return categories
		.map((category, index) => ({ category, index }))
		.sort(
			(a, b) =>
				(totals[b.category.name] ?? 0) - (totals[a.category.name] ?? 0) ||
				a.index - b.index
		)
		.map((entry) => entry.category);
}

/**
 * Does this template match a free-text query?
 *
 * Every word must appear somewhere in the title, the description or the option
 * names — matching option names is what lets "/search godfather" find the
 * "Best Movies" template. Words are matched independently so word order and
 * extra spacing don't matter.
 */
export function matchesQuery(item: ListingItem, query: string): boolean {
	const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return true;
	const haystack = [item.title, item.description ?? '', item.optionNames]
		.join(' ')
		.toLowerCase();
	return words.every((word) => haystack.includes(word));
}
