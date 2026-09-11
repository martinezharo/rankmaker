import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCKED_CRAWLER_USER_AGENTS, isBlockedCrawler } from './crawlers';

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

describe('robots.txt', () => {
	const robots = readFileSync(
		join(process.cwd(), 'public/robots.txt'),
		'utf8'
	);

	// A crawler we refuse at the edge should also be told so in the file it is
	// supposed to read, or the only way it finds out is by being served a 403 —
	// which costs us a Worker invocation for every request it makes.
	it('disallows every crawler that is blocked at the edge', () => {
		for (const crawler of BLOCKED_CRAWLER_USER_AGENTS) {
			expect(robots).toContain(`User-agent: ${crawler}`);
		}
	});

	it('still lets everything else in, and points at the sitemap', () => {
		expect(robots).toContain('User-agent: *\nAllow: /');
		expect(robots).toContain('Sitemap: https://rankmaker.net/sitemap.xml');
	});
});
