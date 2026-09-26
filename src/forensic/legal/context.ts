import type { CaseAnalysis, EntityAnalysis, Severity } from "../types";
import {
  LEGAL_SOURCES,
  type LawCode,
  type LawSource,
  type Provision,
  findProvision,
} from "./laws";
import { PERSON_TYPES, type PersonTypeId, personType } from "./personTypes";

export type LegalAssessment = {
  id: string;
  law: LawCode;
  lawTitle: string;
  lawVersion: string;
  provision: Provision;
  /** Prečo sa ustanovenie použilo — vždy naviazané na konkrétne detekcie. */
  basis: string[];
  entityIds: string[];
  severity: Severity;
  /** 0–100, odvodené od skóre podkladových detekcií. */
  confidence: number;
};

export type LegalGap = {
  code: "LEGAL_SOURCE_UNAVAILABLE";
  law: LawCode;
  lawTitle: string;
  detail: string;
};

export type LegalPersonAssignment = {
  entityId: string;
  entityName: string;
  typeId: PersonTypeId;
  label: string;
  reason: string;
};

export type LegalContext = {
  sources: LawSource[];
  availableLaws: LawCode[];
  unavailableLaws: LawCode[];
  assessments: LegalAssessment[];
  gaps: LegalGap[];
  persons: LegalPersonAssignment[];
  /** True len ak nie je dostupný ani jeden právny zdroj. */
  fullyBlocked: boolean;
};

type Rule = {
  law: LawCode;
  ref: string;
  /** Kódy detekcií (flag.code) alebo zdroje alertov, ktoré ustanovenie aktivujú. */
  triggers: string[];
  minSeverity?: Severity;
};

const SEVERITY_RANK: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const RULES: Rule[] = [
  // 300/2005 — hmotné právo
  {
    law: "300/2005",
    ref: "§ 233",
    triggers: [
      "LAYERING",
      "PASSTHROUGH",
      "SHELL_CONTROL",
      "ROUND_AMOUNT",
      "CASH_INTENSIVE",
    ],
  },
  {
    law: "300/2005",
    ref: "§ 294",
    triggers: [
      "EUROPOL_HOLDER",
      "LICENSE_ISSUE",
      "WEAPON_EUROPOL",
      "SERIAL_BATCH",
      "VOLUME_SURGE",
    ],
  },
  {
    law: "300/2005",
    ref: "§ 296",
    triggers: ["SHELL_CONTROL", "CHAIN", "THIRD_PARTY_PAYER"],
  },
  {
    law: "300/2005",
    ref: "§ 277a",
    triggers: [
      "NO_INVENTORY",
      "ADDRESS_MISMATCH",
      "NO_CONTACT",
      "NO_CONTACT_PERSON",
    ],
  },
  {
    law: "300/2005",
    ref: "§ 261",
    triggers: ["CROSS_BORDER", "TRANSIT_ANOMALY"],
  },
  // 301/2005 — procesné úkony
  {
    law: "301/2005",
    ref: "§ 95",
    triggers: [
      "LAYERING",
      "PASSTHROUGH",
      "ROUND_AMOUNT",
      "CASH_INTENSIVE",
      "SHELL_CONTROL",
    ],
  },
  {
    law: "301/2005",
    ref: "§ 89",
    triggers: [
      "EUROPOL_HOLDER",
      "LICENSE_ISSUE",
      "WEAPON_EUROPOL",
      "SERIAL_BATCH",
    ],
  },
  {
    law: "301/2005",
    ref: "§ 116",
    triggers: [
      "THIRD_PARTY_FUNDING",
      "THIRD_PARTY_PAYER",
      "SAME_DAY",
      "RAPID_REPEAT",
    ],
  },
  {
    law: "301/2005",
    ref: "§ 3",
    triggers: [
      "CROSS_BORDER",
      "TRANSIT_ANOMALY",
      "WEAPON_EUROPOL",
      "EUROPOL_HOLDER",
    ],
  },
  // 460/1992 — ústavné limity zásahov
  {
    law: "460/1992",
    ref: "čl. 20",
    triggers: ["LAYERING", "PASSTHROUGH", "SHELL_CONTROL", "CASH_INTENSIVE"],
  },
  {
    law: "460/1992",
    ref: "čl. 22",
    triggers: [
      "THIRD_PARTY_FUNDING",
      "SAME_DAY",
      "RAPID_REPEAT",
      "CROSS_BORDER",
    ],
  },
  {
    law: "460/1992",
    ref: "čl. 17",
    triggers: ["EUROPOL_HOLDER", "SHELL_CONTROL"],
    minSeverity: "critical",
  },
];

