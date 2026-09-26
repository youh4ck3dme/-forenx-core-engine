-- 1) Vlastník sa dopĺňa automaticky z overenej relácie
ALTER TABLE public.cases ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.case_entities ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.case_transactions ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.case_weapons ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.case_relations ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.case_events ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.case_imports ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 2) Pomocná funkcia: patrí prípad prihlásenému používateľovi?
CREATE OR REPLACE FUNCTION public.owns_case(_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = _case_id AND c.user_id = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION public.owns_case(uuid) TO authenticated;

-- 3) cases: rozdelené politiky, výhradne vlastník
DROP POLICY IF EXISTS "Users manage own cases" ON public.cases;

CREATE POLICY "cases_select_own" ON public.cases
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "cases_insert_own" ON public.cases
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cases_update_own" ON public.cases
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cases_delete_own" ON public.cases
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4) case_entities
DROP POLICY IF EXISTS "Users manage own case entities" ON public.case_entities;

CREATE POLICY "case_entities_select_own" ON public.case_entities
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "case_entities_insert_own" ON public.case_entities
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_case(case_id));

CREATE POLICY "case_entities_update_own" ON public.case_entities
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.owns_case(case_id));

CREATE POLICY "case_entities_delete_own" ON public.case_entities
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 5) case_transactions
DROP POLICY IF EXISTS "Users manage own case transactions" ON public.case_transactions;

CREATE POLICY "case_transactions_select_own" ON public.case_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "case_transactions_insert_own" ON public.case_transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_case(case_id));

CREATE POLICY "case_transactions_update_own" ON public.case_transactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.owns_case(case_id));

CREATE POLICY "case_transactions_delete_own" ON public.case_transactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 6) case_weapons
DROP POLICY IF EXISTS "Users manage own case weapons" ON public.case_weapons;

CREATE POLICY "case_weapons_select_own" ON public.case_weapons
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "case_weapons_insert_own" ON public.case_weapons
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_case(case_id));

CREATE POLICY "case_weapons_update_own" ON public.case_weapons
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.owns_case(case_id));

CREATE POLICY "case_weapons_delete_own" ON public.case_weapons
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 7) case_relations
DROP POLICY IF EXISTS "Users manage own case relations" ON public.case_relations;

CREATE POLICY "case_relations_select_own" ON public.case_relations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "case_relations_insert_own" ON public.case_relations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_case(case_id));

CREATE POLICY "case_relations_update_own" ON public.case_relations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.owns_case(case_id));

CREATE POLICY "case_relations_delete_own" ON public.case_relations
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 8) case_events
DROP POLICY IF EXISTS "Users manage own case events" ON public.case_events;

CREATE POLICY "case_events_select_own" ON public.case_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "case_events_insert_own" ON public.case_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_case(case_id));

CREATE POLICY "case_events_update_own" ON public.case_events
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.owns_case(case_id));

CREATE POLICY "case_events_delete_own" ON public.case_events
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 9) case_imports
DROP POLICY IF EXISTS "Users manage own case imports" ON public.case_imports;

CREATE POLICY "case_imports_select_own" ON public.case_imports
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "case_imports_insert_own" ON public.case_imports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_case(case_id));

CREATE POLICY "case_imports_update_own" ON public.case_imports
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.owns_case(case_id));

CREATE POLICY "case_imports_delete_own" ON public.case_imports
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 10) indexy pre rýchle vlastnícke filtre
CREATE INDEX IF NOT EXISTS idx_cases_user_created ON public.cases (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_entities_user_case ON public.case_entities (user_id, case_id);
CREATE INDEX IF NOT EXISTS idx_case_transactions_user_case ON public.case_transactions (user_id, case_id);
CREATE INDEX IF NOT EXISTS idx_case_weapons_user_case ON public.case_weapons (user_id, case_id);
CREATE INDEX IF NOT EXISTS idx_case_relations_user_case ON public.case_relations (user_id, case_id);
CREATE INDEX IF NOT EXISTS idx_case_events_user_case ON public.case_events (user_id, case_id);