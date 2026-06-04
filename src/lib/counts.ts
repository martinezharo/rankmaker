/**
 * Aggregate real ranking counts per template slug from D1.
 * Returns a `{ slug: count }` map. Shared by the /api/counts endpoint
 * and the SSR homepage so ordering and display stay consistent.
 */
export async function getCounts(
    db: D1Database
): Promise<Record<string, number>> {
    const { results } = await db
        .prepare('SELECT slug, COUNT(*) AS n FROM rankings GROUP BY slug')
        .all<{ slug: string; n: number }>();

    const counts: Record<string, number> = {};
    for (const row of results) {
        counts[row.slug] = row.n;
    }
    return counts;
}
