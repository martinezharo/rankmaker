/**
 * Client half of the mature-content filter.
 *
 * Listing pages are served from a shared edge cache whose key is the URL —
 * cookies are not part of it — so their HTML is always the canonical,
 * mature-free variant. A viewer who opted in re-derives their own listing here
 * from `/api/templates/browse` and TemplateGrid swaps it in.
 *
 * Whether the viewer opted in is reported by `/api/auth/me`, which the header
 * already fetches on every navigation; `publishMaturePreference` is how that
 * answer reaches this module. Until it arrives, grids show the server variant —
 * the safe direction, since it can only ever under-show mature content.
 */
import type { ListingItem } from '../lib/listings';

/** Which listing to load: the whole browse list, or one profile's templates. */
export interface BrowseScope {
	username?: string;
}

type Listener = (items: ListingItem[]) => void;

let preference: boolean | null = null;
const listeners = new Set<{ scope: BrowseScope; notify: Listener }>();
const inFlight = new Map<string, Promise<ListingItem[] | null>>();

function scopeKey(scope: BrowseScope): string {
	return scope.username ? `user:${scope.username}` : 'browse';
}

function load(scope: BrowseScope): Promise<ListingItem[] | null> {
	const key = scopeKey(scope);
	// One request per scope per page, however many grids are subscribed —
	// the home page alone renders a grid per category.
	const existing = inFlight.get(key);
	if (existing) return existing;

	const url = scope.username
		? `/api/templates/browse?user=${encodeURIComponent(scope.username)}`
		: '/api/templates/browse';
	const request = fetch(url, { headers: { 'cache-control': 'no-cache' } })
		.then((res) => (res.ok ? res.json() : { items: null }))
		.then((data) => (data as { items: ListingItem[] | null }).items)
		.catch(() => null);

	inFlight.set(key, request);
	return request;
}

function fulfil(entry: { scope: BrowseScope; notify: Listener }): void {
	void load(entry.scope).then((items) => {
		if (items) entry.notify(items);
	});
}

/**
 * Tell the module what `/api/auth/me` said. Safe to call repeatedly; only a
 * change of answer does anything.
 */
export function publishMaturePreference(showMature: boolean): void {
	if (preference === showMature) return;
	preference = showMature;
	if (showMature) listeners.forEach(fulfil);
}

/**
 * Subscribe a grid to its listing. `notify` fires only when there is a
 * mature-inclusive listing to swap in — never for the common case.
 * Returns an unsubscribe function.
 */
export function subscribeListing(scope: BrowseScope, notify: Listener): () => void {
	const entry = { scope, notify };
	listeners.add(entry);
	if (preference) fulfil(entry);
	return () => listeners.delete(entry);
}

/**
 * Drop the cached listings. Called on navigation: the preference survives
 * (it is a property of the viewer) but the data does not.
 */
export function resetListingCache(): void {
	inFlight.clear();
}
