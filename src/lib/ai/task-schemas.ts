/**
 * Zod schémy odpovedí AI kontrol.
 * Prázdne polia sú platné; kontrola nesmie vymýšľať transakcie, entity,
 * procesné vady ani hypotézy. Min. počet hypotéz sa vynucuje až pri
 * existujúcich dôkazoch (server guard + prompt), nie slepým .min(2).
 */
import { z } from "zod";

export const aiTaskSchemas = {
  explain_finding: z.object({
    explanation: z.string().max(8000).default(""),
    unverified: z.array(z.string().max(1000)).max(20).default([]),
    cited: z.array(z.string().max(100)).max(120).default([]),
  }),
  case_summary: z.object({
    summary: z.string().max(10000).default(""),
    unverified: z.array(z.string().max(1000)).max(20).default([]),
    cited: z.array(z.string().max(100)).max(120).default([]),
  }),
  normalize_descriptions: z.object({
    suggestions: z
      .array(
        z.object({
          transaction: z.string().max(100).default(""),
          normalized: z.string().max(500).default(""),
          counterparty: z.string().max(200).optional(),
          confidence: z.enum(["low", "medium", "high"]).default("low"),
        }),
      )
      .max(200)
      .default([]),
    unverified: z.array(z.string().max(1000)).max(20).default([]),
  }),
  alt_devil: z.object({
    hypotheses: z
      .array(
        z.object({
          id: z.string().max(50).default(""),
          title: z.string().max(300).default(""),
          scenario: z.string().max(8000).default(""),
          explainedEvidence: z.array(z.string().max(500)).max(50).default([]),
          requiredTracesIfTrue: z
            .array(z.string().max(500))
            .max(50)
            .default([]),
          rebuttalTest: z.string().max(4000).default(""),
        }),
      )
      .max(10)
      .default([]),
    unverified: z.array(z.string().max(1000)).max(20).default([]),
    cited: z.array(z.string().max(100)).max(120).default([]),
  }),
  admiss_audit: z.object({
    overallStatus: z
      .enum(["admissible", "at_risk", "inadmissible"])
      .default("admissible"),
    score: z.number().min(0).max(100).default(100),
    defects: z
      .array(
        z.object({
          severity: z.enum(["critical", "curable", "formal"]).default("formal"),
          paragraph: z.string().max(200).default(""),
          description: z.string().max(4000).default(""),
          remedyAction: z.string().max(4000).default(""),
        }),
      )
      .default([]),
    courtReadySummary: z.string().max(8000).default(""),
    unverified: z.array(z.string().max(1000)).max(20).default([]),
    cited: z.array(z.string().max(100)).max(120).default([]),
  }),
} as const;
