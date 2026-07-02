-- 0012_deleted_user_placeholder.sql — permanent placeholder account so
-- account deletion no longer cascades through other users' replies.
--
-- comments.user_id cascades on delete (0007_comments.sql), and so does
-- comments.parent_id — deleting a user used to hard-delete their own
-- comments, which in turn cascade-deleted every reply *other* users had
-- written underneath them, even though `softDeleteComment` exists
-- specifically to avoid destroying content that isn't the deleting user's
-- own. `detachUserComments` (src/lib/comments.ts), called by
-- api/auth/delete-account.ts before the `DELETE FROM users`, reassigns the
-- deleting user's comments to this placeholder first so that cascade never
-- fires for them. Fixed id, no github_id so it can never log in — same
-- pattern as the official account in 0001_init.sql.
INSERT OR IGNORE INTO users (id, github_id, username, avatar, is_verified)
VALUES ('deleted-user', NULL, 'deleted-user', 'star-purple', 0);
