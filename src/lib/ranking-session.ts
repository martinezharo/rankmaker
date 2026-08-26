/**
 * The ranking session: everything that happens between "Start ranking" and a
 * finished order, with no DOM in sight.
 *
 * This is the half of the ranking surface that decides *what to ask next* —
 * merge sort driven by human answers, transitive inference, deferred duels and
 * their forced final round, undo, mid-run option removal, and finishing early.
 * It used to be tangled through 1400 lines of DOM glue, which made the
 * behaviour that matters most to the product (as few matchups as possible, and
 * an order that is actually transitive) impossible to test on its own.
 *
 * The view's only jobs are to render `state` and to call the actions. Timing
 * belongs to the view: a pick is recorded the moment `pick()` is called, so the
 * component animates first and calls in when the animation is done.
 *
 * The comparison bookkeeping and the generic merge sort live one level down, in
 * src/scripts/ranking-sort.ts.
 */
import {
	compKey,
	getKnownResult,
	mergeSort,
	recordResult,
	type CompMap,
} from '../scripts/ranking-sort';

export interface RankingItem {
	id: number;
	name: string;
	image: string | null;
}

export interface Duel {
	a: RankingItem;
	b: RankingItem;
}

export interface BattleRecord {
	a: RankingItem;
	b: RankingItem;
	winner: RankingItem;
	roundNum: number;
}

export type SessionPhase = 'idle' | 'battling' | 'results';

export interface SessionState {
	phase: SessionPhase;
	/** The duel awaiting an answer, or null when nothing is being asked. */
	duel: Duel | null;
	/** Decisions made so far. Skips are deliberately not decisions. */
	round: number;
	/** Denominator for the progress read-out. */
	total: number;
	/** Deferred duels transitivity has still not settled. */
	pendingSkips: number;
	/** The forced final round, where deferring is disabled. */
	finalRound: boolean;
	canUndo: boolean;
	canSkip: boolean;
	/** Ids (as strings) the user removed from this ranking. */
	excluded: ReadonlySet<string>;
	history: readonly BattleRecord[];
	/** The finished order, once there is one. */
	ranked: readonly RankingItem[] | null;
}

/** A ranking needs at least this many options to mean anything. */
export const MIN_OPTIONS = 2;

interface Snapshot {
	comparisons: CompMap;
	historyLength: number;
	round: number;
	skipped: Record<string, true>;
}

export interface RankingSessionOptions {
	/** Called after every state change. */
	onChange: (state: SessionState) => void;
	/**
	 * Called when the user is about to be shown the forced final round, so the
	 * view can announce it. The sort waits for the returned promise.
	 */
	onFinalRound?: (pendingCount: number) => Promise<void> | void;
	/** Persist the exclusion set (localStorage — the page is publicly cached). */
	onExcludedChange?: (excluded: string[]) => void;
	/** Deterministic order for tests; defaults to a shuffle. */
	shuffle?: (items: RankingItem[]) => RankingItem[];
}

/**
 * Worst-case merge sort comparison count.
 *
 * An upper bound on purpose: transitive inference almost never short-circuits
 * a comparison on a fresh run (merge only ever pits not-yet-connected halves
 * against each other), so an optimistic estimate makes the progress bar
 * overshoot — "Round 16 of ~14".
 */
export function estimateComparisons(n: number): number {
	if (n < 2) return 0;
	return Math.ceil(n * Math.log2(n) - n + 1);
}

/**
 * Rank by win rate over the comparisons answered so far. Used when the user
 * finishes early, where there is no complete order to report — ties break on
 * the raw number of wins so a 3/3 outranks a 1/1.
 */
export function rankByWinRate(
	pool: readonly RankingItem[],
	comparisons: CompMap
): RankingItem[] {
	const scores = new Map<number, { wins: number; total: number }>();
	for (const item of pool) scores.set(item.id, { wins: 0, total: 0 });

	for (const [key, value] of Object.entries(comparisons)) {
		const [idA, idB] = key.split('-').map(Number) as [number, number];
		// The key convention is `min-max`, so a positive value means idA won.
		const [winner, loser] = value > 0 ? [idA, idB] : [idB, idA];
		const winnerScore = scores.get(winner);
		const loserScore = scores.get(loser);
		// Comparisons involving a removed option simply have no score entry.
		if (winnerScore) {
			winnerScore.wins++;
			winnerScore.total++;
		}
		if (loserScore) loserScore.total++;
	}

	const rate = (id: number) => {
		const score = scores.get(id)!;
		return score.total > 0 ? score.wins / score.total : 0.5;
	};

	return [...pool].sort((a, b) => {
		const diff = rate(b.id) - rate(a.id);
		if (diff !== 0) return diff;
		return scores.get(b.id)!.wins - scores.get(a.id)!.wins;
	});
}

