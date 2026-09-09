import { expect, test } from '@playwright/test';

test('paginates history cards and renders full results only when expanded', async ({
	page,
}) => {
	const history = Object.fromEntries(
		Array.from({ length: 25 }, (_, index) => {
			const slug = `ranking-${index}`;
			return [
				slug,
				{
					slug,
					title: `Ranking ${index}`,
					ts: Date.UTC(2026, 0, index + 1),
					cover: `/covers/${index}.webp`,
					result: [
						{
							id: `${index}-winner`,
							name: `Winner ${index}`,
							image: `/items/${index}-winner.webp`,
						},
						{
							id: `${index}-runner-up`,
							name: `Runner-up ${index}`,
							image: `/items/${index}-runner-up.webp`,
						},
					],
				},
			];
		})
	);

	await page.addInitScript((storedHistory) => {
		localStorage.setItem('rankmaker_history', JSON.stringify(storedHistory));
	}, history);

	await page.goto('/history');

	const cards = page.locator('.history-card');
	await expect(cards).toHaveCount(20);
	await expect(page.getByRole('button', { name: 'Show more' })).toBeVisible();

	// Card summaries must stay lightweight: the ordered rows are created only
	// when the user asks to see one complete result.
	await expect(page.locator('.history-details-content li')).toHaveCount(0);
	await page.getByRole('button', { name: /Ranking 24/ }).click();
	await expect(page.getByText('Full ranking', { exact: true })).toBeVisible();
	await expect(page.getByText('Winner 24', { exact: true })).toBeVisible();
	await expect(page.getByText('Runner-up 24', { exact: true })).toBeVisible();
	await expect(page.locator('.history-details-content li')).toHaveCount(2);

	await page.getByRole('button', { name: 'Show more' }).click();
	await expect(cards).toHaveCount(25);
	await expect(page.getByRole('button', { name: 'Show more' })).toBeHidden();
});
