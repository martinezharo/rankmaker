-- Rankings event log: one row per "Start Ranking" event.
-- Counts per template are derived with: SELECT slug, COUNT(*) GROUP BY slug.
CREATE TABLE IF NOT EXISTS rankings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  url TEXT,
  date TEXT NOT NULL,
  country TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rankings_slug ON rankings (slug);
