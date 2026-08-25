/**
 * The one bit of <Select> that is safe to import anywhere.
 *
 * `select.ts` enhances the control and registers document-level listeners at
 * import time, so it can only ever run in the browser. Setting a select's value
 * from code needs none of that — and its callers include components that are
 * also rendered on the server — so it lives here, free of side effects.
 */

/** Event the enhanced UI listens to in order to repaint after a code change. */
export const SELECT_SYNC_EVENT = 'rm:select-sync';

/**
 * Set a select's value from code and repaint the custom trigger.
 *
 * A bare `select.value = …` updates the hidden native element only, and the
 * enhanced UI has nothing to react to — use this instead. Like the native
 * behaviour, it does NOT fire `change`.
 */
export function setSelectValue(select: HTMLSelectElement, value: string): void {
	select.value = value;
	select.dispatchEvent(new CustomEvent(SELECT_SYNC_EVENT));
}
