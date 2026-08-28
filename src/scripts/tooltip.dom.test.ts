// @vitest-environment happy-dom
/**
 * The app's single delegated tooltip controller.
 *
 * Its accessibility rules are the point: it must not describe a control with
 * text a screen reader already reads out, it must open on keyboard focus with
 * no delay, and it must never open on a touch device, where a bubble would
 * fight the control it describes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '../test/dom';
import { hideTooltip, initTooltips } from './tooltip';

/**
 * The controller binds document-level listeners exactly once per page, and
 * `document` outlives a test — so it is initialised once here rather than
 * re-imported per test, which would leave one live listener set per test and
 * have them all fire at each other.
 */
function loadModule() {
	initTooltips();
	return { initTooltips };
}

function page() {
	mount(`
		<button id="undo" data-rm-tip="Undo your last pick">Undo</button>
		<button id="bottom" data-rm-tip="Save it" data-rm-tip-placement="bottom">S</button>
		<button id="same" data-rm-tip="Save" aria-label="Save">S</button>
		<button id="described" data-rm-tip="A tip" aria-describedby="elsewhere">D</button>
		<button id="empty" data-rm-tip="   ">E</button>
		<span id="wrapper" data-rm-tip="Wrapped"><i id="inner"></i></span>
		<button id="plain">No tip</button>
	`);
	return {
		undo: document.getElementById('undo')!,
		bottom: document.getElementById('bottom')!,
		same: document.getElementById('same')!,
		described: document.getElementById('described')!,
		empty: document.getElementById('empty')!,
		inner: document.getElementById('inner')!,
		plain: document.getElementById('plain')!,
	};
}

const bubble = () => document.getElementById('rm-tooltip');
const label = () => bubble()?.querySelector('.rm-tooltip-label')?.textContent;

/** A mouse pointer entering a control, as the delegated listener sees it. */
const hover = (element: Element) =>
	element.dispatchEvent(
		new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true })
	);
const unhover = (element: Element) =>
	element.dispatchEvent(
		new PointerEvent('pointerleave', { pointerType: 'mouse', bubbles: true })
	);

let coarse = false;

beforeEach(() => {
	coarse = false;
	vi.useFakeTimers();
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query.includes('coarse') ? coarse : false,
	}));
	vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
		fn(0);
		return 0;
	});
	Element.prototype.getBoundingClientRect = vi.fn(
		() => ({ top: 100, bottom: 140, left: 100, right: 200, width: 100, height: 40 }) as DOMRect
	);
	// happy-dom reports zero for every measurement; `:focus-visible` is also
	// unsupported, so treat the focused element as visibly focused.
	const matches = Element.prototype.matches;
	vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
		this: Element,
		selector: string
	) {
		if (selector === ':focus-visible') return this === document.activeElement;
		return matches.call(this, selector);
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	hideTooltip();
	document.querySelectorAll('#rm-tooltip').forEach((node) => node.remove());
});

describe('hovering', () => {
	it('opens after the dwell delay, not immediately', async () => {
		const parts = page();
		loadModule();

		hover(parts.undo);
		expect(bubble()?.hidden ?? true).toBe(true);

		vi.advanceTimersByTime(350);
		expect(bubble()!.hidden).toBe(false);
		expect(label()).toBe('Undo your last pick');
	});

	it('closes when the pointer leaves', async () => {
		const parts = page();
		loadModule();
		hover(parts.undo);
		vi.advanceTimersByTime(350);

		unhover(parts.undo);
		expect(bubble()!.hidden).toBe(true);
	});

	it('never opens for a pointer that is not a mouse', async () => {
		const parts = page();
		loadModule();

		parts.undo.dispatchEvent(
			new PointerEvent('pointerenter', { pointerType: 'touch', bubbles: true })
		);
		vi.advanceTimersByTime(500);
		expect(bubble()).toBeNull();
	});

	it('never opens on a touch device', async () => {
		const parts = page();
		coarse = true;
		loadModule();

		hover(parts.undo);
		vi.advanceTimersByTime(500);
		expect(bubble()).toBeNull();
	});

	it('opens from a child of the control carrying the tip', async () => {
		const parts = page();
		loadModule();

		hover(parts.inner);
		vi.advanceTimersByTime(350);
		expect(label()).toBe('Wrapped');
	});

	it('ignores a control with no tip', async () => {
		const parts = page();
		loadModule();

		hover(parts.plain);
		vi.advanceTimersByTime(500);
		expect(bubble()).toBeNull();
	});

	it('ignores a blank tip', async () => {
		const parts = page();
		loadModule();

		hover(parts.empty);
		vi.advanceTimersByTime(500);
		expect(bubble()?.hidden ?? true).toBe(true);
	});

	it('swaps to another control without leaving the first bubble up', async () => {
		const parts = page();
		loadModule();
		hover(parts.undo);
		vi.advanceTimersByTime(350);

		hover(parts.bottom);
		vi.advanceTimersByTime(350);
		expect(label()).toBe('Save it');
	});
});

