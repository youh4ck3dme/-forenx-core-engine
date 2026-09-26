import { supabase } from "@/integrations/supabase/client";
import type { ForensicCase } from "@/forensic";
import { mapCaseRows } from "@/lib/case-mapper";
import { shouldUseLocalCaseStore } from "@/lib/identity";
import { SessionExpiredError } from "@/lib/session-expired";

import {
  listDevCases,
  loadDevCase,
  loadDevCaseRevisions,
  createDevCase,
  updateDevCase,
  upsertDevEntity,
  upsertDevTransaction,
  upsertDevRelation,
  upsertDevWeapon,
  upsertDevEvent,
  deleteDevRecord,
} from "@/lib/dev-cases";
import {
  deleteRecord,
  getDeleteImpact,
  saveCase,
  saveEntity,
  saveEvent,
  saveRelation,
  saveTransaction,
  saveWeapon,
} from "@/lib/case-write.functions";

export type CaseSummary = {
  id: string;
  name: string;
  subtitle: string;
  referenceDate: string;
  baseCurrency: string;
  createdAt: string;
  isDemo: boolean;
};

/**
 * Nemenné ID prihláseného používateľa. Slúži ako druhá poistka k RLS —
 * každý dopyt filtrujeme aj na klientovi, nikdy sa nespoliehame len na server.
 */
async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new SessionExpiredError();
  return data.user.id;
}

/** Čítanie ide priamo cez klienta (RLS obmedzí dáta na prihláseného používateľa). */
export async function listCases(): Promise<CaseSummary[]> {
  if (await shouldUseLocalCaseStore()) {
    return listDevCases();
  }
  const userId = await requireUserId();
  // Chyba čítania sa NIKDY nevydáva za „žiadne prípady“ — volajúci musí
  // vedieť rozlíšiť prázdny zoznam od zlyhania a ponúknuť zopakovanie.
  const { data, error } = await supabase
    .from("cases")
    .select(
      "id, name, subtitle, reference_date, base_currency, created_at, is_demo",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error("Prípady sa nepodarilo načítať.");
  }
  return (
    (data ?? []) as Array<{
      id: string;
      name: string;
      subtitle: string | null;
      reference_date: string;
      base_currency: string | null;
      created_at: string;
      is_demo: boolean | null;
    }>
  ).map((row) => ({
    id: row.id,
    name: row.name,
    subtitle: row.subtitle ?? "",
    referenceDate: row.reference_date,
    baseCurrency: row.base_currency ?? "EUR",
    createdAt: row.created_at,
    isDemo: row.is_demo === true,
  }));
}

