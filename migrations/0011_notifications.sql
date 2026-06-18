-- 0011_notifications.sql — in-app notifications + the bits needed to email them.
--
-- Three notification kinds (see `type`):
--   'comment_on_template' — someone commented on a template you own
--   'comment_reply'       — someone replied to one of your comments
--   'new_template'        — someone you follow published a new public template
--
-- `user_id` is the RECIPIENT; `actor_id` is who triggered it. `slug` + `title`
-- point at the template (title is denormalized because OFFICIAL templates live
-- in JSON, not D1, so a join can't resolve their title — and it keeps the row
-- self-contained if a template is later deleted). `comment_id` is set for the
-- two comment kinds, NULL for new_template. `is_read` flips to 1 when the user
-- opens the notifications page.
--
-- Email plumbing: `users.email` is captured from GitHub on login (user:email
-- scope); `users.email_notifications` is the per-user opt-out (default on).

ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN email_notifications INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  actor_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  comment_id  TEXT,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Listing: a user's notifications, newest first.
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at);
-- Unread badge count: WHERE user_id = ? AND is_read = 0.
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, is_read);
