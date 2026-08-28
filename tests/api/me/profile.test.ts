import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_BIO_LEN, POST as UPDATE_BIO } from '../../../src/pages/api/me/profile';
import { POST as MARK_READ } from '../../../src/pages/api/me/notifications/read';
import { GET as FOLLOWING_TEMPLATES } from '../../../src/pages/api/me/following-templates';
import { GET as FOLLOW_LIST } from '../../../src/pages/api/follow/list';
import { countUnread } from '../../../src/lib/notifications';
import { setFollow } from '../../../src/lib/follows';
import { MATURE_COOKIE } from '../../../src/lib/mature';
import { createTestDb, type TestD1 } from '../../../src/test/d1';
import { apiContext } from '../../../src/test/api';
import { insertTemplate, insertUser, signIn } from '../../../src/test/factories';

let db: TestD1;
let alice: { id: string; username: string };
let bob: { id: string; username: string };

beforeEach(async () => {
	db = createTestDb();
	alice = await insertUser(db, { username: 'alice' });
	bob = await insertUser(db, { username: 'bob' });
});
afterEach(() => {
	db.close();
});

const bioOf = async (userId: string) =>
	(
		await db
			.prepare('SELECT bio FROM users WHERE id = ?')
			.bind(userId)
			.first<{ bio: string | null }>()
	)?.bio;

