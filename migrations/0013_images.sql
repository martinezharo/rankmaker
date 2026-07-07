-- User-uploaded template images stored in R2 (keys under the u/ prefix, so
-- official covers/ and options/ assets are never touched by cleanup).
-- template_id is NULL while an upload is unclaimed (form not submitted yet);
-- creating/editing a template claims its keys. Unclaimed rows older than a
-- day are lazily deleted (R2 object + row) on the owner's next upload.

CREATE TABLE IF NOT EXISTS images (
  key         TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES templates(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_images_user ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_template ON images(template_id);
