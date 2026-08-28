// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	bindPreferenceToggles,
	isToggleOn,
	savePreference,
	setToggleState,
} from './preference-toggle';
import { click, flush, inlineDictionary, mount } from '../test/dom';

function page() {
	mount(`
		<button data-pref-key="showMature" data-pref-error="mature-error"
			role="switch" aria-checked="false" class="bg-border">
			<span></span>
		</button>
		<p id="mature-error" role="status"></p>
		<button data-pref-key="emailNotifications" role="switch"
			aria-checked="true" class="bg-primary">
			<span class="translate-x-5"></span>
		</button>
	`);
	return {
		mature: document.querySelector<HTMLElement>('[data-pref-key="showMature"]')!,
		email: document.querySelector<HTMLElement>(
			'[data-pref-key="emailNotifications"]'
		)!,
		error: document.getElementById('mature-error')!,
	};
}

let fetchMock: ReturnType<typeof vi.fn>;
const stubApi = (ok = true, reject = false) => {
	fetchMock = vi.fn(async () => {
		if (reject) throw new Error('offline');
		return { ok };
	});
	vi.stubGlobal('fetch', fetchMock);
};

beforeEach(() => {
	inlineDictionary();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('setToggleState / isToggleOn', () => {
	it('paints and reports the on state', () => {
		const { mature } = page();
		setToggleState(mature, true);
		expect(mature).toHaveAttribute('aria-checked', 'true');
		expect(mature.className).toContain('bg-primary');
		expect(mature.className).not.toContain('bg-border');
		expect(mature.querySelector('span')!.className).toContain('translate-x-5');
		expect(isToggleOn(mature)).toBe(true);
	});

	it('paints and reports the off state', () => {
		const { email } = page();
		setToggleState(email, false);
		expect(email).toHaveAttribute('aria-checked', 'false');
		expect(email.className).toContain('bg-border');
		expect(email.querySelector('span')!.className).not.toContain(
			'translate-x-5'
		);
		expect(isToggleOn(email)).toBe(false);
	});
});

describe('savePreference', () => {
	it('posts the one key it was given', async () => {
		stubApi();
		expect(await savePreference('showMature', true)).toBe(true);
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/me/preferences',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ showMature: true }),
			})
		);
	});

	it('reports failure rather than throwing', async () => {
		stubApi(false);
		expect(await savePreference('showMature', true)).toBe(false);
		stubApi(true, true);
		expect(await savePreference('showMature', true)).toBe(false);
	});
});

describe('bindPreferenceToggles', () => {
	it('flips the switch and saves it', async () => {
		const { mature } = page();
		stubApi();
		bindPreferenceToggles();

		click(mature);
		expect(isToggleOn(mature)).toBe(true); // optimistic
		await flush();

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/me/preferences',
			expect.objectContaining({
				body: JSON.stringify({ showMature: true }),
			})
		);
	});

	it('turns a switch that was on back off', async () => {
		const { email } = page();
		stubApi();
		bindPreferenceToggles();

		click(email);
		await flush();

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/me/preferences',
			expect.objectContaining({
				body: JSON.stringify({ emailNotifications: false }),
			})
		);
	});

	it('announces the mature change, because the rendered pages are now stale', async () => {
		const { mature } = page();
		stubApi();
		const heard = vi.fn();
		document.addEventListener('rm:mature-changed', heard);
		bindPreferenceToggles();

		click(mature);
		await flush();

		expect(heard).toHaveBeenCalledTimes(1);
		expect((heard.mock.calls[0][0] as CustomEvent).detail).toEqual({
			showMature: true,
		});
		document.removeEventListener('rm:mature-changed', heard);
	});

	it('says nothing about other preferences', async () => {
		const { email } = page();
		stubApi();
		const heard = vi.fn();
		document.addEventListener('rm:mature-changed', heard);
		bindPreferenceToggles();

		click(email);
		await flush();

		expect(heard).not.toHaveBeenCalled();
		document.removeEventListener('rm:mature-changed', heard);
	});

	it('reverts and explains when the save is refused', async () => {
		const { mature, error } = page();
		stubApi(false);
		bindPreferenceToggles();

		click(mature);
		await flush();

		expect(isToggleOn(mature)).toBe(false);
		expect(error.textContent).toBeTruthy();
	});

	it('reverts when the network is down', async () => {
		const { mature } = page();
		stubApi(true, true);
		bindPreferenceToggles();

		click(mature);
		await flush();

		expect(isToggleOn(mature)).toBe(false);
	});

	it('clears a previous error on the next attempt', async () => {
		const { mature, error } = page();
		stubApi(false);
		bindPreferenceToggles();
		click(mature);
		await flush();
		expect(error.textContent).toBeTruthy();

		stubApi(true);
		click(mature);
		await flush();
		expect(error.textContent).toBe('');
	});

	it('binds each switch once, however often it runs', async () => {
		const { mature } = page();
		stubApi();
		bindPreferenceToggles();
		bindPreferenceToggles();

		click(mature);
		await flush();

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
