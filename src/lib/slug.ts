/**
 * Derive a template slug from a ranking URL.
 * Ranking pages live at `/template/<slug>`, so the slug is the last
 * non-empty path segment. Returns null when it can't be determined.
 */
export function slugFromUrl(url: string | undefined | null): string | null {
    if (!url) return null;
    try {
        const { pathname } = new URL(url);
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last || null;
    } catch {
        return null;
    }
}

/**
 * Slug-keyed aggregate (ranking counts, vote scores). Always keyed by
 * `slugKey`, never by a raw slug — see `aggregateSlugValues`.
 */
export type SlugValues = Record<string, number>;

/**
 * The key a slug-keyed aggregate is stored under. Slugs are matched
 * case-insensitively because rows written before slugs were canonicalized may
 * differ from a template's own spelling (see AUDIT.md #8).
 */
export function slugKey(slug: string): string {
    return slug.toLowerCase();
}

/**
 * Aggregate rows whose slug differs only by case into a single entry.
 *
 * Emitting the raw spellings as extra keys as well would let a caller read the
 * map directly, but it duplicates every total under two keys and inflates the
 * public /api/counts payload. Callers go through `slugValue` instead.
 */
export function aggregateSlugValues(
    rows: readonly { slug: string; value: number }[]
): SlugValues {
    const totals: SlugValues = {};
    for (const row of rows) {
        const key = slugKey(row.slug);
        totals[key] = (totals[key] ?? 0) + row.value;
    }
    return totals;
}

/** Read a slug-keyed aggregate, ignoring case-only spelling differences. */
export function slugValue(
    values: SlugValues | undefined,
    slug: string
): number {
    return values?.[slugKey(slug)] ?? 0;
}
