-- 0024_template_suspension_reason_check.sql — enforce the suspension reason
-- invariant on databases that already applied 0023.
--
-- 0023 originally added the nullable column without a constraint, and it was
-- applied to production before the constraint was added. SQLite cannot alter
-- the CHECK constraint of an existing table, so this migration rebuilds the
-- templates table with the same schema plus the constraint.
--
-- template_options and images reference templates directly. They are rebuilt
-- as part of the swap so their foreign keys point at the new table and their
-- rows, indexes and ON DELETE actions survive intact. D1 runs migrations in
-- an implicit transaction and keeps foreign-key enforcement on; deferring the
-- checks allows the temporary table names during the swap without weakening
-- enforcement after the migration finishes.

PRAGMA defer_foreign_keys = ON;

-- These triggers refer to both tables being swapped. Drop and recreate them
-- so they are attached to the replacement template_options table.
DROP TRIGGER IF EXISTS trg_template_options_ai;
DROP TRIGGER IF EXISTS trg_template_options_ad;
DROP TRIGGER IF EXISTS trg_template_options_au;

ALTER TABLE template_options RENAME TO template_options_old;
ALTER TABLE images RENAME TO images_old;
ALTER TABLE templates RENAME TO templates_old;

CREATE TABLE templates (
  id          TEXT PRIMARY KEY,
  creator_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL,
  cover_image TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  visibility  TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private', 'unlisted')),
  is_mature   INTEGER NOT NULL DEFAULT 0,
  mature_locked INTEGER NOT NULL DEFAULT 0,
  option_names TEXT,
  option_images TEXT,
  suspension_reason TEXT
    CHECK (
      suspension_reason IS NULL
      OR suspension_reason IN ('low_quality')
    )
);

INSERT INTO templates
  (id, creator_id, slug, title, description, category, cover_image,
   created_at, updated_at, visibility, is_mature, mature_locked,
   option_names, option_images, suspension_reason)
SELECT id, creator_id, slug, title, description, category, cover_image,
       created_at, updated_at, visibility, is_mature, mature_locked,
       option_names, option_images, suspension_reason
FROM templates_old;

CREATE TABLE template_options (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  image       TEXT,
  position    INTEGER NOT NULL DEFAULT 0
);

INSERT INTO template_options (id, template_id, name, image, position)
SELECT id, template_id, name, image, position
FROM template_options_old;

CREATE TABLE images (
  key         TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES templates(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO images (key, user_id, template_id, created_at)
SELECT key, user_id, template_id, created_at
FROM images_old;

-- The old child tables must be gone before the old parent is dropped, so the
-- old ON DELETE actions cannot touch the copied rows in the replacements.
DROP TABLE template_options_old;
DROP TABLE images_old;
DROP TABLE templates_old;

CREATE INDEX idx_templates_creator ON templates(creator_id);
CREATE INDEX idx_template_options_tpl ON template_options(template_id);
CREATE INDEX idx_template_options_listing
  ON template_options (template_id, position, id, image, name);
CREATE INDEX idx_images_user ON images(user_id);
CREATE INDEX idx_images_template ON images(template_id);

CREATE TRIGGER trg_template_options_ai
AFTER INSERT ON template_options
BEGIN
  UPDATE templates SET
    option_names = (
      SELECT GROUP_CONCAT(o.name, ' ') FROM template_options o
       WHERE o.template_id = NEW.template_id
    ),
    option_images = (
      SELECT GROUP_CONCAT(img, char(10)) FROM (
        SELECT o.image AS img FROM template_options o
         WHERE o.template_id = NEW.template_id
           AND o.image IS NOT NULL AND o.image != ''
         ORDER BY o.position, o.id
         LIMIT 4
      )
    )
  WHERE id = NEW.template_id;
END;

CREATE TRIGGER trg_template_options_ad
AFTER DELETE ON template_options
BEGIN
  UPDATE templates SET
    option_names = (
      SELECT GROUP_CONCAT(o.name, ' ') FROM template_options o
       WHERE o.template_id = OLD.template_id
    ),
    option_images = (
      SELECT GROUP_CONCAT(img, char(10)) FROM (
        SELECT o.image AS img FROM template_options o
         WHERE o.template_id = OLD.template_id
           AND o.image IS NOT NULL AND o.image != ''
         ORDER BY o.position, o.id
         LIMIT 4
      )
    )
  WHERE id = OLD.template_id;
END;

CREATE TRIGGER trg_template_options_au
AFTER UPDATE ON template_options
BEGIN
  UPDATE templates SET
    option_names = (
      SELECT GROUP_CONCAT(o.name, ' ') FROM template_options o
       WHERE o.template_id = NEW.template_id
    ),
    option_images = (
      SELECT GROUP_CONCAT(img, char(10)) FROM (
        SELECT o.image AS img FROM template_options o
         WHERE o.template_id = NEW.template_id
           AND o.image IS NOT NULL AND o.image != ''
         ORDER BY o.position, o.id
         LIMIT 4
      )
    )
  WHERE id = NEW.template_id;

  UPDATE templates SET
    option_names = (
      SELECT GROUP_CONCAT(o.name, ' ') FROM template_options o
       WHERE o.template_id = OLD.template_id
    ),
    option_images = (
      SELECT GROUP_CONCAT(img, char(10)) FROM (
        SELECT o.image AS img FROM template_options o
         WHERE o.template_id = OLD.template_id
           AND o.image IS NOT NULL AND o.image != ''
         ORDER BY o.position, o.id
         LIMIT 4
      )
    )
  WHERE id = OLD.template_id AND OLD.template_id != NEW.template_id;
END;

PRAGMA defer_foreign_keys = OFF;
