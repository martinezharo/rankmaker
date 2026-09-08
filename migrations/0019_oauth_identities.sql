-- 0019_oauth_identities.sql — sign-in identities, one row per (provider, account).
--
-- Until now an account WAS its GitHub account: `users.github_id` was both the
-- login key and the only way in. Google is now the primary provider, and a
-- column per provider would mean a migration (plus a new branch in the auth
-- code) for every provider we ever add — so identities move to their own
-- table and the provider becomes data.
--
-- `provider_account_id` is TEXT on purpose: GitHub's id is numeric, Google's
-- `sub` is an opaque string, and the next provider's is anyone's guess.
CREATE TABLE IF NOT EXISTS user_identities (
  provider            TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider, provider_account_id)
);
CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities(user_id);

-- Backfill: every existing account keeps signing in with GitHub.
INSERT OR IGNORE INTO user_identities (provider, provider_account_id, user_id)
SELECT 'github', CAST(github_id AS TEXT), id
FROM users
WHERE github_id IS NOT NULL;

-- `users.github_id` stays behind as a legacy column, unread and unwritten from
-- here on (new GitHub signups leave it NULL). SQLite cannot drop a UNIQUE
-- column without rebuilding the table, and rebuilding `users` would mean
-- dropping a table half the schema has ON DELETE CASCADE references to — not
-- worth it for a dead column. Drop it in a dedicated migration if it ever gets
-- in the way.
