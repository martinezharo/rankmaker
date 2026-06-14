-- 0006_ranking_results_cover.sql
-- Snapshot the template's cover image alongside the ranked result, so the
-- /history page can show the template thumbnail (matching the template cards)
-- without a live lookup — and so it survives the template being edited or
-- deleted, exactly like the ranked options' names/images already are.
--
-- Nullable: rows saved before this migration have no cover and fall back to the
-- winning option's image on render until the template is ranked again.

ALTER TABLE ranking_results ADD COLUMN cover TEXT;