/** Načíta celý prípad a poskladá ho do tvaru, ktorý očakáva forenzné jadro. */
export async function loadCase(caseId: string): Promise<ForensicCase> {
  if (await shouldUseLocalCaseStore()) {
    return loadDevCase(caseId);
  }
  const userId = await requireUserId();
  const [caseRow, entities, transactions, weapons, relations, events] =
    await Promise.all([
      supabase
        .from("cases")
        .select("*")
        .eq("id", caseId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("case_entities")
        .select("*")
        .eq("case_id", caseId)
        .eq("user_id", userId),
      supabase
        .from("case_transactions")
        .select("*")
        .eq("case_id", caseId)
        .eq("user_id", userId),
      supabase
        .from("case_weapons")
        .select("*")
        .eq("case_id", caseId)
        .eq("user_id", userId),
      supabase
        .from("case_relations")
        .select("*")
        .eq("case_id", caseId)
        .eq("user_id", userId),
      supabase
        .from("case_events")
        .select("*")
        .eq("case_id", caseId)
        .eq("user_id", userId),
    ]);

  const row = caseRow.data;
  if (!row) throw new Error("Prípad sa nenašiel.");

  return mapCaseRows(
    row,
    entities.data ?? [],
    transactions.data ?? [],
    weapons.data ?? [],
    relations.data ?? [],
    events.data ?? [],
  );
}

/** Revízie záznamov pre ochranu pred prepísaním súbežnou úpravou. */
export async function loadCaseRevisions(
  caseId: string,
): Promise<Record<string, number>> {
  if (await shouldUseLocalCaseStore()) {
    return loadDevCaseRevisions(caseId);
  }
  const tables = [
    "cases",
    "case_entities",
    "case_transactions",
    "case_weapons",
    "case_relations",
    "case_events",
  ] as const;
  const results = await Promise.all(
    tables.map((table) =>
      table === "cases"
        ? supabase.from(table).select("id, revision").eq("id", caseId)
        : supabase.from(table).select("id, revision").eq("case_id", caseId),
    ),
  );
  const out: Record<string, number> = {};
  for (const result of results) {
    for (const row of result.data ?? []) {
      out[(row as { id: string }).id] =
        (row as { revision?: number }).revision ?? 1;
    }
  }
  return out;
}

/* Zápisy: v Dev Free Entry režime lokálne, v produkcii cez serverové funkcie */
export const createCase = async (input: {
  name: string;
  subtitle?: string;
  referenceDate?: string;
  baseCurrency?: string;
}) => {
  if (await shouldUseLocalCaseStore()) {
    return createDevCase(input);
  }
  return (await saveCase({ data: { ...input } })).id;
};

export const updateCase = async (
  args: NonNullable<Parameters<typeof saveCase>[0]>,
) => {
  if (await shouldUseLocalCaseStore()) {
    return updateDevCase(args.data as Parameters<typeof updateDevCase>[0]);
  }
  return saveCase(args);
};

export const upsertEntity = async (
  args: NonNullable<Parameters<typeof saveEntity>[0]>,
) => {
  if (await shouldUseLocalCaseStore()) {
    return upsertDevEntity(args.data as Record<string, unknown>);
  }
  return saveEntity(args);
};

export const upsertTransaction = async (
  args: NonNullable<Parameters<typeof saveTransaction>[0]>,
) => {
  if (await shouldUseLocalCaseStore()) {
    return upsertDevTransaction(args.data as Record<string, unknown>);
  }
  return saveTransaction(args);
};

export const upsertRelation = async (
  args: NonNullable<Parameters<typeof saveRelation>[0]>,
) => {
  if (await shouldUseLocalCaseStore()) {
    return upsertDevRelation(args.data as Record<string, unknown>);
  }
  return saveRelation(args);
};

export const upsertWeapon = async (
  args: NonNullable<Parameters<typeof saveWeapon>[0]>,
) => {
  if (await shouldUseLocalCaseStore()) {
    return upsertDevWeapon(args.data as Record<string, unknown>);
  }
  return saveWeapon(args);
};

export const upsertEvent = async (
  args: NonNullable<Parameters<typeof saveEvent>[0]>,
) => {
  if (await shouldUseLocalCaseStore()) {
    return upsertDevEvent(args.data as Record<string, unknown>);
  }
  return saveEvent(args);
};

export const describeDeleteImpact = getDeleteImpact;

export const deleteCase = async (id: string) => {
  if (await shouldUseLocalCaseStore()) {
    deleteDevRecord("case", id);
    return;
  }
  await deleteRecord({ data: { type: "case", id } });
};

export const deleteEntity = async (id: string) => {
  if (await shouldUseLocalCaseStore()) {
    deleteDevRecord("entity", id);
    return;
  }
  await deleteRecord({ data: { type: "entity", id } });
};

export const deleteTransaction = async (id: string) => {
  if (await shouldUseLocalCaseStore()) {
    deleteDevRecord("transaction", id);
    return;
  }
  await deleteRecord({ data: { type: "transaction", id } });
};

export const deleteRelation = async (id: string) => {
  if (await shouldUseLocalCaseStore()) {
    deleteDevRecord("relation", id);
    return;
  }
  await deleteRecord({ data: { type: "relation", id } });
};

export const deleteWeapon = async (id: string) => {
  if (await shouldUseLocalCaseStore()) {
    deleteDevRecord("weapon", id);
    return;
  }
  await deleteRecord({ data: { type: "weapon", id } });
};

export const deleteEvent = async (id: string) => {
  if (await shouldUseLocalCaseStore()) {
    deleteDevRecord("event", id);
    return;
  }
  await deleteRecord({ data: { type: "event", id } });
};

export type CaseImportMeta = {
  id: string;
  filename: string;
  byteSize: number;
  sha256: string;
  parserVersion: string;
  columnMapping: Record<string, unknown>;
  totalRows: number;
  validRows: number;
  errorRows: number;
  partial: boolean;
  status: string;
  originalStored: boolean;
  createdAt: string;
};

/** Metadáta importov pre dohľadateľnosť zdrojov v reporte. */
export async function listCaseImports(
  caseId: string,
): Promise<CaseImportMeta[]> {
  const { data, error } = await supabase
    .from("case_imports")
    .select(
      "id, filename, byte_size, sha256, parser_version, column_mapping, total_rows, valid_rows, error_rows, partial, status, original_stored, created_at",
    )
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (
    (data ?? []) as Array<{
      id: string;
      filename: string;
      byte_size: number;
      sha256: string;
      parser_version: string;
      column_mapping: Record<string, unknown> | null;
      total_rows: number;
      valid_rows: number;
      error_rows: number;
      partial: boolean;
      status: string;
      original_stored: boolean;
      created_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    filename: row.filename,
    byteSize: row.byte_size,
    sha256: row.sha256,
    parserVersion: row.parser_version,
    columnMapping: (row.column_mapping ?? {}) as Record<string, unknown>,
    totalRows: row.total_rows,
    validRows: row.valid_rows,
    errorRows: row.error_rows,
    partial: row.partial,
    status: row.status,
    originalStored: row.original_stored,
    createdAt: row.created_at,
  }));
}
