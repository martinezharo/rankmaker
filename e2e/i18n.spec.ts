import { expect, test, type Page } from '@playwright/test';

const SERVER_ONLY_NAMESPACES = ['legal', 'about', 'seoContent', 'email'];

const locales = [
	{ locale: 'en', path: '/search', home: 'Home' },
	{ locale: 'es', path: '/es/search', home: 'Inicio' },
	{ locale: 'fr', path: '/fr/search', home: 'Accueil' },
	{ locale: 'zh', path: '/zh/search', home: '首页' },
	{ locale: 'ms', path: '/ms/search', home: 'Laman Utama' },
	{ locale: 'de', path: '/de/search', home: 'Startseite' },
	{ locale: 'pt', path: '/pt/search', home: 'Início' },
] as const;

async function readPayload(page: Page): Promise<Record<string, unknown>> {
	const raw = await page.locator('#i18n-data').textContent();
	return JSON.parse(raw ?? '{}') as Record<string, unknown>;
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('rankmaker_cookie_consent', 'false');
	});
});

test('ships one trimmed translation dictionary for every locale', async ({ page }) => {
	test.setTimeout(90_000);
	const pageErrors: Error[] = [];
	page.on('pageerror', (error) => pageErrors.push(error));

	for (const { locale, path, home } of locales) {
		await page.goto(path);
		await expect(page.locator('html')).toHaveAttribute('lang', locale);

		const payload = await readPayload(page);
		expect((payload.nav as { home?: string } | undefined)?.home).toBe(home);
		for (const namespace of SERVER_ONLY_NAMESPACES) {
			expect(payload[namespace]).toBeUndefined();
		}
	}

	expect(pageErrors).toEqual([]);
});

test('client-rendered search copy uses the inlined Spanish dictionary', async ({ page }) => {
	test.setTimeout(90_000);
	await page.goto('/es/search');
	await page.locator('#search-input').fill('social');

	await expect(page.locator('#results-count')).toHaveText(
		/Mostrando \d+ plantillas/
	);
	await expect(page.locator('#results-count')).not.toContainText('search.');
});
