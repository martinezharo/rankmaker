/**
 * The signed-in variant of Playwright's `test`.
 *
 * `signIn` seeds a user with a live session and puts its cookie on the browser
 * context, so the pages under test are reached the way a real signed-in
 * visitor reaches them. Everything a test seeds is torn down afterwards.
 */
import { test as base, expect, type BrowserContext } from '@playwright/test';
import { seedTemplate, seedUser, type SeededUser } from './d1';

export type SignIn = (
	unique: string,
	overrides?: Parameters<typeof seedUser>[1]
) => Promise<SeededUser>;

export const test = base.extend<{
	signIn: SignIn;
	seedTemplateFor: typeof seedTemplate;
}>({
	signIn: async ({ context, baseURL }, use) => {
		// The cookie banner otherwise covers the controls a test clicks.
		await context.addInitScript(() => {
			localStorage.setItem('rankmaker_cookie_consent', 'false');
		});
		await use(async (unique, overrides) => {
			const user = seedUser(unique, overrides);
			await addSessionCookie(context, user.sessionId, baseURL!);
			return user;
		});
	},
	seedTemplateFor: async ({}, use) => {
		await use(seedTemplate);
	},
});

async function addSessionCookie(
	context: BrowserContext,
	sessionId: string,
	baseURL: string
): Promise<void> {
	await context.addCookies([
		{
			name: 'rm_session',
			value: sessionId,
			url: baseURL,
			httpOnly: true,
			sameSite: 'Lax',
		},
	]);
}

export { expect };
