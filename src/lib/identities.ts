/**
 * The `user_identities` table: which provider accounts may sign in as which
 * user. One row per (provider, provider_account_id); a user can have several,
 * which is what lets the same person arrive through Google today and GitHub
 * tomorrow and land in the same account.
 *
 * See migration 0019. `users.github_id` is the legacy column this replaced: it
 * is never written any more, and read from exactly one place —
 * `findUserIdByLegacyGithubId` below, which exists to adopt the accounts the
 * backfill could not have seen.
 */
import type { ProviderId } from './oauth-providers';

/** The user this provider account signs in as, or null if it is unknown. */
export async function findUserIdByIdentity(
    db: D1Database,
    provider: ProviderId,
    accountId: string
): Promise<string | null> {
    const row = await db
        .prepare(
            'SELECT user_id FROM user_identities WHERE provider = ? AND provider_account_id = ?'
        )
        .bind(provider, accountId)
        .first<{ user_id: string }>();
    return row?.user_id ?? null;
}

/**
 * The account a GitHub id signs in as according to the pre-0019 schema.
 *
 * The backfill in 0019 could only adopt the accounts that existed the moment
 * it ran. Anybody who signs up through the old code afterwards — the window
 * between applying the migration and deploying the code that writes
 * identities, and any straggler request still being served by the old bundle
 * mid-rollout — gets a `github_id` and no identity row, and would find
 * themselves locked out of their own account on their next login.
 *
 * So a GitHub profile with no identity falls back to this column and is
 * adopted on the spot. It is not an email match and carries none of that
 * risk: `github_id` was the login key, so an account holding one already
 * belongs to whoever controls that GitHub account.
 *
 * Removable once `SELECT COUNT(*) FROM users WHERE github_id IS NOT NULL AND
 * id NOT IN (SELECT user_id FROM user_identities)` is 0 and has stayed 0 —
 * the old code is then gone and nothing can create such a row again.
 */
export async function findUserIdByLegacyGithubId(
    db: D1Database,
    accountId: string
): Promise<string | null> {
    // GitHub ids are numeric; the column is INTEGER. Anything else cannot be
    // in there, and asking would only be a wasted query.
    if (!/^\d+$/.test(accountId)) return null;
    const row = await db
        .prepare('SELECT id FROM users WHERE github_id = ?')
        .bind(Number(accountId))
        .first<{ id: string }>();
    return row?.id ?? null;
}

/**
 * The account that owns a verified email address, for linking a second
 * provider to an existing user.
 *
 * Both ends of the match have to be verified, or this is an account takeover:
 *
 *  - Only ever call this with an address the provider says it has verified,
 *    or anyone who can type someone else's address into a provider that does
 *    not check it gets their account.
 *  - Only rows whose own address was verified are matched (see migration
 *    0020), or an account holding an address nobody vouched for would collect
 *    whoever later proves it at another provider.
 *
 * Returns null unless exactly one account matches — `users.email` is not
 * unique (two people can put the same address on two accounts), and guessing
 * between them is the one thing worse than not linking.
 */
export async function findUserIdByVerifiedEmail(
    db: D1Database,
    email: string
): Promise<string | null> {
    const { results } = await db
        .prepare(
            'SELECT id FROM users WHERE email = ? COLLATE NOCASE AND email_verified = 1 LIMIT 2'
        )
        .bind(email)
        .all<{ id: string }>();
    return results.length === 1 ? results[0].id : null;
}

/**
 * The INSERT for a new identity, as a statement rather than a query, so signup
 * can create the user row and its identity in a single `db.batch()`
 * transaction — a half-created user with no way to sign in would be
 * unrecoverable for whoever it happened to.
 */
export function insertIdentityStatement(
    db: D1Database,
    provider: ProviderId,
    accountId: string,
    userId: string
): D1PreparedStatement {
    return db
        .prepare(
            'INSERT INTO user_identities (provider, provider_account_id, user_id) VALUES (?, ?, ?)'
        )
        .bind(provider, accountId, userId);
}

/** Attach a provider account to an existing user. */
export async function linkIdentity(
    db: D1Database,
    provider: ProviderId,
    accountId: string,
    userId: string
): Promise<void> {
    await insertIdentityStatement(db, provider, accountId, userId).run();
}
