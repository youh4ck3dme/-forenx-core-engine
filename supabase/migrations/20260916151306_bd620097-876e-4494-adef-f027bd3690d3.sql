-- 1) Missing columns on existing tables
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS base_currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS forensic_dossier jsonb,
  ADD COLUMN IF NOT EXISTS forensic_dossier_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;

ALTER TABLE public.case_transactions
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';

ALTER TABLE public.case_entities ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.case_transactions ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.case_weapons ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.case_relations ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.case_events ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.bump_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.revision := COALESCE(OLD.revision, 1) + 1;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cases','case_entities','case_transactions','case_weapons','case_relations','case_events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS bump_revision_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER bump_revision_%1$s BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.bump_revision()', t);
  END LOOP;
END $$;

-- 2) case_imports
CREATE TABLE IF NOT EXISTS public.case_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  filename text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  parser_version text NOT NULL,
  delimiter text NOT NULL DEFAULT ',',
  decimal_separator text NOT NULL DEFAULT '.',
  date_format text NOT NULL DEFAULT 'yyyy-MM-dd',
  encoding text NOT NULL DEFAULT 'utf-8',
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_rows integer NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  valid_rows integer NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
  error_rows integer NOT NULL DEFAULT 0 CHECK (error_rows >= 0),
  partial boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','committed','failed')),
  error_detail text,
  original_stored boolean NOT NULL DEFAULT false,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_imports_case_id ON public.case_imports (case_id, created_at);
CREATE INDEX IF NOT EXISTS idx_case_imports_user_id ON public.case_imports (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_imports TO authenticated;
GRANT ALL ON public.case_imports TO service_role;
ALTER TABLE public.case_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own case imports" ON public.case_imports;
CREATE POLICY "Users manage own case imports" ON public.case_imports FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_case_imports_updated_at ON public.case_imports;
CREATE TRIGGER update_case_imports_updated_at BEFORE UPDATE ON public.case_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) case_audit_log
CREATE TABLE IF NOT EXISTS public.case_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_audit_log_user ON public.case_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_audit_log_case ON public.case_audit_log (case_id, created_at DESC);
GRANT SELECT ON public.case_audit_log TO authenticated;
GRANT ALL ON public.case_audit_log TO service_role;
ALTER TABLE public.case_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own audit log" ON public.case_audit_log;
CREATE POLICY "Users read own audit log" ON public.case_audit_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4) ai_usage
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid,
  task text NOT NULL,
  model text,
  prompt_version text,
  input_revision text,
  status text NOT NULL DEFAULT 'reserved',
  error_code text,
  prompt_tokens integer,
  completion_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON public.ai_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_case ON public.ai_usage (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_status ON public.ai_usage (status, created_at DESC);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own ai usage" ON public.ai_usage;
CREATE POLICY "Users read own ai usage" ON public.ai_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 5) deletion_requests
CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'account',
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','failed')),
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user ON public.deletion_requests (user_id, created_at DESC);
GRANT SELECT ON public.deletion_requests TO authenticated;
GRANT ALL ON public.deletion_requests TO service_role;
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own deletion requests" ON public.deletion_requests;
CREATE POLICY "Users read own deletion requests" ON public.deletion_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 6) subscriptions + billing_events
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  provider text NOT NULL DEFAULT 'stripe',
  customer_id text,
  subscription_id text,
  price_id text,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  status text NOT NULL DEFAULT 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, environment)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscription_id ON public.subscriptions (subscription_id);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own subscription" ON public.subscriptions;
