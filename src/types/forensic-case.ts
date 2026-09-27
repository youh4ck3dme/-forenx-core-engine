import { z } from "zod";

// ─── 1. METADÁTA A INTEGRITA ─────────────────────────────────────
export const CaseMetadataSchema = z.object({
  id: z.string().min(1, "Identifikátor prípadu je povinný."),
  userId: z.string().default("local-user"),
  name: z.string().min(1, "Názov prípadu je povinný."),
  subtitle: z.string().default(""),
  referenceDate: z
    .string()
    .default(() => new Date().toISOString().slice(0, 10)), // YYYY-MM-DD
  baseCurrency: z.string().default("EUR"),
  sha256Hash: z.string().regex(/^[a-f0-9]{64}$/i, "Neplatný SHA-256 odtlačok"),
  status: z
    .enum(["draft", "processing", "analyzed", "archived"])
    .default("draft"),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
  isDemo: z.boolean().default(false),
});

export type CaseMetadata = z.infer<typeof CaseMetadataSchema>;

// ─── 2. NAHRANÉ DOKUMENTY (DOCUMENTS) ─────────────────────────────
export const DocumentClassificationSchema = z.enum([
  "bank_statement",
  "court_dossier",
  "commercial_contract",
  "corporate_registry",
  "cross_border_report",
  "unknown",
]);

export type DocumentClassification = z.infer<
  typeof DocumentClassificationSchema
>;

export const CaseDocumentSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  size: z.number().nonnegative("Veľkosť nemôže byť záporná"),
  mimeType: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, "Neplatný SHA-256 hash"),
  classification: DocumentClassificationSchema,
  ocrStatus: z.enum(["none", "pending", "completed", "failed"]),
  usedOcr: z.boolean().default(false),
  pageCount: z.number().int().nonnegative().default(1),
  rawTextPreview: z.string().optional(),
  extractedText: z.string().optional(),
  hashBasis: z
    .enum(["file_bytes", "extracted_text", "legacy_unknown"])
    .optional(),
  passages: z
    .array(
      z.object({
        page: z.number().int().positive(),
        paragraph: z.number().int().positive(),
        text: z.string().min(1),
      }),
    )
    .optional(),
  uploadedAt: z.string().optional(),
  storagePath: z.string().optional(),
});

export type CaseDocument = z.infer<typeof CaseDocumentSchema>;

// ─── 3. SUBJEKTY (ENTITIES) S NAPOJENÍM NA WHOISWHO / ARES ─────────
export const CaseEntityIntelligenceSchema = z.object({
  verified: z.boolean().default(false),
  source: z.enum(["whoiswho_sk", "ares_cz", "ico_atlas", "manual"]).optional(),
  riskScore: z.number().min(0).max(100).default(0),
  isShellCompany: z.boolean().default(false),
  taxDebtor: z.boolean().default(false),
  inBankruptcy: z.boolean().default(false),
  inRestructuring: z.boolean().default(false),
  lastCheckedAt: z.string().optional(),
  ddReportUrl: z.string().url().optional(),
  taxDebts: z
    .array(
      z.object({
        authority: z.string(),
        amount: z.number(),
        currency: z.string(),
      }),
    )
    .optional(),
  executions: z
    .array(z.object({ reference: z.string(), status: z.string() }))
    .optional(),
});

export type CaseEntityIntelligence = z.infer<
  typeof CaseEntityIntelligenceSchema
>;

export const CaseEntityPositionSchema = z.object({
  x: z.number().default(100),
  y: z.number().default(100),
});

/**
 * A display name is never an identity: two natural persons can share one and
 * company names can change.  Only registry-issued identifiers may be used to
 * merge entities automatically.
 */
export const CaseEntityIdentityKeySchema = z.discriminatedUnion("scheme", [
  z.object({ scheme: z.literal("ico"), value: z.string().regex(/^\d{8}$/) }),
  z.object({
    scheme: z.literal("registry"),
    registry: z.string().trim().min(1).max(64),
    value: z.string().trim().min(1).max(160),
  }),
  z.object({
    scheme: z.literal("person_reference"),
    issuer: z.string().trim().min(1).max(64),
    value: z.string().trim().min(1).max(160),
  }),
]);

