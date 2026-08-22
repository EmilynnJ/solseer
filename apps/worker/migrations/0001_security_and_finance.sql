ALTER TABLE "forum_comments"
  ADD CONSTRAINT "forum_comments_parent_id_fk"
  FOREIGN KEY ("parent_id") REFERENCES "forum_comments"("id")
  ON DELETE CASCADE;--> statement-breakpoint

-- Neon Auth/Data API databases already provide auth.user_id() in a protected
-- schema. Only install the fail-closed compatibility function when it is
-- absent, so migrations do not try to replace Neon's managed function.
DO $compat$
BEGIN
  IF to_regprocedure('auth.user_id()') IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
      EXECUTE 'CREATE SCHEMA auth';
    END IF;
    EXECUTE 'CREATE FUNCTION auth.user_id() RETURNS text LANGUAGE sql STABLE AS $fn$ SELECT NULL::text $fn$';
  END IF;
END
$compat$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE neon_auth_user_id = auth.user_id() LIMIT 1
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.app_user_id() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.app_user_id() TO PUBLIC;--> statement-breakpoint

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
  SELECT id INTO v_user_id FROM users WHERE neon_auth_user_id = p_neon_auth_user_id;
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

REVOKE ALL ON FUNCTION public.bootstrap_client(text, text, text, text) FROM PUBLIC;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.accept_reader_invitation(
  p_neon_auth_user_id text,
  p_email text,
  p_token_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite reader_invitations%ROWTYPE;
  v_user_id uuid;
BEGIN
  SELECT * INTO v_invite
  FROM reader_invitations
  WHERE token_hash = p_token_hash
    AND lower(email) = lower(p_email)
    AND accepted_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired_reader_invitation' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE neon_auth_user_id = p_neon_auth_user_id) THEN
    RAISE EXCEPTION 'identity_already_bootstrapped' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO users (neon_auth_user_id, email, username, full_name, role)
  VALUES (p_neon_auth_user_id, lower(v_invite.email), v_invite.username, v_invite.full_name, 'reader')
  RETURNING id INTO v_user_id;

  INSERT INTO reader_profiles (
    user_id, bio, specialties, verification_status,
    pricing_chat, pricing_voice, pricing_video
  ) VALUES (
    v_user_id, v_invite.bio, v_invite.specialties, v_invite.verification_status,
    v_invite.pricing_chat, v_invite.pricing_voice, v_invite.pricing_video
  );
  INSERT INTO wallets (user_id) VALUES (v_user_id);
  INSERT INTO pending_payouts (reader_id) VALUES (v_user_id);
  UPDATE reader_invitations SET accepted_at = now() WHERE id = v_invite.id;
  RETURN v_user_id;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.accept_reader_invitation(text, text, text) FROM PUBLIC;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.credit_wallet_payment(
  p_user_id uuid,
  p_amount integer,
  p_stripe_reference text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before integer;
  v_after integer;
  v_existing wallet_ledger_entries%ROWTYPE;
BEGIN
  IF p_amount < 500 THEN
    RAISE EXCEPTION 'top_up_below_minimum' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing FROM wallet_ledger_entries WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('duplicate', true, 'balance', v_existing.balance_after);
  END IF;

  SELECT available_balance INTO v_before FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found' USING ERRCODE = 'P0001';
  END IF;
  v_after := v_before + p_amount;

  UPDATE wallets
  SET available_balance = v_after, version = version + 1, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO wallet_ledger_entries (
    user_id, type, amount, balance_before, balance_after,
    stripe_reference, idempotency_key, reason
  ) VALUES (
    p_user_id, 'top_up', p_amount, v_before, v_after,
    p_stripe_reference, p_idempotency_key, 'Verified Stripe PaymentIntent'
  );
  RETURN jsonb_build_object('duplicate', false, 'balance', v_after);
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.credit_wallet_payment(uuid, integer, text, text) FROM PUBLIC;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.bill_reading_minute(
  p_reading_id uuid,
  p_billing_sequence integer,
  p_billed_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reading reading_sessions%ROWTYPE;
  v_client_before integer;
  v_client_after integer;
  v_reader_before integer;
  v_reader_after integer;
  v_reader_share integer;
  v_platform_share integer;
  v_client_key text;
  v_reader_key text;
BEGIN
  IF p_billing_sequence < 1 THEN
    RAISE EXCEPTION 'invalid_billing_sequence' USING ERRCODE = 'P0001';
  END IF;

  v_client_key := 'reading:' || p_reading_id || ':tick:' || p_billing_sequence || ':client';
  v_reader_key := 'reading:' || p_reading_id || ':tick:' || p_billing_sequence || ':reader';

  IF EXISTS (SELECT 1 FROM wallet_ledger_entries WHERE idempotency_key = v_client_key) THEN
    SELECT * INTO v_reading FROM reading_sessions WHERE id = p_reading_id;
    RETURN jsonb_build_object(
      'result', 'duplicate',
      'sequence', v_reading.billing_sequence,
      'nextBillAt', v_reading.next_bill_at,
      'totalPrice', v_reading.total_price
    );
  END IF;

  SELECT * INTO v_reading FROM reading_sessions WHERE id = p_reading_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reading_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_reading.status <> 'active' THEN
    RETURN jsonb_build_object('result', 'not_active', 'status', v_reading.status);
  END IF;
  IF v_reading.billing_sequence + 1 <> p_billing_sequence THEN
    RAISE EXCEPTION 'billing_sequence_mismatch' USING ERRCODE = 'P0001';
  END IF;

  SELECT available_balance INTO v_client_before
  FROM wallets WHERE user_id = v_reading.client_id FOR UPDATE;
  IF v_client_before < v_reading.price_per_minute THEN
    UPDATE reading_sessions
    SET status = 'ending', next_bill_at = NULL, updated_at = now(),
        failure_reason = 'insufficient_balance'
    WHERE id = p_reading_id;
    RETURN jsonb_build_object('result', 'insufficient_balance', 'balance', v_client_before);
  END IF;

  SELECT available_balance INTO v_reader_before
  FROM wallets WHERE user_id = v_reading.reader_id FOR UPDATE;
  v_reader_share := floor(v_reading.price_per_minute * 7000 / 10000.0)::integer;
  v_platform_share := v_reading.price_per_minute - v_reader_share;
  v_client_after := v_client_before - v_reading.price_per_minute;
  v_reader_after := v_reader_before + v_reader_share;

  UPDATE wallets SET available_balance = v_client_after, version = version + 1, updated_at = now()
  WHERE user_id = v_reading.client_id;
  UPDATE wallets SET available_balance = v_reader_after, version = version + 1, updated_at = now()
  WHERE user_id = v_reading.reader_id;
  INSERT INTO pending_payouts (reader_id, available_amount)
  VALUES (v_reading.reader_id, v_reader_share)
  ON CONFLICT (reader_id) DO UPDATE
  SET available_amount = pending_payouts.available_amount + excluded.available_amount,
      updated_at = now();

  INSERT INTO wallet_ledger_entries (
    user_id, type, amount, balance_before, balance_after, reading_id,
    idempotency_key, reason, metadata
  ) VALUES (
    v_reading.client_id, 'reading_charge', -v_reading.price_per_minute,
    v_client_before, v_client_after, p_reading_id, v_client_key,
    'Authoritative server billing tick',
    jsonb_build_object('billingSequence', p_billing_sequence, 'readerShare', v_reader_share, 'platformShare', v_platform_share)
  );
  INSERT INTO wallet_ledger_entries (
    user_id, type, amount, balance_before, balance_after, reading_id,
    idempotency_key, reason, metadata
  ) VALUES (
    v_reading.reader_id, 'reader_earning', v_reader_share,
    v_reader_before, v_reader_after, p_reading_id, v_reader_key,
    '70 percent reader share',
    jsonb_build_object('billingSequence', p_billing_sequence, 'platformShare', v_platform_share)
  );

  UPDATE reading_sessions
  SET billing_sequence = p_billing_sequence,
      last_billed_through = p_billed_at,
      next_bill_at = p_billed_at + interval '60 seconds',
      total_price = total_price + price_per_minute,
      payment_status = 'paid',
      updated_at = now()
  WHERE id = p_reading_id
  RETURNING * INTO v_reading;

  RETURN jsonb_build_object(
    'result', 'billed',
    'sequence', v_reading.billing_sequence,
    'nextBillAt', v_reading.next_bill_at,
    'totalPrice', v_reading.total_price,
    'clientBalance', v_client_after,
    'readerShare', v_reader_share,
    'platformShare', v_platform_share
  );
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.bill_reading_minute(uuid, integer, timestamptz) FROM PUBLIC;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.adjust_wallet_balance(
  p_user_id uuid,
  p_amount integer,
  p_actor_id uuid,
  p_reason text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before integer;
  v_after integer;
  v_existing wallet_ledger_entries%ROWTYPE;
BEGIN
  IF p_amount = 0 OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'invalid_adjustment' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_existing FROM wallet_ledger_entries WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('duplicate', true, 'balance', v_existing.balance_after);
  END IF;
  SELECT available_balance INTO v_before FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  v_after := v_before + p_amount;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001';
  END IF;
  UPDATE wallets SET available_balance = v_after, version = version + 1, updated_at = now()
  WHERE user_id = p_user_id;
  INSERT INTO wallet_ledger_entries (
    user_id, type, amount, balance_before, balance_after,
    idempotency_key, actor_id, reason
  ) VALUES (p_user_id, 'adjustment', p_amount, v_before, v_after, p_idempotency_key, p_actor_id, p_reason);
  INSERT INTO audit_logs (actor_id, action, target_type, target_id, reason, metadata)
  VALUES (p_actor_id, 'wallet.adjust', 'user', p_user_id::text, p_reason, jsonb_build_object('amount', p_amount));
  RETURN jsonb_build_object('duplicate', false, 'balance', v_after);
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.adjust_wallet_balance(uuid, integer, uuid, text, text) FROM PUBLIC;--> statement-breakpoint

ALTER TABLE users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE reader_profiles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE wallet_ledger_entries ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE reading_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE forum_comments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE forum_flags ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE pending_payouts ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE payout_records ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY users_read_self ON users FOR SELECT USING (id = public.app_user_id());--> statement-breakpoint
CREATE POLICY clients_manage_self ON client_profiles FOR ALL
USING (user_id = public.app_user_id()) WITH CHECK (user_id = public.app_user_id());--> statement-breakpoint
CREATE POLICY readers_public_verified ON reader_profiles FOR SELECT
USING (verification_status = 'verified');--> statement-breakpoint
CREATE POLICY readers_manage_self ON reader_profiles FOR UPDATE
USING (user_id = public.app_user_id()) WITH CHECK (user_id = public.app_user_id());--> statement-breakpoint
CREATE POLICY wallets_read_self ON wallets FOR SELECT USING (user_id = public.app_user_id());--> statement-breakpoint
CREATE POLICY ledger_read_self ON wallet_ledger_entries FOR SELECT USING (user_id = public.app_user_id());--> statement-breakpoint
CREATE POLICY reading_participants_read ON reading_sessions FOR SELECT
USING (client_id = public.app_user_id() OR reader_id = public.app_user_id());--> statement-breakpoint
CREATE POLICY reading_events_participants_read ON reading_events FOR SELECT
USING (EXISTS (
  SELECT 1 FROM reading_sessions r
  WHERE r.id = reading_events.reading_id
    AND (r.client_id = public.app_user_id() OR r.reader_id = public.app_user_id())
));--> statement-breakpoint
CREATE POLICY reviews_public_read ON reviews FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY forum_posts_public_read ON forum_posts FOR SELECT USING (status = 'visible');--> statement-breakpoint
CREATE POLICY forum_posts_author_insert ON forum_posts FOR INSERT
WITH CHECK (author_id = public.app_user_id() AND category <> 'announcements');--> statement-breakpoint
CREATE POLICY forum_posts_author_update ON forum_posts FOR UPDATE
USING (author_id = public.app_user_id()) WITH CHECK (author_id = public.app_user_id());--> statement-breakpoint
CREATE POLICY forum_comments_public_read ON forum_comments FOR SELECT USING (status = 'visible');--> statement-breakpoint
CREATE POLICY forum_comments_author_insert ON forum_comments FOR INSERT
WITH CHECK (author_id = public.app_user_id());--> statement-breakpoint
CREATE POLICY forum_comments_author_update ON forum_comments FOR UPDATE
USING (author_id = public.app_user_id()) WITH CHECK (author_id = public.app_user_id());--> statement-breakpoint
CREATE POLICY forum_flags_reporter_insert ON forum_flags FOR INSERT
WITH CHECK (reporter_id = public.app_user_id());--> statement-breakpoint
CREATE POLICY forum_flags_reporter_read ON forum_flags FOR SELECT
USING (reporter_id = public.app_user_id());--> statement-breakpoint
CREATE POLICY payout_balances_reader_read ON pending_payouts FOR SELECT
USING (reader_id = public.app_user_id());--> statement-breakpoint
CREATE POLICY payout_records_reader_read ON payout_records FOR SELECT
USING (reader_id = public.app_user_id());
