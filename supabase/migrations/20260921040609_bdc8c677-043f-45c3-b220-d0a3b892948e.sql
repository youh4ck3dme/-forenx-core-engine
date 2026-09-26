CREATE OR REPLACE FUNCTION public.db_health_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
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
$function$;

REVOKE ALL ON FUNCTION public.db_health_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.db_health_stats() TO service_role;