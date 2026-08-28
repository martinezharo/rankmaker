// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeModal, openModal } from './modal-a11y';
import { mount } from '../test/dom';

/**
 * happy-dom reports `offsetParent` as null for everything, which the focus
 * trap uses to skip hidden controls. Report a parent so visible buttons count.
 */
function makeVisible() {
	Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
		configurable: true,
		get() {
			return this.closest('.hidden') ? null : document.body;
		},
	});
}

function shell() {
	mount(`
		<button id="opener">Open</button>
		<div id="modal" class="hidden">
			<button id="first">Cancel</button>
			<button id="middle">Something</button>
			<button id="last">Confirm</button>
		</div>
		<div id="other-modal" class="hidden">
			<button id="other-first">Close</button>
		</div>
	`);
	return {
		opener: document.getElementById('opener') as HTMLButtonElement,
		modal: document.getElementById('modal')!,
		first: document.getElementById('first') as HTMLButtonElement,
		middle: document.getElementById('middle') as HTMLButtonElement,
		last: document.getElementById('last') as HTMLButtonElement,
		otherModal: document.getElementById('other-modal')!,
	};
}

const tab = (shiftKey = false) =>
	document.dispatchEvent(
		new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
	);

const escape = () =>
	document.dispatchEvent(
		new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
	);

beforeEach(() => {
	makeVisible();
	// openModal defers the focus move to the next frame.
	vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
		fn(0);
		return 0;
	});
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('openModal', () => {
	it('reveals the dialog and marks it up as one', () => {
		const { modal } = shell();
		openModal(modal);
		expect(modal.classList.contains('hidden')).toBe(false);
		expect(modal).toHaveAttribute('role', 'dialog');
		expect(modal).toHaveAttribute('aria-modal', 'true');
	});

	it('moves focus into the dialog, to the control the caller named', () => {
		const { modal, last } = shell();
		openModal(modal, { focus: last });
		expect(document.activeElement).toBe(last);
	});

	it('falls back to the first focusable control', () => {
		const { modal, first } = shell();
		openModal(modal);
		expect(document.activeElement).toBe(first);
	});

	it('stops the page behind it from scrolling', () => {
		const { modal } = shell();
		openModal(modal);
		expect(document.body.style.overflow).toBe('hidden');
		expect(document.documentElement.style.overflow).toBe('hidden');
	});

	it('closes any dialog that was already open', () => {
		const { modal, otherModal } = shell();
		openModal(modal);
		openModal(otherModal);
		expect(modal.classList.contains('hidden')).toBe(true);
		expect(otherModal.classList.contains('hidden')).toBe(false);
	});
});

describe('the focus trap', () => {
	it('wraps forward from the last control to the first', () => {
		const { modal, first, last } = shell();
		openModal(modal, { focus: last });
		tab();
		expect(document.activeElement).toBe(first);
	});

	it('wraps backward from the first control to the last', () => {
		const { modal, first, last } = shell();
		openModal(modal, { focus: first });
		tab(true);
		expect(document.activeElement).toBe(last);
	});

	it('leaves a tab in the middle of the dialog alone', () => {
		const { modal, middle } = shell();
		openModal(modal, { focus: middle });
		tab();
		expect(document.activeElement).toBe(middle);
	});

	it('pulls focus back when it escapes the dialog', () => {
		const { modal, opener, first } = shell();
		openModal(modal);
		opener.focus();
		tab();
		expect(document.activeElement).toBe(first);
	});

	it('holds focus still in a dialog with nothing to focus', () => {
		mount('<div id="empty" class="hidden"><p>Nothing here</p></div>');
		const empty = document.getElementById('empty')!;
		openModal(empty);
		const event = new KeyboardEvent('keydown', {
			key: 'Tab',
			bubbles: true,
			cancelable: true,
		});
		document.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});
});

describe('closing', () => {
	it('closes on Escape', () => {
		const { modal } = shell();
		openModal(modal);
		escape();
		expect(modal.classList.contains('hidden')).toBe(true);
	});

	it('restores focus to whatever opened it', () => {
		const { modal, opener } = shell();
		opener.focus();
		openModal(modal);
		closeModal(modal);
		expect(document.activeElement).toBe(opener);
	});

	it('lets the page scroll again', () => {
		const { modal } = shell();
		document.body.style.overflow = 'auto';
		openModal(modal);
		closeModal(modal);
		expect(document.body.style.overflow).toBe('auto');
	});

	it('runs the caller’s onClose, whichever way it was closed', () => {
		const { modal } = shell();
		const onClose = vi.fn();

		openModal(modal, { onClose });
		closeModal(modal);
		expect(onClose).toHaveBeenCalledTimes(1);

		openModal(modal, { onClose });
		escape();
		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it('stops trapping keys once closed', () => {
		const { modal, opener } = shell();
		openModal(modal);
		closeModal(modal);

		opener.focus();
		tab();
		expect(document.activeElement).toBe(opener);
	});

	it('is harmless on a dialog that is not the open one', () => {
		const { modal, otherModal } = shell();
		openModal(modal);
		closeModal(otherModal);
		expect(modal.classList.contains('hidden')).toBe(false);
		expect(document.body.style.overflow).toBe('hidden');
		closeModal(modal);
	});
});
