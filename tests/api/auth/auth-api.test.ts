/**
 * The session-facing auth endpoints: who am I, log out, delete my account, and
 * the signup form's username check. (The GitHub OAuth handshake in
 * `login.ts` / `callback.ts` is exercised end-to-end instead — it needs a real
 * provider round-trip to mean anything.)
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET as ME } from '../../../src/pages/api/auth/me';
import { POST as LOGOUT } from '../../../src/pages/api/auth/logout';
import { POST as DELETE_ACCOUNT } from '../../../src/pages/api/auth/delete-account';
import { GET as USERNAME_CHECK } from '../../../src/pages/api/auth/username-check';
import { SESSION_COOKIE, getSessionUser } from '../../../src/lib/auth';
import { MATURE_COOKIE, readMaturePref } from '../../../src/lib/mature';
import { createComment, listComments } from '../../../src/lib/comments';
import { createTestDb, type TestD1 } from '../../../src/test/d1';
import { apiContext, fakeBucket, type TestContext } from '../../../src/test/api';
import {
	insertImage,
	insertTemplate,
	insertUser,
	signIn,
} from '../../../src/test/factories';

let db: TestD1;
let bucket: ReturnType<typeof fakeBucket>;
let alice: { id: string; username: string };

beforeEach(async () => {
	db = createTestDb();
	bucket = fakeBucket();
	alice = await insertUser(db, { username: 'alice' });
});
afterEach(() => {
	db.close();
});

function ctx(options: {
	path: string;
	method?: string;
	body?: unknown;
	cookies?: Record<string, string>;
	origin?: string | null;
}): TestContext {
	return apiContext({
		db,
		path: options.path,
		method: options.method ?? 'POST',
		body: options.body,
		cookies: options.cookies ?? {},
		origin: options.origin,
		env: { IMAGES_BUCKET: bucket.bucket },
	});
}

describe('GET /api/auth/me', () => {
	it('reports the signed-in user and their unread badge', async () => {
		await db
			.prepare(
				`INSERT INTO notifications (id, user_id, type, actor_id, slug, title)
				 VALUES ('n1', ?, 'comment_reply', ?, 's', 't')`
			)
			.bind(alice.id, alice.id)
			.run();

		const response = await ME(
			ctx({
				path: '/api/auth/me',
				method: 'GET',
				cookies: await signIn(db, alice.id),
			}) as never
		);
		expect(await response.json()).toEqual({
			user: {
				username: 'alice',
				avatar: 'star-purple',
				isVerified: false,
				unreadNotifications: 1,
			},
			showMature: false,
		});
	});

	it('reports no user for a signed-out visitor', async () => {
		const response = await ME(
			ctx({ path: '/api/auth/me', method: 'GET' }) as never
		);
		expect(await response.json()).toEqual({ user: null, showMature: false });
	});

	it('keeps a signed-out visitor’s own mature cookie', async () => {
		const response = await ME(
			ctx({
				path: '/api/auth/me',
				method: 'GET',
				cookies: { [MATURE_COOKIE]: '1' },
			}) as never
		);
		expect(((await response.json()) as any).showMature).toBe(true);
	});

	it('re-stamps the cookie from the account, so the preference follows the user', async () => {
		const bob = await insertUser(db, { username: 'bob', showMature: true });
		const context = ctx({
			path: '/api/auth/me',
			method: 'GET',
			cookies: await signIn(db, bob.id),
		});

		const response = await ME(context as never);
		expect(((await response.json()) as any).showMature).toBe(true);
		expect(readMaturePref(context.cookies)).toBe(true);
	});

	it('clears a stale opt-in cookie when the account says otherwise', async () => {
		const context = ctx({
			path: '/api/auth/me',
			method: 'GET',
			cookies: {
				...(await signIn(db, alice.id)),
				[MATURE_COOKIE]: '1',
			},
		});

		const response = await ME(context as never);
		expect(((await response.json()) as any).showMature).toBe(false);
		expect(readMaturePref(context.cookies)).toBe(false);
	});

	it('is never cached — the header calls it on every navigation', async () => {
		const response = await ME(
			ctx({ path: '/api/auth/me', method: 'GET' }) as never
		);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	});
});

describe('POST /api/auth/logout', () => {
	it('ends the session and clears the cookie', async () => {
		const cookies = await signIn(db, alice.id);
		const context = ctx({ path: '/api/auth/logout', cookies });

		const response = await LOGOUT(context as never);
		expect(response.status).toBe(200);
		expect(context.cookies.deleted).toContain(SESSION_COOKIE);
		expect(await db.prepare('SELECT id FROM sessions').first()).toBeNull();
	});

	it('leaves the user’s other sessions alone', async () => {
		const phone = await signIn(db, alice.id);
		const laptop = await signIn(db, alice.id);
		await LOGOUT(ctx({ path: '/api/auth/logout', cookies: phone }) as never);

		const context = ctx({ path: '/api/auth/me', cookies: laptop });
		expect(await getSessionUser(context.cookies, db)).not.toBeNull();
	});

	it('rejects a cross-site logout', async () => {
		const cookies = await signIn(db, alice.id);
		const response = await LOGOUT(
			ctx({ path: '/api/auth/logout', cookies, origin: null }) as never
		);
		expect(response.status).toBe(403);
		expect(await db.prepare('SELECT id FROM sessions').first()).not.toBeNull();
	});

	it('is fine when there was no session to end', async () => {
		expect(
			(await LOGOUT(ctx({ path: '/api/auth/logout' }) as never)).status
		).toBe(200);
	});
});

describe('POST /api/auth/delete-account', () => {
	const del = (body: unknown, cookies: Record<string, string>) =>
		DELETE_ACCOUNT(
			ctx({ path: '/api/auth/delete-account', body, cookies }) as never
		);

	it('requires the username to be typed back', async () => {
		const cookies = await signIn(db, alice.id);
		for (const confirmUsername of ['bob', 'ALICE', '', undefined, null]) {
			const response = await del({ confirmUsername }, cookies);
			expect(response.status).toBe(400);
		}
		expect(
			await db.prepare('SELECT id FROM users WHERE id = ?').bind(alice.id).first()
		).not.toBeNull();
	});

	it('deletes the account, its templates and its sessions', async () => {
		await insertTemplate(db, alice.id, { slug: 'alices-ranking' });
		const cookies = await signIn(db, alice.id);

		const response = await del({ confirmUsername: 'alice' }, cookies);
		expect(response.status).toBe(200);

		for (const table of ['users', 'templates', 'sessions']) {
			const row = await db
				.prepare(
					table === 'users'
						? 'SELECT id FROM users WHERE id = ?'
						: table === 'templates'
							? 'SELECT id FROM templates WHERE creator_id = ?'
							: 'SELECT id FROM sessions WHERE user_id = ?'
				)
				.bind(alice.id)
				.first();
			expect(row, table).toBeNull();
		}
	});

	it('keeps other people’s replies under the comments it removes', async () => {
		const bob = await insertUser(db, { username: 'bob' });
		await insertTemplate(db, bob.id, { slug: 'bobs-ranking' });
		const root = await createComment(db, {
			slug: 'bobs-ranking',
			userId: alice.id,
			parentId: null,
			body: 'Alice’s thread',
		});
		await createComment(db, {
			slug: 'bobs-ranking',
			userId: bob.id,
			parentId: root,
			body: 'Bob’s reply',
		});

		await del({ confirmUsername: 'alice' }, await signIn(db, alice.id));

		expect(
			(await listComments(db, 'bobs-ranking', null)).map((c) => c.body)
		).toEqual(['', 'Bob’s reply']);
	});

	it('removes the user’s uploaded objects from R2, not just their rows', async () => {
		await insertImage(db, alice.id, 'u/alice/aaaaaaaaaaaaaaaa1.webp');
		bucket.objects.add('u/alice/aaaaaaaaaaaaaaaa1.webp');

		await del({ confirmUsername: 'alice' }, await signIn(db, alice.id));

		expect(bucket.objects.size).toBe(0);
		expect(await db.prepare('SELECT key FROM images').first()).toBeNull();
	});

	it('keeps the anonymous ranking events, which are aggregate analytics', async () => {
		await db
			.prepare('INSERT INTO rankings (slug, date) VALUES (?, ?)')
			.bind('bobs-ranking', '2026-01-01')
			.run();
		await del({ confirmUsername: 'alice' }, await signIn(db, alice.id));
		expect(await db.prepare('SELECT id FROM rankings').first()).not.toBeNull();
	});

	it('rejects a cross-site request', async () => {
		const response = await DELETE_ACCOUNT(
			ctx({
				path: '/api/auth/delete-account',
				body: { confirmUsername: 'alice' },
				cookies: await signIn(db, alice.id),
				origin: null,
			}) as never
		);
		expect(response.status).toBe(403);
		expect(
			await db.prepare('SELECT id FROM users WHERE id = ?').bind(alice.id).first()
		).not.toBeNull();
	});

	it('requires a session', async () => {
		const response = await del({ confirmUsername: 'alice' }, {});
		expect(response.status).toBe(401);
	});

	it('rejects invalid JSON', async () => {
		const response = await DELETE_ACCOUNT(
			ctx({
				path: '/api/auth/delete-account',
				body: 'not json',
				cookies: await signIn(db, alice.id),
			}) as never
		);
		expect(response.status).toBe(400);
	});
});

describe('GET /api/auth/username-check', () => {
	const check = (username: string) =>
		USERNAME_CHECK(
			apiContext({
				db,
				method: 'GET',
				path: `/api/auth/username-check?u=${encodeURIComponent(username)}`,
			}) as never
		);

	it('says an unused, valid username is available', async () => {
		expect(await (await check('brand-new')).json()).toEqual({
			available: true,
		});
	});

	it('says a taken username is not, whatever its casing', async () => {
		expect(((await (await check('ALICE')).json()) as any).available).toBe(
			false
		);
	});

	it('explains why an invalid username is refused', async () => {
		const payload = (await (await check('ab')).json()) as any;
		expect(payload.available).toBe(false);
		expect(payload.reason).toMatch(/3-30/);
	});

	it('refuses a reserved username', async () => {
		const payload = (await (await check('admin')).json()) as any;
		expect(payload.available).toBe(false);
		expect(payload.reason).toMatch(/reserved/);
	});

	it('refuses an empty query without touching the database', async () => {
		expect(((await (await check('')).json()) as any).available).toBe(false);
	});

	it('is never cached — the form polls it as the user types', async () => {
		expect((await check('brand-new')).headers.get('Cache-Control')).toBe(
			'no-store'
		);
	});
});
