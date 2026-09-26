import type { CaseAnalysis, Flag } from "@/forensic";

/**
 * Minimalizácia a pseudonymizácia dát pred odoslaním do Mistralu.
 *
 * Identifikátory subjektov a transakcií sa nahrádzajú konzistentnými pseudonymami
 * (S1, S2, T1 …), takže väzby medzi záznamami ostávajú zachované, ale mená,
 * adresy, IČO ani UUID sa neodosielajú.
 *
 * Automatická redakcia NIE JE záruka: voľný text (popis platby, poznámka) môže
 * obsahovať mená, čísla účtov alebo iné citlivé údaje. Preto sa používateľovi
 * pred odoslaním zobrazuje presný náhľad odosielaných dát.
 */

export const PROMPT_VERSION = "2026.09.1";

export type Pseudonyms = {
  entity: Record<string, string>;
  entityBack: Record<string, string>;
  transaction: Record<string, string>;
  transactionBack: Record<string, string>;
};

export type AiPayload = {
  case: {
    pseudonym: string;
    baseCurrency: string;
    referenceDate: string;
    revision: string;
  };
  entities: { id: string; kind: string; role: string; country: string }[];
  transactions: {
    id: string;
    date: string;
    amount: number;
    currency: string;
    method: string;
    from: string;
    to: string;
    description: string;
  }[];
  findings: {
    ruleId: string;
    kind: string;
    condition: string;
    severity: string;
    evidence: string[];
  }[];
};

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function buildPseudonyms(analysis: CaseAnalysis): Pseudonyms {
  const entity: Record<string, string> = {};
  const entityBack: Record<string, string> = {};
  const transaction: Record<string, string> = {};
  const transactionBack: Record<string, string> = {};
  analysis.case.entities.forEach((e, i) => {
    const alias = `S${i + 1}`;
    entity[e.id] = alias;
    entityBack[alias] = e.id;
  });
  analysis.case.transactions.forEach((t, i) => {
    const alias = `T${i + 1}`;
    transaction[t.id] = alias;
    transactionBack[alias] = t.id;
  });
  return { entity, entityBack, transaction, transactionBack };
}

export type PayloadScope =
  | { task: "explain_finding"; alertId: string }
  | { task: "case_summary" }
  | { task: "normalize_descriptions" }
  | { task: "alt_devil" }
  | { task: "admiss_audit" };

function flagsOfAlert(analysis: CaseAnalysis, alertId: string): Flag[] {
  const alert = analysis.alerts.find((a) => a.id === alertId);
  if (!alert) return [];
  const all: Flag[] = [
    ...analysis.entities.flatMap((e) => e.flags),
    ...analysis.transactions.flatMap((t) => t.flags),
    ...analysis.weapons.flatMap((w) => w.flags),
  ];
  return all.filter(
    (f) => alert.id.includes(f.code) || alert.title === f.label,
  );
}

/** Zostaví minimalizovaný a pseudonymizovaný obsah pre konkrétnu úlohu. */
export function buildAiPayload(
  analysis: CaseAnalysis,
  scope: PayloadScope,
  pseudonyms: Pseudonyms = buildPseudonyms(analysis),
): { payload: AiPayload; pseudonyms: Pseudonyms } {
  const alias = (id: string) => pseudonyms.entity[id] ?? "S?";
  const txAlias = (id: string) => pseudonyms.transaction[id] ?? "T?";

  const flags =
    scope.task === "explain_finding"
      ? flagsOfAlert(analysis, scope.alertId)
      : [];
  const evidenceIds = new Set(
    flags.flatMap((f) => (f.evidence ?? []).map((e) => e.id)),
  );

  const includeTx =
    scope.task === "case_summary" || scope.task === "normalize_descriptions"
      ? analysis.case.transactions
      : analysis.case.transactions.filter((t) => evidenceIds.has(t.id));

  const includeEntities =
    scope.task === "explain_finding"
      ? analysis.case.entities.filter(
          (e) =>
            evidenceIds.has(e.id) ||
            includeTx.some((t) => t.fromId === e.id || t.toId === e.id),
        )
      : analysis.case.entities;

  const payload: AiPayload = {
    case: {
      pseudonym: "PRÍPAD",
      baseCurrency: analysis.case.baseCurrency,
      referenceDate: analysis.case.referenceDate,
      revision: analysis.dataFingerprint ?? "",
    },
    entities: includeEntities.map((e) => ({
      id: alias(e.id),
      kind: e.kind,
      role: truncate(e.role, 60),
      country: e.country,
    })),
    transactions: includeTx.map((t) => ({
      id: txAlias(t.id),
      date: t.date,
      amount: t.amount,
      currency: t.currency,
      method: t.method,
      from: alias(t.fromId),
      to: alias(t.toId),
      description: truncate(t.description, 160),
    })),
    findings: (scope.task === "explain_finding"
      ? flags
      : analysis.alerts
          .slice(0, 30)
          .flatMap((a) => flagsOfAlert(analysis, a.id))
    ).map((f) => ({
      ruleId: f.ruleId ?? f.code,
      kind: f.kind ?? "heuristika",
      condition: f.condition ?? "",
      severity: f.severity,
      evidence: (f.evidence ?? []).map((e) =>
        e.type === "transaction" ? txAlias(e.id) : alias(e.id),
      ),
    })),
  };

  return { payload, pseudonyms };
}

/** Čitateľný náhľad toho, čo presne odchádza poskytovateľovi. */
export function payloadPreview(payload: AiPayload): string {
  return JSON.stringify(payload, null, 2);
}
