-- Users, sessions and user-created templates.
-- Option ids MUST be integers: the ranking engine does parseInt(card.dataset.itemId).

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  github_id   INTEGER UNIQUE,
  username    TEXT NOT NULL UNIQUE COLLATE NOCASE,
  avatar      TEXT NOT NULL DEFAULT 'star-purple',
  is_verified INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS templates (
  id          TEXT PRIMARY KEY,
  creator_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL,
  cover_image TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_templates_creator ON templates(creator_id);

CREATE TABLE IF NOT EXISTS template_options (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  image       TEXT,
  position    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_template_options_tpl ON template_options(template_id);

-- Official RANKMAKER account. Fixed id, no github_id so it can never log in.
-- The UNIQUE COLLATE NOCASE constraint also stops anyone registering "rankmaker".
INSERT OR IGNORE INTO users (id, github_id, username, avatar, is_verified)
VALUES ('rankmaker-official', NULL, 'RANKMAKER', 'official', 1);
