CREATE TYPE "public"."refund_status" AS ENUM('pending', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "refund_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reading_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"reader_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reader_reversal_amount" integer DEFAULT 0 NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"stripe_refund_id" text,
	"idempotency_key" text NOT NULL,
	"reason" text NOT NULL,
	"initiated_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_records_positive_amounts" CHECK ("refund_records"."amount" > 0 AND "refund_records"."reader_reversal_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_reading_id_reading_sessions_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."reading_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_reader_id_users_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_initiated_by_id_users_id_fk" FOREIGN KEY ("initiated_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "refund_records_idempotency_uidx" ON "refund_records" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "refund_records_reading_idx" ON "refund_records" USING btree ("reading_id","created_at");