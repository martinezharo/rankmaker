import { describe, it, expect, beforeEach } from 'vitest';
import {
	addToPlayed,
	upsertHistory,
	historyToList,
	mergeHistory,
	reconcileMovedHistoryEntries,
	getLocalResult,
	setPendingResult,
	consumePendingResult,
	setForceFresh,
	consumeForceFresh,
	saveResult,
	upsertExcluded,
	getExcludedIds,
	setExcludedIds,
	type HistoryEntry,
} from './history';

// Minimal in-memory Storage stub — the unit env is plain Node (no DOM), and the
// storage wrappers in history.ts are fail-safe, so we inject globals to exercise
// the happy paths.
function memStorage(): Storage {
	const m = new Map<string, string>();
	return {
		getItem: (k) => (m.has(k) ? m.get(k)! : null),
		setItem: (k, v) => void m.set(k, String(v)),
		removeItem: (k) => void m.delete(k),
		clear: () => m.clear(),
		key: (i) => Array.from(m.keys())[i] ?? null,
		get length() {
			return m.size;
		},
	} as Storage;
}

const entry = (slug: string, ts: number): HistoryEntry => ({
	slug,
	title: slug.toUpperCase(),
	result: [{ id: 1, name: 'a', image: 'x' }],
	ts,
});

