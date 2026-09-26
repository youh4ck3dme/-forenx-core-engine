import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  adaptLegacyCaseToUnified,
  adaptUnifiedToLegacyCase,
} from "@/lib/case-adapter";
import { NO_EVIDENCE_MESSAGE, validateCopilotAnswer } from "@/lib/case-copilot";
import { collectCourtEvidence, validSource } from "@/lib/court-evidence";
import {
  buildCourtDossierData,
  renderCourtDossierPdf,
} from "@/lib/export-court-dossier";
import { getGoldenDemoCase } from "@/lib/golden-demo-case";

const fontPath = fileURLToPath(
  new URL("../../../public/fonts/NotoSans-Regular.ttf", import.meta.url),
);

describe("ForenX E2E forensic acceptance flow", () => {
  it("loads a complete Golden Demo case with forensic signals and evidence", () => {
    const forensicCase = getGoldenDemoCase();

    expect(forensicCase.entities).toHaveLength(12);
    expect(forensicCase.transactions).toHaveLength(15);
    expect(forensicCase.timeline).toHaveLength(8);
    expect(forensicCase.dossierSummary).toMatchObject({
      defendabilityIndex: 28,
      overallRisk: "KRITICKÉ",
    });
    expect(forensicCase.dossierSummary?.judgeReadyText).toEqual(
      expect.any(String),
    );
    expect(
      forensicCase.transactions.some(
        (transaction) =>
          transaction.method === "cash" && transaction.amount === 50000,
      ),
    ).toBe(true);
    expect(
      forensicCase.transactions
        .filter((transaction) =>
          transaction.anomalies.includes("round-tripping"),
        )
        .map((transaction) => [
          transaction.fromEntityId,
          transaction.toEntityId,
        ]),
    ).toEqual(
      expect.arrayContaining([
        ["b", "c"],
        ["c", "a"],
      ]),
    );
  });

  it("keeps all five workspace views internally consistent", () => {
    const forensicCase = getGoldenDemoCase();
    const entityIds = new Set(forensicCase.entities.map((entity) => entity.id));

    for (const relationship of forensicCase.relationships) {
      expect(entityIds).toContain(relationship.fromEntityId);
      expect(entityIds).toContain(relationship.toEntityId);
    }
    for (const transaction of forensicCase.transactions) {
      expect(entityIds).toContain(transaction.fromEntityId);
      expect(entityIds).toContain(transaction.toEntityId);
      expect(validSource(transaction.sourceRef, forensicCase)).toBe(true);
      expect(transaction.sourceRef?.paragraph).toBeGreaterThan(0);
    }
    for (const event of forensicCase.timeline) {
      expect(event.involvedEntityIds.every((id) => entityIds.has(id))).toBe(
        true,
      );
      expect(validSource(event.sourceRef, forensicCase)).toBe(true);
      expect(event.sourceRef?.paragraph).toBeGreaterThan(0);
    }
  });

  it("renders a redacted court PDF and produces cryptographic report hashes", async () => {
    const forensicCase = getGoldenDemoCase();
    const report = buildCourtDossierData(forensicCase, {
      issuer: "ForenX Acceptance Audit",
      generatedAt: "2026-09-26T00:00:00.000Z",
    });
    const fontBase64 = (await readFile(fontPath)).toString("base64");
    const bytes = await renderCourtDossierPdf(report, fontBase64);

    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(report.caseHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.reportHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(report)).not.toContain(
      forensicCase.entities[0]?.name,
    );
  });

  it("rejects uncited Copilot claims and returns a precise evidence anchor", () => {
    const forensicCase = getGoldenDemoCase();
    const evidence = collectCourtEvidence(forensicCase);
    const first = evidence[0];
    expect(first).toBeDefined();

    expect(() =>
      validateCopilotAnswer(
        {
          statements: [{ text: "Nepodložený záver.", evidenceIds: ["E999"] }],
        },
        forensicCase,
        "acceptance-test",
      ),
    ).toThrow("neexistujúci dôkaz");
    expect(
      validateCopilotAnswer(
        { statements: [] },
        forensicCase,
        "acceptance-test",
      ),
    ).toMatchObject({ status: "insufficient_evidence" });
    expect(NO_EVIDENCE_MESSAGE).toContain("SourceRef");
    expect(first?.source).toMatchObject({
      documentId: forensicCase.documents[0]?.id,
      page: expect.any(Number),
      paragraph: expect.any(Number),
      excerpt: expect.any(String),
    });
  });

  it("round-trips the unified case through the legacy adapter without loss", () => {
    const source = getGoldenDemoCase();
    const restored = adaptLegacyCaseToUnified(adaptUnifiedToLegacyCase(source));

    expect(restored).toEqual(source);
    expect(restored.metadata.sha256Hash).toBe(source.metadata.sha256Hash);
    expect(
      restored.transactions.map((transaction) => transaction.amount),
    ).toEqual(source.transactions.map((transaction) => transaction.amount));
  });
});
