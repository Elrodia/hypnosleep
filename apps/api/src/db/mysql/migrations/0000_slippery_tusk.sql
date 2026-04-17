CREATE TABLE `favorites` (
	`user_id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `favorites_user_id_session_id_pk` PRIMARY KEY(`user_id`,`session_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`oauth_provider` enum('google','github','microsoft') NOT NULL,
	`oauth_id` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255) NOT NULL,
	`avatar_url` varchar(1024),
	`plan` enum('free','pro') NOT NULL DEFAULT 'free',
	`preferences` json,
	`referral_code` varchar(12) NOT NULL,
	`referred_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_referral_code_unique` UNIQUE(`referral_code`),
	CONSTRAINT `users_oauth_lookup` UNIQUE(`oauth_provider`,`oauth_id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`script_text` text,
	`category` enum('sleep','confidence','fears','habits','focus','anxiety','custom') NOT NULL,
	`duration_sec` int NOT NULL,
	`voice_id` varchar(64) NOT NULL,
	`background_sound` varchar(32) DEFAULT 'silence',
	`audio_url` varchar(1024),
	`play_count` int NOT NULL DEFAULT 0,
	`is_template` boolean NOT NULL DEFAULT false,
	`status` enum('generating','ready','failed') NOT NULL DEFAULT 'generating',
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`plan` enum('monthly','yearly') NOT NULL,
	`stripe_customer_id` varchar(255) NOT NULL,
	`stripe_subscription_id` varchar(255) NOT NULL,
	`status` enum('trialing','active','past_due','canceled','incomplete','incomplete_expired') NOT NULL,
	`trial_ends_at` timestamp,
	`current_period_end` timestamp NOT NULL,
	`canceled_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_stripe_subscription_id_unique` UNIQUE(`stripe_subscription_id`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` varchar(36) NOT NULL,
	`referrer_id` varchar(36) NOT NULL,
	`referred_id` varchar(36) NOT NULL,
	`reward_applied` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`),
	CONSTRAINT `referrals_referred_id_unique` UNIQUE(`referred_id`)
);
--> statement-breakpoint
CREATE TABLE `usage_counters` (
	`user_id` varchar(36) NOT NULL,
	`period_yyyymm` varchar(6) NOT NULL,
	`generations_count` int NOT NULL DEFAULT 0,
	CONSTRAINT `usage_counters_user_id_period_yyyymm_pk` PRIMARY KEY(`user_id`,`period_yyyymm`)
);
--> statement-breakpoint
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_session_id_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referrals` ADD CONSTRAINT `referrals_referrer_id_users_id_fk` FOREIGN KEY (`referrer_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referrals` ADD CONSTRAINT `referrals_referred_id_users_id_fk` FOREIGN KEY (`referred_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usage_counters` ADD CONSTRAINT `usage_counters_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `template_idx` ON `sessions` (`is_template`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `sessions` (`category`);