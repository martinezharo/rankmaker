// @vitest-environment happy-dom
/**
 * The custom <Select>. Its contract with the rest of the app is that the
 * hidden native <select> stays the source of truth — `select.value` and the
 * `change` event keep working — so that is what these assert on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, mount } from '../test/dom';

async function loadModule() {
	vi.resetModules();
	return import('./select');
}

function control({ withSearch = false } = {}) {
	mount(`
		<div data-rm-select>
			<select class="rm-select-native">
				<option value="">All</option>
				<option value="Movies">Movies</option>
				<option value="Games">Games</option>
			</select>
			<button class="rm-select-trigger" data-placeholder="Pick one"
				data-placeholder-icon="fa-list" aria-expanded="false">
				<i class="rm-select-icon"></i>
				<span class="rm-select-text"></span>
			</button>
			<div class="rm-select-popover" hidden>
				${withSearch ? '<input class="rm-select-search-input" />' : ''}
				<div class="rm-select-list">
					<div class="rm-select-option" id="opt-all" data-value="" data-label="All"></div>
					<div class="rm-select-option" id="opt-movies" data-value="Movies"
						data-label="Movies" data-icon="fa-film"></div>
					<div class="rm-select-option" id="opt-games" data-value="Games"
						data-label="Games" data-hint="video games"></div>
					<div class="rm-select-option" id="opt-off" data-value="Off"
						data-label="Off" aria-disabled="true"></div>
				</div>
				<p class="rm-select-empty" hidden>Nothing found</p>
			</div>
		</div>
	`);
	return {
		root: document.querySelector<HTMLElement>('[data-rm-select]')!,
		native: document.querySelector<HTMLSelectElement>('.rm-select-native')!,
		trigger: document.querySelector<HTMLButtonElement>('.rm-select-trigger')!,
		popover: document.querySelector<HTMLElement>('.rm-select-popover')!,
		text: document.querySelector<HTMLElement>('.rm-select-text')!,
		icon: document.querySelector<HTMLElement>('.rm-select-icon')!,
		empty: document.querySelector<HTMLElement>('.rm-select-empty')!,
		search: document.querySelector<HTMLInputElement>('.rm-select-search-input'),
		option: (id: string) => document.getElementById(id)!,
	};
}

beforeEach(() => {
	Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
	Element.prototype.getBoundingClientRect = vi.fn(
		() => ({ top: 100, bottom: 140, height: 40 }) as DOMRect
	);
	Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('initSelects', () => {
	it('shows the matching option’s label, including the "all" one', async () => {
		const parts = control();
		const { initSelects } = await loadModule();
		initSelects();

		expect(parts.text.textContent).toBe('All');
		expect(parts.text.className).not.toContain('rm-select-text-placeholder');
	});

	it('falls back to the placeholder when no option matches the value', async () => {
		const parts = control();
		// A control whose list does not offer the current value — e.g. a draft
		// restored after the option was removed.
		parts.option('opt-all').remove();
		const { initSelects } = await loadModule();
		initSelects();

		expect(parts.text.textContent).toBe('Pick one');
		expect(parts.text.className).toContain('rm-select-text-placeholder');
		expect(parts.icon.className).toContain('fa-list');
	});

	it('shows the current value on first paint', async () => {
		const parts = control();
		parts.native.value = 'Movies';
		const { initSelects } = await loadModule();
		initSelects();

		expect(parts.text.textContent).toBe('Movies');
		expect(parts.icon.className).toContain('fa-film');
		expect(parts.option('opt-movies')).toHaveAttribute('aria-selected', 'true');
	});

	it('writes a choice back to the native select and fires change', async () => {
		const parts = control();
		const { initSelects } = await loadModule();
		initSelects();
		const onChange = vi.fn();
		const onInput = vi.fn();
		parts.native.addEventListener('change', onChange);
		parts.native.addEventListener('input', onInput);

		click(parts.trigger);
		click(parts.option('opt-games'));

		expect(parts.native.value).toBe('Games');
		expect(parts.text.textContent).toBe('Games');
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onInput).toHaveBeenCalledTimes(1);
	});

	it('closes and returns focus after a choice', async () => {
		const parts = control();
		const { initSelects } = await loadModule();
		initSelects();

		click(parts.trigger);
		click(parts.option('opt-games'));

		expect(parts.popover.hidden).toBe(true);
		expect(document.activeElement).toBe(parts.trigger);
	});

	it('does not fire change when the same value is chosen again', async () => {
		const parts = control();
		parts.native.value = 'Movies';
		const { initSelects } = await loadModule();
		initSelects();
		const onChange = vi.fn();
		parts.native.addEventListener('change', onChange);

		click(parts.trigger);
		click(parts.option('opt-movies'));

		expect(onChange).not.toHaveBeenCalled();
	});

	it('ignores a disabled option', async () => {
		const parts = control();
		const { initSelects } = await loadModule();
		initSelects();

		click(parts.trigger);
		click(parts.option('opt-off'));

		expect(parts.native.value).toBe('');
		expect(parts.popover.hidden).toBe(false);
	});

	it('repaints when other code changes the value', async () => {
		const parts = control();
		const { initSelects, setSelectValue } = await loadModule();
		initSelects();

		setSelectValue(parts.native, 'Games');
		expect(parts.text.textContent).toBe('Games');

		parts.native.value = 'Movies';
		parts.native.dispatchEvent(new Event('change'));
		expect(parts.text.textContent).toBe('Movies');
	});

	it('filters the list as the user types, matching label and hint', async () => {
		const parts = control({ withSearch: true });
		const { initSelects } = await loadModule();
		initSelects();
		click(parts.trigger);

		parts.search!.value = 'video';
		parts.search!.dispatchEvent(new Event('input'));

		expect(parts.option('opt-games').hidden).toBe(false);
		expect(parts.option('opt-movies').hidden).toBe(true);
		expect(parts.empty.hidden).toBe(true);
	});

	it('says so when the filter matches nothing', async () => {
		const parts = control({ withSearch: true });
		const { initSelects } = await loadModule();
		initSelects();
		click(parts.trigger);

		parts.search!.value = 'nothing like this';
		parts.search!.dispatchEvent(new Event('input'));

		expect(parts.empty.hidden).toBe(false);
	});

	it('clears the filter each time it opens', async () => {
		const parts = control({ withSearch: true });
		const { initSelects } = await loadModule();
		initSelects();

		click(parts.trigger);
		parts.search!.value = 'movies';
		parts.search!.dispatchEvent(new Event('input'));
		click(parts.trigger);
		click(parts.trigger);

		expect(parts.search!.value).toBe('');
		expect(parts.option('opt-games').hidden).toBe(false);
	});

	it('points assistive tech at the highlighted option', async () => {
		const parts = control();
		const { initSelects } = await loadModule();
		initSelects();

		click(parts.trigger);
		expect(parts.trigger.getAttribute('aria-activedescendant')).toBe('opt-all');

		parts.root.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
		);
		expect(parts.trigger.getAttribute('aria-activedescendant')).toBe(
			'opt-movies'
		);
	});

	it('highlights the option under the pointer', async () => {
		const parts = control();
		const { initSelects } = await loadModule();
		initSelects();
		click(parts.trigger);

		parts.option('opt-games').dispatchEvent(
			new MouseEvent('pointermove', { bubbles: true })
		);
		expect(parts.option('opt-games').className).toContain('is-active');
	});

	it('dismisses the mobile sheet from its backdrop', async () => {
		const parts = control();
		const { initSelects } = await loadModule();
		initSelects();
		click(parts.trigger);

		parts.popover.dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true })
		);
		expect(parts.popover.hidden).toBe(true);
	});

	it('enhances each control once, however often it runs', async () => {
		const parts = control();
		const { initSelects } = await loadModule();
		initSelects();
		initSelects();
		const onChange = vi.fn();
		parts.native.addEventListener('change', onChange);

		click(parts.trigger);
		click(parts.option('opt-games'));

		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it('leaves incomplete markup alone rather than half-enhancing it', async () => {
		mount('<div data-rm-select><button class="rm-select-trigger"></button></div>');
		const { initSelects } = await loadModule();
		expect(() => initSelects()).not.toThrow();
		expect(
			document.querySelector('[data-rm-select]')!.getAttribute('data-rm-select-bound')
		).toBeNull();
	});

	it('only enhances inside the root it was given', async () => {
		control();
		const { initSelects } = await loadModule();
		const other = document.createElement('div');
		initSelects(other);
		expect(
			document.querySelector<HTMLElement>('.rm-select-text')!.textContent
		).toBe('');
	});
});
