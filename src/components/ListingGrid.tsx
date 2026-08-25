/**
 * A TemplateGrid that keeps itself correct for a mature-content viewer.
 *
 * Listing pages are served from a shared edge cache whose key is the URL —
 * cookies are not part of it, and the cache is consulted before the Worker
 * runs. So their HTML is always the canonical, mature-free variant, and a
 * viewer who opted in has their own listing fetched here and re-rendered
 * through the same components (see src/lib/mature.ts).
 *
 * For everyone else this never re-renders: the server markup stands and the
 * only cost is hydrating a component that does nothing.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import TemplateGrid from './TemplateGrid';
import { filterByCategory, type ListingItem } from '../lib/listings';
import { subscribeListing, type BrowseScope } from '../scripts/mature-listing';
import type { Locale } from '../i18n/config';

export interface ListingGridProps {
	/** The server-rendered (canonical) listing for this grid. */
	items: ListingItem[];
	locale?: Locale;
	headingLevel?: 'h2' | 'h3';
	class?: string;
	itemClass?: string;
	empty?: ComponentChildren;
	/** Which listing to re-fetch. Omit for the site-wide browse list. */
	scope?: BrowseScope;
	/** Narrow the re-derived listing the way the server narrowed it. */
	category?: string;
	/** Cap the re-derived listing the way the server capped it. */
	limit?: number;
}

export default function ListingGrid({
	items,
	scope,
	category,
	limit,
	...gridProps
}: ListingGridProps) {
	// Starts as exactly what the server rendered, so hydration is a no-op.
	const [listing, setListing] = useState(items);

	// `scope` is a fresh object on every render; depend on its value instead.
	const scopeUser = scope?.username;

	useEffect(
		() =>
			subscribeListing({ username: scopeUser }, (fetched) => {
				const narrowed = category ? filterByCategory(fetched, category) : fetched;
				setListing(limit ? narrowed.slice(0, limit) : narrowed);
			}),
		[scopeUser, category, limit]
	);

	return <TemplateGrid items={listing} {...gridProps} />;
}
