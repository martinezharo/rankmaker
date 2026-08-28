import { describe, expect, it } from 'vitest';
import {
	decorateListing,
	filterByCategory,
	groupByCategory,
	matchesQuery,
	toListingItem,
	withLiveNumbers,
	type ListingItem,
} from './listings';
import type { Template } from './templates';

function template(overrides: Partial<Template> = {}): Template {
	return {
		id: 'id-1',
		slug: 'a-template',
		title: 'A Template',
		description: null,
		category: 'Movies',
		cover_image: null,
		collage: [],
		times_ranked: 0,
		created_at: '2026-01-01',
		updated_at: '2026-01-01',
		options: [],
		creator: { username: 'someone', avatar: 'star-purple', isVerified: false },
		source: 'user',
		visibility: 'public',
		is_mature: false,
		mature_locked: false,
		...overrides,
	};
}

function item(overrides: Partial<ListingItem> = {}): ListingItem {
	return { ...toListingItem(template()), ...overrides };
}

describe('decorateListing', () => {
	it('orders by ranking count, most-ranked first', () => {
		const listing = decorateListing(
			[
				template({ slug: 'quiet', times_ranked: 3 }),
				template({ slug: 'popular', times_ranked: 90 }),
				template({ slug: 'middling', times_ranked: 40 }),
			],
			{}
		);
		expect(listing.map((t) => t.slug)).toEqual(['popular', 'middling', 'quiet']);
	});

	it('prefers live D1 counts over the stored number', () => {
		const listing = decorateListing(
			[
				template({ slug: 'stale-high', times_ranked: 500 }),
				template({ slug: 'live-high', times_ranked: 1 }),
			],
			{ counts: { 'stale-high': 2, 'live-high': 700 } }
		);
		expect(listing.map((t) => t.slug)).toEqual(['live-high', 'stale-high']);
		expect(listing[0]!.times_ranked).toBe(700);
	});

	it('keeps the stored number when counts are unavailable', () => {
		const [only] = decorateListing([template({ times_ranked: 42 })], {});
		expect(only!.times_ranked).toBe(42);
	});

	it('merges vote scores, defaulting to zero', () => {
		const listing = decorateListing(
			[template({ slug: 'voted' }), template({ slug: 'unvoted' })],
			{ votes: { voted: 12 } }
		);
		expect(listing.find((t) => t.slug === 'voted')!.votes).toBe(12);
		expect(listing.find((t) => t.slug === 'unvoted')!.votes).toBe(0);
	});
});

describe('groupByCategory', () => {
	const categories = [{ name: 'Movies' }, { name: 'Music' }, { name: 'Games' }];

	it('caps each category at the row size, keeping the order', () => {
		const items = [
			item({ slug: 'm1', category: 'Movies', times_ranked: 9 }),
			item({ slug: 'm2', category: 'Movies', times_ranked: 8 }),
			item({ slug: 'm3', category: 'Movies', times_ranked: 7 }),
			item({ slug: 'mu1', category: 'Music', times_ranked: 6 }),
		];
		const grouped = groupByCategory(items, categories, 2);
		expect(grouped['Movies']!.map((t) => t.slug)).toEqual(['m1', 'm2']);
		expect(grouped['Music']!.map((t) => t.slug)).toEqual(['mu1']);
	});

	it('gives every category a row, even an empty one', () => {
		const grouped = groupByCategory([], categories, 4);
		expect(Object.keys(grouped)).toEqual(['Movies', 'Music', 'Games']);
		expect(grouped['Games']).toEqual([]);
	});
});

describe('filterByCategory', () => {
	it('keeps only the requested category', () => {
		const items = [
			item({ slug: 'a', category: 'Movies' }),
			item({ slug: 'b', category: 'Music' }),
			item({ slug: 'c', category: null }),
		];
		expect(filterByCategory(items, 'Movies').map((t) => t.slug)).toEqual(['a']);
	});
});

describe('matchesQuery', () => {
	const movie = item({
		title: 'Best Movies',
		description: 'The greatest films ever made',
		optionNames: 'The Godfather Goodfellas Casino',
	});

	it('matches everything when the query is blank', () => {
		expect(matchesQuery(movie, '')).toBe(true);
		expect(matchesQuery(movie, '   ')).toBe(true);
	});

	it('matches on the title, the description and the option names', () => {
		expect(matchesQuery(movie, 'movies')).toBe(true);
		expect(matchesQuery(movie, 'greatest')).toBe(true);
		// Option names are what makes a template findable by its contents.
		expect(matchesQuery(movie, 'godfather')).toBe(true);
	});

	it('is case-insensitive', () => {
		expect(matchesQuery(movie, 'GODFATHER')).toBe(true);
	});

	it('requires every word, in any order', () => {
		expect(matchesQuery(movie, 'godfather casino')).toBe(true);
		expect(matchesQuery(movie, 'casino godfather')).toBe(true);
		expect(matchesQuery(movie, 'godfather rocky')).toBe(false);
	});

	it('ignores extra whitespace between words', () => {
		expect(matchesQuery(movie, '  godfather   casino  ')).toBe(true);
	});

	it('does not match on the category, which has its own filter', () => {
		expect(matchesQuery(item({ category: 'Movies', title: 'X' }), 'movies')).toBe(
			false
		);
	});
});

describe('withLiveNumbers', () => {
	const stale = () =>
		template({ slug: 'a-template', times_ranked: 999, votes: 42 });

	it('replaces whatever the template carried with the live numbers', () => {
		expect(
			withLiveNumbers(stale(), {
				counts: { 'a-template': 7 },
				votes: { 'a-template': 3 },
			})
		).toMatchObject({ times_ranked: 7, votes: 3 });
	});

	it('reads an aggregate for a slug that is not lowercase', () => {
		expect(
			withLiveNumbers(template({ slug: 'Mixed-Case' }), {
				counts: { 'mixed-case': 5 },
			}).times_ranked
		).toBe(5);
	});

	it('reports zero for a template nobody has ranked or voted on', () => {
		expect(
			withLiveNumbers(stale(), { counts: {}, votes: {} })
		).toMatchObject({ times_ranked: 0, votes: 0 });
	});

	it('leaves the numbers alone when D1 was unavailable', () => {
		expect(withLiveNumbers(stale(), {})).toMatchObject({
			times_ranked: 999,
			votes: 42,
		});
	});

	it('does not mutate the template it was given', () => {
		const original = stale();
		withLiveNumbers(original, { counts: { 'a-template': 7 } });
		expect(original.times_ranked).toBe(999);
	});

	it('keeps every other field, so a card still renders', () => {
		const decorated = withLiveNumbers(
			template({ title: 'A Template' }),
			{ counts: { 'a-template': 1 } }
		);
		expect(decorated).toMatchObject({
			slug: 'a-template',
			title: 'A Template',
			source: 'user',
		});
	});
});
