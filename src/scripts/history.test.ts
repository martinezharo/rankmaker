import { describe, it, expect } from 'vitest';
import {
	addToPlayed,
	upsertHistory,
	historyToList,
	type HistoryEntry,
} from './history';

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
