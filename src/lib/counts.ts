/**
 * Aggregate real ranking counts per template slug from D1.
 * Returns a `{ slug: count }` map. Shared by the /api/counts endpoint
 * and the SSR homepage so ordering and display stay consistent.
 *
 * Slugs of non-public user templates are excluded by default: /api/counts is
 * a public endpoint, so listing them would leak unlisted URLs (which are only
 * protected by being unguessable) and private template slugs. Owner-facing
 * SSR views (/me) pass `includeHidden` to get the full map.
 */
export async function getCounts(
    db: D1Database,
    includeHidden = false
): Promise<Record<string, number>> {
    const filter = includeHidden
        ? ''
        : `WHERE NOT EXISTS (
               SELECT 1 FROM templates t
               WHERE t.slug = rankings.slug COLLATE NOCASE
                 AND t.visibility != 'public'
           )`;
    const { results } = await db
        .prepare(
            `SELECT slug, COUNT(*) AS n FROM rankings ${filter} GROUP BY slug`
        )
        .all<{ slug: string; n: number }>();

    const counts: Record<string, number> = {};
    for (const row of results) {
        counts[row.slug] = row.n;
    }
    return counts;
}
