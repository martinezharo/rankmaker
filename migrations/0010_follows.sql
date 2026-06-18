-- 0010_follows.sql — user-to-user follow graph.
--
-- One row per (follower, following): `follower_id` follows `following_id`.
-- Both reference users(id) and cascade on delete. Following yourself is
-- prevented in the API layer (and would be useless). INSERT OR IGNORE makes
-- re-following a no-op; unfollowing deletes the row.
--
-- The two indexes serve the two read directions: who a user follows
-- (follower_id) and who follows a user (following_id), both newest-first.

CREATE TABLE IF NOT EXISTS follows (
  follower_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower_id, created_at);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows (following_id, created_at);
