/**
 * Manual drag-to-reorder for the results list, backed by SortableJS.
 *
 * SortableJS replaces a hand-rolled pointer-event engine: it brings auto-scroll
 * on long lists (templates can have up to 50 options), cross-browser/touch
 * robustness, and drop animation for free. The caller owns the app-specific glue:
 *   - `onChange` fires live whenever the order shifts mid-drag (renumber rows so
 *     positions update in real time), and
 *   - `onEnd` fires on drop (rebuild the ranking model + re-render the podium).
 *
 * Starts disabled; the page's "Reorder" toggle flips it on and off.
 */
import Sortable from 'sortablejs';

export type ReorderController = {
	/** Enable or disable dragging (mirrors the page's reorder-mode toggle). */
	setEnabled: (enabled: boolean) => void;
	/** Tear down listeners (not strictly needed — the DOM is swapped on nav). */
	destroy: () => void;
};

export type ReorderHandlers = {
	/** Drop committed; receives the final `data-item-id` order. */
	onEnd: (orderedIds: string[]) => void;
	/** Order shifted mid-drag; renumber from the live DOM. */
	onChange?: () => void;
};

export function createReorder(
	listEl: HTMLElement,
	handlers: ReorderHandlers
): ReorderController {
	const sortable = Sortable.create(listEl, {
		handle: '.rank-drag-handle',
		draggable: '.rank-item',
		disabled: true,
		// Live reflow of the list as you drag; eased to feel smooth, not snappy.
		animation: 160,
		easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
		// Use Sortable's own fallback drag rather than native HTML5 DnD: it works
		// uniformly with touch and mouse input (and is what enables auto-scroll).
		forceFallback: true,
		// Drive the fallback with mouse/touch events, not Pointer Events. The
		// pointer path uses setPointerCapture, which both the old hand-rolled
		// engine and synthetic test input handled unreliably.
		// @ts-expect-error `supportPointer` is a real SortableJS option, missing from @types/sortablejs.
		supportPointer: false,
		// Append the floating clone to <body> so it follows the cursor at full
		// size instead of being clipped inside the results container.
		fallbackOnBody: true,
		fallbackTolerance: 4,
		// Auto-scroll the page when dragging near the edges (lists go up to 50).
		scroll: true,
		scrollSensitivity: 90,
		scrollSpeed: 14,
		ghostClass: 'rank-ghost', // faint drop-position placeholder left in the list
		chosenClass: 'rank-chosen',
		dragClass: 'rank-drag', // the clone that follows the cursor
		onChange: () => handlers.onChange?.(),
		onEnd: () => {
			const orderedIds = Array.from(
				listEl.querySelectorAll<HTMLElement>('.rank-item')
			).map((el) => el.dataset.itemId ?? '');
			handlers.onEnd(orderedIds);
		},
	});

	return {
		setEnabled: (enabled) => sortable.option('disabled', !enabled),
		destroy: () => sortable.destroy(),
	};
}
