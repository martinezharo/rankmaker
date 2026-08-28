import { describe, expect, it } from 'vitest';
import {
	buildRankingData,
	optionImageUrl,
	parseStoredRanking,
	rankingItemsFrom,
} from './ranking-data';

describe('optionImageUrl', () => {
	it('passes an absolute URL through', () => {
		expect(optionImageUrl('https://img.test/a.webp', 'Alien')).toBe(
			'https://img.test/a.webp'
		);
	});

	it('rewrites a bundled public asset to a site-root path', () => {
		expect(optionImageUrl('public/covers/a.webp', 'Alien')).toBe(
			'/covers/a.webp'
		);
	});

	it('generates a placeholder carrying the start of the name', () => {
		expect(optionImageUrl(null, 'Alien')).toContain('text=Alien');
		expect(optionImageUrl('', 'Alien')).toContain('text=Alien');
		expect(optionImageUrl(undefined, 'Alien')).toContain('text=Alien');
	});

	it('escapes a name that would otherwise break the placeholder URL', () => {
		const url = optionImageUrl(null, 'A & B');
		expect(url).toContain('text=A%20%26%20B');
		expect(() => new URL(url)).not.toThrow();
	});

	it('trims a long name to keep the placeholder legible', () => {
		expect(optionImageUrl(null, 'A very long option name')).toContain(
			'text=A%20very%20'
		);
	});
});

describe('buildRankingData', () => {
	it('gives every option a usable image, so a duel always renders', () => {
		const data = buildRankingData({
			slug: 'best-movies',
			title: 'Best Movies',
			options: [
				{ id: 1, name: 'Alien', image: 'https://img.test/a.webp' },
				{ id: 2, name: 'Heat', image: null },
			],
		});
		expect(data.options.map((o) => o.image)).toEqual([
			'https://img.test/a.webp',
			expect.stringContaining('placehold.co'),
		]);
	});

	it('keeps the option ids exactly as given — the engine matches on them', () => {
		const data = buildRankingData({
			slug: 'local',
			title: 'A guest template',
			options: [
				{ id: 7, name: 'Seven' },
				{ id: 'local-2', name: 'Two' },
			],
		});
		expect(data.options.map((o) => o.id)).toEqual([7, 'local-2']);
	});

	it('normalizes a missing cover to an empty string', () => {
		for (const cover of [undefined, null, '']) {
			expect(
				buildRankingData({
					slug: 's',
					title: 't',
					cover,
					options: [],
				}).cover
			).toBe('');
		}
	});

	it('carries the slug and title through unchanged', () => {
		const data = buildRankingData({
			slug: 'Best-Movies',
			title: 'Best Movies',
			cover: 'https://img.test/c.webp',
			options: [],
		});
		expect(data).toMatchObject({
			slug: 'Best-Movies',
			title: 'Best Movies',
			cover: 'https://img.test/c.webp',
		});
	});
});

describe('rankingItemsFrom', () => {
	it('turns the payload into the items the engine battles', () => {
		expect(
			rankingItemsFrom({
				slug: 's',
				title: 't',
				cover: '',
				options: [
					{ id: 1, name: 'Alien', image: 'https://img.test/a.webp' },
					{ id: 2, name: 'Heat', image: '' },
				],
			})
		).toEqual([
			{ id: 1, name: 'Alien', image: 'https://img.test/a.webp' },
			{ id: 2, name: 'Heat', image: null },
		]);
	});

	it('coerces a string id, because the engine keys comparisons by number', () => {
		const [item] = rankingItemsFrom({
			slug: 's',
			title: 't',
			cover: '',
			options: [{ id: '7' as never, name: 'Seven', image: '' }],
		});
		expect(item.id).toBe(7);
	});

	it('drops an option the engine could not tell apart from another', () => {
		expect(
			rankingItemsFrom({
				slug: 's',
				title: 't',
				cover: '',
				options: [
					{ id: 'local-2' as never, name: 'No numeric id', image: '' },
					{ id: 3, name: '', image: '' },
					{ id: 4, name: 'Kept', image: '' },
				],
			})
		).toEqual([{ id: 4, name: 'Kept', image: null }]);
	});

	it('is an empty list for a payload with no options', () => {
		expect(
			rankingItemsFrom({ slug: 's', title: 't', cover: '', options: [] })
		).toEqual([]);
	});
});

describe('parseStoredRanking', () => {
	it('reads back a saved result', () => {
		expect(
			parseStoredRanking([
				{ id: 1, name: 'Alien', image: 'https://img.test/a.webp' },
				{ id: 2, name: 'Heat', image: '' },
			])
		).toEqual([
			{ id: 1, name: 'Alien', image: 'https://img.test/a.webp' },
			{ id: 2, name: 'Heat', image: '' },
		]);
	});

	it('treats a missing image as no image', () => {
		expect(parseStoredRanking([{ id: 1, name: 'Alien' }])).toEqual([
			{ id: 1, name: 'Alien', image: null },
		]);
	});

	it('drops corrupted entries rather than losing the whole result', () => {
		expect(
			parseStoredRanking([
				null,
				'a string',
				{ id: 'not-a-number', name: 'Bad' },
				{ id: 1, name: 42 },
				{ id: 2, name: 'Kept', image: null },
			])
		).toEqual([{ id: 2, name: 'Kept', image: null }]);
	});

	it('is an empty list for anything that is not an array', () => {
		for (const value of [null, undefined, {}, 'x', 42]) {
			expect(parseStoredRanking(value)).toEqual([]);
		}
	});
});
