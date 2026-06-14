/**
 * Pure, framework-free helpers for the template comments feature, shared by the
 * server (src/lib/comments.ts) and the client controller in
 * components/ranking/RankingComments.astro. Kept side-effect free so it can be
 * unit-tested with Vitest (see comments.test.ts).
 *
 * Threading rule: comments nest under their real parent, but the *visual* depth
 * is capped (MAX_DEPTH) so deep chains flatten to a fixed indentation on mobile.
 * Ordering rule (product decision): root threads are ranked by total vote
 * volume — up + down, regardless of sign — then most-recent first; replies read
 * chronologically (oldest first) so a conversation flows top to bottom.
 */

/** Visual indentation cap. Logical nesting is preserved; indent stops here. */
export const MAX_DEPTH = 3;

/** Server-side validation bounds (kept here so tests can assert against them). */
export const MAX_BODY_LEN = 2000;
export const MAX_RESULT_ITEMS = 200;

export type RankedItem = { id: number | string; name: string; image: string };

export type CommentAuthor = {
	username: string;
	avatar: string;
	isVerified: boolean;
};

/** Flat comment as it comes out of D1, before tree assembly. */
export type FlatComment = {
	id: string;
	parentId: string | null;
	author: CommentAuthor | null;
	body: string;
	createdAt: string;
	isDeleted: boolean;
	up: number;
	down: number;
	myVote: number; // -1 | 0 | 1
	mine: boolean;
	result: RankedItem[] | null;
};

/** A comment ready to render: derived fields + capped visual depth. */
export type CommentNode = FlatComment & {
	score: number; // up - down, the number shown between the vote arrows
	topPick: RankedItem | null; // result[0] — the author's #1 pick
	depth: number; // capped at MAX_DEPTH
};

export function totalVotes(c: { up: number; down: number }): number {
	return c.up + c.down;
}

function toNode(c: FlatComment, depth: number): CommentNode {
	return {
		...c,
		score: c.up - c.down,
		topPick: c.result && c.result.length > 0 ? c.result[0] : null,
		depth: Math.min(depth, MAX_DEPTH),
	};
}

/**
 * Turn a flat list of comments into a pre-order flat list ready for rendering:
 * each reply immediately follows its parent and carries a (capped) `depth`.
 * Roots are ordered by total vote volume desc then newest; replies oldest-first.
 * Orphans (parent missing/deleted-away) are treated as roots so nothing is lost.
 */
export function arrangeComments(flat: FlatComment[]): CommentNode[] {
	const byId = new Set(flat.map((c) => c.id));
	const childrenOf = new Map<string | null, FlatComment[]>();
	for (const c of flat) {
		const parent =
			c.parentId && byId.has(c.parentId) ? c.parentId : null;
		const arr = childrenOf.get(parent);
		if (arr) arr.push(c);
		else childrenOf.set(parent, [c]);
	}

	const rootCmp = (a: FlatComment, b: FlatComment) =>
		totalVotes(b) - totalVotes(a) ||
		b.createdAt.localeCompare(a.createdAt) ||
		a.id.localeCompare(b.id);
	const replyCmp = (a: FlatComment, b: FlatComment) =>
		a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

	const out: CommentNode[] = [];
	const walk = (parent: string | null, depth: number) => {
		const kids = childrenOf.get(parent);
		if (!kids) return;
		kids.sort(depth === 0 ? rootCmp : replyCmp);
		for (const kid of kids) {
			out.push(toNode(kid, depth));
			walk(kid.id, depth + 1);
		}
	};
	walk(null, 0);
	return out;
}
