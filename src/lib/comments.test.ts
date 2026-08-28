import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	DELETED_USER_ID,
	applyVote,
	createComment,
	detachUserComments,
	getComment,
	getCommentAuthorId,
	getCommentContext,
	listComments,
	parentOnSlug,
	softDeleteComment,
} from './comments';
import { MAX_ROOT_THREADS } from '../scripts/comments';
import { createTestDb, type TestD1 } from '../test/d1';
import {
	insertRankingResult,
	insertTemplate,
	insertUser,
} from '../test/factories';

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

/** Comments are ordered by created_at, so tests that care set it explicitly. */
async function backdate(id: string, createdAt: string) {
	await db
		.prepare('UPDATE comments SET created_at = ? WHERE id = ?')
		.bind(createdAt, id)
		.run();
}

describe('createComment / listComments', () => {
	it('round-trips a comment with its author', async () => {
		const id = await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Great list',
		});

		const [comment] = await listComments(db, 'best-movies', alice.id);
		expect(comment.id).toBe(id);
		expect(comment.body).toBe('Great list');
		expect(comment.author?.username).toBe('alice');
		expect(comment.mine).toBe(true);
		expect(comment.depth).toBe(0);
	});

	it('does not mark someone else’s comment as mine', async () => {
		await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Hers',
		});
		const [comment] = await listComments(db, 'best-movies', bob.id);
		expect(comment.mine).toBe(false);
	});

	it('never claims a comment for a signed-out reader', async () => {
		await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Hers',
		});
		const [comment] = await listComments(db, 'best-movies', null);
		expect(comment.mine).toBe(false);
		expect(comment.myVote).toBe(0);
	});

	it('finds the thread whatever case the slug is asked for', async () => {
		await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Hi',
		});
		expect(await listComments(db, 'BEST-MOVIES', null)).toHaveLength(1);
	});

	it('keeps a comment out of another template’s thread', async () => {
		await insertTemplate(db, alice.id, { slug: 'best-games' });
		await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Movies',
		});
		expect(await listComments(db, 'best-games', null)).toEqual([]);
	});

	it('renders replies under their parent, oldest first', async () => {
		const root = await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Root',
		});
		const first = await createComment(db, {
			slug: 'best-movies',
			userId: bob.id,
			parentId: root,
			body: 'First reply',
		});
		const second = await createComment(db, {
			slug: 'best-movies',
			userId: bob.id,
			parentId: root,
			body: 'Second reply',
		});
		await backdate(first, '2026-01-01T00:00:00.000Z');
		await backdate(second, '2026-01-02T00:00:00.000Z');

		expect(
			(await listComments(db, 'best-movies', null)).map((c) => [
				c.body,
				c.depth,
			])
		).toEqual([
			['Root', 0],
			['First reply', 1],
			['Second reply', 1],
		]);
	});

	it('caps the number of root threads but keeps every reply of the ones it keeps', async () => {
		for (let i = 0; i < MAX_ROOT_THREADS + 5; i++) {
			const id = await createComment(db, {
				slug: 'best-movies',
				userId: alice.id,
				parentId: null,
				body: `Root ${i}`,
			});
			// Vote volume decides which roots survive the cap.
			await db
				.prepare('UPDATE comments SET up_votes = ? WHERE id = ?')
				.bind(MAX_ROOT_THREADS + 5 - i, id)
				.run();
			if (i === 0) {
				await createComment(db, {
					slug: 'best-movies',
					userId: bob.id,
					parentId: id,
					body: 'A reply on the top thread',
				});
			}
		}

		const comments = await listComments(db, 'best-movies', null);
		expect(comments.filter((c) => c.depth === 0)).toHaveLength(
			MAX_ROOT_THREADS
		);
		expect(comments.some((c) => c.body === 'A reply on the top thread')).toBe(
			true
		);
		expect(comments.some((c) => c.body === `Root ${MAX_ROOT_THREADS + 4}`)).toBe(
			false
		);
	});

	it('shows the author’s own ranking of this template next to their comment', async () => {
		await insertRankingResult(db, alice.id, 'best-movies', {
			result: [{ id: 1, name: 'Heat', image: null }],
		});
		await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Mine',
		});

		const [comment] = await listComments(db, 'best-movies', null);
		expect(comment.topPick?.name).toBe('Heat');
	});
});

describe('soft deletion', () => {
	it('strips the body and author but keeps the node for its replies', async () => {
		const root = await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Sensitive',
		});
		await createComment(db, {
			slug: 'best-movies',
			userId: bob.id,
			parentId: root,
			body: 'A reply worth keeping',
		});

		expect(await softDeleteComment(db, root, alice.id)).toBe(true);

		const comments = await listComments(db, 'best-movies', null);
		expect(comments[0].isDeleted).toBe(true);
		expect(comments[0].body).toBe('');
		expect(comments[0].author).toBeNull();
		expect(comments[1].body).toBe('A reply worth keeping');
	});

	it('refuses to delete someone else’s comment', async () => {
		const id = await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Hers',
		});

		expect(await softDeleteComment(db, id, bob.id)).toBe(false);
		expect((await listComments(db, 'best-movies', null))[0].body).toBe('Hers');
	});

	it('is idempotent — deleting twice reports no second deletion', async () => {
		const id = await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Bye',
		});
		expect(await softDeleteComment(db, id, alice.id)).toBe(true);
		expect(await softDeleteComment(db, id, alice.id)).toBe(false);
	});

	it('reports nothing deleted for an unknown comment', async () => {
		expect(await softDeleteComment(db, 'no-such-id', alice.id)).toBe(false);
	});
});

