/**
 * D1 access layer for template up/down votes.
 *
 * Reuses the generic `votes` table from 0007_comments.sql with
 * subject_type='template', subject_id=slug (slug uniquely identifies both
 * official and user templates, like rankings/ranking_results).
 *
 * This module owns the vote *rows*; the net score per slug is denormalized
 * onto `template_stats` by database triggers and read back from there — see
 * src/lib/template-stats.ts.
 */

import { getTemplateStat, getTemplateStats } from './template-stats';
import type { SlugValues } from './slug';

export const VOTE_SUBJECT_TEMPLATE = 'template';

/**
 * Net vote score (sum of +1/-1) per template slug.
 *
 * Reads the denormalized `template_stats` table rather than summing the vote
 * log — see src/lib/template-stats.ts. A listing that also shows ranking counts
 * should call `getTemplateStats` once instead of pairing this with `getCounts`.
 */
export async function getTemplateVotes(
    db: D1Database,
    includeHidden = false
): Promise<SlugValues> {
    return (await getTemplateStats(db, includeHidden)).votes;
}

/** Net score for a single slug. */
export async function getTemplateVoteScore(
    db: D1Database,
    slug: string
): Promise<number> {
    return getTemplateStat(db, slug, 'votes');
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
