-- 0018_marketing_consent.sql — opt-in consent for marketing email.
--
-- `users.email` (0011) was collected to send NOTIFICATIONS, and
-- `users.email_notifications` is the opt-out for exactly that purpose. Under
-- the GDPR consent is purpose-specific, so product news / marketing needs its
-- own record: reusing the notification address for a newsletter is a different
-- processing purpose than the one the user agreed to.
--
-- Hence a separate, opt-in-by-default-OFF column, plus the two fields that make
-- the consent auditable if it is ever challenged:
--   `marketing_consent_at`     — when it was last turned on (NULL when never)
--   `marketing_consent_source` — where it was given: 'signup' | 'preferences'
--
-- Withdrawing consent keeps the timestamp/source of the last opt-in: what
-- matters for an audit is the proof of the consent under which a message was
-- sent, and `marketing_consent = 0` is what the sending path must check.

ALTER TABLE users ADD COLUMN marketing_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN marketing_consent_at TEXT;
ALTER TABLE users ADD COLUMN marketing_consent_source TEXT;

-- The audience query for a future campaign: everyone who opted in and has an
-- address on file.
CREATE INDEX IF NOT EXISTS idx_users_marketing_consent
  ON users (marketing_consent) WHERE marketing_consent = 1;
