-- 0023_template_suspension.sql — moderation suspension for user templates.
--
-- A suspended template behaves exactly like an unlisted one: it disappears
-- from every public surface (home, search, category, profiles, sitemap,
-- recommendations, following, /api/counts) while its URL keeps working, so
-- people who already have the link — and the creator — are not left with a
-- dead page. The difference from `visibility = 'unlisted'` is who decides it:
-- suspension is set by a moderator and the creator cannot lift it.
--
-- It is a column of its own rather than a fourth `visibility` value on
-- purpose:
--   - `visibility` is creator-owned and writable through /api/templates/[id];
--     suspension must not be, and no API path writes this column at all.
--   - the creator's own choice is preserved, so lifting a suspension restores
--     the template to whatever it was (public/unlisted/private) with no extra
--     bookkeeping.
--
-- NULL means "not suspended". A non-NULL value is a reason key from
-- SUSPENSION_REASONS in src/lib/suspension.ts — it is shown to the creator
-- (translated) behind the info icon on the template's suspended badge, so it
-- must be one of the known keys.
--
-- There is no moderation UI: suspensions are applied from the Cloudflare D1
-- dashboard (or `wrangler d1 execute`), e.g.
--
--   UPDATE templates SET suspension_reason = 'low_quality' WHERE slug = '…';
--   UPDATE templates SET suspension_reason = NULL WHERE slug = '…';  -- lift
ALTER TABLE templates ADD COLUMN suspension_reason TEXT
  CHECK (
    suspension_reason IS NULL
    OR suspension_reason IN ('low_quality')
  );
