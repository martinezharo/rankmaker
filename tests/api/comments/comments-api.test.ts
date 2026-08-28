/**
 * The comment API surface: creating, deleting and voting.
 *
 * Named for the group rather than one file because the three handlers live in
 * three route files (`index.ts`, `[id].ts`, `[id]/vote.ts`) but share one set
 * of rules — same-origin, logged in, and "may you even see this template".
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET, POST } from '../../../src/pages/api/comments/index';
import { DELETE } from '../../../src/pages/api/comments/[id]';
import { POST as VOTE } from '../../../src/pages/api/comments/[id]/vote';
import { MAX_BODY_LEN, createComment, listComments } from '../../../src/lib/comments';
import { listNotifications } from '../../../src/lib/notifications';
import { getOfficialTemplates } from '../../../src/lib/templates';
import { createTestDb, type TestD1 } from '../../../src/test/d1';
import { apiContext, fakeKv } from '../../../src/test/api';
import { insertTemplate, insertUser, signIn } from '../../../src/test/factories';

let db: TestD1;
let kv: ReturnType<typeof fakeKv>;
let alice: { id: string; username: string };
let bob: { id: string; username: string };

beforeEach(async () => {
	db = createTestDb();
	kv = fakeKv();
	alice = await insertUser(db, { username: 'alice' });
	bob = await insertUser(db, { username: 'bob' });
	await insertTemplate(db, alice.id, {
		slug: 'best-movies',
		title: 'Best Movies',
	});
});
afterEach(() => {
	db.close();
});

const env = () => ({ 'rm-times-ranked': kv.kv });

const post = (
	body: unknown,
	options: { cookies?: Record<string, string>; origin?: string | null } = {}
) =>
	POST(
		apiContext({
			db,
			path: '/api/comments',
			body,
			cookies: options.cookies ?? {},
			origin: options.origin,
			env: env(),
		}) as never
	);

const get = (slug: string, cookies: Record<string, string> = {}) =>
	GET(
		apiContext({
			db,
			method: 'GET',
			path: `/api/comments?slug=${encodeURIComponent(slug)}`,
			cookies,
			env: env(),
		}) as never
	);

const del = (
	id: string,
	options: { cookies?: Record<string, string>; origin?: string | null } = {}
) =>
	DELETE(
		apiContext({
			db,
			method: 'DELETE',
			path: `/api/comments/${id}`,
			params: { id },
			cookies: options.cookies ?? {},
			origin: options.origin,
			env: env(),
		}) as never
	);

const vote = (
	id: string,
	value: unknown,
	options: { cookies?: Record<string, string>; origin?: string | null } = {}
) =>
	VOTE(
		apiContext({
			db,
			path: `/api/comments/${id}/vote`,
			params: { id },
			body: { value },
			cookies: options.cookies ?? {},
			origin: options.origin,
			env: env(),
		}) as never
	);

describe('POST /api/comments', () => {
	it('creates a comment and returns it', async () => {
		const response = await post(
			{ slug: 'best-movies', body: '  Great list  ' },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(response.status).toBe(200);
		const { comment } = (await response.json()) as any;
		expect(comment.body).toBe('Great list');
		expect(comment.author.username).toBe('bob');
		expect(await listComments(db, 'best-movies', null)).toHaveLength(1);
	});

	it('rejects a cross-site post', async () => {
		const response = await post(
			{ slug: 'best-movies', body: 'Spam' },
			{ cookies: await signIn(db, bob.id), origin: null }
		);
		expect(response.status).toBe(403);
		expect(await listComments(db, 'best-movies', null)).toEqual([]);
	});

	it('requires a session', async () => {
		expect(
			(await post({ slug: 'best-movies', body: 'Hi' })).status
		).toBe(401);
	});

	it('rejects an empty or whitespace-only comment', async () => {
		const cookies = await signIn(db, bob.id);
		for (const value of ['', '   ', '\n\t', 42, null, undefined]) {
			const response = await post(
				{ slug: 'best-movies', body: value },
				{ cookies }
			);
			expect(response.status).toBe(400);
		}
	});

	it('rejects a comment past the length cap', async () => {
		const response = await post(
			{ slug: 'best-movies', body: 'x'.repeat(MAX_BODY_LEN + 1) },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(response.status).toBe(400);
	});

	it('404s an unknown template', async () => {
		expect(
			(
				await post(
					{ slug: 'no-such-template', body: 'Hi' },
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
					{ slug: 'alices-secret', body: 'Hi' },
					{ cookies: await signIn(db, bob.id) }
				)
			).status
		).toBe(404);
	});

	it('stores the comment under the canonical slug', async () => {
		await post(
			{ slug: 'BEST-MOVIES', body: 'Hi' },
			{ cookies: await signIn(db, bob.id) }
		);
		const row = await db
			.prepare('SELECT slug FROM comments')
			.first<{ slug: string }>();
		expect(row?.slug).toBe('best-movies');
	});

	it('refuses a reply whose parent belongs to another template', async () => {
		await insertTemplate(db, alice.id, { slug: 'best-games' });
		const parentId = await createComment(db, {
			slug: 'best-games',
			userId: alice.id,
			parentId: null,
			body: 'Elsewhere',
		});

		const response = await post(
			{ slug: 'best-movies', body: 'Hi', parentId },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(response.status).toBe(400);
	});

	it('refuses a reply to a parent that does not exist', async () => {
		const response = await post(
			{ slug: 'best-movies', body: 'Hi', parentId: 'invented' },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(response.status).toBe(400);
	});

	it('notifies the template owner about a top-level comment', async () => {
		await post(
			{ slug: 'best-movies', body: 'Nice one' },
			{ cookies: await signIn(db, bob.id) }
		);
		const [notification] = await listNotifications(db, alice.id);
		expect(notification.type).toBe('comment_on_template');
		expect(notification.actor.username).toBe('bob');
		expect(notification.title).toBe('Best Movies');
	});

	it('notifies the parent author about a reply, not the template owner', async () => {
		const carol = await insertUser(db, { username: 'carol' });
		const parentId = await createComment(db, {
			slug: 'best-movies',
			userId: bob.id,
			parentId: null,
			body: 'Root',
		});

		await post(
			{ slug: 'best-movies', body: 'Replying', parentId },
			{ cookies: await signIn(db, carol.id) }
		);

		expect((await listNotifications(db, bob.id))[0].type).toBe(
			'comment_reply'
		);
		expect(await listNotifications(db, alice.id)).toEqual([]);
	});

	it('does not notify you about your own comment', async () => {
		await post(
			{ slug: 'best-movies', body: 'Mine' },
			{ cookies: await signIn(db, alice.id) }
		);
		expect(await listNotifications(db, alice.id)).toEqual([]);
	});

	it('rate-limits scripted comment spam', async () => {
		const cookies = await signIn(db, bob.id);
		for (let i = 0; i < 20; i++) {
			const response = await post(
				{ slug: 'best-movies', body: `Comment ${i}` },
				{ cookies }
			);
			expect(response.status).toBe(200);
		}
		const blocked = await post(
			{ slug: 'best-movies', body: 'One too many' },
			{ cookies }
		);
		expect(blocked.status).toBe(429);
		expect(await listComments(db, 'best-movies', null)).toHaveLength(20);
	});

	it('limits each user separately', async () => {
		const bobCookies = await signIn(db, bob.id);
		for (let i = 0; i < 20; i++) {
			await post({ slug: 'best-movies', body: `C${i}` }, { cookies: bobCookies });
		}
		const carol = await insertUser(db, { username: 'carol' });
		const response = await post(
			{ slug: 'best-movies', body: 'Mine' },
			{ cookies: await signIn(db, carol.id) }
		);
		expect(response.status).toBe(200);
	});

	it('never caches the response', async () => {
		const response = await post(
			{ slug: 'best-movies', body: 'Hi' },
			{ cookies: await signIn(db, bob.id) }
		);
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	});
});

describe('GET /api/comments', () => {
	it('is public — a signed-out visitor reads the thread', async () => {
		await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Hello',
		});
		const response = await get('best-movies');
		expect(response.status).toBe(200);
		const payload = (await response.json()) as any;
		expect(payload.currentUser).toBeNull();
		expect(payload.comments).toHaveLength(1);
	});

	it('identifies the signed-in reader', async () => {
		const response = await get('best-movies', await signIn(db, bob.id));
		expect(((await response.json()) as any).currentUser.username).toBe('bob');
	});

	it('404s an unknown template', async () => {
		expect((await get('no-such-template')).status).toBe(404);
	});

	it('404s someone else’s private template instead of leaking the thread', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'alices-secret',
			visibility: 'private',
		});
		await createComment(db, {
			slug: 'alices-secret',
			userId: alice.id,
			parentId: null,
			body: 'Private talk',
		});

		expect((await get('alices-secret', await signIn(db, bob.id))).status).toBe(
			404
		);
		expect((await get('alices-secret', await signIn(db, alice.id))).status).toBe(
			200
		);
	});

	it('serves the thread of an official template', async () => {
		const official = getOfficialTemplates()[0];
		expect((await get(official.slug)).status).toBe(200);
	});

	it('never caches the response — it carries the reader’s identity', async () => {
		expect((await get('best-movies')).headers.get('Cache-Control')).toBe(
			'private, no-store'
		);
	});
});

describe('DELETE /api/comments/:id', () => {
	let commentId: string;
	beforeEach(async () => {
		commentId = await createComment(db, {
			slug: 'best-movies',
			userId: bob.id,
			parentId: null,
			body: 'Mine to delete',
		});
	});

	it('deletes the caller’s own comment', async () => {
		const response = await del(commentId, {
			cookies: await signIn(db, bob.id),
		});
		expect(response.status).toBe(200);
		expect((await listComments(db, 'best-movies', null))[0].isDeleted).toBe(
			true
		);
	});

	it('404s someone else’s comment — including the template owner’s attempt', async () => {
		const response = await del(commentId, {
			cookies: await signIn(db, alice.id),
		});
		expect(response.status).toBe(404);
		expect((await listComments(db, 'best-movies', null))[0].body).toBe(
			'Mine to delete'
		);
	});

	it('rejects a cross-site delete', async () => {
		const response = await del(commentId, {
			cookies: await signIn(db, bob.id),
			origin: null,
		});
		expect(response.status).toBe(403);
	});

	it('requires a session', async () => {
		expect((await del(commentId)).status).toBe(401);
	});

	it('404s an unknown comment', async () => {
		expect(
			(await del('invented', { cookies: await signIn(db, bob.id) })).status
		).toBe(404);
	});
});

describe('POST /api/comments/:id/vote', () => {
	let commentId: string;
	beforeEach(async () => {
		commentId = await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Vote on me',
		});
	});

	it('records the vote and reports the fresh totals', async () => {
		const response = await vote(commentId, 1, {
			cookies: await signIn(db, bob.id),
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ up: 1, down: 0, myVote: 1 });
	});

	it('rejects a cross-site vote', async () => {
		expect(
			(
				await vote(commentId, 1, {
					cookies: await signIn(db, bob.id),
					origin: null,
				})
			).status
		).toBe(403);
	});

	it('requires a session', async () => {
		expect((await vote(commentId, 1)).status).toBe(401);
	});

	it('rejects a value that is not 1, -1 or 0', async () => {
		const cookies = await signIn(db, bob.id);
		for (const value of [2, '1', null, undefined, 0.5]) {
			expect((await vote(commentId, value, { cookies })).status).toBe(400);
		}
	});

	it('404s an unknown comment', async () => {
		expect(
			(await vote('invented', 1, { cookies: await signIn(db, bob.id) })).status
		).toBe(404);
	});

	it('404s a deleted comment rather than voting on a tombstone', async () => {
		await del(commentId, { cookies: await signIn(db, alice.id) });
		expect(
			(await vote(commentId, 1, { cookies: await signIn(db, bob.id) })).status
		).toBe(404);
	});

	it('404s a comment on a template the caller may not see', async () => {
		await insertTemplate(db, alice.id, {
			slug: 'alices-secret',
			visibility: 'private',
		});
		const hidden = await createComment(db, {
			slug: 'alices-secret',
			userId: alice.id,
			parentId: null,
			body: 'Private',
		});
		expect(
			(await vote(hidden, 1, { cookies: await signIn(db, bob.id) })).status
		).toBe(404);
	});
});
