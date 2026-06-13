import { test, expect, type Page } from '@playwright/test';

// Two official templates (resolved from src/data/templates.json — no D1 needed).
const A = { slug: 'best-social-networks-ranking', titleNeedle: 'Social Networks' };
const B = { slug: 'most-popular-stephen-king-books', titleNeedle: 'Stephen King' };

/** Parse the JSON the ranking engine actually reads (#ranking-data). */
async function readRankingData(
	page: Page
): Promise<{ title: string; options: { id: number; name: string }[] }> {
	const raw = await page.locator('#ranking-data').textContent();
	return JSON.parse(raw ?? '{}');
}

test('ranks an official template from start to results', async ({ page }) => {
	test.setTimeout(90_000);
	await page.goto(`/template/${A.slug}`);

	await page.locator('#start-ranking-btn').click();
	await expect(page.locator('#battle-view')).toBeVisible();

	// Answer matchups until the results view appears. Each pick has a ~600ms
	// animation before the next pair shows, so wait for the card name to change.
	const results = page.locator('#results-view');
	for (let i = 0; i < 300; i++) {
		if (await results.isVisible().catch(() => false)) break;
		const cardA = page.locator('#battle-card-a');
		if (!(await cardA.isVisible().catch(() => false))) break;
		const before = (await page.locator('#battle-name-a').textContent())?.trim();
		await cardA.click();
		await page
			.waitForFunction(
				(prev) => {
					if (document.getElementById('results-view')?.checkVisibility())
						return true;
					const now = document
						.getElementById('battle-name-a')
						?.textContent?.trim();
					return now !== prev;
				},
				before,
				{ timeout: 5_000 }
			)
			.catch(() => {});
	}

	await expect(results).toBeVisible();
	await expect(page.locator('#results-podium')).not.toBeEmpty();
	await expect(page.locator('#results-list')).not.toBeEmpty();

	// The share-image module renders a canvas and triggers a PNG download.
	// Smoke-test that it runs end to end without throwing.
	const downloadPromise = page.waitForEvent('download');
	await page.locator('#action-download-image').click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/_ranking\.png$/);
});

test('client-side navigation keeps options in sync with the template (regression)', async ({
	page,
}) => {
	// Guards the "right title/URL, wrong options" bug: after a ViewTransitions
	// navigation, the engine must read the NEW template's options, never a
	// stale copy from the previous page.
	await page.goto(`/template/${A.slug}`);
	expect((await readRankingData(page)).title).toContain(A.titleNeedle);

	// Trigger a real client-side navigation to B (same path that exhibited the
	// bug) by clicking an in-page link the ClientRouter intercepts.
	await page.evaluate((slug) => {
		const a = document.createElement('a');
		a.href = `/template/${slug}`;
		a.textContent = 'go';
		document.body.prepend(a);
		// Click the anchor directly so the event bubbles to the ClientRouter's
		// document listener (a real client-side swap), bypassing hit-testing
		// against the sticky header overlay.
		a.click();
	}, B.slug);

	await expect(page).toHaveURL(new RegExp(`/template/${B.slug}$`));
	await expect
		.poll(async () => (await readRankingData(page)).title)
		.toContain(B.titleNeedle);

	// The battle cards must show B's options, not A's.
	const optionNames = new Set((await readRankingData(page)).options.map((o) => o.name));
	await page.locator('#start-ranking-btn').click();
	await expect(page.locator('#battle-view')).toBeVisible();

	const nameA = (await page.locator('#battle-name-a').textContent())?.trim();
	const nameB = (await page.locator('#battle-name-b').textContent())?.trim();
	expect(optionNames.has(nameA ?? '')).toBe(true);
	expect(optionNames.has(nameB ?? '')).toBe(true);
});
