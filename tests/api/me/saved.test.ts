import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from '../../../src/pages/api/me/saved';
import { listSavedSlugs } from '../../../src/lib/templates';
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
	await insertTemplate(db, alice.id, { slug: 'best-movies' });
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
			path: '/api/me/saved',
			body,
			cookies: options.cookies ?? {},
			origin: options.origin,
		}) as never
	);

const get = (cookies: Record<string, string> = {}) =>
	GET(
		apiContext({ db, method: 'GET', path: '/api/me/saved', cookies }) as never
	);

describe('POST /api/me/saved', () => {
	it('saves and unsaves a template', async () => {
		const cookies = await signIn(db, bob.id);

		expect(
			await (await post({ slug: 'best-movies', action: 'save' }, { cookies })).json()
		).toEqual({ saved: true });
		expect(await listSavedSlugs(db, bob.id)).toEqual(['best-movies']);

		expect(
			await (
				await post({ slug: 'best-movies', action: 'unsave' }, { cookies })
			).json()
		).toEqual({ saved: false });
		expect(await listSavedSlugs(db, bob.id)).toEqual([]);
	});

	it('saves under the canonical slug, not the caller’s spelling', async () => {
		await post(
			{ slug: 'BEST-MOVIES', action: 'save' },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(await listSavedSlugs(db, bob.id)).toEqual(['best-movies']);
	});

	it('collapses a legacy case-variant save into one row', async () => {
		await db
			.prepare('INSERT INTO template_saves (user_id, slug) VALUES (?, ?)')
			.bind(bob.id, 'Best-Movies')
			.run();

		await post(
			{ slug: 'best-movies', action: 'save' },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(await listSavedSlugs(db, bob.id)).toEqual(['best-movies']);
	});

	it('unsaves whatever spelling the row was written with', async () => {
		await db
			.prepare('INSERT INTO template_saves (user_id, slug) VALUES (?, ?)')
			.bind(bob.id, 'Best-Movies')
			.run();

		await post(
			{ slug: 'best-movies', action: 'unsave' },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(await listSavedSlugs(db, bob.id)).toEqual([]);
	});

	it('saving twice keeps one row', async () => {
		const cookies = await signIn(db, bob.id);
		await post({ slug: 'best-movies', action: 'save' }, { cookies });
		await post({ slug: 'best-movies', action: 'save' }, { cookies });
		expect(await listSavedSlugs(db, bob.id)).toEqual(['best-movies']);
	});

	it('rejects a cross-site request', async () => {
		const response = await post(
			{ slug: 'best-movies', action: 'save' },
			{ cookies: await signIn(db, bob.id), origin: null }
		);
		expect(response.status).toBe(403);
		expect(await listSavedSlugs(db, bob.id)).toEqual([]);
	});

	it('requires a session', async () => {
		expect((await post({ slug: 'best-movies', action: 'save' })).status).toBe(
			401
		);
	});

	it('rejects an action it does not recognise', async () => {
		const cookies = await signIn(db, bob.id);
		for (const action of ['SAVE', 'delete', '', null, 1, true]) {
			expect(
				(await post({ slug: 'best-movies', action }, { cookies })).status
			).toBe(400);
		}
	});

	it('404s an unknown template', async () => {
		expect(
			(
				await post(
					{ slug: 'no-such-template', action: 'save' },
					{ cookies: await signIn(db, bob.id) }
				)
			).status
		).toBe(404);
	});

	it('404s someone else’s private template', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'alices-secret',
			visibility: 'private',
		});
		expect(
			(
				await post(
					{ slug: 'alices-secret', action: 'save' },
					{ cookies: await signIn(db, bob.id) }
				)
			).status
		).toBe(404);
	});
});

describe('GET /api/me/saved', () => {
	it('lists the caller’s saved slugs', async () => {
		await post(
			{ slug: 'best-movies', action: 'save' },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(
			await (await get(await signIn(db, bob.id))).json()
		).toEqual({ slugs: ['best-movies'] });
	});

	it('is an empty list for a signed-out caller, not an error', async () => {
		const response = await get();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ slugs: [] });
	});

	it('never shows one user another user’s saves', async () => {
		await post(
			{ slug: 'best-movies', action: 'save' },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(await (await get(await signIn(db, alice.id))).json()).toEqual({
			slugs: [],
		});
	});

	it('is never cached', async () => {
		expect((await get()).headers.get('Cache-Control')).toBe(
			'private, no-store'
		);
	});
});
