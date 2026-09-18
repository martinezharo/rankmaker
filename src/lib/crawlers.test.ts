import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	BLOCKED_CRAWLER_USER_AGENTS,
	NOINDEX_PATH_PREFIXES,
	isBlockedCrawler,
	isNoindexPath,
} from './crawlers';

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

describe('isNoindexPath', () => {
	it('covers the JSON surface, including nested routes', () => {
		expect(isNoindexPath('/api/counts')).toBe(true);
		expect(isNoindexPath('/api/me/history')).toBe(true);
		expect(isNoindexPath('/api/auth/login')).toBe(true);
	});

	it('leaves content pages indexable', () => {
		expect(isNoindexPath('/')).toBe(false);
		expect(isNoindexPath('/template/best-movies')).toBe(false);
		expect(isNoindexPath('/es/category/movies')).toBe(false);
		// Not a prefix match: only the /api/ segment is off limits.
		expect(isNoindexPath('/apiary')).toBe(false);
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

	// The header in src/middleware.ts only keeps the JSON out of an index.
	// Not spending the Worker invocation at all is what robots.txt buys, so
	// the two lists have to say the same thing.
	it('disallows every path prefix the app marks noindex', () => {
		for (const prefix of NOINDEX_PATH_PREFIXES) {
			expect(robots).toContain(`Disallow: ${prefix}`);
		}
	});
});
