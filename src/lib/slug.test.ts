import { describe, expect, it } from 'vitest';
import { aggregateSlugValues, slugValue } from './slug';

describe('aggregateSlugValues', () => {
	it('combines legacy case variants into a single entry', () => {
		expect(
			aggregateSlugValues([
				{ slug: 'Example-Ranking', value: 2 },
				{ slug: 'example-ranking', value: 3 },
			])
		).toEqual({ 'example-ranking': 5 });
	});

	it('does not emit the raw spellings as duplicate keys', () => {
		const totals = aggregateSlugValues([
			{ slug: 'Example-Ranking', value: 2 },
		]);

		expect(Object.keys(totals)).toEqual(['example-ranking']);
	});
});

describe('slugValue', () => {
	it('reads a total regardless of the caller’s slug spelling', () => {
		const totals = aggregateSlugValues([
			{ slug: 'example-ranking', value: 4 },
		]);

		expect(slugValue(totals, 'Example-Ranking')).toBe(4);
		expect(slugValue(totals, 'example-ranking')).toBe(4);
	});

	it('returns 0 for unknown slugs and missing maps', () => {
		expect(slugValue({}, 'nope')).toBe(0);
		expect(slugValue(undefined, 'nope')).toBe(0);
	});
});
