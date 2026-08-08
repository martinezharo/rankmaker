import { test, expect } from '@playwright/test';

// The Font Awesome stylesheet is loaded off the critical path: it ships as
// `rel="preload"` and is promoted to `rel="stylesheet"` once it arrives.
// ClientRouter swaps the entire <head> on every client navigation, so the
// promoted element has to survive that swap — otherwise the router re-inserts
// a bare preload link and every icon on the site stays unstyled for the rest
// of the session.

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('rankmaker_cookie_consent', 'false');
	});
	await page.addInitScript(() => {
		(window as unknown as { __swaps: number }).__swaps = 0;
		document.addEventListener('astro:after-swap', () => {
			(window as unknown as { __swaps: number }).__swaps++;
		});
	});
});

/** Is the Font Awesome CSS currently applied to the document? */
function iconsApplied(page: import('@playwright/test').Page) {
	return page.evaluate(() =>
		[...document.styleSheets].some((sheet) =>
			(sheet.href ?? '').includes('fontawesome')
		)
	);
}

test('icon stylesheet survives ClientRouter navigations', async ({ page }) => {
	// What matters here is the head swap, not which page is swapped in, so this
	// walks between the two cheapest routes in the app: /about and
	// /legal-notice render from the layout alone and never touch D1 or KV.
	await page.goto('/about');
	await expect.poll(() => iconsApplied(page)).toBe(true);

	// Navigate several times, including a repeat target, so a head swap
	// definitely runs more than once.
	let expected = 0;
	for (const href of ['/legal-notice', '/about', '/legal-notice']) {
		expected++;
		await page.click(`a[href="${href}"]`);
		await page.waitForFunction(
			(n) => (window as unknown as { __swaps: number }).__swaps >= n,
			expected
		);

		// The stylesheet must stay applied — not merely be re-applied later.
		expect(await iconsApplied(page)).toBe(true);
		await expect(page.locator('#fontawesome-preload')).toHaveAttribute(
			'rel',
			'stylesheet'
		);
	}
});
