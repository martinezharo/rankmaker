-- Template visibility: public (listed everywhere), private (creator only),
-- unlisted (anyone with the link; the slug is random so it can't be guessed).
ALTER TABLE templates ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'private', 'unlisted'));