describe('addToPlayed', () => {
	it('appends new slugs', () => {
		expect(addToPlayed(['a'], 'b')).toEqual(['a', 'b']);
	});

	it('de-dupes and moves an existing slug to most-recent (last)', () => {
		expect(addToPlayed(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a']);
	});

	it('caps the list to the 500 most recent', () => {
		const many = Array.from({ length: 500 }, (_, i) => `s${i}`);
		const next = addToPlayed(many, 'new');
		expect(next).toHaveLength(500);
		expect(next.at(-1)).toBe('new');
		expect(next.includes('s0')).toBe(false); // oldest dropped
	});
});

describe('upsertHistory', () => {
	it('inserts a new entry', () => {
		const map = upsertHistory({}, entry('a', 1));
		expect(Object.keys(map)).toEqual(['a']);
	});

	it('overwrites the same slug (latest wins)', () => {
		let map = upsertHistory({}, entry('a', 1));
		map = upsertHistory(map, { ...entry('a', 2), title: 'NEW' });
		expect(Object.keys(map)).toEqual(['a']);
		expect(map.a.title).toBe('NEW');
		expect(map.a.ts).toBe(2);
	});

	it('truncates oversized results', () => {
		const big = Array.from({ length: 300 }, (_, i) => ({
			id: i,
			name: `n${i}`,
			image: 'x',
		}));
		const map = upsertHistory({}, { ...entry('a', 1), result: big });
		expect(map.a.result).toHaveLength(200);
	});
});

describe('historyToList', () => {
	it('returns entries newest first', () => {
		const map = {
			a: entry('a', 1),
			b: entry('b', 3),
			c: entry('c', 2),
		};
		expect(historyToList(map).map((e) => e.slug)).toEqual(['b', 'c', 'a']);
	});
});

describe('mergeHistory', () => {
	it('keeps the newest copy of each slug and sorts the combined list', () => {
		const server = [entry('shared', 10), entry('server-only', 30)];
		const local = [
			{ ...entry('shared', 20), title: 'LOCAL NEWER' },
			entry('local-only', 40),
		];

		const merged = mergeHistory(server, local);
		expect(merged.map((item) => item.slug)).toEqual([
			'local-only',
			'server-only',
			'shared',
		]);
		expect(merged.find((item) => item.slug === 'shared')?.title).toBe(
			'LOCAL NEWER'
		);
	});

	it('keeps the server copy when it is equally recent', () => {
		const server = { ...entry('a', 10), title: 'SERVER' };
		const local = { ...entry('a', 10), title: 'LOCAL' };
		expect(mergeHistory([server], [local])).toEqual([server]);
	});
});

describe('reconcileMovedHistoryEntries', () => {
	it('removes the old local slug when D1 has the same snapshot under a new slug', () => {
		const local = entry('old-slug', 1_000);
		const server = { ...local, slug: 'new-secret-slug', ts: 1_500 };
		expect(reconcileMovedHistoryEntries([server], [local])).toEqual({
			entries: [],
			movedSlugs: ['old-slug'],
		});
	});

	it('does not conflate similar snapshots saved at unrelated times', () => {
		const local = entry('different-template', 1_000);
		const server = { ...local, slug: 'another-template', ts: 20_000 };
		expect(reconcileMovedHistoryEntries([server], [local])).toEqual({
			entries: [local],
			movedSlugs: [],
		});
	});
});

describe('localStorage-backed helpers', () => {
	beforeEach(() => {
		globalThis.localStorage = memStorage();
	});

	it('getLocalResult returns the saved entry for a slug', () => {
		saveResult('a', 'A', [{ id: 1, name: 'a', image: 'x' }]);
		const got = getLocalResult('a');
		expect(got?.slug).toBe('a');
		expect(got?.result).toHaveLength(1);
	});

	it('getLocalResult returns null for an unknown slug', () => {
		expect(getLocalResult('nope')).toBeNull();
	});

	it('getLocalResult returns null when storage is unavailable', () => {
		// @ts-expect-error — simulate missing storage
		delete globalThis.localStorage;
		expect(getLocalResult('a')).toBeNull();
	});
});

describe('sessionStorage handoff', () => {
	beforeEach(() => {
		globalThis.sessionStorage = memStorage();
	});

	it('consumePendingResult returns the entry when the slug matches', () => {
		setPendingResult(entry('a', 1));
		expect(consumePendingResult('a')?.slug).toBe('a');
	});

	it('consumePendingResult is one-shot (second read is null)', () => {
		setPendingResult(entry('a', 1));
		consumePendingResult('a');
		expect(consumePendingResult('a')).toBeNull();
	});

	it('consumePendingResult clears a stale handoff for a different slug', () => {
		setPendingResult(entry('a', 1));
		expect(consumePendingResult('b')).toBeNull(); // mismatch → null + cleared
		expect(consumePendingResult('a')).toBeNull(); // and gone
	});
});

describe('upsertExcluded', () => {
	it('sets and replaces a slug\'s excluded ids', () => {
		let map = upsertExcluded({}, 'a', [1, 2]);
		expect(map).toEqual({ a: [1, 2] });
		map = upsertExcluded(map, 'a', [3]);
		expect(map).toEqual({ a: [3] });
	});

	it('removes the entry when ids is empty', () => {
		const map = upsertExcluded({ a: [1], b: [2] }, 'a', []);
		expect(map).toEqual({ b: [2] });
	});

	it('caps the map by dropping the longest-standing slugs', () => {
		let map: Record<string, (number | string)[]> = {};
		for (let i = 0; i < 205; i++) {
			map = upsertExcluded(map, `s${i}`, [1]);
		}
		expect(Object.keys(map).length).toBe(200);
		expect(map['s0']).toBeUndefined();
		expect(map['s204']).toEqual([1]);
	});

	it('does not mutate the input map', () => {
		const orig = { a: [1] };
		upsertExcluded(orig, 'a', [2]);
		expect(orig).toEqual({ a: [1] });
	});
});

describe('excluded ids storage', () => {
	beforeEach(() => {
		globalThis.localStorage = memStorage();
	});

	it('round-trips ids per slug and clears on empty', () => {
		expect(getExcludedIds('a')).toEqual([]);
		setExcludedIds('a', [1, 'x']);
		setExcludedIds('b', [2]);
		expect(getExcludedIds('a')).toEqual([1, 'x']);
		expect(getExcludedIds('b')).toEqual([2]);
		setExcludedIds('a', []);
		expect(getExcludedIds('a')).toEqual([]);
		expect(getExcludedIds('b')).toEqual([2]);
	});
});

describe('force-fresh flag', () => {
	beforeEach(() => {
		globalThis.sessionStorage = memStorage();
	});

	it('consumeForceFresh is true for the flagged slug, then one-shot', () => {
		setForceFresh('a');
		expect(consumeForceFresh('a')).toBe(true);
		expect(consumeForceFresh('a')).toBe(false); // cleared
	});

	it('consumeForceFresh is false (and clears) for a different slug', () => {
		setForceFresh('a');
		expect(consumeForceFresh('b')).toBe(false);
		expect(consumeForceFresh('a')).toBe(false); // cleared by the mismatch read
	});
});
