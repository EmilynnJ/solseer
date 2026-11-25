import { createDatabase } from "./db";

// Snapshot reconciliation, not a replacement for provider request logs.
// No credentials, session tokens, emails, IPs, or private content are copied.
export async function reconcileSecurityActivity(databaseUrl: string | undefined): Promise<number> {
  const { sql } = createDatabase(databaseUrl);
  const result = await sql`
    WITH observations AS (
      SELECT id::text AS auth_user_id, 'auth_account_created'::text AS event_type,
             id::text AS source_id, "createdAt" AS occurred_at
      FROM neon_auth."user"
      UNION ALL
      SELECT id::text, 'auth_email_verified_observed', id::text, now()
      FROM neon_auth."user" WHERE "emailVerified" IS TRUE
      UNION ALL
      SELECT "userId"::text, 'auth_session_observed', id::text, "createdAt"
      FROM neon_auth.session
      UNION ALL
      SELECT neon_auth_user_id::text, 'app_profile_created', id::text, created_at
      FROM public.users WHERE neon_auth_user_id IS NOT NULL
    ), inserted AS (
      INSERT INTO public.security_activity (auth_user_id, event_type, source_id, occurred_at)
      SELECT auth_user_id, event_type, source_id, occurred_at FROM observations
      WHERE auth_user_id IS NOT NULL AND occurred_at IS NOT NULL
      ON CONFLICT (event_type, source_id) DO NOTHING
      RETURNING id
    )
    SELECT count(*)::int AS inserted FROM inserted
  `;
  return Number(result.rows[0]?.inserted ?? 0);
}
