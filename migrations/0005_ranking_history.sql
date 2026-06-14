-- 0005_ranking_history.sql
-- Attribute ranking plays to a user and store their completed results.
--
-- `rankings.user_id` is the "played" signal (set on START via /api/track) used to
-- exclude already-played templates from the "You might also like" row. It is
-- nullable with no FK: anonymous plays stay NULL, and the table is an analytics
-- event log that must survive account deletion.
--
-- `ranking_results` stores the final ordered outcome (saved on completion), one
-- row per (user, template) — re-ranking upserts — powering the /history page.

ALTER TABLE rankings ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_rankings_user ON rankings (user_id);

CREATE TABLE IF NOT EXISTS ranking_results (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,
  title      TEXT NOT NULL,
  result     TEXT NOT NULL,                 -- JSON: [{id,name,image}]
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_ranking_results_user
  ON ranking_results (user_id, updated_at DESC);
