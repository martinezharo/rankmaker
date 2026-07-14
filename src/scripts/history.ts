// history.ts — client-side record of which templates this browser has played and
// the results it produced, for anonymous users (logged-in users persist to D1).
//
// Three stores in localStorage:
//   rankmaker_played   → string[] of slugs (the "played" set; written on START)
//   rankmaker_history  → Record<slug, HistoryEntry> (the saved result; on finish)
//   rankmaker_excluded → Record<slug, (number|string)[]> (option ids the user
//                        removed from a template's ranking; purely client-side,
//                        restorable from the template detail view)
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
const EXCLUDED_KEY = 'rankmaker_excluded';
// sessionStorage handoff: the /history "View details" button stows the picked
// result here so the template page can open straight on the results view, even
// cross-device (where this browser's localStorage has no copy). One-shot.
const PENDING_KEY = 'rankmaker_pending_result';
// sessionStorage flag: the /history "Rank again" button sets this so the
// template page skips the land-on-saved-results behaviour and shows the normal
// detail/START view for a fresh ranking. One-shot, holds the target slug.
const FRESH_KEY = 'rankmaker_force_fresh';

// Bounds so a heavy user can't bloat localStorage (5MB cap in most browsers).
const MAX_PLAYED = 500;
const MAX_HISTORY = 200;
const MAX_RESULT_ITEMS = 200;
const MAX_EXCLUDED_SLUGS = 200;

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

/** Merge server and device histories, keeping the newest result per template. */
export function mergeHistory(
	serverEntries: HistoryEntry[],
	localEntries: HistoryEntry[]
): HistoryEntry[] {
	const merged = new Map(serverEntries.map((entry) => [entry.slug, entry]));
	for (const local of localEntries) {
		const server = merged.get(local.slug);
		if (!server || local.ts > server.ts) merged.set(local.slug, local);
	}
	return [...merged.values()].sort((a, b) => b.ts - a.ts);
}

function sameSnapshot(a: HistoryEntry, b: HistoryEntry): boolean {
	return (
		a.title === b.title &&
		(a.cover ?? '') === (b.cover ?? '') &&
		JSON.stringify(a.result) === JSON.stringify(b.result)
	);
}

/**
 * Detect a server-side slug move for a result that is still stored locally
 * under the old slug. The result snapshots must be identical and their save
 * timestamps close together, which avoids conflating two genuinely different
 * templates that happen to contain the same options.
 */
export function reconcileMovedHistoryEntries(
	serverEntries: HistoryEntry[],
	localEntries: HistoryEntry[]
): { entries: HistoryEntry[]; movedSlugs: string[] } {
	const serverSlugs = new Set(serverEntries.map((entry) => entry.slug));
	const movedSlugs: string[] = [];
	const entries = localEntries.filter((local) => {
		if (serverSlugs.has(local.slug)) return true;
		const moved = serverEntries.some(
			(server) =>
				server.slug !== local.slug &&
				Math.abs(server.ts - local.ts) <= 10_000 &&
				sameSnapshot(server, local)
		);
		if (moved) movedSlugs.push(local.slug);
		return !moved;
	});
	return { entries, movedSlugs };
}

/**
 * Upsert one template's excluded option ids into the exclusions map. An empty
 * `ids` removes the slug's entry entirely; the map is capped by dropping the
 * longest-standing slugs first (insertion order).
 */
export function upsertExcluded(
	map: Record<string, (number | string)[]>,
	slug: string,
	ids: (number | string)[]
): Record<string, (number | string)[]> {
	const next: Record<string, (number | string)[]> = { ...map };
	delete next[slug];
	if (ids.length > 0) next[slug] = [...ids];
	const keys = Object.keys(next);
	if (keys.length <= MAX_EXCLUDED_SLUGS) return next;
	for (const k of keys.slice(0, keys.length - MAX_EXCLUDED_SLUGS)) {
		delete next[k];
	}
	return next;
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
): HistoryEntry | null {
	if (!slug) return null;
	const entry: HistoryEntry = { slug, title, result, ts: Date.now() };
	if (cover) entry.cover = cover;
	saveHistoryEntry(entry);
	// Saving a result also counts as having played it.
	recordStart(slug);
	return entry;
}

