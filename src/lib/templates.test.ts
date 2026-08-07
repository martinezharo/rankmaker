import { describe, expect, it } from 'vitest';
import { getOfficialTemplateBySlug } from './templates';

describe('getOfficialTemplateBySlug', () => {
	it('returns the canonical template for a case-insensitive slug lookup', () => {
		const template = getOfficialTemplateBySlug('BEST-SOCIAL-NETWORKS-RANKING');

		expect(template?.slug).toBe('best-social-networks-ranking');
	});

	it('returns null for an unknown slug', () => {
		expect(getOfficialTemplateBySlug('does-not-exist')).toBeNull();
	});
});
