/**
 * The `user_identities` table: which provider accounts may sign in as which
 * user. One row per (provider, provider_account_id); a user can have several,
 * which is what lets the same person arrive through Google today and GitHub
 * tomorrow and land in the same account.
 *
 * See migration 0019. `users.github_id` is the legacy column this replaced and
 * is no longer read or written anywhere.
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
