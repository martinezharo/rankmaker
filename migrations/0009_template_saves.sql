-- 0009_template_saves.sql — per-user saved (bookmarked) templates.
--
-- `slug` matches both official (JSON) and user (D1) templates, like
-- rankings/ranking_results/comments. One row per (user, template); saving an
-- already-saved template is a no-op (INSERT OR IGNORE), unsaving deletes it.
-- The Saved page lists these newest-first.
--
-- Template up/down votes reuse the generic `votes` table from 0007_comments.sql
-- (subject_type='template', subject_id=slug) and need no migration.

CREATE TABLE IF NOT EXISTS template_saves (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_template_saves_user ON template_saves (user_id, created_at);
