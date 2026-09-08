/**
 * The sign-in dialog, which is now multi-provider.
 *
 * The buttons are rendered from the provider registry (src/lib/oauth-providers.ts),
 * so what a visitor is offered depends on which credentials the deploy has.
 * A checkout with none configured — CI, a fresh clone — falls back to the full
 * list, which is what makes this suite deterministic without secrets.
 *
 * The OAuth hop itself stops at our own /api/auth/login: the assertion is that
 * it hands the browser to the right provider, not that the provider answers.
 */
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('rankmaker_cookie_consent', 'false');
	});
});

test('offers every provider, with the primary one focused', async ({ page }) => {
	await page.goto('/');
	await page.locator('[data-auth-slot="desktop"] .auth-login-link').click();

	const buttons = page.locator('#login-modal a[data-login-provider]');
	await expect(buttons.first()).toBeVisible();
	expect(
		await buttons.evaluateAll((links) =>
			links.map((link) => (link as HTMLElement).dataset.loginProvider)
		)
	).toEqual(['google', 'github']);
	// The primary one takes focus, so the dialog is one Enter away.
	await expect(buttons.first()).toBeFocused();

	// Full navigation, not a ClientRouter fetch: the provider is cross-origin.
	for (const link of await buttons.all()) {
		await expect(link).toHaveAttribute('data-astro-reload', '');
	}
});

test('sends the visitor back to the page they signed in from', async ({ page }) => {
	await page.goto('/search?q=pizza');
	await page.locator('[data-auth-slot="desktop"] .auth-login-link').click();

	const buttons = page.locator('#login-modal a[data-login-provider]');
	await expect(buttons.first()).toHaveAttribute(
		'href',
		'/api/auth/login?next=%2Fsearch%3Fq%3Dpizza&provider=google'
	);
});

test('hands the browser to the provider it was asked for', async ({ request }) => {
	const authorizeUrls = {
		google: 'https://accounts.google.com/o/oauth2/v2/auth',
		github: 'https://github.com/login/oauth/authorize',
	};
	for (const [provider, authorize] of Object.entries(authorizeUrls)) {
		const response = await request.get(`/api/auth/login?provider=${provider}`, {
			maxRedirects: 0,
		});
		expect(response.status()).toBe(302);
		expect(response.headers()['location']).toContain(authorize);
	}
});
