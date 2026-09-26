REVOKE EXECUTE ON FUNCTION public.owns_case(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.owns_case(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.owns_case(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_case(uuid) TO service_role;