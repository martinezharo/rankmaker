// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '../test/dom';

/** The module keeps a "already bound" flag in module scope. */
async function loadModule() {
	vi.resetModules();
	return import('./image-fallback');
}

function card(complete = false, naturalWidth = 1) {
	mount(`
		<div class="relative">
			<img data-fallback-img src="https://img.test/a.webp" />
			<span class="smart-image-fallback hidden">Best Movies</span>
		</div>
		<div class="relative">
			<img src="https://img.test/no-hook.webp" />
			<span class="smart-image-fallback hidden">Other</span>
		</div>
	`);
	const img = document.querySelector<HTMLImageElement>('[data-fallback-img]')!;
	Object.defineProperty(img, 'complete', { value: complete, configurable: true });
	Object.defineProperty(img, 'naturalWidth', {
		value: naturalWidth,
		configurable: true,
	});
	return {
		img,
		fallback: document.querySelector<HTMLElement>('.smart-image-fallback')!,
	};
}

afterEach(() => {
	vi.resetModules();
});

describe('initImageFallbacks', () => {
	it('reveals the text placeholder when an image fails', async () => {
		const { img, fallback } = card();
		const { initImageFallbacks } = await loadModule();
		initImageFallbacks();

		img.dispatchEvent(new Event('error'));

		expect(img.style.display).toBe('none');
		expect(fallback.classList.contains('hidden')).toBe(false);
		expect(fallback.style.display).toBe('flex');
	});

	it('covers an image that failed before the script ran', async () => {
		const { img, fallback } = card(true, 0);
		const { initImageFallbacks } = await loadModule();
		initImageFallbacks();

		expect(fallback.classList.contains('hidden')).toBe(false);
		expect(img.style.display).toBe('none');
	});

	it('leaves an image that loaded fine alone', async () => {
		const { fallback } = card(true, 400);
		const { initImageFallbacks } = await loadModule();
		initImageFallbacks();
		expect(fallback.classList.contains('hidden')).toBe(true);
	});

	it('ignores an image that opted out of the fallback', async () => {
		card();
		const { initImageFallbacks } = await loadModule();
		initImageFallbacks();

		const other = document.querySelectorAll('img')[1];
		other.dispatchEvent(new Event('error'));

		expect(
			document.querySelectorAll('.smart-image-fallback')[1].classList.contains(
				'hidden'
			)
		).toBe(true);
	});

	it('covers a card appended after it ran — the listener is delegated', async () => {
		card();
		const { initImageFallbacks } = await loadModule();
		initImageFallbacks();

		document.body.insertAdjacentHTML(
			'beforeend',
			`<div class="relative">
				<img id="late" data-fallback-img src="https://img.test/late.webp" />
				<span class="smart-image-fallback hidden">Late</span>
			</div>`
		);
		document.getElementById('late')!.dispatchEvent(new Event('error'));

		expect(
			document.querySelectorAll('.smart-image-fallback')[2].classList.contains(
				'hidden'
			)
		).toBe(false);
	});

	it('registers the delegate once, however often it runs', async () => {
		card();
		const { initImageFallbacks } = await loadModule();
		const addEventListener = vi.spyOn(document, 'addEventListener');
		initImageFallbacks();
		initImageFallbacks();
		initImageFallbacks();

		expect(
			addEventListener.mock.calls.filter(([type]) => type === 'error')
		).toHaveLength(1);
		addEventListener.mockRestore();
	});
});
