-- Denormalized listing columns on `templates`.
--
-- Every listing render (home, /search, /category, profiles, the "Following"
-- row) selects two things that do not live on the template row:
--
--   * `option_names` — the space-joined option names, which is the haystack
--     /search's text filter matches against;
--   * `option_images` — the first few option images, which paint the collage
--     cover of a template that has no cover image of its own.
--
-- Both were subqueries over `template_options` inside TEMPLATE_LIST_SELECT, so
-- listing ~100 templates walked all ~2.5k option rows: 780 rows read per
-- render, and now ~70% of this database's entire read budget.
--
-- Storing them on the template row makes a listing read the templates and
-- their creators and nothing else. Same trade as 0021: options are written
-- when someone creates or edits a template, and read on every page view.
ALTER TABLE templates ADD COLUMN option_names TEXT;
ALTER TABLE templates ADD COLUMN option_images TEXT;

-- Maintained by triggers, for the reason given in 0021: a column the write
-- paths have to remember to refresh is a column that a future write path
-- forgets, silently. Here that would mean a renamed option staying findable
-- under its old name, or a deleted image still painting a card.
--
-- The recomputation is spelled out once per trigger because SQLite has no way
-- to share a statement between them. It must stay identical in all four, and
-- identical to what TEMPLATE_LIST_SELECT used to compute inline:
--
--   names  — GROUP_CONCAT over every option of the template
--   images — the first COLLAGE_TILES non-empty images, in option order
--
-- COLLAGE_TILES is 4 (src/lib/covers.ts). It is baked into the LIMIT below:
-- raising it needs a new migration, and covers.test.ts fails if the two drift.

CREATE TRIGGER IF NOT EXISTS trg_template_options_ai
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

CREATE TRIGGER IF NOT EXISTS trg_template_options_ad
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

-- An edit rewrites names, images and positions in place, and could in
-- principle move an option to another template — so both sides are refreshed.
CREATE TRIGGER IF NOT EXISTS trg_template_options_au
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

-- Backfill: the triggers only see writes from here on.
UPDATE templates SET
  option_names = (
    SELECT GROUP_CONCAT(o.name, ' ') FROM template_options o
     WHERE o.template_id = templates.id
  ),
  option_images = (
    SELECT GROUP_CONCAT(img, char(10)) FROM (
      SELECT o.image AS img FROM template_options o
       WHERE o.template_id = templates.id
         AND o.image IS NOT NULL AND o.image != ''
       ORDER BY o.position, o.id
       LIMIT 4
    )
  );

-- The collage subquery orders by (position, id) within one template, and the
-- name concat groups by template. The existing index is on template_id alone,
-- which leaves both to sort; this one hands them the order they ask for and
-- covers the columns they read, so a recompute never touches the table.
CREATE INDEX IF NOT EXISTS idx_template_options_listing
  ON template_options (template_id, position, id, image, name);
