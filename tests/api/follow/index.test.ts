import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from '../../../src/pages/api/follow/index';
import { isFollowing, setFollow } from '../../../src/lib/follows';
import { createTestDb, type TestD1 } from '../../../src/test/d1';
import { apiContext, fakeKv } from '../../../src/test/api';
import { insertUser, signIn } from '../../../src/test/factories';

let db: TestD1;
let kv: ReturnType<typeof fakeKv>;
let alice: { id: string; username: string };
let bob: { id: string; username: string };

beforeEach(async () => {
	db = createTestDb();
	kv = fakeKv();
	alice = await insertUser(db, { username: 'alice' });
	bob = await insertUser(db, { username: 'bob' });
});
afterEach(() => {
	db.close();
});

const post = (
	body: unknown,
	options: { cookies?: Record<string, string>; origin?: string | null } = {}
) =>
	POST(
		apiContext({
			db,
			path: '/api/follow',
			body,
			cookies: options.cookies ?? {},
			origin: options.origin,
			env: { 'rm-times-ranked': kv.kv },
		}) as never
	);

const get = (username: string, cookies: Record<string, string> = {}) =>
	GET(
		apiContext({
			db,
			method: 'GET',
			path: `/api/follow?username=${encodeURIComponent(username)}`,
			cookies,
			env: { 'rm-times-ranked': kv.kv },
		}) as never
	);

describe('POST /api/follow', () => {
	it('follows and unfollows, reporting the target’s fresh count', async () => {
		const cookies = await signIn(db, alice.id);

		expect(
			await (await post({ username: 'bob', action: 'follow' }, { cookies })).json()
		).toEqual({ isFollowing: true, followers: 1 });
		expect(await isFollowing(db, alice.id, bob.id)).toBe(true);

		expect(
			await (
				await post({ username: 'bob', action: 'unfollow' }, { cookies })
			).json()
		).toEqual({ isFollowing: false, followers: 0 });
	});

	it('resolves the username case-insensitively', async () => {
		await post(
			{ username: 'BOB', action: 'follow' },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(await isFollowing(db, alice.id, bob.id)).toBe(true);
	});

	it('rejects a cross-site request', async () => {
		const response = await post(
			{ username: 'bob', action: 'follow' },
			{ cookies: await signIn(db, alice.id), origin: null }
		);
		expect(response.status).toBe(403);
		expect(await isFollowing(db, alice.id, bob.id)).toBe(false);
	});

	it('requires a session', async () => {
		expect(
			(await post({ username: 'bob', action: 'follow' })).status
		).toBe(401);
	});

	it('rejects an action it does not recognise', async () => {
		const cookies = await signIn(db, alice.id);
		for (const action of ['FOLLOW', 'block', '', 1, true, null, undefined]) {
			const response = await post({ username: 'bob', action }, { cookies });
			expect(response.status).toBe(400);
		}
		expect(await isFollowing(db, alice.id, bob.id)).toBe(false);
	});

	it('rejects invalid JSON', async () => {
		const response = await POST(
			apiContext({
				db,
				path: '/api/follow',
				body: 'not json',
				cookies: await signIn(db, alice.id),
				env: { 'rm-times-ranked': kv.kv },
			}) as never
		);
		expect(response.status).toBe(400);
	});

	it('404s an unknown username', async () => {
		expect(
			(
				await post(
					{ username: 'nobody', action: 'follow' },
					{ cookies: await signIn(db, alice.id) }
				)
			).status
		).toBe(404);
	});

	it('refuses to let you follow yourself', async () => {
		const response = await post(
			{ username: 'alice', action: 'follow' },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(response.status).toBe(400);
		expect(await isFollowing(db, alice.id, alice.id)).toBe(false);
	});

	it('rate-limits scripted follow spam', async () => {
		const cookies = await signIn(db, alice.id);
		for (let i = 0; i < 30; i++) {
			const target = await insertUser(db, { username: `target-${i}` });
			expect(
				(
					await post(
						{ username: target.username, action: 'follow' },
						{ cookies }
					)
				).status
			).toBe(200);
		}
		expect(
			(await post({ username: 'bob', action: 'follow' }, { cookies })).status
		).toBe(429);
	});

	it('never caches the response', async () => {
		const response = await post(
			{ username: 'bob', action: 'follow' },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	});
});

describe('GET /api/follow', () => {
	it('reports public counts to a signed-out visitor', async () => {
		await setFollow(db, alice.id, bob.id, true);
		expect(await (await get('bob')).json()).toEqual({
			exists: true,
			followers: 1,
			following: 0,
			isFollowing: false,
			isSelf: false,
			loggedIn: false,
		});
	});

	it('tells the viewer whether they already follow the target', async () => {
		await setFollow(db, alice.id, bob.id, true);
		const payload = (await (
			await get('bob', await signIn(db, alice.id))
		).json()) as any;
		expect(payload.isFollowing).toBe(true);
		expect(payload.isSelf).toBe(false);
		expect(payload.loggedIn).toBe(true);
	});

	it('flags the viewer’s own profile, so the button can hide itself', async () => {
		const payload = (await (
			await get('alice', await signIn(db, alice.id))
		).json()) as any;
		expect(payload.isSelf).toBe(true);
		expect(payload.isFollowing).toBe(false);
	});

	it('answers "does not exist" for an unknown or missing username', async () => {
		for (const username of ['', 'nobody']) {
			const payload = (await (await get(username)).json()) as any;
			expect(payload.exists).toBe(false);
		}
	});

	it('is never cached — it carries per-viewer state', async () => {
		expect((await get('bob')).headers.get('Cache-Control')).toBe(
			'private, no-store'
		);
	});
});
