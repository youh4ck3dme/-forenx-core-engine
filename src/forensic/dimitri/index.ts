import { z } from "zod";
import type {
  Alert,
  CaseAnalysis,
  Entity,
  ForensicCase,
  Relation,
  Severity,
  SourceRecord,
} from "../types";
import { normalizeCountry } from "../normalization";

export type RouteItem = {
  fromCountry: string;
  toCountry: string;
  transactionIds?: string[] | undefined;
  amount?: number | undefined;
  currency?: string | undefined;
};

export type IntermediaryItem = {
  name: string;
  entityId?: string | undefined;
  country?: string | undefined;
  role?: string | undefined;
};

export type SignalItem = {
  code: string;
  label: string;
  detail: string;
  severity: Severity;
  confidence: number;
  entityIds?: string[] | undefined;
  transactionIds?: string[] | undefined;
};

export type NomineeIndicatorItem = {
  entityId?: string | undefined;
  name: string;
  indicators: string[];
  confidence: number;
};

export type UnlinkedReferences = {
  transactionIds?: string[] | undefined;
  entityIds?: string[] | undefined;
};

export type DimitriCheckerReport = {
  reportId: string;
  caseReference?: string | undefined;
  capturedAt: string;
  source: SourceRecord;
  countries: string[];
  routes: RouteItem[];
  intermediaries: IntermediaryItem[];
  signals: SignalItem[];
  nomineeIndicators?: NomineeIndicatorItem[] | undefined;
  unlinkedReferences?: UnlinkedReferences | undefined;
};

const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);

const SourceRecordSchema = z.object({
  id: z.string().default(() => `src-${Date.now()}`),
  source: z.enum([
    "manual",
    "csv-import",
    "document",
    "ico-atlas",
    "orsr",
    "dimitri-checker",
    "ai",
  ]),
  sourceVersion: z.string().optional(),
  sourceUrl: z.string().optional(),
  capturedAt: z.string().min(1, "Chýba čas získania (capturedAt)"),
  sourceHash: z.string().optional(),
  confidence: z
    .number()
    .min(0, "Confidence musí byť minimálne 0")
    .max(100, "Confidence musí byť maximálne 100")
    .optional(),
  rawReference: z.string().optional(),
});

const RouteItemSchema = z.object({
  fromCountry: z.string().min(1),
  toCountry: z.string().min(1),
  transactionIds: z.array(z.string()).optional(),
  amount: z.number().finite().optional(),
  currency: z.string().optional(),
});

const IntermediaryItemSchema = z.object({
  name: z.string().min(1),
  entityId: z.string().optional(),
  country: z.string().optional(),
  role: z.string().optional(),
});

const SignalItemSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1),
  severity: SeveritySchema,
  confidence: z.number().min(0).max(100),
  entityIds: z.array(z.string()).optional(),
  transactionIds: z.array(z.string()).optional(),
});

const NomineeIndicatorSchema = z.object({
  entityId: z.string().optional(),
  name: z.string().min(1),
  indicators: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(100),
});

export const DimitriCheckerReportSchema = z.object({
  reportId: z.string().min(1, "Chýba reportId"),
  caseReference: z.string().optional(),
  capturedAt: z.string().min(1, "Chýba capturedAt"),
  source: SourceRecordSchema,
  countries: z.array(z.string()).default([]),
  routes: z.array(RouteItemSchema).default([]),
  intermediaries: z.array(IntermediaryItemSchema).default([]),
  signals: z.array(SignalItemSchema).default([]),
  nomineeIndicators: z.array(NomineeIndicatorSchema).optional(),
});

/**
 * Zod parser pre JSON alebo CSV výstup z Dimitri Checker.
 */
