CREATE TABLE `oauth_transactions` (
  `id` varchar(36) NOT NULL,
  `provider` enum('google','github','microsoft') NOT NULL,
  `state_nonce` varchar(128) NOT NULL,
  `pkce_verifier` varchar(255),
  `referral_code` varchar(32),
  `user_agent_hash` varchar(64),
  `ip_hash` varchar(64),
  `expires_at` timestamp NOT NULL,
  `consumed_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `oauth_transactions_id_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_transactions_state_nonce_uq` ON `oauth_transactions` (`state_nonce`);
--> statement-breakpoint
CREATE INDEX `oauth_transactions_expires_at_idx` ON `oauth_transactions` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `oauth_transactions_consumed_at_idx` ON `oauth_transactions` (`consumed_at`);
