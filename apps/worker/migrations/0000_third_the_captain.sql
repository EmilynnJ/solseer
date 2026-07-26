CREATE TYPE "public"."flag_status" AS ENUM('open', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."forum_category" AS ENUM('general', 'readings', 'spiritual_growth', 'ask_a_reader', 'announcements');--> statement-breakpoint
CREATE TYPE "public"."ledger_type" AS ENUM('top_up', 'reading_charge', 'reader_earning', 'platform_revenue', 'refund', 'adjustment', 'payout');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('visible', 'hidden', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'paid', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."reader_verification_status" AS ENUM('invited', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."reading_status" AS ENUM('pending', 'accepted', 'preflight', 'connecting', 'active', 'ending', 'ended', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."reading_type" AS ENUM('chat', 'voice', 'video');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('client', 'reader', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"status" "moderation_status" DEFAULT 'visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"post_id" uuid,
	"comment_id" uuid,
	"reason" text NOT NULL,
	"status" "flag_status" DEFAULT 'open' NOT NULL,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_flags_one_target" CHECK (("forum_flags"."post_id" IS NOT NULL AND "forum_flags"."comment_id" IS NULL) OR ("forum_flags"."post_id" IS NULL AND "forum_flags"."comment_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "forum_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"category" "forum_category" NOT NULL,
	"status" "moderation_status" DEFAULT 'visible' NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"consent_source" text NOT NULL,
	"status" text DEFAULT 'subscribed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reader_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"stripe_transfer_id" text,
	"stripe_payout_id" text,
	"idempotency_key" text NOT NULL,
	"initiated_by_id" uuid NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_records_positive_amount" CHECK ("payout_records"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "pending_payouts" (
	"reader_id" uuid PRIMARY KEY NOT NULL,
	"available_amount" integer DEFAULT 0 NOT NULL,
	"reserved_amount" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_payouts_nonnegative" CHECK ("pending_payouts"."available_amount" >= 0 AND "pending_payouts"."reserved_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reader_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"full_name" text NOT NULL,
	"bio" text NOT NULL,
	"specialties" text[] DEFAULT '{}'::text[] NOT NULL,
	"pricing_chat" integer NOT NULL,
	"pricing_voice" integer NOT NULL,
	"pricing_video" integer NOT NULL,
	"token_hash" text NOT NULL,
	"verification_status" "reader_verification_status" DEFAULT 'invited' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"invited_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reader_invitations_nonnegative_rates" CHECK ("reader_invitations"."pricing_chat" >= 0 AND "reader_invitations"."pricing_voice" >= 0 AND "reader_invitations"."pricing_video" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reader_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"specialties" text[] DEFAULT '{}'::text[] NOT NULL,
	"profile_image_key" text,
	"verification_status" "reader_verification_status" DEFAULT 'invited' NOT NULL,
	"pricing_chat" integer DEFAULT 0 NOT NULL,
	"pricing_voice" integer DEFAULT 0 NOT NULL,
	"pricing_video" integer DEFAULT 0 NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"stripe_account_id" text,
	"stripe_onboarding_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reader_profiles_nonnegative_rates" CHECK ("reader_profiles"."pricing_chat" >= 0 AND "reader_profiles"."pricing_voice" >= 0 AND "reader_profiles"."pricing_video" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reading_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reading_id" uuid NOT NULL,
	"provider_event_key" text NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reader_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"type" "reading_type" NOT NULL,
	"status" "reading_status" DEFAULT 'pending' NOT NULL,
	"price_per_minute" integer NOT NULL,
	"cloudflare_meeting_id" text,
	"cloudflare_session_id" text,
	"client_participant_id" text,
	"reader_participant_id" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_billed_through" timestamp with time zone,
	"next_bill_at" timestamp with time zone,
	"billing_sequence" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"total_price" integer DEFAULT 0 NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"chat_transcript" jsonb,
	"failure_reason" text,
	"ended_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_sessions_distinct_participants" CHECK ("reading_sessions"."reader_id" <> "reading_sessions"."client_id"),
	CONSTRAINT "reading_sessions_nonnegative_price" CHECK ("reading_sessions"."price_per_minute" >= 0),
	CONSTRAINT "reading_sessions_nonnegative_totals" CHECK ("reading_sessions"."billing_sequence" >= 0 AND "reading_sessions"."duration_seconds" >= 0 AND "reading_sessions"."total_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reading_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"reader_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"neon_auth_user_id" text NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "ledger_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reading_id" uuid,
	"stripe_reference" text,
	"idempotency_key" text NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_ledger_balances_nonnegative" CHECK ("wallet_ledger_entries"."balance_before" >= 0 AND "wallet_ledger_entries"."balance_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"available_balance" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_nonnegative_balance" CHECK ("wallets"."available_balance" >= 0),
	CONSTRAINT "wallets_valid_version" CHECK ("wallets"."version" >= 0)
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_flags" ADD CONSTRAINT "forum_flags_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_flags" ADD CONSTRAINT "forum_flags_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_flags" ADD CONSTRAINT "forum_flags_comment_id_forum_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."forum_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_flags" ADD CONSTRAINT "forum_flags_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_records" ADD CONSTRAINT "payout_records_reader_id_users_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_records" ADD CONSTRAINT "payout_records_initiated_by_id_users_id_fk" FOREIGN KEY ("initiated_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_payouts" ADD CONSTRAINT "pending_payouts_reader_id_users_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_invitations" ADD CONSTRAINT "reader_invitations_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_profiles" ADD CONSTRAINT "reader_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_events" ADD CONSTRAINT "reading_events_reading_id_reading_sessions_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."reading_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_reader_id_users_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_ended_by_id_users_id_fk" FOREIGN KEY ("ended_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reading_id_reading_sessions_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."reading_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reader_id_users_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_reading_id_reading_sessions_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."reading_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "forum_comments_post_idx" ON "forum_comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "forum_flags_status_idx" ON "forum_flags" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "forum_posts_feed_idx" ON "forum_posts" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_email_lower_uidx" ON "newsletter_subscribers" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "payout_records_idempotency_uidx" ON "payout_records" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payout_records_reader_idx" ON "payout_records" USING btree ("reader_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_events_provider_id_uidx" ON "provider_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reader_invitations_token_hash_uidx" ON "reader_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "reader_invitations_email_idx" ON "reader_invitations" USING btree ("email","expires_at");--> statement-breakpoint
CREATE INDEX "reader_profiles_online_idx" ON "reader_profiles" USING btree ("is_online","last_heartbeat_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reading_events_provider_key_uidx" ON "reading_events" USING btree ("provider_event_key");--> statement-breakpoint
CREATE INDEX "reading_events_reading_idx" ON "reading_events" USING btree ("reading_id","occurred_at");--> statement-breakpoint
CREATE INDEX "reading_sessions_client_idx" ON "reading_sessions" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "reading_sessions_reader_idx" ON "reading_sessions" USING btree ("reader_id","created_at");--> statement-breakpoint
CREATE INDEX "reading_sessions_status_idx" ON "reading_sessions" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reading_sessions_meeting_uidx" ON "reading_sessions" USING btree ("cloudflare_meeting_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_reading_uidx" ON "reviews" USING btree ("reading_id");--> statement-breakpoint
CREATE INDEX "reviews_reader_idx" ON "reviews" USING btree ("reader_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_neon_auth_user_id_uidx" ON "users" USING btree ("neon_auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uidx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_uidx" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_ledger_idempotency_uidx" ON "wallet_ledger_entries" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "wallet_ledger_user_idx" ON "wallet_ledger_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "wallet_ledger_reading_idx" ON "wallet_ledger_entries" USING btree ("reading_id");