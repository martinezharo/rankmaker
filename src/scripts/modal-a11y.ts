/**
 * Minimal accessible-dialog helper shared by every modal in the app
 * (finish-early, battle history, AI suggestion, delete template/account).
 *
 * Modals are plain elements toggled via the `hidden` class; this wraps that
 * toggle with the keyboard/focus behaviour screen-reader and keyboard users
 * expect: Escape to close, a focus trap while open, focus moved into the
 * dialog on open and restored to the trigger on close. It also prevents the
 * document behind the dialog from scrolling. The markup should carry
 * role="dialog" aria-modal="true" (and ideally aria-labelledby) statically.
 */

let activeModal: HTMLElement | null = null;
let lastFocused: HTMLElement | null = null;
let onCloseCb: (() => void) | null = null;
let scrollLockState: { rootOverflow: string; bodyOverflow: string } | null = null;

function lockPageScroll(): void {
	if (scrollLockState) return;

	scrollLockState = {
		rootOverflow: document.documentElement.style.overflow,
		bodyOverflow: document.body.style.overflow,
	};
	document.documentElement.style.overflow = 'hidden';
	document.body.style.overflow = 'hidden';
}

function unlockPageScroll(): void {
	if (!scrollLockState) return;

	document.documentElement.style.overflow = scrollLockState.rootOverflow;
	document.body.style.overflow = scrollLockState.bodyOverflow;
	scrollLockState = null;
}

function focusable(container: HTMLElement): HTMLElement[] {
	const sel =
		'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
	return Array.from(container.querySelectorAll<HTMLElement>(sel)).filter(
		(el) => el.offsetParent !== null || el === document.activeElement
	);
}

function onKeydown(e: KeyboardEvent): void {
	if (!activeModal) return;
	if (e.key === 'Escape') {
		e.preventDefault();
		closeModal(activeModal);
		return;
	}
	if (e.key !== 'Tab') return;
	const items = focusable(activeModal);
	if (items.length === 0) {
		e.preventDefault();
		return;
	}
	const first = items[0];
	const last = items[items.length - 1];
	const current = document.activeElement;
	if (e.shiftKey && current === first) {
		e.preventDefault();
		last.focus();
	} else if (!e.shiftKey && current === last) {
		e.preventDefault();
		first.focus();
	} else if (current instanceof HTMLElement && !activeModal.contains(current)) {
		// Focus escaped the dialog (e.g. it started on the body) — pull it back.
		e.preventDefault();
		first.focus();
	}
}

/**
 * Reveal `modal` (remove the `hidden` class), trap focus inside it and move
 * focus to `opts.focus` or its first focusable element. `opts.onClose` runs
 * whenever the modal is closed (Escape, helper, etc.) — use it to keep any
 * page-side state in sync.
 */
export function openModal(
	modal: HTMLElement,
	opts: { focus?: HTMLElement | null; onClose?: () => void } = {}
): void {
	// If another modal is open, close it first (restores its focus chain).
	if (activeModal && activeModal !== modal) closeModal(activeModal);

	lastFocused =
		document.activeElement instanceof HTMLElement
			? document.activeElement
			: null;
	modal.classList.remove('hidden');
	modal.setAttribute('role', 'dialog');
	modal.setAttribute('aria-modal', 'true');
	activeModal = modal;
	onCloseCb = opts.onClose ?? null;
	lockPageScroll();
	document.addEventListener('keydown', onKeydown, true);

	const target = opts.focus ?? focusable(modal)[0] ?? modal;
	// Defer so the element is laid out (offsetParent) before focusing.
	requestAnimationFrame(() => target.focus());
}

/** Hide `modal`, drop the focus trap and restore focus to the opener. */
export function closeModal(modal: HTMLElement): void {
	modal.classList.add('hidden');
	if (activeModal === modal) {
		activeModal = null;
		document.removeEventListener('keydown', onKeydown, true);
		unlockPageScroll();
		const cb = onCloseCb;
		onCloseCb = null;
		if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
		lastFocused = null;
		cb?.();
	}
}
