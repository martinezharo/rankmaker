import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from '../../../src/pages/api/templates/vote';
import { applyTemplateVote } from '../../../src/lib/template-votes';
import { getOfficialTemplates } from '../../../src/lib/templates';
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

const get = (slug: string, cookies: Record<string, string> = {}) =>
	GET(
		apiContext({
			db,
			method: 'GET',
			path: `/api/templates/vote?slug=${encodeURIComponent(slug)}`,
			cookies,
		}) as never
	);

const post = (
	body: unknown,
	options: { cookies?: Record<string, string>; origin?: string | null } = {}
) =>
	POST(
		apiContext({
			db,
			path: '/api/templates/vote',
			body,
			cookies: options.cookies ?? {},
			origin: options.origin,
		}) as never
	);

describe('POST /api/templates/vote', () => {
	it('records a vote for a signed-in user', async () => {
		const response = await post(
			{ slug: 'best-movies', value: 1 },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ score: 1, myVote: 1 });
	});

	it('rejects a cross-site request before touching the database', async () => {
		const response = await post(
			{ slug: 'best-movies', value: 1 },
			{ cookies: await signIn(db, bob.id), origin: null }
		);
		expect(response.status).toBe(403);
		expect(await db.prepare('SELECT * FROM votes').first()).toBeNull();
	});

	it('rejects a request from another site’s origin', async () => {
		const response = await post(
			{ slug: 'best-movies', value: 1 },
			{
				cookies: await signIn(db, bob.id),
				origin: 'https://evil.test',
			}
		);
		expect(response.status).toBe(403);
	});

	it('requires a session', async () => {
		expect((await post({ slug: 'best-movies', value: 1 })).status).toBe(401);
	});

	it('ignores an expired session', async () => {
		await db
			.prepare(
				'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
			)
			.bind('stale', bob.id, new Date(Date.now() - 1000).toISOString())
			.run();
		const response = await post(
			{ slug: 'best-movies', value: 1 },
			{ cookies: { rm_session: 'stale' } }
		);
		expect(response.status).toBe(401);
	});

	it('rejects a vote value that is not 1, -1 or 0', async () => {
		const cookies = await signIn(db, bob.id);
		for (const value of [2, -2, '1', null, undefined, 1.5]) {
			const response = await post({ slug: 'best-movies', value }, { cookies });
			expect(response.status).toBe(400);
		}
	});

	it('rejects a malformed body', async () => {
		const cookies = await signIn(db, bob.id);
		const response = await POST(
			apiContext({
				db,
				path: '/api/templates/vote',
				body: 'not json',
				cookies,
			}) as never
		);
		expect(response.status).toBe(400);
	});

	it('404s an unknown slug rather than creating a phantom vote', async () => {
		const response = await post(
			{ slug: 'no-such-template', value: 1 },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(response.status).toBe(404);
		expect(await db.prepare('SELECT * FROM votes').first()).toBeNull();
	});

	it('404s someone else’s private template instead of accepting a vote', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'alices-secret',
			visibility: 'private',
		});
		const response = await post(
			{ slug: 'alices-secret', value: 1 },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(response.status).toBe(404);
	});

	it('lets the creator vote on their own private template', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'alices-secret',
			visibility: 'private',
		});
		const response = await post(
			{ slug: 'alices-secret', value: 1 },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(response.status).toBe(200);
	});

	it('stores the vote under the canonical slug, not the caller’s spelling', async () => {
		await post(
			{ slug: 'BEST-MOVIES', value: 1 },
			{ cookies: await signIn(db, bob.id) }
		);
		const row = await db
			.prepare("SELECT subject_id FROM votes WHERE subject_type = 'template'")
			.first<{ subject_id: string }>();
		expect(row?.subject_id).toBe('best-movies');
	});

	it('accepts votes on official templates', async () => {
		const official = getOfficialTemplates()[0];
		const response = await post(
			{ slug: official.slug, value: 1 },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(response.status).toBe(200);
	});

	it('never caches a per-user response', async () => {
		const response = await post(
			{ slug: 'best-movies', value: 1 },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	});
});

describe('GET /api/templates/vote', () => {
	it('reports the score and the caller’s own vote', async () => {
		await applyTemplateVote(db, alice.id, 'best-movies', 1);
		await applyTemplateVote(db, bob.id, 'best-movies', -1);

		const response = await get('best-movies', await signIn(db, bob.id));
		expect(await response.json()).toEqual({
			score: 0,
			myVote: -1,
			loggedIn: true,
		});
	});

	it('gives an anonymous caller the score without a vote', async () => {
		await applyTemplateVote(db, alice.id, 'best-movies', 1);
		expect(await (await get('best-movies')).json()).toEqual({
			score: 1,
			myVote: 0,
			loggedIn: false,
		});
	});

	it('is a quiet zero for a missing or unknown slug', async () => {
		for (const slug of ['', 'no-such-template']) {
			const response = await get(slug);
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({
				score: 0,
				myVote: 0,
				loggedIn: false,
			});
		}
	});

	it('does not leak the score of someone else’s private template', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'alices-secret',
			visibility: 'private',
		});
		await applyTemplateVote(db, alice.id, 'alices-secret', 1);

		expect(
			await (await get('alices-secret', await signIn(db, bob.id))).json()
		).toEqual({ score: 0, myVote: 0, loggedIn: false });
	});

	it('is never cached — the answer is per user', async () => {
		expect((await get('best-movies')).headers.get('Cache-Control')).toBe(
			'private, no-store'
		);
	});
});
