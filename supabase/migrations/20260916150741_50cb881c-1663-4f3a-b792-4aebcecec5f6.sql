CREATE TABLE IF NOT EXISTS public.ai_feature_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  feature text NOT NULL,
  input_summary text,
  output_summary text,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  provider text,
  model text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_feature_logs_created_at ON public.ai_feature_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feature_logs_feature ON public.ai_feature_logs (feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feature_logs_user_id ON public.ai_feature_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feature_logs_success ON public.ai_feature_logs (success, created_at DESC);

GRANT SELECT ON public.ai_feature_logs TO authenticated;
GRANT ALL ON public.ai_feature_logs TO service_role;

ALTER TABLE public.ai_feature_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read ai feature logs" ON public.ai_feature_logs;
CREATE POLICY "Admins can read ai feature logs"
ON public.ai_feature_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.db_health_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'max_connections', (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'),
    'total_connections', (SELECT count(*) FROM pg_stat_activity),
    'active_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'active'),
    'idle_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle'),
    'idle_in_transaction', (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction'),
    'waiting_connections', (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock'),
    'database_size_bytes', pg_database_size(current_database()),
    'postgres_version', current_setting('server_version')
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.db_health_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.db_health_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.db_health_stats() TO service_role;