-- Denormalized per-template aggregates.
--
-- Every listing page (home, /search, /category, profiles) needs the ranking
-- count and the vote score of every template. Both used to be aggregated live:
--
--   SELECT slug, COUNT(*) FROM rankings GROUP BY slug
--
-- which scans the whole event log on every render. `rankings` grows by one row
-- per game played, so the cost of rendering the home page grew with the site's
-- own success: at ~1.3k events that single query was reading 1.5k rows per
-- render and burning 3.7M of the 5M daily D1 row-read budget on its own.
--
-- This table holds one row per slug instead, so a listing reads O(templates)
-- rows rather than O(events played) and stops degrading as the log grows.
--
-- Keyed by the LOWERCASED slug: slugs are matched case-insensitively (rows
-- written before slugs were canonicalized may differ in case — see AUDIT.md
-- #8), and folding at write time is what keeps the read a plain scan with no
-- COLLATE NOCASE grouping.
CREATE TABLE IF NOT EXISTS template_stats (
  slug_key     TEXT PRIMARY KEY,
  times_ranked INTEGER NOT NULL DEFAULT 0,
  votes        INTEGER NOT NULL DEFAULT 0
);

-- The aggregates are maintained by triggers, not by the application.
--
-- The alternative — bumping the counters from the write paths — means every
-- present and future statement that touches `rankings` or `votes` has to
-- remember to do it, and the ones that forget (account deletion, template
-- deletion, a future admin tool) leave the table permanently wrong with no
-- error. The database owns its own derived data instead.

CREATE TRIGGER IF NOT EXISTS trg_rankings_ai AFTER INSERT ON rankings
BEGIN
  INSERT INTO template_stats (slug_key, times_ranked)
  VALUES (lower(NEW.slug), 1)
  ON CONFLICT(slug_key) DO UPDATE SET times_ranked = times_ranked + 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_rankings_ad AFTER DELETE ON rankings
BEGIN
  UPDATE template_stats SET times_ranked = times_ranked - 1
   WHERE slug_key = lower(OLD.slug);
END;

CREATE TRIGGER IF NOT EXISTS trg_rankings_au AFTER UPDATE OF slug ON rankings
BEGIN
  UPDATE template_stats SET times_ranked = times_ranked - 1
   WHERE slug_key = lower(OLD.slug);
  INSERT INTO template_stats (slug_key, times_ranked)
  VALUES (lower(NEW.slug), 1)
  ON CONFLICT(slug_key) DO UPDATE SET times_ranked = times_ranked + 1;
END;

-- `votes` is the generic subject table shared with comments, so every trigger
-- is guarded on subject_type. An upsert's DO UPDATE branch fires the UPDATE
-- trigger, which is how re-voting is accounted for.

CREATE TRIGGER IF NOT EXISTS trg_votes_ai AFTER INSERT ON votes
WHEN NEW.subject_type = 'template'
BEGIN
  INSERT INTO template_stats (slug_key, votes)
  VALUES (lower(NEW.subject_id), NEW.value)
  ON CONFLICT(slug_key) DO UPDATE SET votes = votes + NEW.value;
END;

CREATE TRIGGER IF NOT EXISTS trg_votes_ad AFTER DELETE ON votes
WHEN OLD.subject_type = 'template'
BEGIN
  UPDATE template_stats SET votes = votes - OLD.value
   WHERE slug_key = lower(OLD.subject_id);
END;

CREATE TRIGGER IF NOT EXISTS trg_votes_au AFTER UPDATE ON votes
WHEN NEW.subject_type = 'template'
BEGIN
  UPDATE template_stats SET votes = votes - OLD.value
   WHERE slug_key = lower(OLD.subject_id);
  INSERT INTO template_stats (slug_key, votes)
  VALUES (lower(NEW.subject_id), NEW.value)
  ON CONFLICT(slug_key) DO UPDATE SET votes = votes + NEW.value;
END;

-- Backfill from the live tables. Triggers only see writes from here on, so the
-- existing log has to be folded in once.
INSERT INTO template_stats (slug_key, times_ranked)
SELECT lower(slug), COUNT(*) FROM rankings GROUP BY lower(slug)
ON CONFLICT(slug_key) DO UPDATE SET times_ranked = excluded.times_ranked;

INSERT INTO template_stats (slug_key, votes)
SELECT lower(subject_id), SUM(value) FROM votes
 WHERE subject_type = 'template'
 GROUP BY lower(subject_id)
ON CONFLICT(slug_key) DO UPDATE SET votes = excluded.votes;