/** Store an already timestamped entry, such as the canonical D1 response. */
export function saveHistoryEntry(entry: HistoryEntry): void {
	if (!entry?.slug || !Array.isArray(entry.result)) return;
	write(HISTORY_KEY, upsertHistory(read(HISTORY_KEY, {}), entry));
}

/** Remove a stale local result, for example after its template slug moved. */
export function removeLocalResult(slug: string): void {
	if (!slug) return;
	const map = read<Record<string, HistoryEntry>>(HISTORY_KEY, {});
	if (!(slug in map)) return;
	delete map[slug];
	write(HISTORY_KEY, map);
}

/**
 * Persist a local result to the signed-in account. The endpoint canonicalizes
 * it; on success, replace the local snapshot with the timestamped server copy.
 * Anonymous requests deliberately return null.
 */
export async function syncResultToAccount(
	entry: HistoryEntry
): Promise<HistoryEntry | null> {
	try {
		const response = await fetch('/api/me/history', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				slug: entry.slug,
				result: entry.result.map((item) => ({ id: item.id })),
			}),
			keepalive: true,
		});
		if (!response.ok) return null;
		const data = (await response.json()) as { entry?: unknown };
		const synced = data.entry;
		if (
			typeof synced !== 'object' ||
			synced === null ||
			!('slug' in synced) ||
			!('title' in synced) ||
			!('result' in synced) ||
			!('ts' in synced) ||
			typeof synced.slug !== 'string' ||
			typeof synced.title !== 'string' ||
			!Array.isArray(synced.result) ||
			typeof synced.ts !== 'number'
		) {
			return null;
		}
		const canonical = synced as HistoryEntry;
		saveHistoryEntry(canonical);
		return canonical;
	} catch {
		return null;
	}
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

/** This browser's saved result for `slug`, or null if it hasn't ranked it. */
export function getLocalResult(slug: string): HistoryEntry | null {
	if (!slug) return null;
	const map = read<Record<string, HistoryEntry>>(HISTORY_KEY, {});
	return map[slug] ?? null;
}

/** Option ids this browser has removed from `slug`'s ranking. */
export function getExcludedIds(slug: string): (number | string)[] {
	if (!slug) return [];
	const map = read<Record<string, (number | string)[]>>(EXCLUDED_KEY, {});
	const ids = map[slug];
	return Array.isArray(ids) ? ids : [];
}

/** Persist the full set of removed option ids for `slug` (empty set clears it). */
export function setExcludedIds(
	slug: string,
	ids: (number | string)[]
): void {
	if (!slug) return;
	write(EXCLUDED_KEY, upsertExcluded(read(EXCLUDED_KEY, {}), slug, ids));
}

// ── sessionStorage handoff (one-shot) ─────────────────────────────────────────

function sessionRead<T>(key: string, fallback: T): T {
	try {
		const raw = sessionStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

/** Stash a result for the next template-page load to pick up (see PENDING_KEY). */
export function setPendingResult(entry: HistoryEntry): void {
	if (!entry?.slug) return;
	try {
		sessionStorage.setItem(PENDING_KEY, JSON.stringify(entry));
	} catch {
		/* storage unavailable — the template page falls back to localStorage/D1 */
	}
}

/**
 * Read and clear the pending handoff. Returns the entry only when it matches
 * `slug`; clears the key either way so a stale handoff can't linger.
 */
export function consumePendingResult(slug: string): HistoryEntry | null {
	const entry = sessionRead<HistoryEntry | null>(PENDING_KEY, null);
	try {
		sessionStorage.removeItem(PENDING_KEY);
	} catch {
		/* ignore */
	}
	return entry && entry.slug === slug ? entry : null;
}

/** Flag the next load of `slug`'s template page to start a fresh ranking. */
export function setForceFresh(slug: string): void {
	if (!slug) return;
	try {
		sessionStorage.setItem(FRESH_KEY, JSON.stringify(slug));
	} catch {
		/* storage unavailable — template page just shows saved results instead */
	}
}

/**
 * Read and clear the force-fresh flag. Returns true only when it matches
 * `slug`; clears the key either way so it can't linger.
 */
export function consumeForceFresh(slug: string): boolean {
	const flagged = sessionRead<string | null>(FRESH_KEY, null);
	try {
		sessionStorage.removeItem(FRESH_KEY);
	} catch {
		/* ignore */
	}
	return flagged === slug;
}
