REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_revision() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_plan(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_ai_call(uuid, uuid, text, text, text, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.commit_import(uuid, jsonb, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.db_health_stats() FROM anon;