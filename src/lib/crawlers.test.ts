import { describe, expect, it } from 'vitest';
import { isBlockedCrawler } from './crawlers';

describe('isBlockedCrawler', () => {
	it('blocks the SE Ranking backlinks crawler', () => {
		expect(
			isBlockedCrawler(
				'Mozilla/5.0 (compatible; SERankingBacklinksBot/1.0; +https://seranking.com/backlinks-crawler)'
			)
		).toBe(true);
	});

	it('allows browsers and absent user agents', () => {
		expect(isBlockedCrawler('Mozilla/5.0 Chrome/140.0.0.0')).toBe(false);
		expect(isBlockedCrawler(null)).toBe(false);
	});
});
