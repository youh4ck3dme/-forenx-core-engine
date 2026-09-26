import type {
  ForensicCaseUnified,
  CaseEntity,
  CaseTransaction,
  CaseRelationship,
  CaseTimelineEvent,
  CaseRelationshipType,
} from "@/types/forensic-case";
import { ForensicCaseUnifiedSchema } from "@/types/forensic-case";
import type {
  ForensicCase as LegacyForensicCase,
  Entity as LegacyEntity,
  Transaction as LegacyTransaction,
  Relation as LegacyRelation,
  CaseEvent as LegacyCaseEvent,
  Severity as LegacySeverity,
} from "@/forensic";
import { sha256Hex } from "@/lib/export-pdf";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Zistí typ vzťahu podľa textového popisu hrany.
 */
function inferRelationshipType(label: string): CaseRelationshipType {
  const norm = label.toLowerCase();
  if (
    norm.includes("konateľ") ||
    norm.includes("štatutár") ||
    norm.includes("riaditeľ") ||
    norm.includes("výkonný")
  ) {
    return "statutory";
  }
  if (
    norm.includes("spoločník") ||
    norm.includes("majiteľ") ||
    norm.includes("akcionár") ||
    norm.includes("vlastník") ||
    norm.includes("podiel")
  ) {
    return "shareholder";
  }
  if (
    norm.includes("prevod") ||
    norm.includes("platba") ||
    norm.includes("úhrada") ||
    norm.includes("pôžička") ||
    norm.includes("faktúra")
  ) {
    return "money_flow";
  }
  if (
    norm.includes("spoluobvinen") ||
    norm.includes("komplic") ||
    norm.includes("organizátor")
  ) {
    return "co_accused";
  }
  if (
    norm.includes("manžel") ||
    norm.includes("rodina") ||
    norm.includes("otec") ||
    norm.includes("syn") ||
    norm.includes("dcéra") ||
    norm.includes("brat") ||
    norm.includes("sestra")
  ) {
    return "family";
  }
  return "common_event";
}

/**
 * Obojsmerný adaptér: Konvertuje existujúci starší model prípadu (ForensicCase a ForensicDossier)
 * do nového unifikovaného modelu ForensicCaseUnified so zachovaním všetkých dát.
 */