export function parseDimitriCheckerReport(
  input: unknown,
): DimitriCheckerReport {
  let target = input;

  // Ak je vstup reťazec, skúšame ho rozparsovať ako JSON alebo CSV
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        target = JSON.parse(trimmed);
      } catch (e) {
        throw new Error(
          `Neplatný JSON formát Dimitri reportu: ${(e as Error).message}`,
        );
      }
    } else {
      target = parseDimitriCsv(trimmed);
    }
  }

  const parsed = DimitriCheckerReportSchema.safeParse(target);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".");
    throw new Error(
      `Neplatné dáta reportu Dimitri Checker: ${field ? `${field} — ` : ""}${issue?.message || "neznáma chyba"}`,
    );
  }

  const raw = parsed.data;

  // Validácia ISO-3166 kódov krajín
  const validatedCountries = raw.countries.map((c) => {
    const norm = normalizeCountry(c);
    if (!/^[A-Z]{2}$/.test(norm)) {
      throw new Error(
        `Neplatný kód krajiny: "${c}". Očakáva sa ISO-3166 alpha-2.`,
      );
    }
    return norm;
  });

  const validatedRoutes: RouteItem[] = raw.routes.map((route) => {
    const fromNorm = normalizeCountry(route.fromCountry);
    const toNorm = normalizeCountry(route.toCountry);
    if (!/^[A-Z]{2}$/.test(fromNorm) || !/^[A-Z]{2}$/.test(toNorm)) {
      throw new Error(
        `Neplatný kód krajiny v trase: "${route.fromCountry}" -> "${route.toCountry}"`,
      );
    }
    const res: RouteItem = {
      fromCountry: fromNorm,
      toCountry: toNorm,
    };
    if (route.transactionIds !== undefined)
      res.transactionIds = route.transactionIds;
    if (route.amount !== undefined) res.amount = route.amount;
    if (route.currency !== undefined) res.currency = route.currency;
    return res;
  });

  const resReport: DimitriCheckerReport = {
    reportId: raw.reportId,
    capturedAt: raw.capturedAt,
    source: raw.source,
    countries: validatedCountries,
    routes: validatedRoutes,
    intermediaries: raw.intermediaries,
    signals: raw.signals,
  };
  if (raw.caseReference !== undefined)
    resReport.caseReference = raw.caseReference;
  if (raw.nomineeIndicators !== undefined)
    resReport.nomineeIndicators = raw.nomineeIndicators;

  return resReport;
}

/**
 * Jednoduchý CSV parser pre Dimitri Checker reporty.
 */
function parseDimitriCsv(csvText: string): unknown {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new Error("CSV súbor je prázdny.");
  }

  // Očakávame hlavičku alebo štruktúrované poriadky
  const headerLine = lines[0];
  const header = headerLine ? headerLine.toLowerCase() : "";
  const reportId = `rep-csv-${Date.now()}`;
  const capturedAt = new Date().toISOString();

  const countries = new Set<string>();
  const routes: RouteItem[] = [];
  const signals: SignalItem[] = [];

  const delimiter = header.includes(";") ? ";" : ",";

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line
      .split(delimiter)
      .map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 3) continue;

    // Príklad CSV stĺpcov: fromCountry, toCountry, amount, code, label, severity, confidence
    const [fromCountry, toCountry, rawAmount, code, label, severity, rawConf] =
      cols;
    if (fromCountry && toCountry) {
      const amount = rawAmount ? parseFloat(rawAmount) : undefined;
      const route: RouteItem = {
        fromCountry: normalizeCountry(fromCountry),
        toCountry: normalizeCountry(toCountry),
      };
      if (amount !== undefined && !isNaN(amount)) {
        route.amount = amount;
      }
      routes.push(route);
      countries.add(normalizeCountry(fromCountry));
      countries.add(normalizeCountry(toCountry));
    }

    if (code && label) {
      const conf = rawConf ? parseInt(rawConf, 10) : 80;
      const sevLower = severity ? severity.toLowerCase() : "";
      const validSeverity: Severity = [
        "critical",
        "high",
        "medium",
        "low",
      ].includes(sevLower)
        ? (sevLower as Severity)
        : "medium";
      signals.push({
        code,
        label,
        detail: `CSV Signál z trasy ${fromCountry} -> ${toCountry}`,
        severity: validSeverity,
        confidence: isNaN(conf) ? 80 : Math.min(100, Math.max(0, conf)),
      });
    }
  }

  return {
    reportId,
    capturedAt,
    source: {
      source: "dimitri-checker",
      capturedAt,
      confidence: 90,
    },
    countries: Array.from(countries),
    routes,
    intermediaries: [],
    signals,
  };
}

