-- Revert the email-OTP (passwordless) sign-in feature added in 0004.
-- The frontend no longer exposes "Continue with Email" and the backend
-- routes have been removed, so the table is no longer referenced.
--
-- We deliberately do NOT narrow the `oauth_provider` enum back to three
-- values here: any user rows that were created while the feature was
-- live would otherwise be silently coerced to an empty string and lose
-- their provider attribution. Leaving `'email'` as a legal enum value
-- is harmless — runtime code never produces it anymore.
DROP TABLE IF EXISTS `email_otp_tokens`;
