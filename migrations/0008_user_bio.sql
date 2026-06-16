-- 0008_user_bio.sql
-- Optional free-text bio shown on a user's public profile (/u/[username]) and
-- editable from /me. Nullable: existing users have no bio until they set one,
-- and the onboarding/signup flow intentionally does not collect it.

ALTER TABLE users ADD COLUMN bio TEXT;
