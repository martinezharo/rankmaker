import { afterEach, describe, expect, it, vi } from 'vitest';
import { graphemesOf, truncateGraphemes } from './text';

const FLAG_ES = '🇪🇸';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('graphemesOf', () => {
	it('splits a plain string per character', () => {
		expect(graphemesOf('Alien')).toEqual(['A', 'l', 'i', 'e', 'n']);
	});

	it('keeps a multi-code-point emoji in a single entry', () => {
		expect(graphemesOf(`a${FLAG_ES}b`)).toEqual(['a', FLAG_ES, 'b']);
	});

	it('falls back to code points without Intl.Segmenter', () => {
		vi.stubGlobal('Intl', { ...Intl, Segmenter: undefined });
		// Each half of the flag is its own code point, and each is well formed.
		expect(graphemesOf(`a${FLAG_ES}`)).toHaveLength(3);
	});
});

describe('truncateGraphemes', () => {
	it('leaves a string that already fits untouched', () => {
		expect(truncateGraphemes('Alien', 8)).toBe('Alien');
		expect(truncateGraphemes('Exactly8', 8)).toBe('Exactly8');
	});

	it('cuts a plain string to the requested length', () => {
		expect(truncateGraphemes('A very long option name', 8)).toBe('A very l');
	});

	it('counts an emoji as one character rather than as its code units', () => {
		expect(truncateGraphemes(`${FLAG_ES}${FLAG_ES}${FLAG_ES}`, 2)).toBe(
			`${FLAG_ES}${FLAG_ES}`
		);
	});

	it('never cuts an emoji in half, whatever the boundary lands on', () => {
		// `'Vamos t🇪🇸'.slice(0, 8)` ends inside the flag's first surrogate pair.
		const cut = truncateGraphemes(`Vamos t${FLAG_ES}`, 8);
		expect(cut).toBe(`Vamos t${FLAG_ES}`);
		expect(() => encodeURIComponent(cut)).not.toThrow();
	});

	it('keeps a ZWJ sequence together', () => {
		expect(truncateGraphemes('👩‍👩‍👧 family', 1)).toBe('👩‍👩‍👧');
	});

	it('returns an empty string for a non-positive length', () => {
		expect(truncateGraphemes('Alien', 0)).toBe('');
		expect(truncateGraphemes('Alien', -1)).toBe('');
	});

	it('still produces a well-formed string without Intl.Segmenter', () => {
		vi.stubGlobal('Intl', { ...Intl, Segmenter: undefined });
		const cut = truncateGraphemes(`Vamos t${FLAG_ES}`, 8);
		expect(cut.startsWith('Vamos t')).toBe(true);
		expect(() => encodeURIComponent(cut)).not.toThrow();
	});
});