type Signal = {
  code: string;
  label: string;
  severity: Severity;
  score: number;
  entityIds: string[];
};

function collectSignals(analysis: CaseAnalysis): Signal[] {
  const signals: Signal[] = [];

  for (const entity of analysis.entities) {
    for (const flag of entity.flags) {
      signals.push({
        code: flag.code,
        label: `${flag.label} — ${entity.entity.name}`,
        severity: flag.severity,
        score: Math.min(100, flag.weight * 2),
        entityIds: [entity.entity.id],
      });
    }
  }

  for (const tx of analysis.transactions) {
    for (const flag of tx.flags) {
      signals.push({
        code: flag.code,
        label: `${flag.label} — ${tx.transaction.description}`,
        severity: flag.severity,
        score: tx.score,
        entityIds: [tx.transaction.fromId, tx.transaction.toId],
      });
    }
  }

  for (const weapon of analysis.weapons) {
    if (weapon.europolMatch) {
      signals.push({
        code: "WEAPON_EUROPOL",
        label: `Zhoda v EUROPOL — ${weapon.weapon.brand} ${weapon.weapon.model} (${weapon.weapon.serial})`,
        severity: "critical",
        score: 95,
        entityIds: [weapon.weapon.holderId, weapon.weapon.supplierId],
      });
    }
    if (weapon.invalidLicence) {
      signals.push({
        code: "LICENSE_ISSUE",
        label: `Chýbajúca licencia — ${weapon.weapon.serial}`,
        severity: "high",
        score: 70,
        entityIds: [weapon.weapon.holderId],
      });
    }
  }

  for (const chain of analysis.chains) {
    signals.push({
      code: "CHAIN",
      label: "Reťazec dodávateľ → schránka → odberateľ",
      severity: chain.severity,
      score: chain.severity === "critical" ? 92 : 74,
      entityIds: [chain.shellId, ...chain.supplierIds, ...chain.buyerIds],
    });
  }

  for (const flow of analysis.crossBorder) {
    signals.push({
      code: "CROSS_BORDER",
      label: `Cezhraničný tok ${flow.route}`,
      severity: flow.score >= 80 ? "critical" : "high",
      score: flow.score,
      entityIds: [],
    });
  }

  for (const path of analysis.moneyPaths) {
    signals.push({
      code: "LAYERING",
      label: `Trasa peňazí cez ${path.hops} kroky`,
      severity: path.severity,
      score: path.score,
      entityIds: path.entityIds,
    });
  }

  for (const signal of analysis.launderingSignals) {
    signals.push({
      code: signal.code,
      label: signal.label,
      severity: signal.severity,
      score: signal.score,
      entityIds: [signal.entityId],
    });
  }

  for (const pattern of analysis.temporalPatterns) {
    signals.push({
      code: pattern.code,
      label: pattern.label,
      severity: pattern.severity,
      score: pattern.score,
      entityIds: [],
    });
  }

  return signals;
}

