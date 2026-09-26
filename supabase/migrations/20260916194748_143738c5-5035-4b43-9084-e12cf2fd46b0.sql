CREATE INDEX IF NOT EXISTS idx_case_imports_user_created ON public.case_imports (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_imports_case_id ON public.case_imports (case_id);
CREATE INDEX IF NOT EXISTS idx_case_imports_status ON public.case_imports (status);

CREATE INDEX IF NOT EXISTS idx_case_audit_log_user_created ON public.case_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_audit_log_case_created ON public.case_audit_log (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON public.ai_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_case_id ON public.ai_usage (case_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_status ON public.ai_usage (status);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_created ON public.deletion_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_env ON public.subscriptions (user_id, environment);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscription_id ON public.subscriptions (subscription_id);

CREATE INDEX IF NOT EXISTS idx_billing_events_event_id ON public.billing_events (event_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_user_created ON public.billing_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_registry_profiles_case_id ON public.company_registry_profiles (case_id);
CREATE INDEX IF NOT EXISTS idx_registry_profiles_entity_id ON public.company_registry_profiles (entity_id);
CREATE INDEX IF NOT EXISTS idx_registry_profiles_user_created ON public.company_registry_profiles (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cross_border_case_id ON public.cross_border_analyses (case_id);
CREATE INDEX IF NOT EXISTS idx_cross_border_user_created ON public.cross_border_analyses (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_entities_case_id ON public.case_entities (case_id);
CREATE INDEX IF NOT EXISTS idx_cases_user_created ON public.cases (user_id, created_at DESC);