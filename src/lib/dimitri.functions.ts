import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildDimitriAlerts,
  parseDimitriCheckerReport,
  validateDimitriReferences,
} from "@/forensic/dimitri";
import type { ForensicCase } from "@/forensic/types";

const uuid = z.string().uuid();

function fail(
  error: { message?: string; code?: string } | null,
  fallback: string,
): never {
  if (error?.code === "42501")
    throw new Error("Nemáte oprávnenie na túto operáciu.");
  throw new Error(error?.message ? `${fallback} (${error.message})` : fallback);
}

/**
 * Importuje report z Dimitri Checker pre daný prípad.
 */
export const importDimitriCheckerReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        caseId: uuid,
        reportPayload: z.unknown(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Overenie prípadu a načítanie transakcií/entít
    const { data: owned, error: caseError } = await supabase
      .from("cases")
      .select("*, case_entities(*), case_transactions(*)")
      .eq("id", data.caseId)
      .eq("user_id", userId)
      .maybeSingle();

    if (caseError) fail(caseError, "Nepodariť sa overiť prípad.");
    if (!owned)
      throw new Error("Prípad sa nenašiel alebo naň nemáte oprávnenie.");

    // Formátovanie načítaného prípadu pre referenčnú kontrolu
    const caseData: ForensicCase = {
      id: owned.id,
      name: owned.name,
      subtitle: owned.subtitle ?? "",
      referenceDate: owned.reference_date,
      baseCurrency: owned.base_currency ?? "EUR",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entities: (owned.case_entities as any[]) || [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transactions: (owned.case_transactions as any[]) || [],
      weapons: [],
      relations: [],
      events: [],
      europolSerials: [],
      validLicences: [],
      orsrAddresses: {},
    };

    // 2. Parse a validácia reportu
    const rawReport = parseDimitriCheckerReport(data.reportPayload);

    // 3. Kontrola neprepojených referencií (varovania)
    const { report, warnings } = validateDimitriReferences(rawReport, caseData);

    // 4. Uloženie do databázy cross_border_analyses
    const { data: inserted, error: insertError } =
      await // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("cross_border_analyses" as any) as any)
        .insert({
          case_id: data.caseId,
          user_id: userId,
          report_id: report.reportId,
          source: report.source.source,
          captured_at: report.capturedAt,
          countries: report.countries,
          routes: report.routes,
          intermediaries: report.intermediaries,
          signals: report.signals,
          nominee_indicators: report.nomineeIndicators || [],
          source_url: report.source.sourceUrl ?? null,
          source_hash: report.source.sourceHash ?? null,
          raw_payload: data.reportPayload,
        })
        .select("id")
        .single();

    if (insertError)
      fail(insertError, "Uloženie reportu Dimitri Checker zlyhalo.");

    const alerts = buildDimitriAlerts(report, caseData);

    return {
      ok: true,
      analysisId: inserted.id,
      reportId: report.reportId,
      warnings,
      alertsCount: alerts.length,
      unlinkedReferences: report.unlinkedReferences,
    };
  });

/**
 * Zoznam uložených cezhraničných analýz pre prípad.
 */
export const listCrossBorderAnalyses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ caseId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: analyses, error } =
      await // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("cross_border_analyses" as any) as any)
        .select("*")
        .eq("case_id", data.caseId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) fail(error, "Načítanie cezhraničných analýz zlyhalo.");
    return { ok: true, analyses: analyses ?? [] };
  });
