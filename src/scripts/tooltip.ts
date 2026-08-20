/**
 * RANKMAKER's tooltip.
 *
 * A single delegated controller drives every tooltip in the app, so there is
 * one look, one delay and one set of dismissal rules everywhere. Native
 * `title` is deliberately not used: it can't be styled, it appears after a
 * long OS-controlled delay, and it never shows on keyboard focus.
 *
 * Usage — put the text on the control itself, no wrapper component needed:
 *
 *   <button data-rm-tip="Undo your last pick">…</button>
 *   <button data-rm-tip="Save" data-rm-tip-placement="bottom">…</button>
 *
 * Because it works off an attribute and a delegated listener, markup built at
 * runtime as an HTML string (template cards, comment rows, the header auth
 * chip) gets tooltips for free — nothing to initialise per element.
 *
 * Accessibility:
 * - The bubble is `role="tooltip"` and referenced with `aria-describedby`,
 *   but only when the tip says something the control's own accessible name
 *   doesn't already say — otherwise screen readers would hear it twice.
 * - Keyboard focus opens it with no delay; Escape closes it.
 * - Coarse pointers (touch) never open it: there is no hover there, and a
 *   bubble on tap would fight the control it describes. Every tooltip is
 *   therefore an enhancement — never the only place information lives.
 */

const ATTR = 'data-rm-tip';
const PLACEMENT_ATTR = 'data-rm-tip-placement';
const TOOLTIP_ID = 'rm-tooltip';

/** Hover dwell before showing, so pointer traffic doesn't flash bubbles. */
const OPEN_DELAY_MS = 350;
/** Gap between the anchor and the bubble (leaves room for the arrow). */
const OFFSET = 10;
/** Minimum breathing room between the bubble and the viewport edge. */
const MARGIN = 8;

export type Placement = 'top' | 'bottom' | 'left' | 'right';

let bubble: HTMLElement | null = null;
let arrow: HTMLElement | null = null;
let anchor: HTMLElement | null = null;
let openTimer: number | undefined;
/** Set while the anchor was described by us, so we can clean the attribute up. */
let describedAnchor: HTMLElement | null = null;

function isCoarsePointer(): boolean {
	return window.matchMedia('(pointer: coarse)').matches;
}

function ensureBubble(): HTMLElement {
	if (bubble?.isConnected) return bubble;
	bubble = document.createElement('div');
	bubble.id = TOOLTIP_ID;
	bubble.className = 'rm-tooltip';
	bubble.setAttribute('role', 'tooltip');
	bubble.hidden = true;
	arrow = document.createElement('span');
	arrow.className = 'rm-tooltip-arrow';
	const label = document.createElement('span');
	label.className = 'rm-tooltip-label';
	bubble.append(label, arrow);
	document.body.append(bubble);
	return bubble;
}

/**
 * The name assistive tech already announces for this control. Used to decide
 * whether the tip adds anything worth describing.
 */
function accessibleName(el: HTMLElement): string {
	return (el.getAttribute('aria-label') || el.textContent || '')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

/**
 * Place the bubble against the anchor, flipping to the opposite side when the
 * preferred one doesn't fit and clamping so it never leaves the viewport. The
 * arrow is positioned separately so it keeps pointing at the anchor's centre
 * even after the bubble has been clamped.
 */
function position(el: HTMLElement, tip: HTMLElement, preferred: Placement): void {
	const a = el.getBoundingClientRect();
	const vw = document.documentElement.clientWidth;
	const vh = window.innerHeight;

	// Measure at the natural width the CSS max-width allows.
	tip.style.left = '0';
	tip.style.top = '0';
	const t = tip.getBoundingClientRect();

	const fits: Record<Placement, boolean> = {
		top: a.top - t.height - OFFSET >= MARGIN,
		bottom: a.bottom + t.height + OFFSET <= vh - MARGIN,
		left: a.left - t.width - OFFSET >= MARGIN,
		right: a.right + t.width + OFFSET <= vw - MARGIN,
	};
	const opposite: Record<Placement, Placement> = {
		top: 'bottom',
		bottom: 'top',
		left: 'right',
		right: 'left',
	};
	const placement = fits[preferred] ? preferred : fits[opposite[preferred]] ? opposite[preferred] : preferred;

	const vertical = placement === 'top' || placement === 'bottom';
	let left = vertical
		? a.left + a.width / 2 - t.width / 2
		: placement === 'left'
			? a.left - t.width - OFFSET
			: a.right + OFFSET;
	let top = vertical
		? placement === 'top'
			? a.top - t.height - OFFSET
			: a.bottom + OFFSET
		: a.top + a.height / 2 - t.height / 2;

	left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - t.width - MARGIN));
	top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - t.height - MARGIN));

	tip.dataset.placement = placement;
	tip.style.left = `${Math.round(left)}px`;
	tip.style.top = `${Math.round(top)}px`;

	if (arrow) {
		if (vertical) {
			const x = a.left + a.width / 2 - left;
			arrow.style.left = `${Math.round(Math.min(Math.max(x, 12), t.width - 12))}px`;
			arrow.style.top = '';
		} else {
			const y = a.top + a.height / 2 - top;
			arrow.style.top = `${Math.round(Math.min(Math.max(y, 12), t.height - 12))}px`;
			arrow.style.left = '';
		}
	}
}