export class RankingSession {
	readonly #items: readonly RankingItem[];
	readonly #itemIds: number[];
	readonly #options: RankingSessionOptions;

	#comparisons: CompMap = {};
	#history: BattleRecord[] = [];
	#undoStack: Snapshot[] = [];
	/** Deferred pairs, by comparison key. */
	#skipped: Record<string, true> = {};
	#excluded: Set<string>;

	#round = 0;
	#total = 0;
	#phase: SessionPhase = 'idle';
	#duel: Duel | null = null;
	#ranked: RankingItem[] | null = null;
	#finalRound = false;

	/** Resolver for the comparison currently on screen. */
	#answer: ((result: number) => void) | null = null;
	/** Bumped on every restart so an in-flight sort can be abandoned. */
	#generation = 0;
	/** The one shuffle a run uses, so undo replays the exact same tree. */
	#order: RankingItem[] = [];

	constructor(items: readonly RankingItem[], options: RankingSessionOptions) {
		this.#items = items;
		this.#itemIds = items.map((item) => item.id);
		this.#options = options;
		this.#excluded = new Set();
	}

	// ─── State ──────────────────────────────────────────────────────────────

	get state(): SessionState {
		return {
			phase: this.#phase,
			duel: this.#duel,
			round: this.#round,
			// The max() guards the rare case where deferring makes the forced
			// final round need a few extra duels, so it never reads
			// "Round 18 of ~17".
			total: Math.max(this.#total, this.#round),
			pendingSkips: this.#pendingSkipKeys().length,
			finalRound: this.#finalRound,
			canUndo: this.#undoStack.length > 0 && this.#answer !== null,
			canSkip: !this.#finalRound,
			excluded: this.#excluded,
			history: this.#history,
			ranked: this.#ranked,
		};
	}

	get activeItems(): RankingItem[] {
		return this.#items.filter((item) => !this.#excluded.has(String(item.id)));
	}

	/** Whether removing one more option would leave too few to rank. */
	get atMinimum(): boolean {
		return this.activeItems.length <= MIN_OPTIONS;
	}

	#emit(): void {
		this.#options.onChange(this.state);
	}

	// ─── Exclusions ─────────────────────────────────────────────────────────

	/**
	 * Adopt a previously persisted exclusion set. Stale ids (the template's
	 * options changed since) must never leave fewer than MIN_OPTIONS rankable,
	 * so an unusable set is dropped rather than allowed to strand the page.
	 */
	adoptExcluded(ids: readonly string[]): void {
		this.#excluded = new Set(ids.map(String));
		if (this.activeItems.length < MIN_OPTIONS) {
			this.#excluded = new Set();
			this.#options.onExcludedChange?.([]);
		}
		this.#emit();
	}

