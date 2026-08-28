import { describe, expect, it } from 'vitest';
import { stringToColor } from './placeholder-color';

describe('stringToColor', () => {
	it('always returns a six-digit hex colour', () => {
		for (const name of ['', 'a', 'Alien', 'A'.repeat(200), '日本語', '<>&']) {
			expect(stringToColor(name), name).toMatch(/^#[0-9A-F]{6}$/);
		}
	});

	it('is deterministic — server and browser must agree', () => {
		expect(stringToColor('Alien')).toBe(stringToColor('Alien'));
	});

	it('gives different names different colours', () => {
		expect(stringToColor('Alien')).not.toBe(stringToColor('Heat'));
	});
});
