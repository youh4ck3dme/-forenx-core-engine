import type { ForensicDossier } from "@/lib/types";

/** Fiktívny, malý spis bez osobných údajov a bez demo flagu. */
export function regressionDossier(): ForensicDossier {
  return {
    caseId: "regression-case",
    caseTitle: "Regresný test",
    defendabilityIndex: 50,
    generatedAt: "2026-01-01T00:00:00.000Z",
    facts: {
      timeline: [
        {
          time: "2026-01-01",
          event: "Platba 100 EUR",
          source: "fixture.txt:1",
          sourceRef: {
            documentId: "fixture.txt",
            page: 1,
            excerpt: "Platba 100 EUR",
          },
          chainBreak: false,
        },
      ],
      traces: [],
    },
    defenseAttack: {
      overallRisk: "STREDNÉ",
      attacks: [
        {
          id: "atk-1",
          defenseClaim: "Platba bola bežná.",
          risk: "NÍZKE",
          counterStrike: "Účel v texte spisu chýba.",
          evidenceGap: "Chýba doklad o protiplnení.",
          sourceRef: {
            documentId: "fixture.txt",
            page: 1,
            excerpt: "Referencia platby",
          },
        },
      ],
    },
    evidenceStrength: {
      traces: [
        {
          id: "tr-1",
          name: "Bankový záznam",
          lr: "—",
          strength: "Silná",
          light: "yellow",
          paragraph: "§ 119 TP",
          sourceRef: {
            documentId: "fixture.txt",
            page: 1,
            excerpt: "100 EUR",
          },
        },
      ],
      paragraphs: [],
    },
    judgeReadyText: {
      skutkovyStav: "Fiktívny skutok.",
      vyporiadanie: "Vyžaduje overenie.",
      vedecke: "Bez expertízy.",
    },
    analysisMeta: {
      promptVersion: "fixture-v1",
      model: "fixture-model",
      provider: "mock",
      createdAt: "2026-01-01T00:00:00.000Z",
      analysisStatus: "complete",
      documentIds: ["fixture.txt"],
      sourceReferences: ["fixture.txt:1"],
      idempotencyKey: "ap:fixture",
      truncation: {
        inputChars: 100,
        analyzedChars: 100,
        truncated: false,
        chunkCount: 1,
        chunkLimit: 25000,
        documentLimit: 80000,
      },
      chunks: [{ index: 1, total: 1, charCount: 100, status: "ok" }],
      heuristicModulesNote:
        "AI odhady z textu spisu — nie live ORSR, RPVS ani Dimitri API.",
    },
  };
}
