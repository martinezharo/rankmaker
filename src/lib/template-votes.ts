/**
 * D1 access layer for template up/down votes.
 *
 * Reuses the generic `votes` table from 0007_comments.sql with
 * subject_type='template', subject_id=slug (slug uniquely identifies both
 * official and user templates, like rankings/ranking_results). Unlike comments,
 * template scores have no row to denormalize a counter onto (officials live in
 * JSON), so the net score is aggregated live — mirroring src/lib/counts.ts.
 */

import { aggregateSlugValues } from './slug';

export const VOTE_SUBJECT_TEMPLATE = 'template';

/**
 * Net vote score (sum of +1/-1) per template slug.
 *
 * Non-public user-template slugs are excluded by default (same exclusion as
 * getCounts in src/lib/counts.ts) so they don't leak through public endpoints.
 * Owner-facing SSR views pass `includeHidden` to get the full map.
 */
export async function getTemplateVotes(
    db: D1Database,
    includeHidden = false
): Promise<Record<string, number>> {
    const filter = includeHidden
        ? ''
        : `AND NOT EXISTS (
               SELECT 1 FROM templates t
               WHERE t.slug = votes.subject_id COLLATE NOCASE
                 AND t.visibility != 'public'
           )`;
    const { results } = await db
        .prepare(
            `SELECT subject_id AS slug, SUM(value) AS score
             FROM votes
             WHERE subject_type = 'template' ${filter}
             GROUP BY subject_id`
        )
        .all<{ slug: string; score: number }>();

    return aggregateSlugValues(
        results.map((row) => ({ slug: row.slug, value: row.score }))
    );
}

/** Net score for a single slug. */
export async function getTemplateVoteScore(
    db: D1Database,
    slug: string
): Promise<number> {
    const row = await db
        .prepare(
            `SELECT COALESCE(SUM(value), 0) AS score FROM votes
             WHERE subject_type = 'template' AND subject_id = ? COLLATE NOCASE`
        )
        .bind(slug)
        .first<{ score: number }>();
    return row?.score ?? 0;
}

/** This user's current vote on `slug` (1, -1, or 0 if none). */
export async function getUserTemplateVote(
    db: D1Database,
    userId: string,
    slug: string
): Promise<number> {
    const row = await db
        .prepare(
            `SELECT value FROM votes
             WHERE user_id = ? AND subject_type = 'template'
               AND subject_id = ? COLLATE NOCASE`
        )
        .bind(userId, slug)
        .first<{ value: number }>();
    return row?.value ?? 0;
}

/**
 * Apply `value` (1 up, -1 down, 0 clears) as this user's vote on `slug`.
 * Upserts or deletes the vote row, then re-aggregates the net score.
 * Returns the fresh score and the caller's resulting vote.
 */
export async function applyTemplateVote(
    db: D1Database,
    userId: string,
    slug: string,
    value: number
): Promise<{ score: number; myVote: number }> {
    if (value === 0) {
        await db
            .prepare(
                `DELETE FROM votes
                 WHERE user_id = ? AND subject_type = 'template'
                   AND subject_id = ? COLLATE NOCASE`
            )
            .bind(userId, slug)
            .run();
    } else {
        // Clear only case-only aliases left by pre-canonicalization writes; the
        // canonical row is upserted below. Deleting it here too would make the
        // ON CONFLICT clause dead code and turn every vote into a
        // delete-then-insert pair that loses the vote if the second half fails.
        // Both statements go in one batch so the row is never briefly missing.
        await db.batch([
            db
                .prepare(
                    `DELETE FROM votes
                     WHERE user_id = ? AND subject_type = 'template'
                       AND subject_id = ? COLLATE NOCASE AND subject_id != ?`
                )
                .bind(userId, slug, slug),
            db
                .prepare(
                    `INSERT INTO votes (user_id, subject_type, subject_id, value)
                     VALUES (?, 'template', ?, ?)
                     ON CONFLICT(user_id, subject_type, subject_id)
                     DO UPDATE SET value = excluded.value`
                )
                .bind(userId, slug, value),
        ]);
    }

    return { score: await getTemplateVoteScore(db, slug), myVote: value };
}
