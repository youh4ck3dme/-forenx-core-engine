-- Immutable identity keys are registry-issued identifiers only. Display names
-- intentionally have no uniqueness constraint: homonyms must remain separate.
ALTER TABLE public.case_entities ADD COLUMN IF NOT EXISTS identity_key text;
CREATE UNIQUE INDEX IF NOT EXISTS case_entities_identity_key_unique
  ON public.case_entities (case_id, identity_key)
  WHERE identity_key IS NOT NULL;

ALTER TABLE public.case_relations ADD COLUMN IF NOT EXISTS valid_from date;
ALTER TABLE public.case_relations ADD COLUMN IF NOT EXISTS valid_to date;
ALTER TABLE public.case_relations
  ADD CONSTRAINT case_relations_valid_period
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
  NOT VALID;
ALTER TABLE public.case_relations VALIDATE CONSTRAINT case_relations_valid_period;

-- Persisted custody events complement the client-side verifier. Each row is
-- append-only to authenticated users; the hash chain is verified by consumers.
CREATE TABLE IF NOT EXISTS public.case_custody_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  trace_id text NOT NULL,
  entry_index integer NOT NULL CHECK (entry_index >= 0),
  occurred_at timestamptz NOT NULL,
  actor text NOT NULL,
  action text NOT NULL,
  location text NOT NULL,
  notes text,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  prev_hash text NOT NULL CHECK (prev_hash ~ '^[a-f0-9]{64}$'),
  hash text NOT NULL CHECK (hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, trace_id, entry_index),
  UNIQUE (case_id, trace_id, hash)
);
ALTER TABLE public.case_custody_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case_custody_ledger_select_own" ON public.case_custody_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "case_custody_ledger_insert_own" ON public.case_custody_ledger
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_case(case_id));
CREATE INDEX IF NOT EXISTS case_custody_ledger_trace_idx
  ON public.case_custody_ledger (case_id, trace_id, entry_index);

CREATE OR REPLACE VIEW public.case_custody_ledger_chain
WITH (security_invoker = true) AS
SELECT
  l.*,
  lag(l.hash) OVER (
    PARTITION BY l.case_id, l.trace_id ORDER BY l.entry_index
  ) AS expected_prev_hash
FROM public.case_custody_ledger l;
GRANT SELECT ON public.case_custody_ledger_chain TO authenticated;

-- One transaction owns the complete AI graph write. A locked ownership check
-- prevents TOCTOU changes of the case owner and any raised error rolls back all
-- entity, event, and relation writes.
CREATE OR REPLACE FUNCTION public.commit_ai_case_graph(
  _case_id uuid,
  _graph jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_entity jsonb;
  v_event jsonb;
  v_relation jsonb;
  v_entity_ids jsonb := '{}'::jsonb;
  v_key text;
  v_identity_key text;
  v_id uuid;
  v_entities integer := 0;
  v_events integer := 0;
  v_relations integer := 0;
BEGIN
  IF jsonb_typeof(_graph) <> 'object'
    OR jsonb_typeof(COALESCE(_graph->'entities', '[]'::jsonb)) <> 'array'
    OR jsonb_typeof(COALESCE(_graph->'events', '[]'::jsonb)) <> 'array'
    OR jsonb_typeof(COALESCE(_graph->'relations', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Invalid graph payload' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_owner FROM public.cases WHERE id = _case_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Case not found or not owned by current user'
      USING ERRCODE = '42501';
  END IF;

  FOR v_entity IN SELECT value FROM jsonb_array_elements(_graph->'entities') LOOP
    v_key := v_entity->>'key';
    v_identity_key := nullif(v_entity->>'identityKey', '');
    IF v_key IS NULL OR v_key !~ '^[A-Za-z0-9:_-]{1,160}$'
      OR nullif(btrim(v_entity->>'name'), '') IS NULL
      OR v_entity->>'kind' NOT IN ('person', 'company') THEN
      RAISE EXCEPTION 'Invalid entity payload' USING ERRCODE = '22023';
    END IF;
    IF v_entity_ids ? v_key THEN
      RAISE EXCEPTION 'Duplicate entity key' USING ERRCODE = '22023';
    END IF;

    IF v_identity_key IS NOT NULL THEN
      SELECT id INTO v_id FROM public.case_entities
      WHERE case_id = _case_id AND identity_key = v_identity_key FOR UPDATE;
    ELSE
      v_id := NULL;
    END IF;
    IF v_id IS NULL THEN
      INSERT INTO public.case_entities
        (case_id, user_id, name, kind, role, x, y, identity_key)
      VALUES
        (_case_id, auth.uid(), btrim(v_entity->>'name'), v_entity->>'kind',
         coalesce(v_entity->>'role', ''), coalesce((v_entity->>'x')::numeric, 100),
         coalesce((v_entity->>'y')::numeric, 100), v_identity_key)
      RETURNING id INTO v_id;
      v_entities := v_entities + 1;
    END IF;
    v_entity_ids := v_entity_ids || jsonb_build_object(v_key, v_id::text);
  END LOOP;

  FOR v_event IN SELECT value FROM jsonb_array_elements(_graph->'events') LOOP
    IF nullif(btrim(v_event->>'date'), '') IS NULL
      OR nullif(btrim(v_event->>'title'), '') IS NULL THEN
      RAISE EXCEPTION 'Invalid event payload' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.case_events (case_id, user_id, date, title, detail, severity)
    SELECT _case_id, auth.uid(), (v_event->>'date')::date, btrim(v_event->>'title'),
      coalesce(v_event->>'detail', ''), 'medium'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.case_events e
      WHERE e.case_id = _case_id AND e.date = (v_event->>'date')::date
        AND lower(btrim(e.title)) = lower(btrim(v_event->>'title'))
    );
    IF FOUND THEN v_events := v_events + 1; END IF;
  END LOOP;

  FOR v_relation IN SELECT value FROM jsonb_array_elements(_graph->'relations') LOOP
    IF NOT (v_entity_ids ? (v_relation->>'fromKey'))
      OR NOT (v_entity_ids ? (v_relation->>'toKey')) THEN
      RAISE EXCEPTION 'Relation refers to an unknown entity key' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.case_relations
      (case_id, user_id, from_id, to_id, label, valid_from, valid_to)
    VALUES (
      _case_id, auth.uid(), (v_entity_ids->>(v_relation->>'fromKey'))::uuid,
      (v_entity_ids->>(v_relation->>'toKey'))::uuid,
      coalesce(v_relation->>'label', 'spoločná udalosť'),
      nullif(v_relation->>'validFrom', '')::date,
      nullif(v_relation->>'validTo', '')::date
    );
    v_relations := v_relations + 1;
  END LOOP;
  RETURN jsonb_build_object('entities', v_entities, 'events', v_events, 'relations', v_relations);
END;
$$;
REVOKE ALL ON FUNCTION public.commit_ai_case_graph(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_ai_case_graph(uuid, jsonb) TO authenticated;