	exclude(id: number | string): void {
		if (this.atMinimum || this.#excluded.has(String(id))) return;
		this.#excluded.add(String(id));
		this.#options.onExcludedChange?.([...this.#excluded]);

		// Drop deferred duels involving the removed option so they can never
		// resurface in the forced final round.
		for (const key of Object.keys(this.#skipped)) {
			const [a, b] = key.split('-');
			if (a === String(id) || b === String(id)) delete this.#skipped[key];
		}

		// Removal is deliberately not undoable through the battle Undo button:
		// restoring a snapshot could resurrect skipped pairs for the removed
		// option. Restoring lives on the option card instead.
		this.#undoStack = [];

		if (this.#phase === 'battling') {
			this.#order = this.#order.filter((item) => String(item.id) !== String(id));
			this.#total = estimateComparisons(this.#order.length);
			// Same pattern as undo: cancel the pending duel and re-run,
			// fast-forwarding through everything already answered.
			this.#answer = null;
			void this.#run(!this.#finalRound);
		}
		this.#emit();
	}

	restore(id: number | string): void {
		if (!this.#excluded.delete(String(id))) return;
		this.#options.onExcludedChange?.([...this.#excluded]);
		this.#emit();
	}

	// ─── Running ────────────────────────────────────────────────────────────

	/** Begin a fresh ranking, discarding anything answered before. */
	start(): void {
		const pool = this.activeItems;
		this.#total = estimateComparisons(pool.length);
		this.#round = 0;
		this.#comparisons = {};
		this.#history = [];
		this.#undoStack = [];
		this.#skipped = {};
		this.#phase = 'battling';
		this.#ranked = null;
		this.#finalRound = false;
		const shuffle = this.#options.shuffle ?? defaultShuffle;
		this.#order = shuffle([...pool]);
		this.#emit();
		void this.#run(true);
	}

	/**
	 * `allowSkip = false` is the forced final round: deferring is disabled so
	 * every still-unsettled pair gets a real answer and the sort terminates
	 * with a clean total order.
	 */
	async #run(allowSkip: boolean): Promise<void> {
		this.#generation++;
		const generation = this.#generation;
		this.#finalRound = !allowSkip;
		this.#emit();

		try {
			const sorted = await mergeSort(
				[...this.#order],
				(a, b) => this.#compare(a, b, generation),
				() => generation !== this.#generation
			);
			if (generation !== this.#generation) return; // superseded

			const pending = this.#pendingSkipKeys();
			if (allowSkip && pending.length > 0) {
				// Deferred duels remain. The re-run fast-forwards through every
				// real pick, so only the unsettled skips (and any divergence
				// they cause) come back.
				await this.#options.onFinalRound?.(pending.length);
				if (generation !== this.#generation) return;
				return this.#run(false);
			}
			this.#finish(sorted);
		} catch {
			// Cancelled by an undo/removal restart — expected.
		}
	}

	/**
	 * The human-input bridge: resolve a pair from what is already known, or
	 * put it on screen and wait for an answer.
	 */
	#compare(a: RankingItem, b: RankingItem, generation: number): Promise<number> {
		const known = getKnownResult(this.#comparisons, a.id, b.id);
		if (known !== 0) return Promise.resolve(known > 0 ? -1 : 1);

		this.#round++;
		return new Promise((resolve, reject) => {
			if (generation !== this.#generation) {
				reject(new Error('cancelled'));
				return;
			}
			this.#answer = resolve;
			this.#duel = { a, b };
			this.#emit();
		});
	}

	#finish(ranked: readonly RankingItem[]): void {
		this.#answer = null;
		this.#duel = null;
		this.#ranked = [...ranked];
		this.#phase = 'results';
		this.#emit();
	}

	// ─── Answers ────────────────────────────────────────────────────────────

	/** Record the winner of the duel on screen and move on. */
	pick(side: 'a' | 'b'): void {
		const duel = this.#duel;
		const resolve = this.#answer;
		if (!duel || !resolve) return;

		this.#pushUndo();
		const aWins = side === 'a';
		recordResult(this.#comparisons, this.#itemIds, duel.a.id, duel.b.id, aWins);
		this.#history.push({
			a: duel.a,
			b: duel.b,
			winner: aWins ? duel.a : duel.b,
			roundNum: this.#round,
		});

		this.#answer = null;
		this.#duel = null;
		resolve(aWins ? -1 : 1);
	}

	/**
	 * Defer the duel on screen. It resolves provisionally (keep order) WITHOUT
	 * being recorded, so merge sort proceeds while transitive inference stays
	 * clean, and the pair comes back in the forced final round unless a later
	 * pick settles it.
	 */
	skip(): void {
		const duel = this.#duel;
		const resolve = this.#answer;
		if (!duel || !resolve || this.#finalRound) return;

		this.#pushUndo();
		this.#skipped[compKey(duel.a.id, duel.b.id)] = true;
		// A skip is not a decision — undo the round bump `#compare` made so the
		// progress counter tracks real decisions only.
		this.#round--;

		this.#answer = null;
		this.#duel = null;
		resolve(-1);
	}

	/** Take back the last pick or skip and re-ask it. */
	undo(): void {
		if (this.#undoStack.length === 0 || !this.#answer) return;

		const snapshot = this.#undoStack.pop()!;
		this.#comparisons = snapshot.comparisons;
		this.#history.length = snapshot.historyLength;
		this.#round = snapshot.round;
		this.#skipped = { ...snapshot.skipped };

		// Cancel the pending duel and restart. The restored comparisons make
		// transitive inference auto-answer everything already decided, which
		// fast-forwards straight back to the duel just undone.
		this.#answer = null;
		this.#emit();
		void this.#run(!this.#finalRound);
	}

	/** Stop here and rank on what has been answered so far. */
	finishEarly(): void {
		this.#generation++; // abandon the in-flight sort
		this.#finish(rankByWinRate(this.activeItems, this.#comparisons));
	}

	#pushUndo(): void {
		this.#undoStack.push({
			comparisons: { ...this.#comparisons },
			historyLength: this.#history.length,
			// The round *before* this duel was shown: `#compare` increments it
			// again when the undone duel is re-shown on replay, so storing the
			// post-increment value would drift the counter +1 per undo.
			round: this.#round - 1,
			skipped: { ...this.#skipped },
		});
	}

	/**
	 * Deferred pairs transitivity has not since settled. The settled ones are
	 * the opportunistic win — they never need re-asking.
	 */
	#pendingSkipKeys(): string[] {
		return Object.keys(this.#skipped).filter((key) => {
			const [a, b] = key.split('-').map(Number) as [number, number];
			return getKnownResult(this.#comparisons, a, b) === 0;
		});
	}
}

function defaultShuffle(items: RankingItem[]): RankingItem[] {
	return items.sort(() => Math.random() - 0.5);
}
