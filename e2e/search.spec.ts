import { test, expect } from '@playwright/test';

const STAR_WARS = {
	slug: 'all-star-wars-movies',
	title: '🌌All Star Wars Movies',
	cover: 'https://img.rankmaker.net/covers/Star_Wars_Logo.svg.webp',
};

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('rankmaker_cookie_consent', 'false');
	});
});

test('refreshes live counts without moving or mismatching template covers', async ({
	page,
}) => {
	let releaseCounts!: () => void;
	const countsCanResolve = new Promise<void>((resolve) => {
		releaseCounts = resolve;
	});

	await page.route('**/api/counts', async (route) => {
		await countsCanResolve;
		await route.fulfill({
			json: { counts: { [STAR_WARS.slug]: 10_000 } },
		});
	});

	await page.goto('/search');

	const cards = page.locator('main a[href^="/template/"]');
	const initialFirstHref = await cards.first().getAttribute('href');
	expect(initialFirstHref).not.toBeNull();
	const starWarsCard = page.locator(
		`main a[href="/template/${STAR_WARS.slug}"]`
	);
	await expect(
		starWarsCard.locator(`[data-count-slug="${STAR_WARS.slug}"]`)
	).not.toHaveText('0 ranked');
	await page.evaluate(() => {
		const root = document.querySelector('[data-search-results]')!;
		const describeCards = () =>
			[...root.querySelectorAll<HTMLAnchorElement>('a[href^="/template/"]')].map(
				(card) => {
					const image = card.querySelector('img[data-fallback-img]');
					return {
						href: card.getAttribute('href'),
						src: image?.getAttribute('src'),
						alt: image?.getAttribute('alt'),
						title: card.querySelector('h3')?.textContent,
					};
				}
			);
		const baseline = JSON.stringify(describeCards());
		(window as unknown as { __searchCardsChanged: boolean }).__searchCardsChanged =
			false;
		new MutationObserver(() => {
			if (JSON.stringify(describeCards()) !== baseline) {
				(
					window as unknown as { __searchCardsChanged: boolean }
				).__searchCardsChanged = true;
			}
		}).observe(root, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['href', 'src', 'alt'],
		});
	});

	releaseCounts();

	await expect(cards.first()).toHaveAttribute('href', initialFirstHref!);
	await expect(
		starWarsCard.getByRole('img', { name: STAR_WARS.title })
	).toHaveAttribute('src', STAR_WARS.cover);
	await expect(starWarsCard.getByText('10,000 ranked')).toBeVisible();
	expect(
		await page.evaluate(
			() =>
				(window as unknown as { __searchCardsChanged: boolean })
					.__searchCardsChanged
		)
	).toBe(false);

	const initialCardCount = await cards.count();
	await page.getByRole('textbox').fill('All Star Wars Movies');
	await expect.poll(() => cards.count()).toBeLessThan(initialCardCount);
	await expect(
		page
			.locator(`main a[href="/template/${STAR_WARS.slug}"]`)
			.getByRole('img', { name: STAR_WARS.title })
	).toHaveAttribute('src', STAR_WARS.cover);
});
