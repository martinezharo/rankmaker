import { describe, it, expect } from 'vitest';
import {
	compKey,
	getKnownResult,
	recordResult,
	mergeSort,
	type CompMap,
} from './ranking-sort';

describe('compKey', () => {
	it('is order-independent', () => {
		expect(compKey(1, 2)).toBe('1-2');
		expect(compKey(2, 1)).toBe('1-2');
	});
});

describe('getKnownResult', () => {
	it('returns 0 for unknown pairs', () => {
		expect(getKnownResult({}, 1, 2)).toBe(0);
	});

	it('orients the stored result to the queried direction', () => {
		const map: CompMap = {};
		recordResult(map, [1, 2], 1, 2, true); // 1 beats 2
		expect(getKnownResult(map, 1, 2)).toBeGreaterThan(0); // a=1 wins
		expect(getKnownResult(map, 2, 1)).toBeLessThan(0); // a=2 loses
	});

	it('records correctly regardless of id order of the inputs', () => {
		const map: CompMap = {};
		// Higher id passed first, and it loses → lower id (2) wins.
		recordResult(map, [2, 5], 5, 2, false);
		expect(getKnownResult(map, 2, 5)).toBeGreaterThan(0);
		expect(getKnownResult(map, 5, 2)).toBeLessThan(0);
	});
});

describe('transitive inference', () => {
	it('infers A>C from A>B and B>C', () => {
		const ids = [1, 2, 3];
		const map: CompMap = {};
		recordResult(map, ids, 1, 2, true); // 1 > 2
		recordResult(map, ids, 2, 3, true); // 2 > 3
		expect(getKnownResult(map, 1, 3)).toBeGreaterThan(0); // inferred 1 > 3
	});

	it('infers a full chain transitively', () => {
		const ids = [1, 2, 3, 4, 5];
		const map: CompMap = {};
		// Establish a strict chain 1 > 2 > 3 > 4 > 5 with adjacent comparisons.
		recordResult(map, ids, 1, 2, true);
		recordResult(map, ids, 2, 3, true);
		recordResult(map, ids, 3, 4, true);
		recordResult(map, ids, 4, 5, true);
		// Every non-adjacent pair should now be known by inference.
		expect(getKnownResult(map, 1, 5)).toBeGreaterThan(0);
		expect(getKnownResult(map, 1, 4)).toBeGreaterThan(0);
		expect(getKnownResult(map, 2, 5)).toBeGreaterThan(0);
		expect(getKnownResult(map, 5, 1)).toBeLessThan(0);
	});

	it('does not overwrite a real answer with an inference', () => {
		const ids = [1, 2, 3];
		const map: CompMap = {};
		recordResult(map, ids, 1, 2, true); // 1 > 2
		recordResult(map, ids, 2, 3, true); // 2 > 3 (infers 1 > 3)
		const before = getKnownResult(map, 1, 3);
		expect(before).toBeGreaterThan(0);
		// Re-recording the same direct answer keeps it stable.
		recordResult(map, ids, 1, 3, true);
		expect(getKnownResult(map, 1, 3)).toBeGreaterThan(0);
	});
});

describe('mergeSort', () => {
	const asc = async (a: number, b: number) => a - b;

	it('sorts a generic array', async () => {
		expect(await mergeSort([3, 1, 2, 5, 4], asc)).toEqual([1, 2, 3, 4, 5]);
	});

	it('handles empty and single-element arrays', async () => {
		expect(await mergeSort([], asc)).toEqual([]);
		expect(await mergeSort([42], asc)).toEqual([42]);
	});

	it('is stable for equal elements (left stays first)', async () => {
		const items = [
			{ id: 'a', k: 1 },
			{ id: 'b', k: 1 },
			{ id: 'c', k: 0 },
		];
		const out = await mergeSort(items, async (x, y) => x.k - y.k);
		expect(out.map((o) => o.id)).toEqual(['c', 'a', 'b']);
	});

	it('rejects when cancelled mid-sort', async () => {
		await expect(
			mergeSort([3, 1, 2], asc, () => true)
		).rejects.toThrow('cancelled');
	});

	it('drives the comparison store like the page does, and transitivity cuts human asks', async () => {
		// Ground truth: lower rank value = better = should come first.
		const items = [5, 3, 1, 4, 2].map((rank, i) => ({ id: i + 1, rank }));
		const ids = items.map((it) => it.id);
		const map: CompMap = {};
		let humanAsks = 0;

		const compare = async (a: typeof items[0], b: typeof items[0]) => {
			const known = getKnownResult(map, a.id, b.id);
			if (known !== 0) return known > 0 ? -1 : 1;
			// Unknown → would show the user a battle. Resolve by ground truth.
			humanAsks++;
			const aWins = a.rank < b.rank;
			recordResult(map, ids, a.id, b.id, aWins);
			return aWins ? -1 : 1;
		};

		const ranked = await mergeSort(items, compare);
		// Fully and correctly sorted by ground truth.
		expect(ranked.map((it) => it.rank)).toEqual([1, 2, 3, 4, 5]);
		// Transitive inference means we asked fewer than every possible pair.
		const totalPairs = (items.length * (items.length - 1)) / 2;
		expect(humanAsks).toBeLessThan(totalPairs);
	});
});
