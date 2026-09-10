import { getTemplateStats } from './template-stats';
import type { SlugValues } from './slug';

/**
 * Ranking counts per template slug — a `{ slug: count }` map.
 *
 * Reads the denormalized `template_stats` table (see
 * src/lib/template-stats.ts); it is no longer an aggregate over the event log.
 * Kept as its own export because /api/counts and the saved list need only this
 * half. A listing that also shows vote scores should call `getTemplateStats`
 * once instead of pairing this with `getTemplateVotes`.
 */
export async function getCounts(
	db: D1Database,
	includeHidden = false
): Promise<SlugValues> {
	return (await getTemplateStats(db, includeHidden)).counts;
}
