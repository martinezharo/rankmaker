/**
 * The denormalized per-template aggregates: how many times each template has
 * been ranked, and its net vote score.
 *
 * Both numbers used to be aggregated live with a `GROUP BY` over the whole
 * `rankings` / `votes` log on every listing render, which made the cost of a
 * page view grow with the number of games ever played. `template_stats` holds
 * one row per slug instead (maintained by triggers — see
 * migrations/0021_template_stats.sql), so a listing reads O(templates) rows.
 *
 * This module is the only reader of that table. `getCounts` (src/lib/counts.ts)
 * and `getTemplateVotes` (src/lib/template-votes.ts) are thin wrappers for the
 * callers that need just one of the two maps; anything that renders a listing
 * needs both and should call `getTemplateStats` once, which fetches them in a
 * single statement.
 */
import { aggregateSlugValues, type SlugValues } from './slug';
import { NOT_LISTED_SQL } from './suspension';

/** The live aggregates a listing is decorated with. */
export type TemplateStats = { counts: SlugValues; votes: SlugValues };

/**
 * Slugs of user templates that are not publicly listed (private, unlisted or
 * suspended) are excluded by default: listings and
 * /api/counts are public surfaces, so including them would leak unlisted URLs
 * (which are only protected by being unguessable) and private template slugs.
 * Owner-facing SSR views (/me) pass `includeHidden` to get the full picture.
 *
 * Official templates have no `templates` row at all, so the filter is written
 * as "no hidden row exists for this slug" rather than a join.
 */
export async function getTemplateStats(
	db: D1Database,
	includeHidden = false
): Promise<TemplateStats> {
	const filter = includeHidden
		? ''
		: `WHERE NOT EXISTS (
               SELECT 1 FROM templates t
               WHERE t.slug = template_stats.slug_key COLLATE NOCASE
                 AND ${NOT_LISTED_SQL}
           )`;
	const { results } = await db
		.prepare(
			`SELECT slug_key, times_ranked, votes FROM template_stats ${filter}`
		)
		.all<{ slug_key: string; times_ranked: number; votes: number }>();

	// A counter that falls back to zero (every play or vote undone) leaves its
	// row behind. Dropping the zeros here keeps the maps — and the public
	// /api/counts payload — the same shape the live aggregates produced.
	return {
		counts: toMap(results, 'times_ranked'),
		votes: toMap(results, 'votes'),
	};
}

function toMap(
	rows: readonly { slug_key: string; times_ranked: number; votes: number }[],
	column: 'times_ranked' | 'votes'
): SlugValues {
	return aggregateSlugValues(
		rows
			.filter((row) => row[column] !== 0)
			.map((row) => ({ slug: row.slug_key, value: row[column] }))
	);
}

/** The stored score for a single slug, 0 when nothing is recorded. */
export async function getTemplateStat(
	db: D1Database,
	slug: string,
	column: 'times_ranked' | 'votes'
): Promise<number> {
	const row = await db
		.prepare(`SELECT ${column} AS value FROM template_stats WHERE slug_key = ?`)
		.bind(slug.toLowerCase())
		.first<{ value: number }>();
	return row?.value ?? 0;
}
