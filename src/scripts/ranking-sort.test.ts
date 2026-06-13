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

// Deterministic PRNG so a fuzz failure is reproducible from its seed.
function mulberry32(seed: number): () => number {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// These guard the core promise of the app: the battle engine must always reach
// a correct full ranking, never re-show a settled matchup, and never balloon the
// number of battles. They drive mergeSort exactly as the page does — consult the
// comparison store, only "ask" (count) when the pair is unknown, record, repeat.
// One ranking trial: a strict ground-truth order (ranks 0..n-1), an arbitrary
// starting order, driven through mergeSort the way the page does. Asserts the
// engine's core guarantees and returns the human-battle count.
async function runRankingTrial(
	rnd: () => number,
	n: number,
	label: string
): Promise<void> {
	const ranks = shuffle([...Array(n).keys()], rnd);
	const items = ranks.map((rank, i) => ({ id: i + 1, rank }));
	const ids = items.map((it) => it.id);
	const input = shuffle(items, rnd);

	const map: CompMap = {};
	const asked = new Set<string>();
	let asks = 0;
	const compare = async (a: (typeof items)[0], b: (typeof items)[0]) => {
		const known = getKnownResult(map, a.id, b.id);
		if (known !== 0) return known > 0 ? -1 : 1; // auto-resolved, no battle shown
		const key = compKey(a.id, b.id);
		// A matchup the user already settled must never reappear.
		expect(asked.has(key), `repeated battle ${key} (${label})`).toBe(false);
		asked.add(key);
		asks++;
		const aWins = a.rank < b.rank;
		recordResult(map, ids, a.id, b.id, aWins);
		return aWins ? -1 : 1;
	};

	const ranked = await mergeSort(input, compare);

	// Every option present exactly once, in the exact correct order.
	expect(ranked.length, label).toBe(n);
	expect(ranked.map((it) => it.rank), label).toEqual([...Array(n).keys()]);
	// Transitivity must never push battles past merge sort's own comparison count.
	expect(asks, label).toBeLessThanOrEqual(n * Math.ceil(Math.log2(n)));
}

describe('battle engine invariants', () => {
	it('fuzz: exact ranking, no repeated/excess battles (sizes 4–16)', async () => {
		for (let seed = 1; seed <= 200; seed++) {
			const rnd = mulberry32(seed);
			const n = 4 + Math.floor(rnd() * 13); // 4..16 options
			await runRankingTrial(rnd, n, `seed ${seed}`);
		}
	}, 20_000);

	it('holds for large rankings up to the 50-option max', async () => {
		for (const seed of [101, 202, 303]) {
			const rnd = mulberry32(seed);
			const n = 40 + Math.floor(rnd() * 11); // 40..50 options
			await runRankingTrial(rnd, n, `large seed ${seed}`);
		}
	}, 30_000);

	it('asks zero battles when the full order is already known', async () => {
		const items = [3, 1, 2, 5, 4].map((rank, i) => ({ id: i + 1, rank }));
		const ids = items.map((it) => it.id);
		const map: CompMap = {};
		// Seed only adjacent results; transitive closure fills in the rest.
		const byRank = [...items].sort((a, b) => a.rank - b.rank);
		for (let i = 0; i < byRank.length - 1; i++) {
			recordResult(map, ids, byRank[i].id, byRank[i + 1].id, true);
		}

		let asks = 0;
		const compare = async (a: (typeof items)[0], b: (typeof items)[0]) => {
			const known = getKnownResult(map, a.id, b.id);
			if (known !== 0) return known > 0 ? -1 : 1;
			asks++; // would surface a battle to the user
			return a.rank < b.rank ? -1 : 1;
		};

		const ranked = await mergeSort(items, compare);
		expect(asks).toBe(0);
		// ranks are the values [3,1,2,5,4]; sorted ascending → [1,2,3,4,5].
		expect(ranked.map((it) => it.rank)).toEqual([1, 2, 3, 4, 5]);
	});
});