describe('POST /api/me/profile', () => {
	const post = (
		body: unknown,
		options: { cookies?: Record<string, string>; origin?: string | null } = {}
	) =>
		UPDATE_BIO(
			apiContext({
				db,
				path: '/api/me/profile',
				body,
				cookies: options.cookies ?? {},
				origin: options.origin,
			}) as never
		);

	it('saves a trimmed bio', async () => {
		const response = await post(
			{ bio: '  I rank things.  ' },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(await response.json()).toEqual({ ok: true, bio: 'I rank things.' });
		expect(await bioOf(alice.id)).toBe('I rank things.');
	});

	it('clears the bio when it is emptied', async () => {
		const cookies = await signIn(db, alice.id);
		await post({ bio: 'Something' }, { cookies });
		await post({ bio: '   ' }, { cookies });
		expect(await bioOf(alice.id)).toBeNull();
	});

	it('rejects a bio past the cap', async () => {
		const response = await post(
			{ bio: 'x'.repeat(MAX_BIO_LEN + 1) },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(response.status).toBe(400);
		expect(await bioOf(alice.id)).toBeNull();
	});

	it('accepts one exactly at the cap', async () => {
		const response = await post(
			{ bio: 'x'.repeat(MAX_BIO_LEN) },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(response.status).toBe(200);
	});

	it('rejects a bio that is not a string', async () => {
		const cookies = await signIn(db, alice.id);
		for (const bio of [42, null, undefined, {}, ['x']]) {
			expect((await post({ bio }, { cookies })).status).toBe(400);
		}
	});

	it('rejects a cross-site request and requires a session', async () => {
		expect(
			(
				await post(
					{ bio: 'Hi' },
					{ cookies: await signIn(db, alice.id), origin: null }
				)
			).status
		).toBe(403);
		expect((await post({ bio: 'Hi' })).status).toBe(401);
	});

	it('only ever edits the caller’s own bio', async () => {
		await post({ bio: 'Alice here' }, { cookies: await signIn(db, alice.id) });
		expect(await bioOf(bob.id)).toBeNull();
	});
});

describe('POST /api/me/notifications/read', () => {
	const markRead = (options: {
		cookies?: Record<string, string>;
		origin?: string | null;
	}) =>
		MARK_READ(
			apiContext({
				db,
				path: '/api/me/notifications/read',
				cookies: options.cookies ?? {},
				origin: options.origin,
			}) as never
		);

	async function notify(userId: string, id: string) {
		await db
			.prepare(
				`INSERT INTO notifications (id, user_id, type, actor_id, slug, title)
				 VALUES (?, ?, 'comment_reply', ?, 's', 't')`
			)
			.bind(id, userId, bob.id)
			.run();
	}

	it('clears the caller’s unread badge', async () => {
		await notify(alice.id, 'n1');
		const response = await markRead({ cookies: await signIn(db, alice.id) });
		expect(response.status).toBe(200);
		expect(await countUnread(db, alice.id)).toBe(0);
	});

	it('leaves other users’ notifications unread', async () => {
		await notify(alice.id, 'n1');
		await notify(bob.id, 'n2');
		await markRead({ cookies: await signIn(db, alice.id) });
		expect(await countUnread(db, bob.id)).toBe(1);
	});

	it('rejects a cross-site request and requires a session', async () => {
		await notify(alice.id, 'n1');
		expect(
			(
				await markRead({
					cookies: await signIn(db, alice.id),
					origin: null,
				})
			).status
		).toBe(403);
		expect((await markRead({})).status).toBe(401);
		expect(await countUnread(db, alice.id)).toBe(1);
	});
});

describe('GET /api/me/following-templates', () => {
	const following = (
		cookies: Record<string, string> = {},
		optedIn = false
	) =>
		FOLLOWING_TEMPLATES(
			apiContext({
				db,
				method: 'GET',
				path: '/api/me/following-templates',
				cookies: optedIn ? { ...cookies, [MATURE_COOKIE]: '1' } : cookies,
			}) as never
		);

	it('lists the latest templates from the accounts you follow', async () => {
		await setFollow(db, alice.id, bob.id, true);
		await insertTemplate(db, bob.id, { slug: 'bobs', title: 'Bobs Ranking' });

		const payload = (await (
			await following(await signIn(db, alice.id))
		).json()) as any;
		expect(payload.templates).toHaveLength(1);
		expect(payload.templates[0]).toMatchObject({
			slug: 'bobs',
			title: 'Bobs Ranking',
			creator: { username: 'bob' },
		});
	});

	it('is empty for an anonymous visitor', async () => {
		expect(await (await following()).json()).toEqual({ templates: [] });
	});

	it('honours the viewer’s mature preference', async () => {
		await setFollow(db, alice.id, bob.id, true);
		await insertTemplate(db, bob.id, { slug: 'spicy', isMature: true });
		const cookies = await signIn(db, alice.id);

		expect(
			((await (await following(cookies)).json()) as any).templates
		).toEqual([]);
		expect(
			((await (await following(cookies, true)).json()) as any).templates
		).toHaveLength(1);
	});

	it('is never cached', async () => {
		expect((await following()).headers.get('Cache-Control')).toBe(
			'private, no-store'
		);
	});
});

describe('GET /api/follow/list', () => {
	const list = (username: string, type?: string) =>
		FOLLOW_LIST(
			apiContext({
				db,
				method: 'GET',
				path: `/api/follow/list?username=${encodeURIComponent(username)}${
					type ? `&type=${type}` : ''
				}`,
			}) as never
		);

	it('lists followers by default and following on request', async () => {
		await setFollow(db, alice.id, bob.id, true);

		expect(
			((await (await list('bob')).json()) as any).users.map(
				(u: any) => u.username
			)
		).toEqual(['alice']);
		expect(
			((await (await list('alice', 'following')).json()) as any).users.map(
				(u: any) => u.username
			)
		).toEqual(['bob']);
	});

	it('falls back to followers for an unknown type', async () => {
		await setFollow(db, alice.id, bob.id, true);
		expect(
			((await (await list('bob', 'nonsense')).json()) as any).users
		).toHaveLength(1);
	});

	it('is an empty list for an unknown or missing username', async () => {
		for (const username of ['', 'nobody']) {
			expect(await (await list(username)).json()).toEqual({ users: [] });
		}
	});

	it('is publicly cacheable — who follows whom is public', async () => {
		expect((await list('bob')).headers.get('Cache-Control')).toBe(
			'public, max-age=30'
		);
	});
});
