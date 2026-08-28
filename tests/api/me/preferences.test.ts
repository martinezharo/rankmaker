import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../../src/pages/api/me/preferences';
import { getEmailPref } from '../../../src/lib/notifications';
import { MATURE_COOKIE, readMaturePref } from '../../../src/lib/mature';
import { createTestDb, type TestD1 } from '../../../src/test/d1';
import { apiContext, type TestContext } from '../../../src/test/api';
import { insertUser, signIn } from '../../../src/test/factories';

let db: TestD1;
let alice: { id: string; username: string };

beforeEach(async () => {
	db = createTestDb();
	alice = await insertUser(db, { username: 'alice' });
});
afterEach(() => {
	db.close();
});

async function post(
	body: unknown,
	options: { cookies?: Record<string, string>; origin?: string | null } = {}
): Promise<{ response: Response; context: TestContext }> {
	const context = apiContext({
		db,
		path: '/api/me/preferences',
		body,
		cookies: options.cookies ?? {},
		origin: options.origin,
	});
	return { response: await POST(context as never), context };
}

const showMature = async (userId: string) =>
	(
		await db
			.prepare('SELECT show_mature FROM users WHERE id = ?')
			.bind(userId)
			.first<{ show_mature: number }>()
	)?.show_mature;

describe('POST /api/me/preferences', () => {
	it('lets a signed-out visitor set the mature preference as a cookie', async () => {
		const { response, context } = await post({ showMature: true });
		expect(response.status).toBe(200);
		expect(readMaturePref(context.cookies)).toBe(true);
		expect(context.cookies.written.get(MATURE_COOKIE)?.options).toMatchObject({
			httpOnly: true,
		});
	});

	it('also stores it on the account, so it follows the user across devices', async () => {
		const { context } = await post(
			{ showMature: true },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(readMaturePref(context.cookies)).toBe(true);
		expect(await showMature(alice.id)).toBe(1);
	});

	it('turns the preference back off', async () => {
		const cookies = await signIn(db, alice.id);
		await post({ showMature: true }, { cookies });
		const { context } = await post({ showMature: false }, { cookies });
		expect(readMaturePref(context.cookies)).toBe(false);
		expect(await showMature(alice.id)).toBe(0);
	});

	it('requires a session for the account-level email preference', async () => {
		const { response } = await post({ emailNotifications: false });
		expect(response.status).toBe(401);
	});

	it('toggles the email preference for a signed-in user', async () => {
		await post(
			{ emailNotifications: false },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(await getEmailPref(db, alice.id)).toBe(false);
	});

	it('applies both preferences in one call', async () => {
		const { context } = await post(
			{ showMature: true, emailNotifications: false },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(readMaturePref(context.cookies)).toBe(true);
		expect(await getEmailPref(db, alice.id)).toBe(false);
	});

	it('rejects a cross-site request', async () => {
		const { response, context } = await post(
			{ showMature: true },
			{ origin: null }
		);
		expect(response.status).toBe(403);
		expect(context.cookies.written.size).toBe(0);
	});

	it('rejects a body with nothing to update', async () => {
		expect((await post({})).response.status).toBe(400);
	});

	it('rejects non-boolean values rather than coercing them', async () => {
		const cookies = await signIn(db, alice.id);
		for (const value of ['true', 1, 0, null, 'on']) {
			expect((await post({ showMature: value }, { cookies })).response.status).toBe(
				400
			);
			expect(
				(await post({ emailNotifications: value }, { cookies })).response.status
			).toBe(400);
		}
		expect(await showMature(alice.id)).toBe(0);
		expect(await getEmailPref(db, alice.id)).toBe(true);
	});

	it('rejects invalid JSON', async () => {
		expect((await post('not json')).response.status).toBe(400);
	});

	it('never caches the response', async () => {
		const { response } = await post({ showMature: true });
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	});
});