/**
 * Prepojí odkazy v reportovaní na existujúce transakcie a entity v prípade.
 * Neprepojené odkazy uloží ako varovanie/metadata bez zlyhania importu.
 */
export function validateDimitriReferences(
  report: DimitriCheckerReport,
  caseData: ForensicCase,
): {
  report: DimitriCheckerReport;
  warnings: string[];
} {
  const existingTxIds = new Set(caseData.transactions.map((t) => t.id));
  const existingEntityIds = new Set(caseData.entities.map((e) => e.id));

  const unlinkedTxIds: string[] = [];
  const unlinkedEntityIds: string[] = [];
  const warnings: string[] = [];

  const filterIds = (ids?: string[], isTx = false): string[] => {
    if (!ids) return [];
    const valid: string[] = [];
    for (const id of ids) {
      const exists = isTx ? existingTxIds.has(id) : existingEntityIds.has(id);
      if (exists) {
        valid.push(id);
      } else {
        if (isTx) unlinkedTxIds.push(id);
        else unlinkedEntityIds.push(id);
        warnings.push(
          `Odkaz na neznámu ${isTx ? "transakciu" : "entitu"} ID: "${id}" nebol nájdený v prípade.`,
        );
      }
    }
    return valid;
  };

  const updatedRoutes = report.routes.map((r) => {
    const route: RouteItem = {
      fromCountry: r.fromCountry,
      toCountry: r.toCountry,
    };
    if (r.amount !== undefined) route.amount = r.amount;
    if (r.currency !== undefined) route.currency = r.currency;
    const txIds = filterIds(r.transactionIds, true);
    if (txIds.length > 0) route.transactionIds = txIds;
    return route;
  });

  const updatedSignals = report.signals.map((s) => {
    const sig: SignalItem = {
      code: s.code,
      label: s.label,
      detail: s.detail,
      severity: s.severity,
      confidence: s.confidence,
    };
    const txIds = filterIds(s.transactionIds, true);
    if (txIds.length > 0) sig.transactionIds = txIds;
    const entIds = filterIds(s.entityIds, false);
    if (entIds.length > 0) sig.entityIds = entIds;
    return sig;
  });

  const updatedNominees: NomineeIndicatorItem[] | undefined =
    report.nomineeIndicators
      ? report.nomineeIndicators.map((n) => {
          const nom: NomineeIndicatorItem = {
            name: n.name,
            indicators: n.indicators,
            confidence: n.confidence,
          };
          if (n.entityId && existingEntityIds.has(n.entityId)) {
            nom.entityId = n.entityId;
          }
          return nom;
        })
      : undefined;

  const finalReport: DimitriCheckerReport = {
    reportId: report.reportId,
    capturedAt: report.capturedAt,
    source: report.source,
    countries: report.countries,
    routes: updatedRoutes,
    intermediaries: report.intermediaries,
    signals: updatedSignals,
  };

  if (report.caseReference !== undefined)
    finalReport.caseReference = report.caseReference;
  if (updatedNominees !== undefined)
    finalReport.nomineeIndicators = updatedNominees;
  if (unlinkedTxIds.length > 0 || unlinkedEntityIds.length > 0) {
    const unlinkedRef: { transactionIds?: string[]; entityIds?: string[] } = {};
    if (unlinkedTxIds.length > 0)
      unlinkedRef.transactionIds = Array.from(new Set(unlinkedTxIds));
    if (unlinkedEntityIds.length > 0)
      unlinkedRef.entityIds = Array.from(new Set(unlinkedEntityIds));
    finalReport.unlinkedReferences = unlinkedRef;
  }

  return {
    report: finalReport,
    warnings,
  };
}