describe('the keyboard', () => {
	it('opens immediately on focus — no dwell for a keyboard user', async () => {
		const parts = page();
		loadModule();

		parts.undo.focus();
		parts.undo.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		vi.advanceTimersByTime(0);

		expect(bubble()!.hidden).toBe(false);
	});

	it('closes on blur', async () => {
		const parts = page();
		loadModule();
		parts.undo.focus();
		parts.undo.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		vi.advanceTimersByTime(0);

		parts.undo.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
		expect(bubble()!.hidden).toBe(true);
	});

	it('closes on Escape', async () => {
		const parts = page();
		loadModule();
		hover(parts.undo);
		vi.advanceTimersByTime(350);

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(bubble()!.hidden).toBe(true);
	});
});

describe('what a screen reader hears', () => {
	it('describes the control when the tip adds something', async () => {
		const parts = page();
		loadModule();

		hover(parts.undo);
		vi.advanceTimersByTime(350);

		expect(parts.undo).toHaveAttribute('aria-describedby', 'rm-tooltip');
		expect(bubble()).toHaveAttribute('role', 'tooltip');
	});

	it('stays quiet when the tip only repeats the control’s own name', async () => {
		const parts = page();
		loadModule();

		hover(parts.same);
		vi.advanceTimersByTime(350);

		expect(parts.same).not.toHaveAttribute('aria-describedby');
	});

	it('does not overwrite a description the markup already set', async () => {
		const parts = page();
		loadModule();

		hover(parts.described);
		vi.advanceTimersByTime(350);

		expect(parts.described).toHaveAttribute('aria-describedby', 'elsewhere');
	});

	it('cleans the description up on close', async () => {
		const parts = page();
		loadModule();
		hover(parts.undo);
		vi.advanceTimersByTime(350);

		unhover(parts.undo);
		expect(parts.undo).not.toHaveAttribute('aria-describedby');
	});
});

describe('dismissal', () => {
	it('closes when the control is acted on', async () => {
		const parts = page();
		loadModule();
		hover(parts.undo);
		vi.advanceTimersByTime(350);

		document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		expect(bubble()!.hidden).toBe(true);
	});

	it('closes on scroll and on resize, which move the anchor', async () => {
		const parts = page();
		loadModule();

		for (const fire of [
			() => window.dispatchEvent(new Event('scroll')),
			() => window.dispatchEvent(new Event('resize')),
		]) {
			hover(parts.undo);
			vi.advanceTimersByTime(350);
			expect(bubble()!.hidden).toBe(false);
			fire();
			expect(bubble()!.hidden).toBe(true);
		}
	});

	it('closes on a client-side navigation', async () => {
		const parts = page();
		loadModule();
		hover(parts.undo);
		vi.advanceTimersByTime(350);

		document.dispatchEvent(new CustomEvent('astro:before-swap'));
		expect(bubble()!.hidden).toBe(true);
	});

	it('cancels a pending open when the pointer leaves first', async () => {
		const parts = page();
		loadModule();

		hover(parts.undo);
		vi.advanceTimersByTime(100);
		unhover(parts.undo);
		vi.advanceTimersByTime(500);

		expect(bubble()?.hidden ?? true).toBe(true);
	});
});

describe('initTooltips', () => {
	it('binds once, however many navigations call it', async () => {
		const parts = page();
		loadModule();
		const addEventListener = vi.spyOn(document, 'addEventListener');

		initTooltips();
		initTooltips();

		expect(addEventListener).not.toHaveBeenCalled();
		hover(parts.undo);
		vi.advanceTimersByTime(350);
		expect(bubble()!.hidden).toBe(false);
	});

	it('reuses one bubble for the whole app', async () => {
		const parts = page();
		loadModule();

		hover(parts.undo);
		vi.advanceTimersByTime(350);
		unhover(parts.undo);
		hover(parts.bottom);
		vi.advanceTimersByTime(350);

		expect(document.querySelectorAll('#rm-tooltip')).toHaveLength(1);
	});
});
