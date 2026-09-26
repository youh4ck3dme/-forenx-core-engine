CREATE INDEX IF NOT EXISTS idx_case_relations_from_id ON public.case_relations(from_id);
CREATE INDEX IF NOT EXISTS idx_case_relations_to_id ON public.case_relations(to_id);
CREATE INDEX IF NOT EXISTS idx_case_transactions_from_id ON public.case_transactions(from_id);
CREATE INDEX IF NOT EXISTS idx_case_transactions_to_id ON public.case_transactions(to_id);
CREATE INDEX IF NOT EXISTS idx_case_transactions_payer_id ON public.case_transactions(payer_id);
CREATE INDEX IF NOT EXISTS idx_case_weapons_holder_id ON public.case_weapons(holder_id);
CREATE INDEX IF NOT EXISTS idx_case_weapons_supplier_id ON public.case_weapons(supplier_id);
CREATE INDEX IF NOT EXISTS idx_case_transactions_case_date ON public.case_transactions(case_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_case_events_case_date ON public.case_events(case_id, date DESC);