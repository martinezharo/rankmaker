-- 0020_users_email_verified.sql — is the address on this account provider-verified?
--
-- 0019 made a verified email enough to link a second provider into an existing
-- account. That is only safe if the address it matches was itself vouched for:
-- an account holding an address nobody ever verified would hand itself to
-- whoever can get a provider to hand us that address.
--
-- `users.email` is not that. It is the best address we have for notifications,
-- and it is written from whatever the provider gave us — for GitHub that is the
-- primary verified address when the `user:email` scope answers, and the public
-- profile email when it does not (see src/lib/oauth-providers.ts). So the flag
-- records what the provider actually said, and only a flagged row can be
-- matched (src/lib/identities.ts).
--
-- Backfill: every address stored before this migration came through GitHub,
-- which exposes verified addresses on both paths — `/user/emails` is filtered
-- to `verified`, and the public profile email can only be chosen from
-- addresses already verified on the account. Those are marked verified so the
-- 79 accounts that exist today link to Google on the first click rather than
-- quietly becoming a second, empty account. Anything stored from here on gets
-- the flag its provider earned.
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

UPDATE users
SET email_verified = 1
WHERE email IS NOT NULL
  AND id IN (SELECT user_id FROM user_identities WHERE provider = 'github');
