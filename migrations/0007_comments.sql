-- 0007_comments.sql — template comments (Reddit-style threads + voting).
--
-- `comments` are threaded per template `slug` (matches both official and user
-- templates, like rankings/ranking_results). The author's ranking shown next to
-- a comment is resolved LIVE from ranking_results on (user_id, slug) at read
-- time, so it appears once they've ranked (even if they comment first) and
-- tracks any re-rank. The `result` column is reserved/unused (kept nullable for
-- a possible future per-comment snapshot). Soft delete keeps a node whose
-- children still need a parent.
--
-- `votes` is intentionally GENERIC (subject_type/subject_id) so the same table
-- can later back template up/down votes without another migration. up_votes /
-- down_votes are denormalized onto `comments` for cheap ordering & display.

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id   TEXT REFERENCES comments(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  result      TEXT,
  up_votes    INTEGER NOT NULL DEFAULT 0,
  down_votes  INTEGER NOT NULL DEFAULT 0,
  is_deleted  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments (slug, parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments (user_id);

CREATE TABLE IF NOT EXISTS votes (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id   TEXT NOT NULL,
  value        INTEGER NOT NULL CHECK (value IN (-1, 1)),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, subject_type, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_votes_subject ON votes (subject_type, subject_id);
