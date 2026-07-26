CREATE OR REPLACE FUNCTION public.request_account_deletion(
  p_user_id uuid,
  p_confirmation text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count integer;
BEGIN
  IF p_confirmation <> 'DELETE MY ACCOUNT' THEN
    RAISE EXCEPTION 'account_deletion_not_confirmed';
  END IF;

  SELECT count(*)::integer INTO v_active_count
  FROM reading_sessions
  WHERE (client_id = p_user_id OR reader_id = p_user_id)
    AND status IN ('pending', 'accepted', 'preflight', 'connecting', 'active', 'ending');

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'active_reading_prevents_deletion';
  END IF;

  UPDATE reader_profiles
  SET is_online = false,
      last_heartbeat_at = NULL,
      profile_image_key = NULL,
      bio = '',
      specialties = '{}'::text[],
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO audit_logs(actor_id, action, target_type, target_id, reason)
  VALUES (p_user_id, 'account.delete', 'user', p_user_id::text, 'User-requested account deletion');

  UPDATE users
  SET status = 'deleted',
      neon_auth_user_id = 'deleted:' || id::text,
      email = 'deleted+' || id::text || '@soulseer.invalid',
      username = 'deleted_' || replace(id::text, '-', ''),
      full_name = 'Deleted User',
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion(uuid, text) FROM PUBLIC;
