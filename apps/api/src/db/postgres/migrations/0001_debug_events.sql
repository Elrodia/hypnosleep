CREATE TABLE "debug_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rid" varchar(64) NOT NULL,
	"level" varchar(8) NOT NULL,
	"category" varchar(32) NOT NULL,
	"reason" varchar(64),
	"user_id" varchar(36),
	"message" text NOT NULL,
	"context" jsonb,
	"error_name" varchar(128),
	"error_message" text,
	"error_code" varchar(64),
	"http_status" integer,
	"method" varchar(8),
	"path" varchar(512),
	"user_agent" varchar(512),
	"ip_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "debug_events_rid_idx" ON "debug_events" USING btree ("rid","created_at");--> statement-breakpoint
CREATE INDEX "debug_events_category_idx" ON "debug_events" USING btree ("category","created_at");--> statement-breakpoint
CREATE INDEX "debug_events_user_idx" ON "debug_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "debug_events_created_idx" ON "debug_events" USING btree ("created_at");