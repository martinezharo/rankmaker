-- Slug lookups are case-insensitive so that legacy rows written before slugs
-- were canonicalized still resolve (see AUDIT.md #8). SQLite only uses an
-- index when the query's collation matches the index's, so a
-- `WHERE slug = ? COLLATE NOCASE` predicate cannot use these BINARY indexes and
-- degrades to a table scan on the hottest read paths (comment threads, vote
-- totals, per-template ranking counts).
--
-- `templates.slug` needs nothing here: the column itself is declared
-- COLLATE NOCASE, so its UNIQUE index is already case-insensitive.

-- Comment threads: listComments() filters roots by slug.
CREATE INDEX IF NOT EXISTS idx_comments_slug_nocase
  ON comments (slug COLLATE NOCASE, parent_id);

-- "N ranked" on every template page.
CREATE INDEX IF NOT EXISTS idx_rankings_slug_nocase
  ON rankings (slug COLLATE NOCASE);

-- Aggregate template score, and this user's own vote.
CREATE INDEX IF NOT EXISTS idx_votes_subject_nocase
  ON votes (subject_type, subject_id COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_votes_user_subject_nocase
  ON votes (user_id, subject_type, subject_id COLLATE NOCASE);

-- Per-user reads/writes keyed by (user_id, slug); the primary keys on these
-- tables are BINARY, so the slug half is unusable under NOCASE.
CREATE INDEX IF NOT EXISTS idx_ranking_results_slug_nocase
  ON ranking_results (user_id, slug COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_template_saves_slug_nocase
  ON template_saves (user_id, slug COLLATE NOCASE);