export function adaptLegacyCaseToUnified(
  legacyCase: any,
  dossier?: any,
): ForensicCaseUnified {
  const preservedUnified = legacyCase?.__forenxUnified;
  if (preservedUnified)
    return ForensicCaseUnifiedSchema.parse(preservedUnified);
  const caseId =
    legacyCase?.id ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "default-case-id");
  const caseName = legacyCase?.name || "Bez názvu";
  const now = new Date().toISOString();

  // 1. Metadáta a SHA-256
  const payloadToHash = JSON.stringify({
    id: caseId,
    name: caseName,
    entities: legacyCase?.entities ?? [],
    transactions: legacyCase?.transactions ?? [],
    events: legacyCase?.events ?? [],
  });
  const sha256Hash = sha256Hex(payloadToHash);

  // 2. Subjekty (Entities)
  const rawEntities: any[] = Array.isArray(legacyCase?.entities)
    ? legacyCase.entities
    : [];
  const entities: CaseEntity[] = rawEntities.map((e, index) => {
    const hasIco = Boolean(e.ico && String(e.ico).trim().length > 0);
    const intelligence =
      e.intelligence ||
      (hasIco
        ? {
            verified: false,
            source: "whoiswho_sk" as const,
            riskScore: typeof e.score === "number" ? e.score : 0,
            isShellCompany: Boolean(e.isShell),
            taxDebtor: false,
            inBankruptcy: false,
            inRestructuring: false,
          }
        : undefined);

    return {
      id: String(e.id || `ent-${index}`),
      name: String(e.name || "Neznámy subjekt"),
      kind: e.kind === "company" ? "company" : "person",
      role: String(e.role || ""),
      ico: e.ico ? String(e.ico).trim() : undefined,
      country: String(e.country || "SK"),
      address: e.address || e.registeredAddress || undefined,
      position: {
        x: typeof e.x === "number" ? e.x : 100 + (index % 5) * 120,
        y: typeof e.y === "number" ? e.y : 100 + Math.floor(index / 5) * 100,
      },
      intelligence,
    };
  });

  // 3. Transakcie (Transactions)
  const rawTransactions: any[] = Array.isArray(legacyCase?.transactions)
    ? legacyCase.transactions
    : [];
  const transactions: CaseTransaction[] = rawTransactions.map((t, index) => ({
    id: String(t.id || `tx-${index}`),
    documentId: t.documentId || t.importId || undefined,
    date: String(t.date || now.slice(0, 10)),
    amount: Number(t.amount || 0),
    currency: String(t.currency || legacyCase?.baseCurrency || "EUR"),
    fromEntityId: String(t.fromId || t.fromEntityId || ""),
    toEntityId: String(t.toId || t.toEntityId || ""),
    ibanSource: t.ibanSource || undefined,
    ibanTarget: t.ibanTarget || undefined,
    method: t.method === "cash" ? ("cash" as const) : ("transfer" as const),
    description: String(t.description || ""),
    anomalies: Array.isArray(t.anomalies) ? t.anomalies.map(String) : [],
    sourceRef: t.sourceRef
      ? typeof t.sourceRef === "object"
        ? {
            documentId: String(t.sourceRef.documentId || ""),
            page:
              typeof t.sourceRef.page === "number"
                ? t.sourceRef.page
                : undefined,
            excerpt: t.sourceRef.excerpt
              ? String(t.sourceRef.excerpt)
              : undefined,
          }
        : { documentId: String(t.sourceRef) }
      : undefined,
  }));

  // 4. Vzťahy v grafe (Relationships)
  const rawRelations: any[] = Array.isArray(legacyCase?.relations)
    ? legacyCase.relations
    : [];
  const relationships: CaseRelationship[] = rawRelations.map((r, index) => {
    const label = String(r.label || "");
    const type = r.type || inferRelationshipType(label);
    const fromEntityId = String(r.fromId || r.fromEntityId || "");
    const toEntityId = String(r.toId || r.toEntityId || "");
    return {
      id: String(r.id || `rel-${fromEntityId}-${toEntityId}-${index}`),
      fromEntityId,
      toEntityId,
      type,
      label,
      weight: Number(r.weight || 1),
      sourceRef: r.sourceRef ? String(r.sourceRef) : undefined,
    };
  });

  // 5. Časová os a udalosti (Timeline)
  const rawEvents: any[] =
    Array.isArray(legacyCase?.events) && legacyCase.events.length > 0
      ? legacyCase.events
      : Array.isArray(dossier?.facts?.timeline)
        ? dossier.facts.timeline
        : [];

  const timeline: CaseTimelineEvent[] = rawEvents.map((ev, index) => {
    const rawSev = String(ev.severity || "medium").toLowerCase();
    const severity: "critical" | "high" | "medium" | "low" =
      rawSev === "critical" || rawSev === "high" || rawSev === "low"
        ? (rawSev as any)
        : "medium";

    const title = String(ev.title || ev.event || "Udalosť");
    const detail = String(ev.detail || ev.event || "");
    const timestamp = String(
      ev.date || ev.timestamp || ev.time || now.slice(0, 10),
    );

    const sourceRef = ev.sourceRef
      ? typeof ev.sourceRef === "object"
        ? {
            documentId: String(ev.sourceRef.documentId || ""),
            page:
              typeof ev.sourceRef.page === "number"
                ? ev.sourceRef.page
                : undefined,
            excerpt: ev.sourceRef.excerpt
              ? String(ev.sourceRef.excerpt)
              : undefined,
          }
        : { documentId: String(ev.sourceRef) }
      : ev.source
        ? { documentId: String(ev.source) }
        : undefined;

    return {
      id: String(ev.id || `event-${index}`),
      timestamp,
      title,
      detail,
      severity,
      paragraph: ev.paragraph ? String(ev.paragraph) : undefined,
      involvedEntityIds: Array.isArray(ev.actors)
        ? ev.actors.map(String)
        : Array.isArray(ev.involvedEntityIds)
          ? ev.involvedEntityIds.map(String)
          : [],
      chainBreak: Boolean(ev.chainBreak),
      sourceRef,
    };
  });

  // 6. Dokumenty (Documents)
  const documents =
    Array.isArray(legacyCase?.documents) && legacyCase.documents.length > 0
      ? legacyCase.documents
      : Array.isArray(dossier?.analysisMeta?.documentIds)
        ? dossier.analysisMeta.documentIds.map(
            (docId: string, idx: number) => ({
              id: docId || `doc-${idx}`,
              name: docId || `dokument-${idx + 1}.pdf`,
              size: 0,
              mimeType: "application/pdf",
              sha256: sha256Hex(docId),
              classification: "court_dossier" as const,
              ocrStatus: "completed" as const,
              usedOcr: false,
              pageCount: 1,
            }),
          )
        : [];

  // 7. Zhrnutie autopilota (DossierSummary)
  let dossierSummary: any = undefined;
  if (dossier) {
    dossierSummary = {
      defendabilityIndex:
        typeof dossier.defendabilityIndex === "number"
          ? dossier.defendabilityIndex
          : 50,
      overallRisk: dossier.defenseAttack?.overallRisk || "STREDNÉ",
      defenseAttacks: Array.isArray(dossier.defenseAttack?.attacks)
        ? dossier.defenseAttack.attacks
        : [],
      judgeReadyText: dossier.judgeReadyText,
      investigativeAnswers: dossier.investigativeAnswers,
    };
  }

  const result: ForensicCaseUnified = {
    metadata: {
      id: caseId,
      userId: String(legacyCase?.userId || "local-user"),
      name: caseName,
      subtitle: String(legacyCase?.subtitle || ""),
      referenceDate: String(legacyCase?.referenceDate || now.slice(0, 10)),
      baseCurrency: String(legacyCase?.baseCurrency || "EUR"),
      sha256Hash,
      status: dossierSummary || entities.length > 0 ? "analyzed" : "draft",
      tags: Array.isArray(legacyCase?.tags) ? legacyCase.tags.map(String) : [],
      createdAt: String(legacyCase?.createdAt || now),
      updatedAt: String(legacyCase?.updatedAt || now),
      isDemo: Boolean(legacyCase?.isDemo),
    },
    documents,
    entities,
    transactions,
    relationships,
    timeline,
    dossierSummary,
  };

  return ForensicCaseUnifiedSchema.parse(result);
}

