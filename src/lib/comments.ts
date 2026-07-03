/**
 * D1 access layer for template comments + the generic `votes` table.
 *
 * Mirrors the query/style conventions of src/lib/counts.ts and
 * src/lib/templates.ts. Pure shaping/ordering lives in src/scripts/comments.ts
 * (unit-tested); this module only talks to the database and maps rows.
 */
import { randomHex } from './auth';
import {
	arrangeComments,
	MAX_BODY_LEN,
	MAX_RESULT_ITEMS,
	MAX_ROOT_THREADS,
	type CommentNode,
	type FlatComment,
	type RankedItem,
} from '../scripts/comments';

export { MAX_BODY_LEN, MAX_RESULT_ITEMS };
export type { CommentNode, RankedItem };

export const VOTE_SUBJECT_COMMENT = 'comment';

// Permanent placeholder account (see migrations/0012_deleted_user_placeholder.sql)
// that absorbs a deleted user's comments — see detachUserComments below.
export const DELETED_USER_ID = 'deleted-user';

type CommentRow = {
	id: string;
	parent_id: string | null;
	user_id: string;
	body: string;
	result: string | null;
	up_votes: number;
	down_votes: number;
	is_deleted: number;
	created_at: string;
	username: string;
	avatar: string;
	is_verified: number;
	my_vote: number | null;
};

function parseResult(raw: string | null): RankedItem[] | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as RankedItem[]) : null;
	} catch {
		return null;
	}
}

/**
 * The comments on `slug`, assembled into the render-ready pre-order list.
 * Bounded: only the top MAX_ROOT_THREADS root threads (in display order —
 * total vote volume desc, then newest) are fetched, each with ALL its replies,
 * so a popular thread can't grow the query without bound and no reply is ever
 * orphaned from its parent. `currentUserId` (when logged in) joins in that
 * user's vote per comment and flags their own comments. Deleted comments are
 * kept (their replies need a parent) but stripped of author/body/result.
 */
export async function listComments(
	db: D1Database,
	slug: string,
	currentUserId: string | null
): Promise<CommentNode[]> {
	const { results } = await db
		.prepare(
			`WITH RECURSIVE roots AS (
			   SELECT id FROM comments
			   WHERE slug = ? AND parent_id IS NULL
			   ORDER BY (up_votes + down_votes) DESC, created_at DESC, id ASC
			   LIMIT ?
			 ),
			 thread AS (
			   SELECT id FROM roots
			   UNION ALL
			   SELECT c.id FROM comments c JOIN thread t ON c.parent_id = t.id
			 )
			 SELECT c.id, c.parent_id, c.user_id, c.body, rr.result AS result,
			        c.up_votes, c.down_votes, c.is_deleted, c.created_at,
			        u.username, u.avatar, u.is_verified,
			        v.value AS my_vote
			 FROM thread
			 JOIN comments c ON c.id = thread.id
			 JOIN users u ON u.id = c.user_id
			 LEFT JOIN votes v
			   ON v.subject_type = 'comment' AND v.subject_id = c.id
			      AND v.user_id = ?
			 LEFT JOIN ranking_results rr
			   ON rr.user_id = c.user_id AND rr.slug = c.slug`
		)
		.bind(slug, MAX_ROOT_THREADS, currentUserId ?? '')
		.all<CommentRow>();

	const flat: FlatComment[] = results.map((r) => {
		const deleted = r.is_deleted === 1;
		return {
			id: r.id,
			parentId: r.parent_id,
			author: deleted
				? null
				: {
						username: r.username,
						avatar: r.avatar,
						isVerified: r.is_verified === 1,
					},
			body: deleted ? '' : r.body,
			createdAt: r.created_at,
			isDeleted: deleted,
			up: r.up_votes,
			down: r.down_votes,
			myVote: r.my_vote ?? 0,
			mine: currentUserId !== null && r.user_id === currentUserId,
			result: deleted ? null : parseResult(r.result),
		};
	});

	return arrangeComments(flat);
}

/** A single comment shaped for an API response after create. */
export async function getComment(
	db: D1Database,
	id: string,
	currentUserId: string | null
): Promise<CommentNode | null> {
	const { results } = await db
		.prepare(
			`SELECT c.id, c.parent_id, c.user_id, c.body, rr.result AS result,
			        c.up_votes, c.down_votes, c.is_deleted, c.created_at,
			        u.username, u.avatar, u.is_verified,
			        v.value AS my_vote
			 FROM comments c
			 JOIN users u ON u.id = c.user_id
			 LEFT JOIN votes v
			   ON v.subject_type = 'comment' AND v.subject_id = c.id
			      AND v.user_id = ?
			 LEFT JOIN ranking_results rr
			   ON rr.user_id = c.user_id AND rr.slug = c.slug
			 WHERE c.id = ?`
		)
		.bind(currentUserId ?? '', id)
		.all<CommentRow>();
	const nodes = arrangeComments(
		results.map((r) => ({
			id: r.id,
			parentId: null, // standalone — render at depth 0
			author: {
				username: r.username,
				avatar: r.avatar,
				isVerified: r.is_verified === 1,
			},
			body: r.body,
			createdAt: r.created_at,
			isDeleted: r.is_deleted === 1,
			up: r.up_votes,
			down: r.down_votes,
			myVote: r.my_vote ?? 0,
			mine: currentUserId !== null && r.user_id === currentUserId,
			result: parseResult(r.result),
		}))
	);
	return nodes[0] ?? null;
}

