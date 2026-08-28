// @vitest-environment happy-dom
/**
 * The shared popover behaviour behind the custom <Select> and the language
 * switcher. Everything a keyboard or screen-reader user relies on lives here,
 * so it is tested through the DOM rather than through either consumer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, mount } from '../test/dom';

async function loadModule() {
	vi.resetModules();
	return import('./dropdown');
}

function widget(id = 'one') {
	document.body.insertAdjacentHTML(
		'beforeend',
		`<div class="root" id="root-${id}">
			<button class="trigger" id="trigger-${id}" aria-expanded="false">Open</button>
			<div class="popover" id="popover-${id}" hidden>
				<div class="item" id="${id}-a" data-label="Apple">Apple</div>
				<div class="item" id="${id}-b" data-label="Banana">Banana</div>
				<div class="item" id="${id}-c" data-label="Cherry">Cherry</div>
			</div>
		</div>`
	);
	const root = document.getElementById(`root-${id}`)!;
	return {
		root,
		trigger: document.getElementById(`trigger-${id}`) as HTMLButtonElement,
		popover: document.getElementById(`popover-${id}`)!,
		items: [...root.querySelectorAll<HTMLElement>('.item')],
	};
}

function build(id = 'one', overrides: Record<string, unknown> = {}) {
	const parts = widget(id);
	let active: HTMLElement | null = null;
	const activate = vi.fn();
	const setActive = vi.fn((item: HTMLElement | null) => {
		active = item;
	});
	return {
		...parts,
		activate,
		setActive,
		getActive: () => active,
		config: {
			root: parts.root,
			trigger: parts.trigger,
			popover: parts.popover,
			items: () => parts.items.filter((item) => !item.hidden),
			activate,
			setActive,
			getActive: () => active,
			textOf: (item: HTMLElement) => item.dataset.label ?? '',
			...overrides,
		},
	};
}

const key = (target: Element, k: string, init: KeyboardEventInit = {}) =>
	target.dispatchEvent(
		new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })
	);

beforeEach(() => {
	mount('');
	// happy-dom has no layout; the placement maths only needs numbers.
	Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
	Element.prototype.getBoundingClientRect = vi.fn(
		() => ({ top: 100, bottom: 140, left: 0, right: 0, width: 0, height: 40 }) as DOMRect
	);
	Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('createDropdown', () => {
	it('opens and closes from the trigger, telling assistive tech which it is', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, popover, root } = build();
		createDropdown(config);

		click(trigger);
		expect(popover.hidden).toBe(false);
		expect(trigger).toHaveAttribute('aria-expanded', 'true');
		expect(root.className).toContain('rm-dd-open');

		click(trigger);
		expect(popover.hidden).toBe(true);
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	it('highlights the first item on open', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, items, setActive } = build();
		createDropdown(config);

		click(trigger);
		expect(setActive).toHaveBeenLastCalledWith(items[0]);
	});

	it('moves the highlight with the arrow keys, stopping at the ends', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, root, items, setActive } = build();
		createDropdown(config);
		click(trigger);

		key(root, 'ArrowDown');
		expect(setActive).toHaveBeenLastCalledWith(items[1]);
		key(root, 'ArrowDown');
		key(root, 'ArrowDown');
		expect(setActive).toHaveBeenLastCalledWith(items[2]);

		key(root, 'ArrowUp');
		expect(setActive).toHaveBeenLastCalledWith(items[1]);
	});

	it('opens on an arrow key when closed', async () => {
		const { createDropdown } = await loadModule();
		const { config, root, popover } = build();
		createDropdown(config);

		key(root, 'ArrowDown');
		expect(popover.hidden).toBe(false);
	});

	it('jumps to the ends with Home and End', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, root, items, setActive } = build();
		createDropdown(config);
		click(trigger);

		key(root, 'End');
		expect(setActive).toHaveBeenLastCalledWith(items[2]);
		key(root, 'Home');
		expect(setActive).toHaveBeenLastCalledWith(items[0]);
	});

	it('ignores Home and End while closed', async () => {
		const { createDropdown } = await loadModule();
		const { config, root, popover } = build();
		createDropdown(config);

		key(root, 'Home');
		key(root, 'End');
		expect(popover.hidden).toBe(true);
	});

	it('commits the highlighted item on Enter', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, root, items, activate } = build();
		createDropdown(config);
		click(trigger);
		key(root, 'ArrowDown');

		key(root, 'Enter');
		expect(activate).toHaveBeenCalledWith(items[1]);
	});

	it('opens on Enter or Space when closed, rather than committing', async () => {
		const { createDropdown } = await loadModule();
		const { config, root, popover, activate } = build();
		createDropdown(config);

		key(root, 'Enter');
		expect(popover.hidden).toBe(false);
		expect(activate).not.toHaveBeenCalled();
	});

	it('leaves Space typable inside a filter input', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, popover, activate } = build();
		popover.insertAdjacentHTML('afterbegin', '<input id="filter" />');
		createDropdown(config);
		click(trigger);

		key(document.getElementById('filter')!, ' ');
		expect(activate).not.toHaveBeenCalled();
	});

	it('closes on Escape and returns focus to the trigger', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, root, popover } = build();
		createDropdown(config);
		click(trigger);

		key(root, 'Escape');
		expect(popover.hidden).toBe(true);
		expect(document.activeElement).toBe(trigger);
	});

	it('closes on Tab, so focus leaves a closed control', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, root, popover } = build();
		createDropdown(config);
		click(trigger);

		key(root, 'Tab');
		expect(popover.hidden).toBe(true);
	});

	it('closes when a pointer lands outside it', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, popover } = build();
		createDropdown(config);
		click(trigger);

		document.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
		expect(popover.hidden).toBe(true);
	});

	it('stays open for a pointer inside it', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, popover, items } = build();
		createDropdown(config);
		click(trigger);

		items[0].dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
		expect(popover.hidden).toBe(false);
	});

	it('jumps to an item by typing its first letters', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, root, items, setActive } = build();
		createDropdown(config);
		click(trigger);

		key(root, 'c');
		expect(setActive).toHaveBeenLastCalledWith(items[2]);
	});

	it('accumulates the typed letters', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, root, items, setActive } = build();
		createDropdown(config);
		click(trigger);

		key(root, 'b');
		key(root, 'a');
		expect(setActive).toHaveBeenLastCalledWith(items[1]);
	});

	it('leaves typeahead off when the caller does not want it', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, root, setActive } = build('two', {
			textOf: undefined,
		});
		createDropdown(config);
		click(trigger);
		setActive.mockClear();

		key(root, 'c');
		expect(setActive).not.toHaveBeenCalled();
	});

	it('ignores a keyboard shortcut, which belongs to the browser', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, root, setActive } = build();
		createDropdown(config);
		click(trigger);
		setActive.mockClear();

		key(root, 'c', { metaKey: true });
		key(root, 'c', { ctrlKey: true });
		expect(setActive).not.toHaveBeenCalled();
	});

	it('keeps only one dropdown open at a time', async () => {
		const { createDropdown } = await loadModule();
		const first = build('one');
		const second = build('two');
		createDropdown(first.config);
		createDropdown(second.config);

		click(first.trigger);
		click(second.trigger);

		expect(first.popover.hidden).toBe(true);
		expect(second.popover.hidden).toBe(false);
	});

	it('flips above the trigger when there is no room below', async () => {
		const { createDropdown } = await loadModule();
		Element.prototype.getBoundingClientRect = vi.fn(
			() => ({ top: 700, bottom: 740, height: 40 }) as DOMRect
		);
		const { config, trigger, root } = build();
		createDropdown(config);

		click(trigger);
		expect(root.className).toContain('rm-dd-up');
	});

	it('drops the flip when it closes', async () => {
		const { createDropdown } = await loadModule();
		Element.prototype.getBoundingClientRect = vi.fn(
			() => ({ top: 700, bottom: 740, height: 40 }) as DOMRect
		);
		const { config, trigger, root } = build();
		createDropdown(config);

		click(trigger);
		click(trigger);
		expect(root.className).not.toContain('rm-dd-up');
	});

	it('reports and drives its own state', async () => {
		const { createDropdown } = await loadModule();
		const { config, popover } = build();
		const dropdown = createDropdown(config);

		expect(dropdown.isOpen()).toBe(false);
		dropdown.open();
		expect(dropdown.isOpen()).toBe(true);
		dropdown.open(); // idempotent
		expect(popover.hidden).toBe(false);
		dropdown.close();
		dropdown.close(); // idempotent
		expect(dropdown.isOpen()).toBe(false);
	});
});

describe('closeOpenDropdown', () => {
	it('closes whatever is open', async () => {
		const { createDropdown, closeOpenDropdown } = await loadModule();
		const { config, trigger, popover } = build();
		createDropdown(config);
		click(trigger);

		closeOpenDropdown();
		expect(popover.hidden).toBe(true);
	});

	it('is harmless when nothing is open', async () => {
		const { closeOpenDropdown } = await loadModule();
		expect(() => closeOpenDropdown()).not.toThrow();
	});

	it('runs on a client-side navigation, so a popover never survives one', async () => {
		const { createDropdown } = await loadModule();
		const { config, trigger, popover } = build();
		createDropdown(config);
		click(trigger);

		document.dispatchEvent(new CustomEvent('astro:before-swap'));
		expect(popover.hidden).toBe(true);
	});
});
