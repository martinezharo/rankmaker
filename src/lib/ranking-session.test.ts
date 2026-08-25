import { describe, expect, it, vi } from 'vitest';
import {
	estimateComparisons,
	rankByWinRate,
	RankingSession,
	type RankingItem,
	type RankingSessionOptions,
	type SessionState,
} from './ranking-session';

function items(n: number): RankingItem[] {
	return Array.from({ length: n }, (_, i) => ({
		id: i + 1,
		name: `Item ${i + 1}`,
		image: null,
	}));
}

/** Let the sort's promise chain advance — `mergeSort` is async by design. */
function flush(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Drives a session the way a person would. Paired with `lowerIdWins` this makes
 * the "true" order id-ascending, so a correct session must finish with exactly
 * that.
 */
function driver(pool: RankingItem[], extra: Partial<RankingSessionOptions> = {}) {
	const states: SessionState[] = [];
	const session = new RankingSession(pool, {
		onChange: (state) => states.push(state),
		// Deterministic: no shuffling, so runs are reproducible.
		shuffle: (list) => list,
		...extra,
	});
	const last = () => states[states.length - 1]!;

	/** Start, and wait for the first duel to be on screen. */
	async function begin(): Promise<void> {
		session.start();
		await flush();
	}

	/** Answer the duel on screen and wait for whatever comes next. */
	async function answer(choice: 'a' | 'b' | 'skip'): Promise<void> {
		if (choice === 'skip') session.skip();
		else session.pick(choice);
		await flush();
	}

	async function answerAll(
		pick: (state: SessionState) => 'a' | 'b' | 'skip'
	): Promise<void> {
		let guard = 500;
		while (last().duel && guard-- > 0) await answer(pick(last()));
		if (guard <= 0) throw new Error('session did not terminate');
	}

	return { session, states, last, begin, answer, answerAll };
}

const lowerIdWins = (state: SessionState): 'a' | 'b' =>
	state.duel!.a.id < state.duel!.b.id ? 'a' : 'b';

describe('estimateComparisons', () => {
	it('is zero below two options', () => {
		expect(estimateComparisons(0)).toBe(0);
		expect(estimateComparisons(1)).toBe(0);
	});

	it('is an upper bound, so the progress bar never overshoots', async () => {
		for (const n of [4, 8, 9, 16]) {
			const { last, begin, answerAll } = driver(items(n));
			await begin();
			await answerAll(lowerIdWins);
			expect(last().round).toBeLessThanOrEqual(estimateComparisons(n));
		}
	});
});

describe('a full ranking', () => {
	it('produces the consistent total order the answers imply', async () => {
		const { last, begin, answerAll } = driver(items(8));
		await begin();
		await answerAll(lowerIdWins);

		expect(last().phase).toBe('results');
		expect(last().ranked!.map((i) => i.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
	});

	it('asks far fewer duels than every possible pair', async () => {
		const n = 8;
		const { last, begin, answerAll } = driver(items(n));
		await begin();
		await answerAll(lowerIdWins);

		const everyPair = (n * (n - 1)) / 2; // 28
		expect(last().round).toBeLessThan(everyPair);
	});

	it('never asks the same pair twice', async () => {
		const { last, begin, answerAll } = driver(items(8));
		await begin();
		const asked: string[] = [];
		await answerAll((state) => {
			const { a, b } = state.duel!;
			asked.push(a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`);
			return lowerIdWins(state);
		});
		expect(new Set(asked).size).toBe(asked.length);
	});

	it('records every answered duel in the history', async () => {
		const { last, begin, answerAll } = driver(items(6));
		await begin();
		await answerAll(lowerIdWins);
		expect(last().history).toHaveLength(last().round);
		for (const battle of last().history) {
			expect(battle.winner.id).toBe(Math.min(battle.a.id, battle.b.id));
		}
	});
});

describe('skipping', () => {
	it('does not count a skip as a decision', async () => {
		const { last, begin, answer } = driver(items(4));
		await begin();
		const before = last().round;
		await answer('skip');
		// One skip out, one fresh duel in: net zero real decisions.
		expect(last().round).toBe(before);
	});

	it('re-asks unsettled pairs in a forced final round, then finishes', async () => {
		const onFinalRound = vi.fn(() => Promise.resolve());
		const { last, begin, answer, answerAll } = driver(items(4), { onFinalRound });

		await begin();
		await answer('skip');
		await answerAll(lowerIdWins);

		expect(last().phase).toBe('results');
		expect(onFinalRound).toHaveBeenCalled();
		expect(last().pendingSkips).toBe(0);
		expect(last().ranked!.map((i) => i.id)).toEqual([1, 2, 3, 4]);
	});

	it('never finishes with a deferred pair still unresolved', async () => {
		const { last, begin, answer, answerAll } = driver(items(6), {
			onFinalRound: () => Promise.resolve(),
		});
		await begin();
		await answer('skip');
		expect(last().pendingSkips).toBe(1);

		await answerAll(lowerIdWins);

		// Either transitivity settled it or the final round re-asked it — what
		// must never happen is finishing with it still pending.
		expect(last().pendingSkips).toBe(0);
		expect(last().phase).toBe('results');
	});

	it('refuses to skip during the forced final round', async () => {
		const { session, last, begin, answer } = driver(items(4), {
			onFinalRound: () => Promise.resolve(),
		});
		await begin();
		await answer('skip');

		let guard = 100;
		while (last().duel && !last().finalRound && guard-- > 0) {
			await answer(lowerIdWins(last()));
		}
		expect(last().finalRound).toBe(true);
		expect(last().canSkip).toBe(false);

		const round = last().round;
		session.skip(); // must be a no-op
		expect(last().round).toBe(round);
		expect(last().duel).not.toBeNull();
	});
});

describe('undo', () => {
	it('takes back the last pick and re-asks that duel', async () => {
		const { session, last, begin, answer } = driver(items(6));
		await begin();
		const first = last().duel!;
		const firstRound = last().round;
		await answer('a');

		session.undo();
		await flush();

		expect(last().duel!.a.id).toBe(first.a.id);
		expect(last().duel!.b.id).toBe(first.b.id);
		expect(last().history).toHaveLength(0);
		// Back on the duel that was undone, so the counter reads its round
		// again — it must not drift upward across the undo/replay cycle.
		expect(last().round).toBe(firstRound);
	});

	it('is unavailable before anything has been answered', async () => {
		const { last, begin, answer } = driver(items(4));
		await begin();
		expect(last().canUndo).toBe(false);
		await answer('a');
		expect(last().canUndo).toBe(true);
	});

	it('still reaches a consistent order after undoing repeatedly', async () => {
		const { session, last, begin, answer, answerAll } = driver(items(6));
		await begin();
		await answer('b'); // deliberately "wrong"
		session.undo();
		await flush();
		await answer('b');
		session.undo();
		await flush();
		await answerAll(lowerIdWins);
		expect(last().ranked!.map((i) => i.id)).toEqual([1, 2, 3, 4, 5, 6]);
	});
});

describe('removing options', () => {
	it('drops the option from the result', async () => {
		const { session, last, begin, answerAll } = driver(items(5));
		session.exclude(3);
		await begin();
		await answerAll(lowerIdWins);
		expect(last().ranked!.map((i) => i.id)).toEqual([1, 2, 4, 5]);
	});

	it('refuses to go below two rankable options', () => {
		const { session, last } = driver(items(3));
		session.exclude(1);
		expect(session.activeItems).toHaveLength(2);
		session.exclude(2); // would leave one
		expect(session.activeItems).toHaveLength(2);
		expect(last().excluded.has('2')).toBe(false);
	});

	it('restores a removed option', () => {
		const { session, last } = driver(items(4));
		session.exclude(2);
		expect(last().excluded.has('2')).toBe(true);
		session.restore(2);
		expect(last().excluded.has('2')).toBe(false);
	});

	it('discards a persisted exclusion set that would strand the ranking', () => {
		const onExcludedChange = vi.fn();
		const session = new RankingSession(items(3), {
			onChange: () => {},
			onExcludedChange,
		});
		session.adoptExcluded(['1', '2']); // would leave a single option
		expect(session.activeItems).toHaveLength(3);
		expect(onExcludedChange).toHaveBeenCalledWith([]);
	});

	it('keeps a persisted exclusion set that still leaves enough', () => {
		const session = new RankingSession(items(5), { onChange: () => {} });
		session.adoptExcluded(['2', '4']);
		expect(session.activeItems.map((i) => i.id)).toEqual([1, 3, 5]);
	});

	it('removing mid-battle keeps the ranking going without that option', async () => {
		const { session, last, begin, answer, answerAll } = driver(items(6));
		await begin();
		await answer(lowerIdWins(last()));

		session.exclude(4);
		await flush();

		await answerAll(lowerIdWins);
		expect(last().phase).toBe('results');
		expect(last().ranked!.map((i) => i.id)).not.toContain(4);
		expect(last().ranked).toHaveLength(5);
	});
});

describe('finishing early', () => {
	it('ranks on what has been answered, keeping every active option', async () => {
		const { session, last, begin, answer } = driver(items(6));
		await begin();
		await answer(lowerIdWins(last()));
		await answer(lowerIdWins(last()));

		session.finishEarly();

		expect(last().phase).toBe('results');
		expect(last().ranked).toHaveLength(6);
	});

	it('stops asking once it has finished', async () => {
		const { session, last, begin, answer } = driver(items(6));
		await begin();
		await answer(lowerIdWins(last()));
		session.finishEarly();
		await flush();
		expect(last().duel).toBeNull();
		expect(last().phase).toBe('results');
	});
});

describe('rankByWinRate', () => {
	it('puts the option that won more of its duels first', () => {
		const pool = items(3);
		// 1 beats 2, 1 beats 3, 3 beats 2  →  1, 3, 2
		const ranked = rankByWinRate(pool, { '1-2': 1, '1-3': 1, '2-3': -1 });
		expect(ranked.map((i) => i.id)).toEqual([1, 3, 2]);
	});

	it('treats an option with no duels as even', () => {
		const pool = items(3);
		// 1 beats 2; option 3 never played, so it sits between them.
		const ranked = rankByWinRate(pool, { '1-2': 1 });
		expect(ranked.map((i) => i.id)).toEqual([1, 3, 2]);
	});

	it('ignores comparisons for options no longer in the pool', () => {
		const pool = items(3).filter((i) => i.id !== 2);
		const ranked = rankByWinRate(pool, { '1-2': 1, '2-3': 1, '1-3': 1 });
		expect(ranked.map((i) => i.id)).toEqual([1, 3]);
	});
});
