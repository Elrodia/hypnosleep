CREATE TABLE "ai_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"prompt_text" text NOT NULL,
	"model" varchar(64) NOT NULL,
	"tokens_input" integer,
	"tokens_output" integer,
	"generation_ms" integer,
	"voice" varchar(64) NOT NULL,
	"status" varchar(16) NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" varchar(64) NOT NULL,
	"session_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mood_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rating_range" CHECK ("mood_logs"."rating" >= 1 AND "mood_logs"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "streaks" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_listen_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"insight_text" text NOT NULL,
	"week_start" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_gen_user_idx" ON "ai_generations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "events_user_idx" ON "events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "mood_user_idx" ON "mood_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "insights_user_week_idx" ON "weekly_insights" USING btree ("user_id","week_start");