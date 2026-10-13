ALTER TABLE "reader_profiles" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "reader_profiles" ADD COLUMN "sms_notifications_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reader_profiles" ADD COLUMN "sms_consent_at" timestamp with time zone;--> statement-breakpoint

CREATE TYPE "public"."notification_delivery_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reading_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"provider_message_id" text,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_reading_id_reading_sessions_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."reading_sessions"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_reading_recipient_channel_uidx" ON "notification_deliveries" USING btree ("reading_id","recipient_id","channel");--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.bootstrap_client(
  p_neon_auth_user_id text,
  p_email text,
  p_username text,
  p_full_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  UPDATE users
  SET email = lower(p_email),
      username = p_username,
      full_name = p_full_name,
      updated_at = now()
  WHERE neon_auth_user_id = p_neon_auth_user_id
  RETURNING id INTO v_user_id;

  IF v_user_id IS NOT NULL THEN
    RETURN v_user_id;
  END IF;

  INSERT INTO users (neon_auth_user_id, email, username, full_name, role)
  VALUES (p_neon_auth_user_id, lower(p_email), p_username, p_full_name, 'client')
  RETURNING id INTO v_user_id;

  INSERT INTO client_profiles (user_id) VALUES (v_user_id);
  INSERT INTO wallets (user_id) VALUES (v_user_id);
  RETURN v_user_id;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.bootstrap_client(text, text, text, text) FROM PUBLIC;
