ALTER TYPE "public"."ledger_type" RENAME TO "ledger_type_old";--> statement-breakpoint
CREATE TYPE "public"."ledger_type" AS ENUM('top_up', 'reading_charge', 'reader_earning', 'platform_revenue', 'refund', 'adjustment', 'payout', 'message_charge', 'message_earning');--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" ALTER COLUMN "type" TYPE "public"."ledger_type" USING "type"::text::"public"."ledger_type";--> statement-breakpoint
DROP TYPE "public"."ledger_type_old";--> statement-breakpoint

CREATE TYPE "public"."direct_message_kind" AS ENUM('client_message', 'reader_free', 'reader_paid');--> statement-breakpoint

CREATE TABLE "message_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"reader_id" uuid NOT NULL,
	"client_last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reader_last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_conversations_distinct_participants" CHECK ("client_id" <> "reader_id")
);--> statement-breakpoint

CREATE TABLE "direct_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"kind" "direct_message_kind" NOT NULL,
	"body" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "direct_messages_body_length" CHECK (char_length("body") BETWEEN 1 AND 8000),
	CONSTRAINT "direct_messages_price_matches_kind" CHECK (("kind" = 'reader_paid' AND "price_cents" BETWEEN 100 AND 100000) OR ("kind" <> 'reader_paid' AND "price_cents" = 0))
);--> statement-breakpoint

CREATE TABLE "message_unlocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"reader_id" uuid NOT NULL,
	"price_cents" integer NOT NULL,
	"reader_share" integer NOT NULL,
	"platform_share" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_unlocks_split_valid" CHECK ("price_cents" > 0 AND "reader_share" >= 0 AND "platform_share" >= 0 AND "reader_share" + "platform_share" = "price_cents")
);--> statement-breakpoint

ALTER TABLE "message_conversations" ADD CONSTRAINT "message_conversations_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "message_conversations" ADD CONSTRAINT "message_conversations_reader_id_users_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."users"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_conversation_id_message_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."message_conversations"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "message_unlocks" ADD CONSTRAINT "message_unlocks_message_id_direct_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."direct_messages"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "message_unlocks" ADD CONSTRAINT "message_unlocks_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "message_unlocks" ADD CONSTRAINT "message_unlocks_reader_id_users_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."users"("id") ON DELETE restrict;--> statement-breakpoint

