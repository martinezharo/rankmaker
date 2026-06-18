/**
 * D1 access layer for the user-to-user follow graph (0010_follows.sql).
 *
 * A row (follower_id, following_id) means follower_id follows following_id.
 * Counts and follow-state are read live; the homepage "Following" row and the
 * profile follower/following modals are built from these queries.
 */
import { getCounts } from './counts';
import { getTemplateVotes } from './template-votes';
import { mapTemplateRow, type Template } from './templates';

export type FollowCounts = { followers: number; following: number };

/** Public summary of a user, for follower/following lists. */
export type UserSummary = {
    username: string;
    avatar: string;
    isVerified: boolean;
    bio: string | null;
};

/** Followers (people following this user) and following (people this user follows). */
export async function getFollowCounts(
    db: D1Database,
    userId: string
): Promise<FollowCounts> {
    const row = await db
        .prepare(
            `SELECT
                 (SELECT COUNT(*) FROM follows WHERE following_id = ?1) AS followers,
                 (SELECT COUNT(*) FROM follows WHERE follower_id  = ?1) AS following`
        )
        .bind(userId)
        .first<{ followers: number; following: number }>();
    return {
        followers: row?.followers ?? 0,
        following: row?.following ?? 0,
    };
}

/** Does `followerId` currently follow `followingId`? */
export async function isFollowing(
    db: D1Database,
    followerId: string,
    followingId: string
): Promise<boolean> {
    const row = await db
        .prepare(
            `SELECT 1 AS x FROM follows
             WHERE follower_id = ? AND following_id = ?`
        )
        .bind(followerId, followingId)
        .first();
    return row !== null;
}

/**
 * Follow or unfollow. Following yourself is a no-op (and rejected upstream).
 * Returns whether the caller now follows the target.
 */
export async function setFollow(
    db: D1Database,
    followerId: string,
    followingId: string,
    follow: boolean
): Promise<boolean> {
    if (followerId === followingId) return false;
    if (follow) {
        await db
            .prepare(
                `INSERT OR IGNORE INTO follows (follower_id, following_id)
                 VALUES (?, ?)`
            )
            .bind(followerId, followingId)
            .run();
    } else {
        await db
            .prepare(
                `DELETE FROM follows
                 WHERE follower_id = ? AND following_id = ?`
            )
            .bind(followerId, followingId)
            .run();
    }
    return follow;
}

/** Users who follow `userId`, newest first. */
export async function listFollowers(
    db: D1Database,
    userId: string,
    limit = 200
): Promise<UserSummary[]> {
    const { results } = await db
        .prepare(
            `SELECT u.username, u.avatar, u.is_verified, u.bio
             FROM follows f JOIN users u ON u.id = f.follower_id
             WHERE f.following_id = ?
             ORDER BY f.created_at DESC
             LIMIT ?`
        )
        .bind(userId, limit)
        .all<{
            username: string;
            avatar: string;
            is_verified: number;
            bio: string | null;
        }>();
    return results.map((r) => ({
        username: r.username,
        avatar: r.avatar,
        isVerified: r.is_verified === 1,
        bio: r.bio,
    }));
}

/** Users `userId` follows, newest first. */
export async function listFollowing(
    db: D1Database,
    userId: string,
    limit = 200
): Promise<UserSummary[]> {
    const { results } = await db
        .prepare(
            `SELECT u.username, u.avatar, u.is_verified, u.bio
             FROM follows f JOIN users u ON u.id = f.following_id
             WHERE f.follower_id = ?
             ORDER BY f.created_at DESC
             LIMIT ?`
        )
        .bind(userId, limit)
        .all<{
            username: string;
            avatar: string;
            is_verified: number;
            bio: string | null;
        }>();
    return results.map((r) => ({
        username: r.username,
        avatar: r.avatar,
        isVerified: r.is_verified === 1,
        bio: r.bio,
    }));
}

/**
 * Latest PUBLIC templates created by the accounts `userId` follows, newest
 * first. Powers the homepage "Following" row. Live ranking counts and vote
 * scores are merged so the cards match every other row. Hidden templates are
 * never surfaced (the visibility filter), like listUserTemplates.
 */
export async function listFollowingTemplates(
    db: D1Database,
    userId: string,
    limit = 8
): Promise<Template[]> {
    const { results } = await db
        .prepare(
            `SELECT t.id, t.slug, t.title, t.description, t.category, t.cover_image,
                    t.created_at, t.updated_at, t.visibility,
                    u.username, u.avatar, u.is_verified
             FROM templates t
             JOIN users u ON u.id = t.creator_id
             JOIN follows f ON f.following_id = t.creator_id
             WHERE f.follower_id = ? AND t.visibility = 'public'
             ORDER BY t.created_at DESC
             LIMIT ?`
        )
        .bind(userId, limit)
        .all();
    if (results.length === 0) return [];

    let templates = results.map((r) => mapTemplateRow(r as any));
    try {
        const [counts, votes] = await Promise.all([
            getCounts(db),
            getTemplateVotes(db),
        ]);
        templates = templates.map((t) => ({
            ...t,
            times_ranked: counts[t.slug] ?? 0,
            votes: votes[t.slug] ?? 0,
        }));
    } catch {
        // keep zeroed counts on error
    }
    return templates;
}
