/**
 * Serverová (a zdieľaná) pripravenosť AI kontrol podľa dát v DB.
 * Prehliadačom načítaný súbor bez persistencie nie je „analyzovaný“.
 */

export type AiControlTask =
  | "explain_finding"
  | "case_summary"
  | "normalize_descriptions"
  | "alt_devil"
  | "admiss_audit";

export const CASE_NOT_READY_MESSAGE =
  "Prípad zatiaľ neobsahuje dáta na kontrolu. Najprv spustite analýzu spisu.";

/** Jasná správa pri chýbajúcich / prázdnych transakciách (normalize_descriptions). */
export const NO_TRANSACTION_DATA_MESSAGE =
  "V spise neboli nájdené transakčné dáta.";

/** Stav výsledku kontroly podľa zmluvy Sandbox / AI controls. */
export type AiControlStatus =
  "READY" | "NOT_READY" | "NO_FINDINGS" | "COMPLETED";

export type ControlDataSnapshot = {
  entityCount: number;
  transactionCount: number;
  /** Počet forenzných nálezov / alertov z analyzeCase. */
  findingCount: number;
  eventCount: number;
  hasDossier: boolean;
};

export type ControlReadiness = {
  ready: boolean;
  status: "READY" | "NOT_READY";
  missing: string[];
  message: string;
};

export type AiControlFinding = {
  id?: string;
  title: string;
  detail?: string;
  severity?: string;
};

/** Jednotná zmluva výsledku pre normalizáciu, alt. scenáre a audit. */
export type AiControlResult = {
  status: AiControlStatus;
  summary: string;
  findings: AiControlFinding[];
  warnings: string[];
  sourceReferences: string[];
  promptVersion: string;
  createdAt: string;
};

const LABELS = {
  entities: "entity (case_entities)",
  transactions: "transakcie (case_transactions)",
  findings: "nálezy / findings",
  events: "udalosti časovej osi (case_events)",
  dossier: "forenzný dossier (analýza spisu)",
} as const;

function hasAnyEvidence(snap: ControlDataSnapshot): boolean {
  return (
    snap.entityCount > 0 ||
    snap.transactionCount > 0 ||
    snap.findingCount > 0 ||
    snap.eventCount > 0 ||
    snap.hasDossier
  );
}

/**
 * Čo daná kontrola potrebuje v DB pred volaním AI.
 * Bez dát → NOT_READY (AI sa nevolá).
 */
export function assessControlReadiness(
  task: AiControlTask,
  snap: ControlDataSnapshot,
): ControlReadiness {
  const missing: string[] = [];

  switch (task) {
    case "normalize_descriptions":
      if (snap.transactionCount === 0) {
        missing.push(LABELS.transactions);
        return {
          ready: false,
          status: "NOT_READY",
          missing,
          message: NO_TRANSACTION_DATA_MESSAGE,
        };
      }
      break;
    case "alt_devil":
      // Hypotézy majú zmysel len pri existujúcej stope / entitách / nálezoch.
      if (
        snap.entityCount === 0 &&
        snap.transactionCount === 0 &&
        snap.findingCount === 0
      ) {
        if (snap.entityCount === 0) missing.push(LABELS.entities);
        if (snap.transactionCount === 0) missing.push(LABELS.transactions);
        if (snap.findingCount === 0) missing.push(LABELS.findings);
      }
      break;
    case "admiss_audit":
      if (
        snap.entityCount === 0 &&
        snap.eventCount === 0 &&
        snap.findingCount === 0 &&
        !snap.hasDossier
      ) {
        missing.push(LABELS.entities);
        missing.push(LABELS.events);
        missing.push(LABELS.findings);
        missing.push(LABELS.dossier);
      }
      break;
    case "case_summary":
      if (!hasAnyEvidence(snap)) {
        missing.push(LABELS.entities);
        missing.push(LABELS.transactions);
        missing.push(LABELS.findings);
        missing.push(LABELS.dossier);
      }
      break;
    case "explain_finding":
      if (snap.findingCount === 0) missing.push(LABELS.findings);
      break;
    default:
      if (!hasAnyEvidence(snap)) {
        missing.push(LABELS.entities);
        missing.push(LABELS.transactions);
      }
  }

  if (missing.length > 0) {
    return {
      ready: false,
      status: "NOT_READY",
      missing,
      message: CASE_NOT_READY_MESSAGE,
    };
  }

  return {
    ready: true,
    status: "READY",
    missing: [],
    message: "",
  };
}

export function snapshotFromCounts(input: {
  entities: number;
  transactions: number;
  findings: number;
  events?: number;
  hasDossier?: boolean;
}): ControlDataSnapshot {
  return {
    entityCount: input.entities,
    transactionCount: input.transactions,
    findingCount: input.findings,
    eventCount: input.events ?? 0,
    hasDossier: input.hasDossier ?? false,
  };
}
