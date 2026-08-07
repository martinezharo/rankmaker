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
 * Aggregate rows whose slug differs only by case and retain raw aliases for
 * callers that still hold a legacy-cased template slug.
 */
export function aggregateSlugValues(
    rows: readonly { slug: string; value: number }[]
): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const row of rows) {
        const key = row.slug.toLowerCase();
        totals[key] = (totals[key] ?? 0) + row.value;
    }

    const output: Record<string, number> = { ...totals };
    for (const row of rows) {
        output[row.slug] = totals[row.slug.toLowerCase()];
    }
    return output;
}
