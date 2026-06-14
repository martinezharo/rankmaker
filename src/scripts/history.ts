// history.ts — client-side record of which templates this browser has played and
// the results it produced, for anonymous users (logged-in users persist to D1).
//
// Two stores in localStorage:
//   rankmaker_played  → string[] of slugs (the "played" set; written on START)
//   rankmaker_history → Record<slug, HistoryEntry> (the saved result; on finish)
//
// The pure helpers (add/upsert/list) are exported and unit-tested; the
// localStorage wrappers are thin and fail-safe (storage may be unavailable or
// full — never let tracking break the ranking UI).

export type RankedItem = { id: number | string; name: string; image: string };

export type HistoryEntry = {
	slug: string;
	title: string;
	result: RankedItem[];
	ts: number;
	// Snapshot of the template's cover image at completion time. Optional:
	// entries saved before covers were tracked fall back to the winner's image.
	cover?: string;
};

const PLAYED_KEY = 'rankmaker_played';
const HISTORY_KEY = 'rankmaker_history';

// Bounds so a heavy user can't bloat localStorage (5MB cap in most browsers).
const MAX_PLAYED = 500;
const MAX_HISTORY = 200;
const MAX_RESULT_ITEMS = 200;

// ── Pure helpers (unit-tested) ────────────────────────────────────────────────

/** Add a slug to the played list, most-recent last, de-duped and capped. */
export function addToPlayed(list: string[], slug: string): string[] {
	const next = list.filter((s) => s !== slug);
	next.push(slug);
	return next.slice(-MAX_PLAYED);
}

/** Upsert one template's result into the history map (latest wins). */
export function upsertHistory(
	map: Record<string, HistoryEntry>,
	entry: HistoryEntry
): Record<string, HistoryEntry> {
	const next: Record<string, HistoryEntry> = {
		...map,
		[entry.slug]: { ...entry, result: entry.result.slice(0, MAX_RESULT_ITEMS) },
	};
	// Cap: drop the oldest entries if we exceed the limit.
	const entries = Object.values(next).sort((a, b) => b.ts - a.ts);
	if (entries.length <= MAX_HISTORY) return next;
	const kept: Record<string, HistoryEntry> = {};
	for (const e of entries.slice(0, MAX_HISTORY)) kept[e.slug] = e;
	return kept;
}

/** History map → list, newest first. */
export function historyToList(
	map: Record<string, HistoryEntry>
): HistoryEntry[] {
	return Object.values(map).sort((a, b) => b.ts - a.ts);
}

// ── localStorage wrappers (fail-safe) ─────────────────────────────────────────

function read<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

function write(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* storage unavailable or full — ignore */
	}
}

/** Record that this browser started ranking `slug` (the "played" signal). */
export function recordStart(slug: string): void {
	if (!slug) return;
	write(PLAYED_KEY, addToPlayed(read<string[]>(PLAYED_KEY, []), slug));
}

/** Save the completed result for `slug`. */
export function saveResult(
	slug: string,
	title: string,
	result: RankedItem[],
	cover?: string
): void {
	if (!slug) return;
	const entry: HistoryEntry = { slug, title, result, ts: Date.now() };
	if (cover) entry.cover = cover;
	write(HISTORY_KEY, upsertHistory(read(HISTORY_KEY, {}), entry));
	// Saving a result also counts as having played it.
	recordStart(slug);
}

/** Slugs this browser has played — union of the played list and history keys. */
export function getPlayedSlugs(): Set<string> {
	const played = read<string[]>(PLAYED_KEY, []);
	const history = read<Record<string, HistoryEntry>>(HISTORY_KEY, {});
	return new Set([...played, ...Object.keys(history)]);
}

/** Saved results for this browser, newest first. */
export function getLocalHistory(): HistoryEntry[] {
	return historyToList(read<Record<string, HistoryEntry>>(HISTORY_KEY, {}));
}
