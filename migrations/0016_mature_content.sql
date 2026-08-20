-- 0016_mature_content.sql — manual "mature content" flag + the per-viewer
-- opt-in that decides whether flagged templates are listed at all.
--
-- There is no AI moderation here: a template is flagged by its creator (the
-- checkbox in the create/edit form) or by an admin from the admin panel.
--
-- `templates.is_mature` hides the template from every public listing (home,
-- search, category, profiles, sitemap, recommendations, following) unless the
-- viewer opted in, and gates its own page behind a blur + confirmation modal.
-- It only has an effect on PUBLIC templates: private/unlisted ones are already
-- unlisted, so the flag simply travels with them until they are made public.
--
-- `templates.mature_locked` is set when an ADMIN decides the flag: the creator
-- can then no longer clear it from the edit form (they can still flag their own
-- template, which is never harmful). Clearing the flag from the admin panel
-- also clears the lock.
--
-- `users.show_mature` is the account-level preference (default off). The render
-- path reads the `rm_mature` cookie — this column is what syncs that cookie
-- across devices, via /api/auth/me.
ALTER TABLE templates ADD COLUMN is_mature INTEGER NOT NULL DEFAULT 0;
ALTER TABLE templates ADD COLUMN mature_locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN show_mature INTEGER NOT NULL DEFAULT 0;
