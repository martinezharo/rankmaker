import { describe, expect, it } from 'vitest';
import {
	LISTING_CACHE_CONTROL,
	MATURE_COOKIE,
	filterMature,
	isMatureGated,
	matureCookieOptions,
	matureSqlFilter,
	readMaturePref,
	writeMaturePref,
} from './mature';
import { fakeCookies } from '../test/cookies';

describe('the mature preference cookie', () => {
	it('is off by default — that is what a first-time visitor and a crawler get', () => {
		expect(readMaturePref(fakeCookies())).toBe(false);
	});

	it('is on only for the exact opt-in value', () => {
		expect(readMaturePref(fakeCookies({ [MATURE_COOKIE]: '1' }))).toBe(true);
		for (const value of ['0', 'true', 'yes', '', '01']) {
			expect(readMaturePref(fakeCookies({ [MATURE_COOKIE]: value }))).toBe(
				false
			);
		}
	});

	it('round-trips through a write', () => {
		const cookies = fakeCookies();
		writeMaturePref(cookies, true);
		expect(readMaturePref(cookies)).toBe(true);
		writeMaturePref(cookies, false);
		expect(readMaturePref(cookies)).toBe(false);
	});

	it('is written httpOnly, same-site and site-wide, and stays put for a year', () => {
		const cookies = fakeCookies();
		writeMaturePref(cookies, true);
		expect(cookies.written.get(MATURE_COOKIE)?.options).toMatchObject({
			httpOnly: true,
			sameSite: 'lax',
			path: '/',
			maxAge: 365 * 24 * 60 * 60,
		});
		expect(matureCookieOptions().httpOnly).toBe(true);
	});
});

describe('matureSqlFilter', () => {
	it('drops flagged rows when the viewer has not opted in', () => {
		expect(matureSqlFilter(false)).toBe(' AND t.is_mature = 0');
	});

	it('adds nothing when they have', () => {
		expect(matureSqlFilter(true)).toBe('');
	});

	it('is a constant, so it can never carry caller input into the SQL', () => {
		expect(matureSqlFilter(false)).toBe(matureSqlFilter(false));
		expect(matureSqlFilter(false)).not.toMatch(/\?/);
	});
});

describe('filterMature', () => {
	const templates = [
		{ slug: 'tame', is_mature: false },
		{ slug: 'spicy', is_mature: true },
	];

	it('removes flagged templates for an opted-out viewer', () => {
		expect(filterMature(templates, false).map((t) => t.slug)).toEqual([
			'tame',
		]);
	});

	it('returns the list untouched for an opted-in viewer', () => {
		expect(filterMature(templates, true)).toBe(templates);
	});

	it('does not mutate the input', () => {
		filterMature(templates, false);
		expect(templates).toHaveLength(2);
	});
});

describe('isMatureGated', () => {
	it('gates a flagged public template for an opted-out viewer', () => {
		expect(
			isMatureGated({ is_mature: true, visibility: 'public' }, false)
		).toBe(true);
	});

	it('does not gate once the viewer opted in', () => {
		expect(
			isMatureGated({ is_mature: true, visibility: 'public' }, false)
		).toBe(true);
		expect(
			isMatureGated({ is_mature: true, visibility: 'public' }, true)
		).toBe(false);
	});

	it('never gates an unflagged template', () => {
		expect(
			isMatureGated({ is_mature: false, visibility: 'public' }, false)
		).toBe(false);
	});

	it('leaves private and unlisted templates alone — they are already unlisted', () => {
		for (const visibility of ['private', 'unlisted']) {
			expect(isMatureGated({ is_mature: true, visibility }, false)).toBe(
				false
			);
		}
	});
});

describe('LISTING_CACHE_CONTROL', () => {
	it('is public and short-lived — listings render one variant for everyone', () => {
		expect(LISTING_CACHE_CONTROL).toBe('public, max-age=60');
	});
});