export function hideTooltip(): void {
	window.clearTimeout(openTimer);
	openTimer = undefined;
	anchor = null;
	if (describedAnchor) {
		describedAnchor.removeAttribute('aria-describedby');
		describedAnchor = null;
	}
	if (bubble) {
		bubble.hidden = true;
		bubble.classList.remove('is-open');
	}
}

function show(el: HTMLElement): void {
	const text = el.getAttribute(ATTR)?.trim();
	if (!text) return;

	const tip = ensureBubble();
	const label = tip.querySelector('.rm-tooltip-label');
	if (label) label.textContent = text;

	anchor = el;
	tip.hidden = false;
	position(el, tip, (el.getAttribute(PLACEMENT_ATTR) as Placement) || 'top');
	// Next frame, so the entry transition runs from the placed position.
	requestAnimationFrame(() => {
		if (anchor === el) tip.classList.add('is-open');
	});

	// Describe the control only when the tip isn't just its name again.
	if (accessibleName(el) !== text.toLowerCase() && !el.hasAttribute('aria-describedby')) {
		el.setAttribute('aria-describedby', TOOLTIP_ID);
		describedAnchor = el;
	}
}

function scheduleShow(el: HTMLElement, delay: number): void {
	window.clearTimeout(openTimer);
	if (anchor && anchor !== el) hideTooltip();
	openTimer = window.setTimeout(() => show(el), delay);
}

function target(event: Event): HTMLElement | null {
	const node = event.target;
	if (!(node instanceof Element)) return null;
	return node.closest<HTMLElement>(`[${ATTR}]`);
}

/**
 * Wire the document-level listeners. Safe to call repeatedly (the ClientRouter
 * fires `astro:page-load` on every navigation); only the first call binds.
 */
export function initTooltips(): void {
	if ((window as unknown as { __rmTooltips?: boolean }).__rmTooltips) return;
	(window as unknown as { __rmTooltips?: boolean }).__rmTooltips = true;

	document.addEventListener(
		'pointerenter',
		(event) => {
			if (event.pointerType !== 'mouse' || isCoarsePointer()) return;
			const el = target(event);
			if (el && el !== anchor) scheduleShow(el, OPEN_DELAY_MS);
		},
		true
	);

	document.addEventListener(
		'pointerleave',
		(event) => {
			const el = target(event);
			if (el && el === anchor) hideTooltip();
			else if (el) window.clearTimeout(openTimer);
		},
		true
	);

	// Keyboard focus shows it immediately — a keyboard user has already
	// committed to the control and shouldn't wait out a hover delay.
	document.addEventListener(
		'focusin',
		(event) => {
			const el = target(event);
			if (el && el.matches(':focus-visible')) scheduleShow(el, 0);
		},
		true
	);
	document.addEventListener('focusout', hideTooltip, true);

	// Acting on the control answers the question the tooltip was answering.
	document.addEventListener('pointerdown', hideTooltip, true);
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') hideTooltip();
	});

	// The bubble is positioned in viewport coordinates, so anything that moves
	// the anchor invalidates it. Re-anchoring on scroll would fight momentum
	// scrolling; dismissing is both cheaper and less surprising.
	window.addEventListener('scroll', hideTooltip, true);
	window.addEventListener('resize', hideTooltip);
	document.addEventListener('astro:before-swap', hideTooltip);
}
