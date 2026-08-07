import { describe, expect, it } from 'vitest';
import { aggregateSlugValues } from './slug';

describe('aggregateSlugValues', () => {
	it('combines legacy case variants and preserves direct aliases', () => {
		expect(
			aggregateSlugValues([
				{ slug: 'Example-Ranking', value: 2 },
				{ slug: 'example-ranking', value: 3 },
			])
		).toEqual({
			'example-ranking': 5,
			'Example-Ranking': 5,
		});
	});
});
