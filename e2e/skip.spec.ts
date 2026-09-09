import { test, expect, type Page } from '@playwright/test';

const A = { slug: 'best-social-networks-ranking' };

async function optionCount(page: Page): Promise<number> {
	const raw = await page.locator('#ranking-data').textContent();
	return JSON.parse(raw ?? '{}').options.length;
}

// Wait until the battle pair changes or results appear.
async function waitNext(page: Page, prevA: string | undefined) {
	await page
		.waitForFunction(
			(prev) => {
				if (document.getElementById('results-view')?.checkVisibility()) return true;
				const now = document.getElementById('battle-name-a')?.textContent?.trim();
				return now !== prev;
			},
			prevA,
			{ timeout: 6_000 }
		)
		.catch(() => {});
}

test('skip defers duels into a forced final round, then ranks everything', async ({
	page,
}) => {
	test.setTimeout(90_000);
	await page.goto(`/template/${A.slug}`);
	await page.locator('#start-ranking-btn').click();
	await expect(page.locator('#battle-view')).toBeVisible();

	const battleView = page.locator('#battle-view');
	const results = page.locator('#results-view');
	let sawFinalRound = false;
	let skipsDone = 0;

	for (let i = 0; i < 400; i++) {
		if (await results.isVisible().catch(() => false)) break;
		const cardA = page.locator('#battle-card-a');
		if (!(await cardA.isVisible().catch(() => false))) break;

		const before = (await page.locator('#battle-name-a').textContent())?.trim();
		const inFinal = await battleView.evaluate((el) =>
			el.classList.contains('final-round')
		);
		if (inFinal) sawFinalRound = true;

		// Skip the first 2 duels (only while skipping is allowed), then always pick A.
		const skipBtn = page.locator('#battle-skip-btn');
		const canSkip = await skipBtn.isVisible().catch(() => false);
		if (skipsDone < 2 && canSkip && !inFinal) {
			await skipBtn.click();
			skipsDone++;
		} else {
			await cardA.click();
		}
		await waitNext(page, before);
	}

	await expect(results).toBeVisible();
	// We skipped, so the forced final round (red UI, skip hidden) must have run.
	expect(skipsDone, 'should have skipped 2 duels').toBe(2);
	expect(sawFinalRound, 'final round should have triggered').toBe(true);
	// Every option ranked exactly once — nothing dropped by the provisional pass.
	await expect(page.locator('#results-list .rank-item')).toHaveCount(
		await optionCount(page)
	);
});
