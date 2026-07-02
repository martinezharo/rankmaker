import { describe, it, expect } from 'vitest';
import { computeCanvasHeight, truncate } from './ranking-share-image';

describe('computeCanvasHeight', () => {
	// HEADER_H(110) + PODIUM_H(420) + FOOTER_H(60) + PAD(50) = 640 baseline.
	it('has no rest band for 3 or fewer items', () => {
		expect(computeCanvasHeight(1)).toBe(640);
		expect(computeCanvasHeight(3)).toBe(640);
	});

	it('adds one 2-column row band for items 4–5', () => {
		// 1 row → ROW_H(100) + label band(60) = 160.
		expect(computeCanvasHeight(4)).toBe(800);
		expect(computeCanvasHeight(5)).toBe(800);
	});

	it('grows by a row every two extra items', () => {
		// 6 items → 3 rest → 2 rows → 2*100 + 60 = 260.
		expect(computeCanvasHeight(6)).toBe(900);
	});
});

describe('truncate', () => {
	// Fake text measurement: 10px per character.
	const measure = (t: string) => t.length * 10;

	it('returns text unchanged when it fits (no ellipsis)', () => {
		expect(truncate('abc', 30, measure)).toBe('abc');
		expect(truncate('abc', 100, measure)).toBe('abc');
	});

	it('trims and appends an ellipsis when too wide', () => {
		// maxW 50 → keep 5 chars (width 50), then add ellipsis.
		expect(truncate('abcdefghij', 50, measure)).toBe('abcde…');
	});

	it('never trims below a 3-character floor', () => {
		expect(truncate('abcdefghij', 5, measure)).toBe('abc…');
	});
});