CREATE POLICY "Users read own subscription" ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'stripe',
  type text NOT NULL,
  user_id uuid,
  event_created_at timestamptz,
  result text NOT NULL DEFAULT 'processing',
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_events_created ON public.billing_events (created_at DESC);
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- 7) company_registry_profiles + cross_border_analyses
CREATE TABLE IF NOT EXISTS public.company_registry_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  entity_id uuid REFERENCES public.case_entities(id) ON DELETE SET NULL,
  ico text NOT NULL,
  legal_name text NOT NULL,
  legal_form text,
  registered_address text,
  country text NOT NULL DEFAULT 'SK',
  status text NOT NULL DEFAULT 'active',
  incorporated_at date,
  dissolved_at date,
  statutory_persons jsonb NOT NULL DEFAULT '[]'::jsonb,
  business_activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  address_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL,
  source_url text,
  source_hash text NOT NULL,
  captured_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, ico, source_hash)
);
CREATE INDEX IF NOT EXISTS idx_registry_profiles_case ON public.company_registry_profiles (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registry_profiles_user ON public.company_registry_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_registry_profiles_entity ON public.company_registry_profiles (entity_id);
GRANT SELECT ON public.company_registry_profiles TO authenticated;
GRANT ALL ON public.company_registry_profiles TO service_role;
ALTER TABLE public.company_registry_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own registry profiles" ON public.company_registry_profiles;
CREATE POLICY "Users read own registry profiles" ON public.company_registry_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.cross_border_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  report_id text NOT NULL,
  source text NOT NULL,
  captured_at timestamptz,
  countries jsonb NOT NULL DEFAULT '[]'::jsonb,
  routes jsonb NOT NULL DEFAULT '[]'::jsonb,
  intermediaries jsonb NOT NULL DEFAULT '[]'::jsonb,
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  nominee_indicators jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_url text,
  source_hash text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cross_border_case ON public.cross_border_analyses (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cross_border_user ON public.cross_border_analyses (user_id);
GRANT SELECT, INSERT ON public.cross_border_analyses TO authenticated;
GRANT ALL ON public.cross_border_analyses TO service_role;
ALTER TABLE public.cross_border_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own cross border analyses" ON public.cross_border_analyses;
CREATE POLICY "Users manage own cross border analyses" ON public.cross_border_analyses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8) Server-only helper functions
CREATE OR REPLACE FUNCTION public.current_plan(_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT s.plan FROM public.subscriptions s
      WHERE s.user_id = _user
        AND s.status IN ('active','trialing','past_due')
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
      ORDER BY s.current_period_end DESC NULLS LAST
      LIMIT 1),
    'free');
$$;
REVOKE ALL ON FUNCTION public.current_plan(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.current_plan(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ai_call(
  _user uuid, _case uuid, _task text, _model text,
  _prompt_version text, _input_revision text, _daily_limit integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  used integer;
  new_id uuid;
BEGIN
  SELECT count(*) INTO used FROM public.ai_usage
   WHERE user_id = _user AND created_at > now() - interval '24 hours' AND status <> 'failed';
  IF used >= _daily_limit THEN
    RAISE EXCEPTION 'daily_limit_reached';
  END IF;
  INSERT INTO public.ai_usage (user_id, case_id, task, model, prompt_version, input_revision, status)
  VALUES (_user, _case, _task, _model, _prompt_version, _input_revision, 'reserved')
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_ai_call(uuid, uuid, text, text, text, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.reserve_ai_call(uuid, uuid, text, text, text, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.commit_import(_import uuid, _rows jsonb, _actor uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  imp public.case_imports;
  inserted integer := 0;
BEGIN
  SELECT * INTO imp FROM public.case_imports WHERE id = _import FOR UPDATE;
  IF imp.id IS NULL THEN RAISE EXCEPTION 'import_not_found'; END IF;
  IF imp.user_id <> _actor THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF imp.status <> 'pending' THEN RAISE EXCEPTION 'import_already_processed'; END IF;

  INSERT INTO public.case_transactions
    (case_id, user_id, date, amount, currency, method, from_id, to_id, payer_id,
     origin_country, destination_country, description)
  SELECT imp.case_id, imp.user_id,
         (r->>'date')::date,
         (r->>'amount')::numeric,
         upper(r->>'currency'),
         r->>'method',
         (r->>'from_id')::uuid,
         (r->>'to_id')::uuid,
         NULLIF(r->>'payer_id','')::uuid,
         upper(COALESCE(r->>'origin_country','SK')),
         upper(COALESCE(r->>'destination_country','SK')),
         COALESCE(r->>'description','')
    FROM jsonb_array_elements(_rows) AS r;
  GET DIAGNOSTICS inserted = ROW_COUNT;

  UPDATE public.case_imports SET status = 'committed', updated_at = now() WHERE id = _import;
  RETURN inserted;
END;
$$;
REVOKE ALL ON FUNCTION public.commit_import(uuid, jsonb, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.commit_import(uuid, jsonb, uuid) TO service_role;