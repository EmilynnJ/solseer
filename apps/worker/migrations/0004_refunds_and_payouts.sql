CREATE OR REPLACE FUNCTION public.refund_reading_to_wallet(
  p_reading_id uuid,
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
  v_reading reading_sessions%ROWTYPE;
  v_existing refund_records%ROWTYPE;
  v_client_before integer;
  v_client_after integer;
  v_reader_before integer;
  v_reader_after integer;
  v_pending integer;
  v_reader_reversal integer;
  v_refund_id uuid;
BEGIN
  SELECT * INTO v_existing FROM refund_records WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('duplicate', true, 'refundId', v_existing.id, 'amount', v_existing.amount);
  END IF;

  SELECT * INTO v_reading FROM reading_sessions WHERE id = p_reading_id FOR UPDATE;
  IF NOT FOUND OR v_reading.status <> 'ended' OR v_reading.total_price <= 0 THEN
    RAISE EXCEPTION 'reading_not_refundable' USING ERRCODE = 'P0001';
  END IF;
  IF v_reading.payment_status = 'refunded' THEN
    RAISE EXCEPTION 'reading_already_refunded' USING ERRCODE = 'P0001';
  END IF;

  SELECT available_balance INTO v_client_before FROM wallets WHERE user_id = v_reading.client_id FOR UPDATE;
  SELECT available_balance INTO v_reader_before FROM wallets WHERE user_id = v_reading.reader_id FOR UPDATE;
  SELECT available_amount INTO v_pending FROM pending_payouts WHERE reader_id = v_reading.reader_id FOR UPDATE;
  v_reader_reversal := LEAST(
    floor(v_reading.total_price * 7000 / 10000.0)::integer,
    coalesce(v_pending, 0),
    v_reader_before
  );
  v_client_after := v_client_before + v_reading.total_price;
  v_reader_after := v_reader_before - v_reader_reversal;

  UPDATE wallets SET available_balance = v_client_after, version = version + 1, updated_at = now()
  WHERE user_id = v_reading.client_id;
  UPDATE wallets SET available_balance = v_reader_after, version = version + 1, updated_at = now()
  WHERE user_id = v_reading.reader_id;
  UPDATE pending_payouts SET available_amount = available_amount - v_reader_reversal, updated_at = now()
  WHERE reader_id = v_reading.reader_id;

  INSERT INTO refund_records (
    reading_id, client_id, reader_id, amount, reader_reversal_amount,
    status, idempotency_key, reason, initiated_by_id
  ) VALUES (
    v_reading.id, v_reading.client_id, v_reading.reader_id, v_reading.total_price,
    v_reader_reversal, 'succeeded', p_idempotency_key, p_reason, p_actor_id
  ) RETURNING id INTO v_refund_id;

  INSERT INTO wallet_ledger_entries (
    user_id, type, amount, balance_before, balance_after, reading_id,
    idempotency_key, actor_id, reason, metadata
  ) VALUES (
    v_reading.client_id, 'refund', v_reading.total_price, v_client_before, v_client_after,
    v_reading.id, 'refund:' || p_idempotency_key || ':client', p_actor_id, p_reason,
    jsonb_build_object('refundRecordId', v_refund_id, 'destination', 'soulseer_wallet')
  );
  IF v_reader_reversal > 0 THEN
    INSERT INTO wallet_ledger_entries (
      user_id, type, amount, balance_before, balance_after, reading_id,
      idempotency_key, actor_id, reason, metadata
    ) VALUES (
      v_reading.reader_id, 'adjustment', -v_reader_reversal, v_reader_before, v_reader_after,
      v_reading.id, 'refund:' || p_idempotency_key || ':reader', p_actor_id, p_reason,
      jsonb_build_object('refundRecordId', v_refund_id)
    );
  END IF;
  UPDATE reading_sessions SET payment_status = 'refunded', updated_at = now() WHERE id = v_reading.id;
  INSERT INTO audit_logs (actor_id, action, target_type, target_id, reason, metadata)
  VALUES (
    p_actor_id, 'reading.refund', 'reading', v_reading.id::text, p_reason,
    jsonb_build_object('refundId', v_refund_id, 'amount', v_reading.total_price, 'readerReversal', v_reader_reversal)
  );
  RETURN jsonb_build_object(
    'duplicate', false, 'refundId', v_refund_id, 'amount', v_reading.total_price,
    'readerReversal', v_reader_reversal, 'clientBalance', v_client_after
  );
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.refund_reading_to_wallet(uuid, uuid, text, text) FROM PUBLIC;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.reserve_reader_payout(
  p_reader_id uuid,
  p_actor_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount integer;
  v_account text;
  v_wallet_before integer;
  v_payout_id uuid;
  v_existing payout_records%ROWTYPE;
BEGIN
  SELECT * INTO v_existing FROM payout_records WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    SELECT stripe_account_id INTO v_account FROM reader_profiles WHERE user_id = p_reader_id;
    RETURN jsonb_build_object(
      'duplicate', true, 'payoutId', v_existing.id, 'amount', v_existing.amount,
      'stripeAccountId', v_account
    );
  END IF;

  SELECT available_amount INTO v_amount FROM pending_payouts WHERE reader_id = p_reader_id FOR UPDATE;
  SELECT stripe_account_id INTO v_account
  FROM reader_profiles
  WHERE user_id = p_reader_id AND stripe_onboarding_complete = true
  FOR UPDATE;
  IF v_account IS NULL THEN
    RAISE EXCEPTION 'connect_onboarding_required' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(v_amount, 0) < 1500 THEN
    RAISE EXCEPTION 'payout_below_threshold' USING ERRCODE = 'P0001';
  END IF;
  SELECT available_balance INTO v_wallet_before FROM wallets WHERE user_id = p_reader_id FOR UPDATE;
  IF v_wallet_before < v_amount THEN
    RAISE EXCEPTION 'earnings_balance_mismatch' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO payout_records (reader_id, amount, status, idempotency_key, initiated_by_id)
  VALUES (p_reader_id, v_amount, 'processing', p_idempotency_key, p_actor_id)
  RETURNING id INTO v_payout_id;
  UPDATE pending_payouts
  SET available_amount = 0, reserved_amount = reserved_amount + v_amount, updated_at = now()
  WHERE reader_id = p_reader_id;
  UPDATE wallets
  SET available_balance = available_balance - v_amount, version = version + 1, updated_at = now()
  WHERE user_id = p_reader_id;
  INSERT INTO wallet_ledger_entries (
    user_id, type, amount, balance_before, balance_after,
    idempotency_key, actor_id, reason, metadata
  ) VALUES (
    p_reader_id, 'payout', -v_amount, v_wallet_before, v_wallet_before - v_amount,
    'payout:' || p_idempotency_key, p_actor_id, 'Reader payout reserved',
    jsonb_build_object('payoutRecordId', v_payout_id)
  );
  RETURN jsonb_build_object(
    'duplicate', false, 'payoutId', v_payout_id, 'amount', v_amount,
    'stripeAccountId', v_account
  );
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.reserve_reader_payout(uuid, uuid, text) FROM PUBLIC;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.complete_reader_payout(
  p_payout_id uuid,
  p_stripe_transfer_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout payout_records%ROWTYPE;
BEGIN
  SELECT * INTO v_payout FROM payout_records WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND OR v_payout.status = 'paid' THEN RETURN; END IF;
  IF v_payout.status <> 'processing' THEN
    RAISE EXCEPTION 'payout_not_processing' USING ERRCODE = 'P0001';
  END IF;
  UPDATE payout_records
  SET status = 'paid', stripe_transfer_id = p_stripe_transfer_id, updated_at = now()
  WHERE id = p_payout_id;
  UPDATE pending_payouts
  SET reserved_amount = reserved_amount - v_payout.amount, updated_at = now()
  WHERE reader_id = v_payout.reader_id;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.complete_reader_payout(uuid, text) FROM PUBLIC;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.fail_reader_payout(
  p_payout_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout payout_records%ROWTYPE;
  v_before integer;
BEGIN
  SELECT * INTO v_payout FROM payout_records WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND OR v_payout.status NOT IN ('processing', 'paid') THEN RETURN; END IF;
  SELECT available_balance INTO v_before FROM wallets WHERE user_id = v_payout.reader_id FOR UPDATE;
  UPDATE payout_records SET status = 'failed', failure_reason = p_reason, updated_at = now()
  WHERE id = p_payout_id;
  IF v_payout.status = 'processing' THEN
    UPDATE pending_payouts
    SET reserved_amount = reserved_amount - v_payout.amount,
        available_amount = available_amount + v_payout.amount,
        updated_at = now()
    WHERE reader_id = v_payout.reader_id;
  ELSE
    UPDATE pending_payouts
    SET available_amount = available_amount + v_payout.amount, updated_at = now()
    WHERE reader_id = v_payout.reader_id;
  END IF;
  UPDATE wallets SET available_balance = v_before + v_payout.amount, version = version + 1, updated_at = now()
  WHERE user_id = v_payout.reader_id;
  INSERT INTO wallet_ledger_entries (
    user_id, type, amount, balance_before, balance_after,
    idempotency_key, actor_id, reason, metadata
  ) VALUES (
    v_payout.reader_id, 'adjustment', v_payout.amount, v_before, v_before + v_payout.amount,
    'payout-failed:' || v_payout.id, v_payout.initiated_by_id, p_reason,
    jsonb_build_object('payoutRecordId', v_payout.id)
  ) ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.fail_reader_payout(uuid, text) FROM PUBLIC;--> statement-breakpoint

ALTER TABLE refund_records ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY refund_participants_read ON refund_records FOR SELECT
USING (client_id = public.app_user_id() OR reader_id = public.app_user_id());
