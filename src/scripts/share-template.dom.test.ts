// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initShareButtons } from './share-template';
import { click, flush, inlineDictionary, mount } from '../test/dom';

function page() {
	mount(`
		<button class="share-btn" data-title="Best Movies" data-slug="best-movies">
			<i class="fa-solid fa-share-nodes text-xs"></i>
		</button>
	`);
	return document.querySelector<HTMLElement>('.share-btn')!;
}

beforeEach(() => {
	inlineDictionary();
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('initShareButtons', () => {
	it('shares through the native sheet when there is one', async () => {
		const button = page();
		const share = vi.fn(async () => undefined);
		vi.stubGlobal('navigator', { share });

		initShareButtons();
		click(button);
		await flush();

		expect(share).toHaveBeenCalledWith({
			title: expect.stringContaining('Best Movies'),
			url: `${window.location.origin}/template/best-movies`,
		});
	});

	it('shares the localized URL', async () => {
		const button = page();
		inlineDictionary('es');
		const share = vi.fn(async () => undefined);
		vi.stubGlobal('navigator', { share });

		initShareButtons();
		click(button);
		await flush();

		expect(share).toHaveBeenCalledWith(
			expect.objectContaining({
				url: `${window.location.origin}/es/template/best-movies`,
			})
		);
	});

	it('is quiet when the share sheet is dismissed', async () => {
		const button = page();
		vi.stubGlobal('navigator', {
			share: async () => {
				throw new Error('AbortError');
			},
		});

		initShareButtons();
		click(button);
		await expect(flush()).resolves.toBeUndefined();
	});

	it('copies the link and flashes a tick when there is no share sheet', async () => {
		vi.useFakeTimers();
		const button = page();
		const writeText = vi.fn(async () => undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		initShareButtons();
		click(button);
		await flush();

		expect(writeText).toHaveBeenCalledWith(
			`${window.location.origin}/template/best-movies`
		);
		expect(button.querySelector('i')!.className).toContain('fa-check');

		vi.advanceTimersByTime(1500);
		expect(button.querySelector('i')!.className).toContain('fa-share-nodes');
	});

	it('does not follow the card link it sits inside', () => {
		const button = page();
		vi.stubGlobal('navigator', { share: vi.fn(async () => undefined) });
		initShareButtons();

		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		button.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});

	it('binds each button once, so a re-run does not double-share', async () => {
		const button = page();
		const share = vi.fn(async () => undefined);
		vi.stubGlobal('navigator', { share });

		initShareButtons();
		initShareButtons();
		click(button);
		await flush();

		expect(share).toHaveBeenCalledTimes(1);
	});

	it('picks up buttons injected after the first run', async () => {
		page();
		const share = vi.fn(async () => undefined);
		vi.stubGlobal('navigator', { share });
		initShareButtons();

		document.body.insertAdjacentHTML(
			'beforeend',
			'<button class="share-btn" data-title="New" data-slug="new-one"><i></i></button>'
		);
		initShareButtons();
		click(document.querySelectorAll('.share-btn')[1]);
		await flush();

		expect(share).toHaveBeenCalledWith(
			expect.objectContaining({
				url: `${window.location.origin}/template/new-one`,
			})
		);
	});
});
