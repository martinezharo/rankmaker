/**
 * The signed-in flows: creating a template, saving, following and commenting.
 *
 * Everything runs against the real app and the real local D1. Only the session
 * is seeded — standing in for the GitHub OAuth round-trip, which the Worker
 * performs server-side and which a browser cannot stand in for (see
 * e2e/fixtures/d1.ts). Every authorization check the app makes runs for real.
 */
import { expect, test } from './fixtures/test';
import { queryAll, queryOne, seedUser } from './fixtures/d1';

test.describe('the header', () => {
	test('shows the signed-in account', async ({ page, signIn }) => {
		const user = await signIn('header');
		await page.goto('/');
		// The header is publicly cached HTML that reconciles itself from
		// /api/auth/me, so the chip appears after the page has painted.
		await expect(page.locator('[data-auth-slot="desktop"]')).toContainText(
			user.username,
			{ timeout: 15_000 }
		);
	});

	test('offers a sign-in to a guest', async ({ page }) => {
		await page.context().addInitScript(() => {
			localStorage.setItem('rankmaker_cookie_consent', 'false');
		});
		await page.goto('/');
		await expect(page.locator('[data-auth-slot="desktop"]')).not.toHaveAttribute(
			'data-user',
			/.+/,
			{ timeout: 15_000 }
		);
	});
});

