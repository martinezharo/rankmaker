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

/** Drive an official template through the 1v1 battles until results appear. */
async function rankToResults(page: Page, slug: string): Promise<void> {
	await page.goto(`/template/${slug}`);
	await page.locator('#start-ranking-btn').click();
	await expect(page.locator('#battle-view')).toBeVisible();

	// Answer matchups until the results view appears. Each pick has a ~600ms
	// animation before the next pair shows, so wait for the card name to change.
	// Track every matchup shown: the engine must never re-ask a settled pair.
	const seenPairs = new Set<string>();
	const results = page.locator('#results-view');
	for (let i = 0; i < 300; i++) {
		if (await results.isVisible().catch(() => false)) break;
		const cardA = page.locator('#battle-card-a');
		if (!(await cardA.isVisible().catch(() => false))) break;
		const before = (await page.locator('#battle-name-a').textContent())?.trim();
		const nameB = (await page.locator('#battle-name-b').textContent())?.trim();
		const pairKey = [before, nameB].sort().join(' ⚔ ');
		expect(seenPairs.has(pairKey), `repeated battle: ${pairKey}`).toBe(false);
		seenPairs.add(pairKey);
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
}

/** Pointer-drag the drag handle of one row over the top edge of another row. */
async function dragRow(page: Page, fromIndex: number, toIndex: number) {
	const rows = page.locator('#results-list .rank-item');
	// mouse.* is low-level and does not auto-scroll; bring the rows into the
	// viewport (the tall podium can push the list below the fold) before dragging.
	await rows.nth(fromIndex).scrollIntoViewIfNeeded();
	const handle = rows.nth(fromIndex).locator('.rank-drag-handle');
	const hb = await handle.boundingBox();
	const tb = await rows.nth(toIndex).boundingBox();
	if (!hb || !tb) throw new Error('row not found for drag');
	const hx = hb.x + hb.width / 2;
	const hy = hb.y + hb.height / 2;
	const tx = tb.x + tb.width / 2;
	const ty = tb.y + 6; // just inside the top edge of the target row

	await page.mouse.move(hx, hy);
	await page.mouse.down();
	// Cross the drag threshold, then travel over the target in small steps so
	// SortableJS's fallback drag picks up the move via elementFromPoint.
	await page.mouse.move(hx, hy - 6, { steps: 5 });
	await page.waitForTimeout(50);
	await page.mouse.move(tx, ty, { steps: 20 });
	await page.waitForTimeout(50);
	await page.mouse.move(tx, ty, { steps: 5 });
	await page.mouse.up();
	await page.waitForTimeout(100);
}

test('ranks an official template from start to results, then downloads image', async ({
	page,
}) => {
	test.setTimeout(90_000);
	await rankToResults(page, A.slug);

	await expect(page.locator('#results-podium')).not.toBeEmpty();
	await expect(page.locator('#results-list')).not.toBeEmpty();

	// Every option must end up ranked exactly once — none dropped or duplicated.
	const optionCount = (await readRankingData(page)).options.length;
	await expect(page.locator('#results-list .rank-item')).toHaveCount(optionCount);

	// The share-image module renders a canvas and triggers a PNG download.
	// Smoke-test that it runs end to end without throwing.
	const downloadPromise = page.waitForEvent('download');
	await page.locator('#action-download-image').click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toMatch(/_ranking\.png$/);
});

test('manual reorder moves a row up and re-renders the podium', async ({ page }) => {
	test.setTimeout(90_000);
	await rankToResults(page, A.slug);

	const rows = page.locator('#results-list .rank-item');
	const namesBefore = await rows.locator('p').allInnerTexts();

	// Drag the 4th item (not on the podium) to the top.
	const draggedName = namesBefore[3];
	await page.locator('#action-reorder').click(); // enter reorder mode
	await expect(rows.nth(3).locator('.rank-drag-handle')).toBeVisible();
	await dragRow(page, 3, 0);

	// Order changed, the dragged item is now within the top 3, and the podium
	// (which only shows the top 3) was re-rendered to include it.
	await expect
		.poll(async () => await rows.locator('p').allInnerTexts())
		.not.toEqual(namesBefore);
	const namesAfter = await rows.locator('p').allInnerTexts();
	expect(namesAfter.indexOf(draggedName)).toBeLessThan(3);
	await expect(page.locator('#results-podium')).toContainText(draggedName);
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
