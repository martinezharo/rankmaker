/**
 * Shared setup for the tests that need a DOM.
 *
 * Those files opt in with a `// @vitest-environment happy-dom` docblock and
 * import from here; the import itself installs the jest-dom matchers and
 * registers Testing Library's cleanup, so no file has to repeat that.
 *
 * Two kinds of browser code live in this repo and both are covered here:
 *   - Preact islands, mounted with `render` from @testing-library/preact.
 *   - Plain DOM scripts in `src/scripts`, which attach to markup Astro
 *     rendered. `mount()` puts that markup in place for them.
 */
import '@testing-library/jest-dom/vitest';
import { act, cleanup } from '@testing-library/preact';
import { afterEach, vi } from 'vitest';
import { I18N_PAYLOAD_ID, clientDictionaryFor } from '../i18n/server';
import { serializeJsonForScript } from '../lib/safe-json';
import type { Locale } from '../i18n/config';

afterEach(cleanup);

/**
 * Replace the document body with `html` and return it, for the scripts that
 * query the page rather than being handed their nodes.
 */
export function mount(html: string): HTMLElement {
	document.body.innerHTML = html;
	return document.body;
}

afterEach(() => {
	document.body.innerHTML = '';
	document.head
		.querySelectorAll('[data-test-injected]')
		.forEach((node) => node.remove());
});

/**
 * Inline the translation dictionary exactly as Layout.astro does, and set
 * `<html lang>` the way the server would, so the code under test resolves real
 * copy instead of raw keys — through the same path the browser uses.
 *
 * Call it in a test that asserts on user-visible text; leave it out and every
 * key renders as itself, which is what an un-hydrated page would show.
 */
export function inlineDictionary(locale: Locale = 'en'): void {
	document.documentElement.lang = locale;
	document.getElementById(I18N_PAYLOAD_ID)?.remove();
	const script = document.createElement('script');
	script.type = 'application/json';
	script.id = I18N_PAYLOAD_ID;
	script.setAttribute('data-test-injected', '');
	script.textContent = serializeJsonForScript(clientDictionaryFor(locale));
	document.head.append(script);
}

/**
 * Let everything that was already scheduled settle — Preact's render queue,
 * pending effects, and resolved promises — so an assertion sees the DOM as the
 * user would.
 *
 * Under fake timers it must not wait on a real one: a `setTimeout` that only
 * fake time can reach would never fire, and the test would hang rather than
 * fail.
 */
export async function flush(): Promise<void> {
	await act(async () => {
		if (vi.isFakeTimers()) vi.advanceTimersByTime(0);
		else await new Promise((resolve) => setTimeout(resolve, 0));
		await drainMicrotasks();
	});
}

/**
 * Run fake timers forward and let Preact commit what they scheduled.
 *
 * Preact renders on a microtask, so `vi.advanceTimersByTime` alone fires the
 * callback but leaves the DOM a beat behind — every assertion after it would
 * read the previous frame. Requires `vi.useFakeTimers()`.
 */
export async function advanceTimers(ms: number): Promise<void> {
	await act(async () => {
		vi.advanceTimersByTime(ms);
		await drainMicrotasks();
	});
}

/**
 * Let a promise chain run to its end.
 *
 * The ranking session resumes its merge sort one `await` at a time, so the
 * work a single click sets off spans many promise turns — awaiting once would
 * stop somewhere in the middle of it.
 */
async function drainMicrotasks(): Promise<void> {
	for (let turn = 0; turn < 50; turn++) await Promise.resolve();
}

/** A click that scripts relying on `event.target` see as a real user click. */
export function click(node: Element | null): void {
	if (!node) throw new Error('click(): node is null');
	node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

export { act, render, screen, fireEvent, waitFor } from '@testing-library/preact';
