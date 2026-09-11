import { describe, expect, it } from 'vitest';
import { SITE_HOST, SITE_URL } from './site';

describe('SITE_HOST', () => {
	it('is the hostname of SITE_URL, with no scheme, port or path', () => {
		expect(SITE_HOST).toBe(new URL(SITE_URL).hostname);
		expect(SITE_HOST).not.toContain('/');
		expect(SITE_HOST).not.toContain(':');
	});

	// The analytics beacon compares it against `location.hostname`, which never
	// carries either — a value that did would silently match nothing, and the
	// live site would stop reporting.
	it('is what a browser would report for the live site', () => {
		expect(new URL(SITE_URL).hostname).toBe(SITE_HOST);
		expect(SITE_HOST).toBe('rankmaker.net');
	});
});
