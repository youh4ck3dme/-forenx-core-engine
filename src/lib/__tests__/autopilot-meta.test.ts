import { describe, expect, it } from "vitest";
import {
  attachAnalysisMeta,
  buildAnalysisMeta,
  buildAutopilotIdempotencyKey,
  collectSourceReferences,
  isDemoDossier,
} from "@/lib/autopilot-meta";
import { ARMIVEX_CASE_DOSSIER } from "@/lib/demo-dossier";
import type { ForensicDossier } from "@/lib/types";

const base: ForensicDossier = {
  caseId: "case-1",
  caseTitle: "Test",
  defendabilityIndex: 50,
  generatedAt: "2026-01-01T00:00:00.000Z",
  facts: {
    timeline: [
      {
        time: "2025-01-01",
        event: "Udalosť",
        source: "Zápisnica č. 1",
        chainBreak: false,
      },
    ],
    traces: [],
  },
  defenseAttack: { overallRisk: "STREDNÉ", attacks: [] },
  evidenceStrength: { traces: [], paragraphs: [] },
  judgeReadyText: {
    skutkovyStav: "A",
    vyporiadanie: "B",
    vedecke: "C",
  },
};

describe("autopilot-meta", () => {
  it("vytvára stabilný idempotency key", async () => {
    const a = await buildAutopilotIdempotencyKey({
      caseId: "c1",
      documentText: "hello world",
    });
    const b = await buildAutopilotIdempotencyKey({
      caseId: "c1",
      documentText: "hello world",
    });
    const c = await buildAutopilotIdempotencyKey({
      caseId: "c1",
      documentText: "hello world!",
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith("ap:")).toBe(true);
  });

  it("zbiera sourceReferences a označí truncáciu", () => {
    const meta = buildAnalysisMeta({
      caseId: "c1",
      documentIds: ["a.pdf"],
      inputChars: 100_000,
      analyzedChars: 80_000,
      chunkCount: 4,
      chunks: [],
      model: "test-model",
      idempotencyKey: "ap:x",
      analysisStatus: "complete",
      sourceReferences: collectSourceReferences(base),
    });
    expect(meta.truncation.truncated).toBe(true);
    expect(meta.sourceReferences).toContain("Zápisnica č. 1");
    expect(meta.documentIds).toEqual(["a.pdf"]);
    const attached = attachAnalysisMeta(base, meta);
    expect(attached.analysisMeta?.model).toBe("test-model");
  });

  it("rozpozná demo dossier", () => {
    expect(isDemoDossier(ARMIVEX_CASE_DOSSIER)).toBe(true);
    expect(isDemoDossier(base)).toBe(false);
    expect(
      isDemoDossier({
        ...base,
        caseId: "PPZ-51/UBOK-PZ-ST-2025",
        caseTitle: "Kauza Armivex",
      }),
    ).toBe(false);
  });
});