describe('detachUserComments', () => {
	it('preserves other users’ replies when an account is deleted', async () => {
		const root = await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Alice’s thread',
		});
		await createComment(db, {
			slug: 'best-movies',
			userId: bob.id,
			parentId: root,
			body: 'Bob’s reply',
		});

		await detachUserComments(db, alice.id);
		await db.prepare('DELETE FROM users WHERE id = ?').bind(alice.id).run();

		const comments = await listComments(db, 'best-movies', null);
		expect(comments.map((c) => c.body)).toEqual(['', 'Bob’s reply']);
		expect(comments[0].isDeleted).toBe(true);
	});

	it('reassigns the comments to the placeholder account', async () => {
		await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Mine',
		});
		await detachUserComments(db, alice.id);

		const row = await db
			.prepare('SELECT user_id FROM comments')
			.first<{ user_id: string }>();
		expect(row?.user_id).toBe(DELETED_USER_ID);
	});

	it('leaves other accounts’ comments alone', async () => {
		await createComment(db, {
			slug: 'best-movies',
			userId: bob.id,
			parentId: null,
			body: 'Bob stays',
		});
		await detachUserComments(db, alice.id);
		expect((await listComments(db, 'best-movies', null))[0].body).toBe(
			'Bob stays'
		);
	});
});

describe('authorization helpers', () => {
	it('getCommentAuthorId names the author, and forgets a deleted one', async () => {
		const id = await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Hi',
		});
		expect(await getCommentAuthorId(db, id)).toBe(alice.id);
		await softDeleteComment(db, id, alice.id);
		expect(await getCommentAuthorId(db, id)).toBeNull();
		expect(await getCommentAuthorId(db, 'unknown')).toBeNull();
	});

	it('getCommentContext reports the template a comment belongs to', async () => {
		const id = await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Hi',
		});
		expect(await getCommentContext(db, id)).toEqual({
			slug: 'best-movies',
			isDeleted: false,
		});
		await softDeleteComment(db, id, alice.id);
		expect(await getCommentContext(db, id)).toEqual({
			slug: 'best-movies',
			isDeleted: true,
		});
		expect(await getCommentContext(db, 'unknown')).toBeNull();
	});

	it('parentOnSlug blocks a reply that points at another template’s comment', async () => {
		await insertTemplate(db, alice.id, { slug: 'best-games' });
		const id = await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Hi',
		});
		expect(await parentOnSlug(db, id, 'BEST-MOVIES')).toBe(true);
		expect(await parentOnSlug(db, id, 'best-games')).toBe(false);
		expect(await parentOnSlug(db, 'unknown', 'best-movies')).toBe(false);
	});
});

describe('applyVote', () => {
	let commentId: string;
	beforeEach(async () => {
		commentId = await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Vote on me',
		});
	});

	it('records an upvote and reflects it back to the voter', async () => {
		expect(await applyVote(db, bob.id, commentId, 1)).toEqual({
			up: 1,
			down: 0,
			myVote: 1,
		});
	});

	it('replaces a vote instead of stacking it', async () => {
		await applyVote(db, bob.id, commentId, 1);
		expect(await applyVote(db, bob.id, commentId, -1)).toEqual({
			up: 0,
			down: 1,
			myVote: -1,
		});
	});

	it('clears a vote with 0', async () => {
		await applyVote(db, bob.id, commentId, 1);
		expect(await applyVote(db, bob.id, commentId, 0)).toEqual({
			up: 0,
			down: 0,
			myVote: 0,
		});
	});

	it('counts one vote per user', async () => {
		const carol = await insertUser(db, { username: 'carol' });
		await applyVote(db, bob.id, commentId, 1);
		await applyVote(db, bob.id, commentId, 1);
		const result = await applyVote(db, carol.id, commentId, 1);
		expect(result.up).toBe(2);
	});

	it('recomputes the counters from the vote rows, healing any drift', async () => {
		await applyVote(db, bob.id, commentId, 1);
		await db
			.prepare('UPDATE comments SET up_votes = 999, down_votes = 42')
			.run();

		const carol = await insertUser(db, { username: 'carol' });
		expect(await applyVote(db, carol.id, commentId, 1)).toEqual({
			up: 2,
			down: 0,
			myVote: 1,
		});
	});

	it('shows each reader their own vote and nobody else’s', async () => {
		await applyVote(db, bob.id, commentId, -1);
		const [forBob] = await listComments(db, 'best-movies', bob.id);
		const [forAlice] = await listComments(db, 'best-movies', alice.id);
		expect(forBob.myVote).toBe(-1);
		expect(forAlice.myVote).toBe(0);
		expect(forAlice.down).toBe(1);
	});

	it('drops a voter’s votes with their account, and heals the counters', async () => {
		await applyVote(db, bob.id, commentId, 1);
		await db.prepare('DELETE FROM users WHERE id = ?').bind(bob.id).run();

		const carol = await insertUser(db, { username: 'carol' });
		expect((await applyVote(db, carol.id, commentId, 1)).up).toBe(1);
	});
});

describe('getComment', () => {
	it('returns the freshly created comment on its own, at depth 0', async () => {
		const root = await createComment(db, {
			slug: 'best-movies',
			userId: alice.id,
			parentId: null,
			body: 'Root',
		});
		const replyId = await createComment(db, {
			slug: 'best-movies',
			userId: bob.id,
			parentId: root,
			body: 'Reply',
		});

		const comment = await getComment(db, replyId, bob.id);
		expect(comment?.body).toBe('Reply');
		expect(comment?.depth).toBe(0);
		expect(comment?.mine).toBe(true);
	});

	it('is null for an unknown id', async () => {
		expect(await getComment(db, 'nope', alice.id)).toBeNull();
	});
});
