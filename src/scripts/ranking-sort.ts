/**
 * Ranking sort engine — pure, DOM-free logic extracted from the template page
 * (src/pages/template/[slug].astro) so it can be unit-tested in isolation.
 *
 * Split of responsibilities: the page owns the human-input bridge (which pair
 * to show on screen, click handling, animations); this module owns the
 * comparison bookkeeping (with transitive inference) and the generic merge
 * sort. The page drives `mergeSort` with an async `compare` that resolves when
 * the user clicks a card.
 *
 * `CompMap` is a plain object keyed by an order-independent pair key, value
 * 1 (lower id wins) | -1 (higher id wins). It's deliberately a plain object so
 * the page can snapshot/restore it for undo with a cheap shallow clone.
 */

export type CompMap = Record<string, 1 | -1>;

/** Order-independent key for a pair of item ids (`min-max`). */
export function compKey(a: number, b: number): string {
	return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/**
 * Known result of the pair, oriented as "does `aId` beat `bId`?":
 *   > 0 → a wins, < 0 → b wins, 0 → unknown.
 */
export function getKnownResult(map: CompMap, aId: number, bId: number): number {
	const v = map[compKey(aId, bId)];
	if (v === undefined) return 0;
	return aId < bId ? v : -v;
}

/** Record a result only if the pair is still unknown (used for inferences). */
function recordDirect(
	map: CompMap,
	aId: number,
	bId: number,
	aWins: boolean
): void {
	const key = compKey(aId, bId);
	if (map[key] !== undefined) return;
	map[key] = aId < bId ? (aWins ? 1 : -1) : aWins ? -1 : 1;
}

/**
 * Record that the (aId,bId) comparison resolved `aWins`, then derive every
 * comparison implied by transitivity over `ids` (A>B ∧ B>C ⇒ A>C). Mutates
 * `map`. The direct answer is set unconditionally (it's a real human input);
 * inferred results never overwrite an existing entry.
 */
export function recordResult(
	map: CompMap,
	ids: number[],
	aId: number,
	bId: number,
	aWins: boolean
): void {
	map[compKey(aId, bId)] =
		aId < bId ? (aWins ? 1 : -1) : aWins ? -1 : 1;
	propagateTransitive(map, ids);
}

/** Floyd–Warshall-style transitive closure over the current known results. */
function propagateTransitive(map: CompMap, ids: number[]): void {
	let changed = true;
	while (changed) {
		changed = false;
		for (const a of ids) {
			for (const b of ids) {
				if (a === b) continue;
				const ab = getKnownResult(map, a, b);
				if (ab === 0) continue;
				for (const c of ids) {
					if (c === a || c === b) continue;
					const bc = getKnownResult(map, b, c);
					if (bc === 0) continue;
					// A>B ∧ B>C ⇒ A>C  (and the mirror for <)
					if (ab > 0 && bc > 0 && getKnownResult(map, a, c) === 0) {
						recordDirect(map, a, c, true);
						changed = true;
					}
					if (ab < 0 && bc < 0 && getKnownResult(map, a, c) === 0) {
						recordDirect(map, a, c, false);
						changed = true;
					}
				}
			}
		}
	}
}

/**
 * Generic merge sort over an async comparator. `compare(a,b)` resolves to a
 * negative number when `a` should come first (mirrors `Array.prototype.sort`).
 * `isCancelled` lets the caller abort an in-flight sort (e.g. the user restarts
 * ranking); when it returns true the sort rejects with `Error("cancelled")`.
 * Stable: equal/`<= 0` comparisons keep the left element first.
 */
export async function mergeSort<T>(
	arr: T[],
	compare: (a: T, b: T) => Promise<number>,
	isCancelled: () => boolean = () => false
): Promise<T[]> {
	if (isCancelled()) throw new Error('cancelled');
	if (arr.length <= 1) return arr;
	const mid = Math.floor(arr.length / 2);
	const left = await mergeSort(arr.slice(0, mid), compare, isCancelled);
	const right = await mergeSort(arr.slice(mid), compare, isCancelled);
	return merge(left, right, compare, isCancelled);
}

async function merge<T>(
	left: T[],
	right: T[],
	compare: (a: T, b: T) => Promise<number>,
	isCancelled: () => boolean
): Promise<T[]> {
	const result: T[] = [];
	let i = 0;
	let j = 0;
	while (i < left.length && j < right.length) {
		if (isCancelled()) throw new Error('cancelled');
		const cmp = await compare(left[i], right[j]);
		if (cmp <= 0) result.push(left[i++]);
		else result.push(right[j++]);
	}
	while (i < left.length) result.push(left[i++]);
	while (j < right.length) result.push(right[j++]);
	return result;
}
