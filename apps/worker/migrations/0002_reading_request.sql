CREATE OR REPLACE FUNCTION public.create_on_demand_reading(
  p_client_id uuid,
  p_reader_id uuid,
  p_type reading_type
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate integer;
  v_balance integer;
  v_reading_id uuid;
BEGIN
  IF p_client_id = p_reader_id THEN
    RAISE EXCEPTION 'invalid_participants' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('client:' || p_client_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('reader:' || p_reader_id::text, 0));

  SELECT CASE p_type
    WHEN 'chat' THEN rp.pricing_chat
    WHEN 'voice' THEN rp.pricing_voice
    WHEN 'video' THEN rp.pricing_video
  END INTO v_rate
  FROM reader_profiles rp
  JOIN users u ON u.id = rp.user_id
  WHERE rp.user_id = p_reader_id
    AND rp.verification_status = 'verified'
    AND rp.is_online = true
    AND rp.last_heartbeat_at > now() - interval '90 seconds'
    AND u.status = 'active'
  FOR UPDATE;

  IF v_rate IS NULL OR v_rate < 100 THEN
    RAISE EXCEPTION 'reader_unavailable' USING ERRCODE = 'P0001';
  END IF;

  SELECT available_balance INTO v_balance
  FROM wallets WHERE user_id = p_client_id FOR UPDATE;
  IF v_balance < v_rate THEN
    RAISE EXCEPTION 'insufficient_starting_balance' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM reading_sessions
    WHERE status IN ('pending', 'accepted', 'preflight', 'connecting', 'active', 'ending')
      AND (client_id = p_client_id OR reader_id = p_reader_id)
  ) THEN
    RAISE EXCEPTION 'participant_already_busy' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO reading_sessions (reader_id, client_id, type, status, price_per_minute)
  VALUES (p_reader_id, p_client_id, p_type, 'pending', v_rate)
  RETURNING id INTO v_reading_id;
  RETURN v_reading_id;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.create_on_demand_reading(uuid, uuid, reading_type) FROM PUBLIC;