/**
 * Vytvorí štruktúrovanú cezhraničnú analýzu pre prípad.
 */
export function buildCrossBorderAnalysis(
  report: DimitriCheckerReport,
  caseData: ForensicCase,
) {
  const { report: validatedReport } = validateDimitriReferences(
    report,
    caseData,
  );

  return {
    reportId: validatedReport.reportId,
    capturedAt: validatedReport.capturedAt,
    countries: validatedReport.countries,
    routes: validatedReport.routes,
    intermediaries: validatedReport.intermediaries,
    signals: validatedReport.signals,
    nomineeIndicators: validatedReport.nomineeIndicators || [],
    unlinkedReferences: validatedReport.unlinkedReferences,
  };
}

/**
 * Konvertuje signály z Dimitri Checker na systémové Alert objekty.
 */
export function buildDimitriAlerts(
  report: DimitriCheckerReport,
  caseData: ForensicCase,
): Alert[] {
  const { report: validatedReport } = validateDimitriReferences(
    report,
    caseData,
  );
  const alerts: Alert[] = [];

  for (const signal of validatedReport.signals) {
    alerts.push({
      id: `alert-dimitri-${validatedReport.reportId}-${signal.code}`,
      title: signal.label,
      detail: `Dimitri Checker signál: ${signal.detail} (Confidence: ${signal.confidence}%)`,
      severity: signal.severity,
      score: Math.round((signal.confidence / 100) * 40),
      source: "cezhraničné",
      date: validatedReport.capturedAt,
    });
  }

  if (validatedReport.nomineeIndicators) {
    for (const nominee of validatedReport.nomineeIndicators) {
      alerts.push({
        id: `alert-nominee-${validatedReport.reportId}-${nominee.name.toLowerCase().replace(/\s+/g, "_")}`,
        title: "Indikátory možnej nastrčenej osoby",
        detail: `Subjekt ${nominee.name}: ${nominee.indicators.join(", ")} (Vyžaduje overenie, Confidence: ${nominee.confidence}%)`,
        severity: "high",
        score: Math.round((nominee.confidence / 100) * 35),
        source: "entita",
        date: validatedReport.capturedAt,
      });
    }
  }

  return alerts;
}

/**
 * Vytvorí relácie pre sprostredkovateľov z reportu.
 */
export function linkDimitriEntities(
  report: DimitriCheckerReport,
  entities: Entity[],
): Relation[] {
  const relations: Relation[] = [];
  const entityMap = new Map(entities.map((e) => [e.id, e]));

  for (const intermediary of report.intermediaries) {
    if (intermediary.entityId && entityMap.has(intermediary.entityId)) {
      relations.push({
        fromId: intermediary.entityId,
        toId: intermediary.entityId,
        label: intermediary.role || "sprostredkovateľ toku",
      });
    }
  }

  return relations;
}

/**
 * Zslúči výstupy z Dimitri Checker do existujúcej analýzy prípadu (CaseAnalysis).
 */
export function mergeDimitriFindings(
  existing: CaseAnalysis,
  report: DimitriCheckerReport,
): CaseAnalysis {
  const newAlerts = buildDimitriAlerts(report, existing.case);
  const existingAlertIds = new Set(existing.alerts.map((a) => a.id));

  const filteredNewAlerts = newAlerts.filter(
    (a) => !existingAlertIds.has(a.id),
  );
  const mergedAlerts = [...existing.alerts, ...filteredNewAlerts];

  return {
    ...existing,
    alerts: mergedAlerts,
  };
}
