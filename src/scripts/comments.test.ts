import { describe, it, expect } from 'vitest';
import {
	arrangeComments,
	totalVotes,
	MAX_DEPTH,
	type FlatComment,
} from './comments';

const base = (over: Partial<FlatComment>): FlatComment => ({
	id: 'x',
	parentId: null,
	author: { username: 'a', avatar: 'star-purple', isVerified: false },
	body: 'hi',
	createdAt: '2026-01-01T00:00:00Z',
	isDeleted: false,
	up: 0,
	down: 0,
	myVote: 0,
	mine: false,
	result: null,
	...over,
});

describe('totalVotes', () => {
	it('sums up and down regardless of sign', () => {
		expect(totalVotes({ up: 3, down: 5 })).toBe(8);
	});
});

describe('arrangeComments — root ordering', () => {
	it('orders roots by total vote volume (up+down), not net score', () => {
		// A: net +1 but only 1 vote; B: net -5 but 15 votes → B ranks first.
		const a = base({ id: 'a', up: 1, down: 0 });
		const b = base({ id: 'b', up: 5, down: 10 });
		const out = arrangeComments([a, b]);
		expect(out.map((c) => c.id)).toEqual(['b', 'a']);
	});

	it('breaks vote ties by most-recent first', () => {
		const older = base({ id: 'old', createdAt: '2026-01-01T00:00:00Z' });
		const newer = base({ id: 'new', createdAt: '2026-02-01T00:00:00Z' });
		const out = arrangeComments([older, newer]);
		expect(out.map((c) => c.id)).toEqual(['new', 'old']);
	});
});

describe('arrangeComments — threading', () => {
	it('places replies right after their parent, oldest first', () => {
		const root = base({ id: 'r', up: 0, down: 0 });
		const r2 = base({
			id: 'r2',
			parentId: 'r',
			createdAt: '2026-01-03T00:00:00Z',
		});
		const r1 = base({
			id: 'r1',
			parentId: 'r',
			createdAt: '2026-01-02T00:00:00Z',
		});
		const out = arrangeComments([root, r2, r1]);
		expect(out.map((c) => c.id)).toEqual(['r', 'r1', 'r2']);
		expect(out.map((c) => c.depth)).toEqual([0, 1, 1]);
	});

	it('caps visual depth at MAX_DEPTH while keeping pre-order', () => {
		// Build a single deep chain a -> b -> c -> ... beyond MAX_DEPTH.
		const chain: FlatComment[] = [];
		let parent: string | null = null;
		const ids: string[] = [];
		for (let i = 0; i < MAX_DEPTH + 3; i++) {
			const id = `n${i}`;
			ids.push(id);
			chain.push(base({ id, parentId: parent }));
			parent = id;
		}
		const out = arrangeComments(chain);
		expect(out.map((c) => c.id)).toEqual(ids);
		// Depth increases then clamps at MAX_DEPTH.
		expect(out[0].depth).toBe(0);
		expect(out[MAX_DEPTH].depth).toBe(MAX_DEPTH);
		expect(out[out.length - 1].depth).toBe(MAX_DEPTH);
	});

	it('treats comments with a missing parent as roots', () => {
		const orphan = base({ id: 'o', parentId: 'gone' });
		const out = arrangeComments([orphan]);
		expect(out).toHaveLength(1);
		expect(out[0].depth).toBe(0);
	});
});

describe('arrangeComments — derived fields', () => {
	it('computes net score and topPick from the result snapshot', () => {
		const c = base({
			id: 'c',
			up: 7,
			down: 2,
			result: [
				{ id: 1, name: 'Winner', image: 'w.png' },
				{ id: 2, name: 'Second', image: 's.png' },
			],
		});
		const [node] = arrangeComments([c]);
		expect(node.score).toBe(5);
		expect(node.topPick).toEqual({ id: 1, name: 'Winner', image: 'w.png' });
	});

	it('has a null topPick when there is no attached result', () => {
		const [node] = arrangeComments([base({ result: null })]);
		expect(node.topPick).toBeNull();
	});
});
