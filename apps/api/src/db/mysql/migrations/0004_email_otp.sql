ALTER TABLE `users` MODIFY COLUMN `oauth_provider` enum('google','github','microsoft','email') NOT NULL;
--> statement-breakpoint
ALTER TABLE `oauth_transactions` MODIFY COLUMN `provider` enum('google','github','microsoft','email') NOT NULL;
--> statement-breakpoint
CREATE TABLE `email_otp_tokens` (
  `id` varchar(36) NOT NULL,
  `email` varchar(320) NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `email_otp_tokens_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_otp_tokens_token_hash_uq` ON `email_otp_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `email_otp_tokens_email_idx` ON `email_otp_tokens` (`email`);
--> statement-breakpoint
CREATE INDEX `email_otp_tokens_expires_at_idx` ON `email_otp_tokens` (`expires_at`);