test.describe('creating a template', () => {
	test('stores one guest template when the form submits twice before navigation', async ({
		page,
	}) => {
		await page.context().addInitScript(() => {
			localStorage.setItem('rankmaker_cookie_consent', 'false');
		});
		await page.goto('/create');

		await page.locator('#tf-title').fill('E2E Guest Double Submit');
		const names = ['One', 'Two', 'Three', 'Four'];
		const options = page.locator('#tf-options .option-name');
		for (let i = 0; i < names.length; i++) {
			if ((await options.count()) <= i) {
				await page.locator('#tf-add-option').click();
			}
			await options.nth(i).fill(names[i]);
		}

		await page.locator('#template-form').evaluate((form) => {
			form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
			form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		});
		await page.waitForURL(/\/local\//);

		const stored = await page.evaluate(() =>
			JSON.parse(localStorage.getItem('rankmaker_local_templates') ?? '[]')
		);
		expect(stored).toHaveLength(1);
		expect(stored[0].title).toBe('E2E Guest Double Submit');
	});

	test('publishes it, with its options in the order they were typed', async ({
		page,
		signIn,
	}) => {
		await signIn('creator');
		await page.goto('/create');

		await page.locator('#tf-title').fill('E2E Best Heist Movies');
		await page
			.locator('#tf-description')
			.fill('A ranking created by the end-to-end suite to prove the form works.');

		// Category is the app's custom <Select>: the id names the hidden
		// native element, and the control's parts hang off it.
		await page.locator('#tf-category-trigger').click();
		await page
			.locator('#tf-category-listbox .rm-select-option[data-value="Movies"]')
			.click();

		// A public template with no cover needs four option images, which a
		// test cannot upload — so publish it unlisted, where the text
		// placeholder is allowed.
		await page.locator('#tf-visibility-trigger').click();
		await page
			.locator('#tf-visibility-listbox .rm-select-option[data-value="unlisted"]')
			.click();

		const names = ['Heat', 'Inside Man', 'The Town', 'Ronin'];
		const options = page.locator('#tf-options .option-name');
		for (let i = 0; i < names.length; i++) {
			if ((await options.count()) <= i) {
				await page.locator('#tf-add-option').click();
			}
			await options.nth(i).fill(names[i]);
		}

		await page.locator('#tf-submit').click();
		await page.waitForURL(/\/template\//, { timeout: 20_000 });

		const created = queryOne<{ id: string; slug: string; visibility: string }>(
			'SELECT id, slug, visibility FROM templates WHERE title = ?',
			'E2E Best Heist Movies'
		);
		expect(created?.visibility).toBe('unlisted');
		expect(
			queryAll<{ name: string }>(
				'SELECT name FROM template_options WHERE template_id = ? ORDER BY position',
				created!.id
			).map((row) => row.name)
		).toEqual(names);
		await expect(page.locator('main h1')).toContainText('E2E Best Heist Movies');
	});

	test('refuses a template that does not meet the rules', async ({
		page,
		signIn,
	}) => {
		await signIn('bad-creator');
		await page.goto('/create');

		await page.locator('#tf-title').fill('No');
		await page.locator('#tf-submit').click();

		await expect(page.locator('#tf-error')).not.toBeEmpty({ timeout: 10_000 });
		expect(
			queryAll("SELECT id FROM templates WHERE title = 'No'")
		).toHaveLength(0);
	});
});

test.describe('editing a template', () => {
	test('renames it without changing its share link', async ({
		page,
		signIn,
		seedTemplateFor,
	}) => {
		const user = await signIn('editor');
		const template = seedTemplateFor(user.id, 'editable', {
			title: 'E2E Before Rename',
			visibility: 'unlisted',
		});

		await page.goto(`/edit/${template.slug}`);
		await page.locator('#tf-title').fill('E2E After Rename');
		await page.locator('#tf-submit').click();
		await page.waitForURL(/\/template\//, { timeout: 20_000 });

		const row = queryOne<{ title: string; slug: string }>(
			'SELECT title, slug FROM templates WHERE id = ?',
			template.id
		);
		expect(row?.title).toBe('E2E After Rename');
		expect(row?.slug).toBe(template.slug);
	});

	test('will not open someone else’s template', async ({
		page,
		signIn,
		seedTemplateFor,
	}) => {
		await signIn('intruder');
		const owner = seedUser('edit-owner');
		const template = seedTemplateFor(owner.id, 'not-yours');

		const response = await page.goto(`/edit/${template.slug}`);

		expect(response?.status()).toBeGreaterThanOrEqual(400);
	});
});

test.describe('saving a template', () => {
	const savedCount = (userId: string) =>
		queryAll('SELECT slug FROM template_saves WHERE user_id = ?', userId).length;

	test('saves it, and it is still saved on the next visit', async ({
		page,
		signIn,
		seedTemplateFor,
	}) => {
		const user = await signIn('saver');
		const template = seedTemplateFor(user.id, 'saveable');

		await page.goto(`/template/${template.slug}`);
		const saveButton = page.locator('.save-btn').first();
		await expect(saveButton).toBeVisible({ timeout: 15_000 });
		await saveButton.click();

		await expect.poll(() => savedCount(user.id)).toBe(1);

		await page.reload();
		await expect(page.locator('.save-btn[data-saved="1"]').first()).toBeVisible({
			timeout: 15_000,
		});
	});

	test('un-saves on a second press', async ({
		page,
		signIn,
		seedTemplateFor,
	}) => {
		const user = await signIn('unsaver');
		const template = seedTemplateFor(user.id, 'unsaveable');

		await page.goto(`/template/${template.slug}`);
		const saveButton = page.locator('.save-btn').first();
		await expect(saveButton).toBeVisible({ timeout: 15_000 });
		await saveButton.click();
		await expect.poll(() => savedCount(user.id)).toBe(1);

		await saveButton.click();
		await expect.poll(() => savedCount(user.id)).toBe(0);
	});
});

test.describe('commenting', () => {
	test('posts a comment and shows it in the thread', async ({
		page,
		signIn,
		seedTemplateFor,
	}) => {
		const user = await signIn('commenter');
		const template = seedTemplateFor(user.id, 'commentable');
		const body = 'A comment written by the end-to-end suite.';

		await page.goto(`/template/${template.slug}`);
		const input = page.locator('[data-comment-input]').first();
		await expect(input).toBeVisible({ timeout: 15_000 });
		await input.fill(body);
		await page.locator('[data-comment-submit]').first().click();

		await expect(page.getByText(body)).toBeVisible({ timeout: 15_000 });
		expect(
			queryOne<{ body: string }>(
				'SELECT body FROM comments WHERE slug = ?',
				template.slug
			)?.body
		).toBe(body);
	});

	test('shows an existing thread to a signed-out visitor', async ({
		page,
		browser,
		signIn,
		seedTemplateFor,
	}) => {
		const user = await signIn('thread-author');
		const template = seedTemplateFor(user.id, 'public-thread');
		const body = 'Visible to everyone.';

		await page.goto(`/template/${template.slug}`);
		const input = page.locator('[data-comment-input]').first();
		await expect(input).toBeVisible({ timeout: 15_000 });
		await input.fill(body);
		await page.locator('[data-comment-submit]').first().click();
		await expect(page.getByText(body)).toBeVisible({ timeout: 15_000 });

		const guest = await browser.newPage();
		await guest.goto(`${page.url()}`);
		await expect(guest.getByText(body)).toBeVisible({ timeout: 15_000 });
		await guest.close();
	});
});

test.describe('following', () => {
	test('follows another account from their profile', async ({
		page,
		signIn,
		seedTemplateFor,
	}) => {
		const viewer = await signIn('follower');
		const creator = seedUser('followed');
		seedTemplateFor(creator.id, 'by-followed');

		await page.goto(`/u/${creator.username}`);
		const followButton = page.locator('[data-follow-btn]');
		await expect(followButton).toBeVisible({ timeout: 15_000 });
		await followButton.click();

		await expect
			.poll(() =>
				queryAll(
					'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
					viewer.id,
					creator.id
				).length
			)
			.toBe(1);
		await expect(page.locator('[data-followers-count]')).toHaveText('1');
	});

	test('offers no follow button on your own profile', async ({
		page,
		signIn,
	}) => {
		const user = await signIn('self');
		await page.goto(`/u/${user.username}`);
		await expect(page.locator('main h1')).toContainText(user.username, {
			timeout: 15_000,
		});
		await expect(page.locator('[data-follow-btn]')).toBeHidden();
	});
});

test.describe('a private template', () => {
	test('is reachable by its creator and refused to everyone else', async ({
		page,
		browser,
		baseURL,
		signIn,
		seedTemplateFor,
	}) => {
		const owner = await signIn('private-owner');
		const template = seedTemplateFor(owner.id, 'private-one', {
			visibility: 'private',
		});

		const mine = await page.goto(`/template/${template.slug}`);
		expect(mine?.status()).toBe(200);

		const guest = await browser.newPage();
		const theirs = await guest.goto(
			new URL(`/template/${template.slug}`, baseURL).toString()
		);
		expect(theirs?.status()).toBeGreaterThanOrEqual(400);
		await guest.close();
	});
});
