-- Independent observation ledger: no writes to managed Neon Auth tables.
CREATE TABLE public.security_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_user_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('auth_account_created','auth_email_verified_observed','auth_session_observed','app_profile_created')),
  source_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_type, source_id)
);
--> statement-breakpoint
CREATE INDEX security_activity_subject_time_idx ON public.security_activity(auth_user_id, occurred_at DESC);
--> statement-breakpoint
CREATE INDEX security_activity_time_idx ON public.security_activity(occurred_at DESC, id DESC);
--> statement-breakpoint
ALTER TABLE public.security_activity ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON public.security_activity FROM PUBLIC;