CREATE UNIQUE INDEX "message_conversations_client_reader_uidx" ON "message_conversations" ("client_id", "reader_id");--> statement-breakpoint
CREATE INDEX "message_conversations_client_idx" ON "message_conversations" ("client_id", "last_message_at");--> statement-breakpoint
CREATE INDEX "message_conversations_reader_idx" ON "message_conversations" ("reader_id", "last_message_at");--> statement-breakpoint
CREATE INDEX "direct_messages_conversation_idx" ON "direct_messages" ("conversation_id", "created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_unlocks_message_uidx" ON "message_unlocks" ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_unlocks_idempotency_uidx" ON "message_unlocks" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "message_unlocks_client_idx" ON "message_unlocks" ("client_id", "created_at");--> statement-breakpoint
CREATE INDEX "message_unlocks_reader_idx" ON "message_unlocks" ("reader_id", "created_at");--> statement-breakpoint

ALTER TABLE "wallet_ledger_entries" ADD COLUMN "message_id" uuid;--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_message_id_direct_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."direct_messages"("id") ON DELETE restrict;--> statement-breakpoint
CREATE INDEX "wallet_ledger_message_idx" ON "wallet_ledger_entries" ("message_id");--> statement-breakpoint

DROP INDEX "notification_delivery_reading_recipient_channel_uidx";--> statement-breakpoint
ALTER TABLE "notification_deliveries" ALTER COLUMN "reading_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "message_id" uuid;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_message_id_direct_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."direct_messages"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_one_source" CHECK (("reading_id" IS NOT NULL AND "message_id" IS NULL) OR ("reading_id" IS NULL AND "message_id" IS NOT NULL));--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_reading_recipient_channel_uidx" ON "notification_deliveries" ("reading_id", "recipient_id", "channel") WHERE "reading_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_message_recipient_channel_uidx" ON "notification_deliveries" ("message_id", "recipient_id", "channel") WHERE "message_id" IS NOT NULL;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.send_client_message(
  p_client_id uuid,
  p_reader_id uuid,
  p_body text
)
RETURNS TABLE(conversation_id uuid, message_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid;
  v_message_id uuid;
BEGIN
  IF char_length(btrim(p_body)) NOT BETWEEN 1 AND 8000 THEN
    RAISE EXCEPTION 'invalid_message_body' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM users u
    JOIN reader_profiles rp ON rp.user_id = u.id
    WHERE u.id = p_reader_id
      AND u.role = 'reader'
      AND u.status = 'active'
      AND rp.verification_status = 'verified'
  ) THEN
    RAISE EXCEPTION 'reader_unavailable_for_messages' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = p_client_id AND role = 'client' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'client_unavailable_for_messages' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO message_conversations (client_id, reader_id)
  VALUES (p_client_id, p_reader_id)
  ON CONFLICT (client_id, reader_id) DO UPDATE
  SET updated_at = now()
  RETURNING id INTO v_conversation_id;

  INSERT INTO direct_messages (conversation_id, sender_id, kind, body, price_cents)
  VALUES (v_conversation_id, p_client_id, 'client_message', btrim(p_body), 0)
  RETURNING id INTO v_message_id;

  UPDATE message_conversations
  SET client_last_read_at = now(), last_message_at = now(), updated_at = now()
  WHERE id = v_conversation_id;

  RETURN QUERY SELECT v_conversation_id, v_message_id;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.send_client_message(uuid, uuid, text) FROM PUBLIC;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.send_reader_message(
  p_reader_id uuid,
  p_conversation_id uuid,
  p_body text,
  p_paid boolean,
  p_price_cents integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id uuid;
BEGIN
  IF char_length(btrim(p_body)) NOT BETWEEN 1 AND 8000 THEN
    RAISE EXCEPTION 'invalid_message_body' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM message_conversations
    WHERE id = p_conversation_id AND reader_id = p_reader_id
  ) THEN
    RAISE EXCEPTION 'conversation_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF p_paid AND p_price_cents NOT BETWEEN 100 AND 100000 THEN
    RAISE EXCEPTION 'invalid_paid_reply_price' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO direct_messages (
    conversation_id, sender_id, kind, body, price_cents
  ) VALUES (
    p_conversation_id,
    p_reader_id,
    CASE WHEN p_paid THEN 'reader_paid'::direct_message_kind ELSE 'reader_free'::direct_message_kind END,
    btrim(p_body),
    CASE WHEN p_paid THEN p_price_cents ELSE 0 END
  )
  RETURNING id INTO v_message_id;

  UPDATE message_conversations
  SET reader_last_read_at = now(), last_message_at = now(), updated_at = now()
  WHERE id = p_conversation_id;

  RETURN v_message_id;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.send_reader_message(uuid, uuid, text, boolean, integer) FROM PUBLIC;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.unlock_paid_message(
  p_message_id uuid,
  p_client_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message direct_messages%ROWTYPE;
  v_conversation message_conversations%ROWTYPE;
  v_existing message_unlocks%ROWTYPE;
  v_client_before integer;
  v_client_after integer;
  v_reader_before integer;
  v_reader_after integer;
  v_reader_share integer;
  v_platform_share integer;
BEGIN
  IF char_length(p_idempotency_key) NOT BETWEEN 8 AND 200 THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_message
  FROM direct_messages
  WHERE id = p_message_id
  FOR UPDATE;
  IF NOT FOUND OR v_message.kind <> 'reader_paid' THEN
    RAISE EXCEPTION 'paid_message_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_conversation
  FROM message_conversations
  WHERE id = v_message.conversation_id;
  IF v_conversation.client_id <> p_client_id OR v_message.sender_id <> v_conversation.reader_id THEN
    RAISE EXCEPTION 'paid_message_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing
  FROM message_unlocks
  WHERE message_id = p_message_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'result', 'duplicate',
      'balance', (SELECT available_balance FROM wallets WHERE user_id = p_client_id),
      'priceCents', v_existing.price_cents
    );
  END IF;
  IF EXISTS (
    SELECT 1 FROM message_unlocks
    WHERE idempotency_key = p_idempotency_key AND message_id <> p_message_id
  ) THEN
    RAISE EXCEPTION 'idempotency_key_reused' USING ERRCODE = 'P0001';
  END IF;

  PERFORM user_id
  FROM wallets
  WHERE user_id IN (v_conversation.client_id, v_conversation.reader_id)
  ORDER BY user_id
  FOR UPDATE;

  SELECT available_balance INTO v_client_before
  FROM wallets WHERE user_id = v_conversation.client_id;
  SELECT available_balance INTO v_reader_before
  FROM wallets WHERE user_id = v_conversation.reader_id;
  IF v_client_before IS NULL OR v_reader_before IS NULL THEN
    RAISE EXCEPTION 'wallet_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_client_before < v_message.price_cents THEN
    RETURN jsonb_build_object(
      'result', 'insufficient_balance',
      'balance', v_client_before,
      'priceCents', v_message.price_cents
    );
  END IF;

  v_reader_share := floor(v_message.price_cents * 7000 / 10000.0)::integer;
  v_platform_share := v_message.price_cents - v_reader_share;
  v_client_after := v_client_before - v_message.price_cents;
  v_reader_after := v_reader_before + v_reader_share;

  UPDATE wallets
  SET available_balance = v_client_after, version = version + 1, updated_at = now()
  WHERE user_id = v_conversation.client_id;
  UPDATE wallets
  SET available_balance = v_reader_after, version = version + 1, updated_at = now()
  WHERE user_id = v_conversation.reader_id;

  INSERT INTO pending_payouts (reader_id, available_amount)
  VALUES (v_conversation.reader_id, v_reader_share)
  ON CONFLICT (reader_id) DO UPDATE
  SET available_amount = pending_payouts.available_amount + excluded.available_amount,
      updated_at = now();

  INSERT INTO message_unlocks (
    message_id, client_id, reader_id, price_cents,
    reader_share, platform_share, idempotency_key
  ) VALUES (
    p_message_id, v_conversation.client_id, v_conversation.reader_id,
    v_message.price_cents, v_reader_share, v_platform_share, p_idempotency_key
  );

  INSERT INTO wallet_ledger_entries (
    user_id, type, amount, balance_before, balance_after, message_id,
    idempotency_key, reason, metadata
  ) VALUES (
    v_conversation.client_id, 'message_charge', -v_message.price_cents,
    v_client_before, v_client_after, p_message_id,
    'message:' || p_message_id || ':client', 'Premium message unlocked',
    jsonb_build_object('readerShare', v_reader_share, 'platformShare', v_platform_share)
  );
  INSERT INTO wallet_ledger_entries (
    user_id, type, amount, balance_before, balance_after, message_id,
    idempotency_key, reason, metadata
  ) VALUES (
    v_conversation.reader_id, 'message_earning', v_reader_share,
    v_reader_before, v_reader_after, p_message_id,
    'message:' || p_message_id || ':reader', '70 percent Reader share for premium message',
    jsonb_build_object('platformShare', v_platform_share)
  );

  RETURN jsonb_build_object(
    'result', 'unlocked',
    'balance', v_client_after,
    'priceCents', v_message.price_cents,
    'readerShare', v_reader_share,
    'platformShare', v_platform_share
  );
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.unlock_paid_message(uuid, uuid, text) FROM PUBLIC;--> statement-breakpoint

ALTER TABLE "message_conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "direct_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "message_unlocks" ENABLE ROW LEVEL SECURITY;