export type CaseEntityIdentityKey = z.infer<
  typeof CaseEntityIdentityKeySchema
>;

export const CaseEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["person", "company"]),
  /** Omitted means the entity is unresolved and must not be name-merged. */
  identityKey: CaseEntityIdentityKeySchema.optional(),
  role: z.string().default(""),
  ico: z.string().optional(),
  country: z.string().default("SK"),
  address: z.string().optional(),
  position: CaseEntityPositionSchema.default({ x: 100, y: 100 }),
  intelligence: CaseEntityIntelligenceSchema.optional(),
});

export type CaseEntity = z.infer<typeof CaseEntitySchema>;

// ─── 4. TRANSAKCIE (FINANČNÉ TOKY) ────────────────────────────────
export const CaseSourceRefSchema = z.object({
  documentId: z.string(),
  page: z.number().optional(),
  paragraph: z.number().int().positive().optional(),
  excerpt: z.string().optional(),
});

export type CaseSourceRef = z.infer<typeof CaseSourceRefSchema>;

export const CaseTransactionSchema = z.object({
  id: z.string(),
  documentId: z.string().optional(),
  date: z.string(), // YYYY-MM-DD
  amount: z.number(),
  currency: z.string().default("EUR"),
  fromEntityId: z.string(),
  toEntityId: z.string(),
  ibanSource: z.string().optional(),
  ibanTarget: z.string().optional(),
  method: z.enum(["transfer", "cash"]).default("transfer"),
  description: z.string().default(""),
  anomalies: z.array(z.string()).default([]),
  sourceRef: CaseSourceRefSchema.optional(),
});

export type CaseTransaction = z.infer<typeof CaseTransactionSchema>;

// ─── 5. GRAFOVÉ VZŤAHY (RELATIONSHIPS) ────────────────────────────
export const CaseRelationshipTypeSchema = z.enum([
  "statutory",
  "shareholder",
  "money_flow",
  "co_accused",
  "family",
  "common_event",
]);

export type CaseRelationshipType = z.infer<typeof CaseRelationshipTypeSchema>;

export const CaseRelationshipSchema = z.object({
  id: z.string(),
  fromEntityId: z.string(),
  toEntityId: z.string(),
  type: CaseRelationshipTypeSchema,
  label: z.string(),
  weight: z.number().default(1),
  sourceRef: z.string().optional(),
  validFrom: z.string().date().optional(),
  validTo: z.string().date().optional(),
});

export type CaseRelationship = z.infer<typeof CaseRelationshipSchema>;

// ─── 6. ČASOVÁ OS A UDALOSTI (TIMELINE) ───────────────────────────
export const CaseTimelineEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  title: z.string(),
  detail: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  paragraph: z.string().optional(),
  involvedEntityIds: z.array(z.string()).default([]),
  chainBreak: z.boolean().default(false),
  sourceRef: CaseSourceRefSchema.optional(),
});

export type CaseTimelineEvent = z.infer<typeof CaseTimelineEventSchema>;

// ─── 7. UNIFIKOVANÝ FORENSIC CASE (SINGLE SOURCE OF TRUTH) ─────────
export const CaseDossierSummarySchema = z.object({
  defendabilityIndex: z.number().min(0).max(100).default(50),
  overallRisk: z
    .enum(["KRITICKÉ", "VYSOKÉ", "STREDNÉ", "NÍZKE"])
    .default("STREDNÉ"),
  defenseAttacks: z
    .array(z.union([z.string(), z.record(z.string(), z.unknown())]))
    .default([]),
  judgeReadyText: z.unknown().optional(),
  investigativeAnswers: z.unknown().optional(),
});

export type CaseDossierSummary = z.infer<typeof CaseDossierSummarySchema>;

export const ForensicCaseUnifiedSchema = z.object({
  metadata: CaseMetadataSchema,
  documents: z.array(CaseDocumentSchema).default([]),
  entities: z.array(CaseEntitySchema).default([]),
  transactions: z.array(CaseTransactionSchema).default([]),
  relationships: z.array(CaseRelationshipSchema).default([]),
  timeline: z.array(CaseTimelineEventSchema).default([]),
  dossierSummary: CaseDossierSummarySchema.optional(),
});

export type ForensicCaseUnified = z.infer<typeof ForensicCaseUnifiedSchema>;