/** Author (user id) of a comment, or null if it doesn't exist / is deleted. */
export async function getCommentAuthorId(
	db: D1Database,
	commentId: string
): Promise<string | null> {
	const row = await db
		.prepare(
			'SELECT user_id FROM comments WHERE id = ? AND is_deleted = 0'
		)
		.bind(commentId)
		.first<{ user_id: string }>();
	return row?.user_id ?? null;
}

/** Does `parentId` exist on this slug? (Reject cross-template replies.) */
export async function parentOnSlug(
	db: D1Database,
	parentId: string,
	slug: string
): Promise<boolean> {
	const row = await db
		.prepare('SELECT 1 AS x FROM comments WHERE id = ? AND slug = ?')
		.bind(parentId, slug)
		.first();
	return row !== null;
}

export async function createComment(
	db: D1Database,
	input: {
		slug: string;
		userId: string;
		parentId: string | null;
		body: string;
	}
): Promise<string> {
	const id = randomHex(16);
	// The author's ranking is resolved live from ranking_results at read time
	// (see listComments), so a comment never stores its own result snapshot —
	// it appears automatically once they've ranked, and tracks any re-rank.
	await db
		.prepare(
			`INSERT INTO comments (id, slug, user_id, parent_id, body)
			 VALUES (?, ?, ?, ?, ?)`
		)
		.bind(id, input.slug, input.userId, input.parentId, input.body)
		.run();
	return id;
}

/**
 * Soft-delete a comment, only if it belongs to `userId`. Body/result are
 * cleared so a deleted comment leaks nothing while still anchoring its replies.
 * Returns true when a row was actually deleted.
 */
export async function softDeleteComment(
	db: D1Database,
	id: string,
	userId: string
): Promise<boolean> {
	const res = await db
		.prepare(
			`UPDATE comments
			 SET is_deleted = 1, body = '', result = NULL,
			     updated_at = datetime('now')
			 WHERE id = ? AND user_id = ? AND is_deleted = 0`
		)
		.bind(id, userId)
		.run();
	// D1 exposes affected rows via meta.changes on most adapters; fall back to
	// a re-check when unavailable.
	const changes = res.meta?.changes;
	if (typeof changes === 'number') return changes > 0;
	const row = await db
		.prepare('SELECT is_deleted FROM comments WHERE id = ? AND user_id = ?')
		.bind(id, userId)
		.first<{ is_deleted: number }>();
	return row?.is_deleted === 1;
}

/**
 * Detach every comment `userId` authored from their account, before that
 * account is deleted: soft-deletes them (same effect as softDeleteComment)
 * and reassigns ownership to the permanent "deleted user" placeholder.
 * `comments.user_id` cascades on delete, and so does `comments.parent_id` —
 * without this, deleting the user would hard-delete their own comment rows,
 * which would then cascade a second time through parent_id and wipe every
 * reply *other* users had written underneath them.
 */
export async function detachUserComments(
	db: D1Database,
	userId: string
): Promise<void> {
	await db.batch([
		db
			.prepare(
				`UPDATE comments
				 SET is_deleted = 1, body = '', result = NULL,
				     updated_at = datetime('now')
				 WHERE user_id = ? AND is_deleted = 0`
			)
			.bind(userId),
		db
			.prepare('UPDATE comments SET user_id = ? WHERE user_id = ?')
			.bind(DELETED_USER_ID, userId),
	]);
}

/**
 * Apply `value` (1 up, -1 down, 0 clears) as this user's vote on `commentId`,
 * keeping the denormalized up_votes/down_votes counters correct. Runs the vote
 * row change and counter adjustment in one batch. Returns fresh totals.
 */
export async function applyVote(
	db: D1Database,
	userId: string,
	commentId: string,
	value: number
): Promise<{ up: number; down: number; myVote: number }> {
	const prev = await db
		.prepare(
			`SELECT value FROM votes
			 WHERE user_id = ? AND subject_type = 'comment' AND subject_id = ?`
		)
		.bind(userId, commentId)
		.first<{ value: number }>();
	const prevValue = prev?.value ?? 0;

	if (value === prevValue) {
		const row = await db
			.prepare('SELECT up_votes, down_votes FROM comments WHERE id = ?')
			.bind(commentId)
			.first<{ up_votes: number; down_votes: number }>();
		return {
			up: row?.up_votes ?? 0,
			down: row?.down_votes ?? 0,
			myVote: prevValue,
		};
	}

	// Counter deltas: remove the old vote's contribution, add the new one's.
	const upDelta = (value === 1 ? 1 : 0) - (prevValue === 1 ? 1 : 0);
	const downDelta = (value === -1 ? 1 : 0) - (prevValue === -1 ? 1 : 0);

	const voteStmt =
		value === 0
			? db
					.prepare(
						`DELETE FROM votes
						 WHERE user_id = ? AND subject_type = 'comment' AND subject_id = ?`
					)
					.bind(userId, commentId)
			: db
					.prepare(
						`INSERT INTO votes (user_id, subject_type, subject_id, value)
						 VALUES (?, 'comment', ?, ?)
						 ON CONFLICT(user_id, subject_type, subject_id)
						 DO UPDATE SET value = excluded.value`
					)
					.bind(userId, commentId, value);

	const countStmt = db
		.prepare(
			`UPDATE comments
			 SET up_votes = MAX(0, up_votes + ?),
			     down_votes = MAX(0, down_votes + ?)
			 WHERE id = ?`
		)
		.bind(upDelta, downDelta, commentId);

	await db.batch([voteStmt, countStmt]);

	const row = await db
		.prepare('SELECT up_votes, down_votes FROM comments WHERE id = ?')
		.bind(commentId)
		.first<{ up_votes: number; down_votes: number }>();
	return {
		up: row?.up_votes ?? 0,
		down: row?.down_votes ?? 0,
		myVote: value,
	};
}
