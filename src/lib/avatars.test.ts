import { describe, expect, it } from 'vitest';
import {
	AVATAR_PRESETS,
	SELECTABLE_AVATAR_KEYS,
	avatarHtml,
	isValidAvatarKey,
	randomAvatarKey,
} from './avatars';

describe('the avatar presets', () => {
	it('gives every preset an icon and both colours', () => {
		for (const [key, preset] of Object.entries(AVATAR_PRESETS)) {
			expect(preset.icon, key).toMatch(/^fa-/);
			expect(preset.bg, key).toBeTruthy();
			expect(preset.fg, key).toBeTruthy();
		}
	});

	it('keeps the official avatar out of the signup picker', () => {
		expect(SELECTABLE_AVATAR_KEYS).not.toContain('official');
		expect(AVATAR_PRESETS.official).toBeDefined();
	});
});

describe('isValidAvatarKey', () => {
	it('accepts every selectable key', () => {
		for (const key of SELECTABLE_AVATAR_KEYS) {
			expect(isValidAvatarKey(key)).toBe(true);
		}
	});

	it('refuses the reserved official avatar and anything invented', () => {
		for (const key of ['official', 'made-up', '', 42, null, undefined, {}]) {
			expect(isValidAvatarKey(key)).toBe(false);
		}
	});
});

describe('randomAvatarKey', () => {
	it('only ever returns a selectable key', () => {
		for (let i = 0; i < 100; i++) {
			expect(SELECTABLE_AVATAR_KEYS).toContain(randomAvatarKey());
		}
	});
});

describe('avatarHtml', () => {
	it('renders the preset’s icon and colours at the requested size', () => {
		const html = avatarHtml('bolt-purple', 48);
		expect(html).toContain('fa-bolt');
		expect(html).toContain('#8400FF');
		expect(html).toContain('width:48px;height:48px;');
	});

	it('renders the image avatar instead of an icon when the preset has one', () => {
		const html = avatarHtml('official', 48);
		expect(html).toContain('<img src="/favicon.webp"');
		expect(html).not.toContain('fa-crown');
	});

	it('falls back to a known preset for an unknown key', () => {
		expect(avatarHtml('nonsense', 32)).toBe(
			avatarHtml('star-purple', 32)
		);
	});

	it('adds the verified badge only when asked', () => {
		expect(avatarHtml('bolt-purple', 32, true)).toContain('fa-circle-check');
		expect(avatarHtml('bolt-purple', 32, false)).not.toContain(
			'fa-circle-check'
		);
	});

	it('escapes the caller-supplied badge label', () => {
		const html = avatarHtml('bolt-purple', 32, true, '"><script>x</script>');
		expect(html).not.toContain('<script>');
		expect(html).toContain('&quot;&gt;&lt;script&gt;');
	});
});
