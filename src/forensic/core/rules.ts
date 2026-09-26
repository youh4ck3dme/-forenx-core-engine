import type { EvidenceRef, FindingKind, Flag, Severity } from "../types";

/**
 * Verzia sady pravidiel. Mení sa pri každej zmene prahu, váhy alebo podmienky.
 * Výsledok analýzy je reprodukovateľný pre danú verziu pravidiel a dané dáta —
 * nezávisí od času vytvorenia reportu ani od rozloženia grafu.
 */
export const RULES_VERSION = "2026.09.1";

export type RuleDoc = {
  id: string;
  label: string;
  /** fakt = priamo pozorované v dátach, heuristika = interpretácia, hypotéza = návrh na overenie. */
  kind: FindingKind;
  /** Ľudsky čitateľná spúšťacia podmienka vrátane prahu. */
  condition: string;
  weight: number;
  severity: Severity;
  /** Odkiaľ pochádza prah — model dát, odborná prax alebo dohoda produktu. */
  basis: string;
};

export const RULE_CATALOG: Record<string, RuleDoc> = {
  ROUND_AMOUNT: {
    id: "ROUND_AMOUNT",
    label: "Zaokrúhlená suma",
    kind: "heuristika",
    condition: "Suma je presne 20/25/30/35/40 tis. v mene transakcie",
    weight: 18,
    severity: "medium",
    basis:
      "Dohoda produktu — okrúhle sumy sú typické pre dohodnuté, nie trhové ceny.",
  },
  CASH_HIGH_VALUE: {
    id: "CASH_HIGH_VALUE",
    label: "Vysoká hotovostná platba",
    kind: "fakt",
    condition: "Spôsob platby = hotovosť a |suma| ≥ 15 000",
    weight: 24,
    severity: "high",
    basis: "Limit hotovostných platieb v SR (zákon č. 394/2012 Z. z.).",
  },
  SAME_DAY: {
    id: "SAME_DAY",
    label: "Viac transakcií v jeden deň",
    kind: "fakt",
    condition: "≥ 2 transakcie s rovnakým dátumom a spolu ≥ 50 000",
    weight: 20,
    severity: "high",
    basis: "Dohoda produktu — indikátor rozdelenia jednej platby.",
  },
  RAPID_SUCCESSIVE: {
    id: "RAPID_SUCCESSIVE",
    label: "Rýchle opakovanie nákupov",
    kind: "heuristika",
    condition: "≥ 3 transakcie tej istej strany v okne 183 dní",
    weight: 16,
    severity: "high",
    basis: "Dohoda produktu — frekvencia nad bežnú obchodnú kadenciu.",
  },
  THIRD_PARTY_PAYMENT: {
    id: "THIRD_PARTY_PAYMENT",
    label: "Platba tretej strany",
    kind: "fakt",
    condition: "Vyplnený platiteľ sa líši od zmluvnej strany",
    weight: 18,
    severity: "high",
    basis: "Priamo z dátového modelu (pole platiteľ).",
  },
};

/** Doplní pravidlu chýbajúce metadáta, aby každé zistenie malo stabilný identifikátor. */
export function withRuleMeta(flag: Flag, evidence?: EvidenceRef[]): Flag {
  const doc = RULE_CATALOG[flag.code];
  return {
    ...flag,
    ruleId: flag.ruleId ?? flag.code,
    ruleVersion: flag.ruleVersion ?? RULES_VERSION,
    kind: flag.kind ?? doc?.kind ?? "heuristika",
    condition: flag.condition ?? doc?.condition ?? "",
    evidence: flag.evidence ?? evidence ?? [],
  };
}

export const SCORE_METHODOLOGY = {
  version: RULES_VERSION,
  summary:
    "Skóre je heuristické skóre rizika, nie pravdepodobnosť trestnej činnosti. Vzniká súčtom váh splnených pravidiel, orezaným na 100.",
  thresholds: [
    { level: "critical" as Severity, from: 80 },
    { level: "high" as Severity, from: 60 },
    { level: "medium" as Severity, from: 35 },
    { level: "low" as Severity, from: 0 },
  ],
};