/**
 * Obojsmerný adaptér: Konvertuje unifikovaný model späť do formátu ForensicCase
 * očakávaného existujúcimi komponentmi (NetworkGraph, analyzeCase, atď.).
 */
export function adaptUnifiedToLegacyCase(
  unified: ForensicCaseUnified,
): LegacyForensicCase {
  const entities: LegacyEntity[] = unified.entities.map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind === "company" ? "company" : "person",
    role: e.role,
    ico: e.ico,
    address: e.address,
    registeredAddress: e.address,
    country: e.country,
    x: e.position.x,
    y: e.position.y,
  }));

  const transactions: LegacyTransaction[] = unified.transactions.map((t) => ({
    id: t.id,
    date: t.date,
    amount: t.amount,
    currency: t.currency,
    method: t.method === "cash" ? "cash" : "transfer",
    fromId: t.fromEntityId,
    toId: t.toEntityId,
    originCountry: "SK",
    destinationCountry: "SK",
    description: t.description,
  }));

  const relations: LegacyRelation[] = unified.relationships.map((r) => ({
    fromId: r.fromEntityId,
    toId: r.toEntityId,
    label: r.label,
  }));

  const events: LegacyCaseEvent[] = unified.timeline.map((ev) => ({
    date: ev.timestamp,
    title: ev.title,
    detail: ev.detail,
    severity: (["critical", "high", "medium", "low"].includes(ev.severity)
      ? ev.severity
      : "low") as LegacySeverity,
  }));

  return {
    id: unified.metadata.id,
    name: unified.metadata.name,
    subtitle: unified.metadata.subtitle,
    referenceDate: unified.metadata.referenceDate,
    baseCurrency: unified.metadata.baseCurrency,
    entities,
    transactions,
    weapons: [],
    relations,
    events,
    europolSerials: [],
    validLicences: [],
    orsrAddresses: {},
    // Legacy consumers ignore unknown fields; retaining the original snapshot
    // keeps the legacy bridge lossless when the value is adapted back.
    __forenxUnified: structuredClone(unified),
  } as LegacyForensicCase;
}