function inferPersonType(entity: EntityAnalysis): LegalPersonAssignment {
  const codes = new Set(entity.flags.map((f) => f.code));
  const base = { entityId: entity.entity.id, entityName: entity.entity.name };

  if (entity.entity.kind === "person") {
    if (codes.has("SHELL_CONTROL") || codes.has("THIRD_PARTY_PAYER")) {
      return {
        ...base,
        typeId: "suspect",
        label: PERSON_TYPES.suspect.label,
        reason: "Ovláda schránkové firmy a financuje nákupy za iné subjekty.",
      };
    }
    if (entity.entity.responsive === false) {
      return {
        ...base,
        typeId: "straw_man",
        label: PERSON_TYPES.straw_man.label,
        reason: "Nekontaktná osoba vo formálnej pozícii bez reálnej činnosti.",
      };
    }
    if (entity.score >= 60) {
      return {
        ...base,
        typeId: "statutory_body",
        label: PERSON_TYPES.statutory_body.label,
        reason:
          "Vysoké rizikové skóre pri výkone funkcie v dotknutých spoločnostiach.",
      };
    }
    return {
      ...base,
      typeId: "witness",
      label: PERSON_TYPES.witness.label,
      reason:
        "Bez samostatných rizikových indikátorov, relevantná pre výsluch.",
    };
  }

  if (entity.isShell) {
    return {
      ...base,
      typeId: "legal_entity",
      label: PERSON_TYPES.legal_entity.label,
      reason:
        "Schránková spoločnosť — možná trestná zodpovednosť právnickej osoby.",
    };
  }
  if (entity.score >= 35) {
    return {
      ...base,
      typeId: "legal_entity",
      label: PERSON_TYPES.legal_entity.label,
      reason: "Zapojená do rizikových transakcií v rámci reťazca.",
    };
  }
  return {
    ...base,
    typeId: "third_party_affected",
    label: PERSON_TYPES.third_party_affected.label,
    reason: "Dotknutý subjekt bez vlastných rizikových detekcií.",
  };
}

/**
 * Zostaví právny kontext prípadu. Gating je per-zákon: nedostupný zdroj
 * vygeneruje LEGAL_SOURCE_UNAVAILABLE len pre seba, ostatné zákony sa
 * vyhodnocujú normálne.
 */
export function buildLegalContext(analysis: CaseAnalysis): LegalContext {
  const sources = Object.values(LEGAL_SOURCES);
  const availableLaws = sources
    .filter((s) => s.availability === "available")
    .map((s) => s.code);
  const unavailableLaws = sources
    .filter((s) => s.availability !== "available")
    .map((s) => s.code);

  const gaps: LegalGap[] = sources
    .filter((s) => s.availability !== "available")
    .map((s) => ({
      code: "LEGAL_SOURCE_UNAVAILABLE" as const,
      law: s.code,
      lawTitle: s.title,
      detail:
        s.unavailableReason ??
        `Znenie ${s.code} nie je v datasete — posúdenie podľa tohto predpisu je vynechané.`,
    }));

  const signals = collectSignals(analysis);
  const assessments: LegalAssessment[] = [];

  for (const rule of RULES) {
    const source = LEGAL_SOURCES[rule.law];
    if (source.availability !== "available") continue;

    const provision = findProvision(rule.law, rule.ref);
    if (!provision) continue;

    const matched = signals.filter(
      (s) =>
        rule.triggers.includes(s.code) &&
        (!rule.minSeverity ||
          SEVERITY_RANK[s.severity] >= SEVERITY_RANK[rule.minSeverity]),
    );
    if (matched.length === 0) continue;

    const severity = matched.reduce<Severity>(
      (acc, s) =>
        SEVERITY_RANK[s.severity] > SEVERITY_RANK[acc] ? s.severity : acc,
      "low",
    );
    const confidence = Math.min(
      100,
      Math.round(
        matched.reduce((sum, s) => sum + s.score, 0) / matched.length +
          (matched.length - 1) * 4,
      ),
    );

    assessments.push({
      id: `${rule.law}-${rule.ref}`,
      law: rule.law,
      lawTitle: source.title,
      lawVersion: source.version,
      provision,
      basis: [...new Set(matched.map((m) => m.label))].slice(0, 6),
      entityIds: [...new Set(matched.flatMap((m) => m.entityIds))],
      severity,
      confidence,
    });
  }

  assessments.sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      b.confidence - a.confidence,
  );

  return {
    sources,
    availableLaws,
    unavailableLaws,
    assessments,
    gaps,
    persons: analysis.entities.map(inferPersonType),
    fullyBlocked: availableLaws.length === 0,
  };
}

export { PERSON_TYPES, personType };
