import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	API_PATH_PREFIXES,
	BLOCKED_CRAWLER_USER_AGENTS,
	isApiPath,
	isBlockedCrawler,
} from './crawlers';
import { defaultLocale, locales } from '../i18n/config';

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

describe('isApiPath', () => {
	it('covers the JSON surface, including nested routes', () => {
		expect(isApiPath('/api/counts')).toBe(true);
		expect(isApiPath('/api/me/history')).toBe(true);
		expect(isApiPath('/api/auth/login')).toBe(true);
	});

	it('leaves content pages alone', () => {
		expect(isApiPath('/')).toBe(false);
		expect(isApiPath('/template/best-movies')).toBe(false);
		expect(isApiPath('/es/category/movies')).toBe(false);
		// Not a prefix match: only the /api/ segment is off limits.
		expect(isApiPath('/apiary')).toBe(false);
	});

	// The middleware strips the locale before asking, so a prefixed path is
	// only an API path once unprefixed — which is what makes it 404 rather
	// than become a second URL for the same endpoint.
	it('is false for a locale-prefixed path as written', () => {
		expect(isApiPath('/es/api/counts')).toBe(false);
		expect(isApiPath('/de/api/auth/login')).toBe(false);
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
	it('disallows every API path prefix', () => {
		for (const prefix of API_PATH_PREFIXES) {
			expect(robots).toContain(`Disallow: ${prefix}`);
		}
	});

	// robots.txt matching is literal: /es/api/counts is not covered by
	// `Disallow: /api/`. The middleware 404s those paths, but the 404 still
	// costs the invocation, so each locale needs its own line. Adding a
	// locale to src/i18n/config.ts fails here until robots.txt catches up.
	it('disallows the API under every non-default locale prefix', () => {
		for (const locale of locales) {
			if (locale === defaultLocale) continue;
			for (const prefix of API_PATH_PREFIXES) {
				expect(robots).toContain(`Disallow: /${locale}${prefix}`);
			}
		}
	});
});
