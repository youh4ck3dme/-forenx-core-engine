import { describe, expect, it } from "vitest";
import { buildCourtDossierData } from "@/lib/export-court-dossier";
import { canonicalJson } from "@/lib/court-evidence";
import { sha256Hex } from "@/lib/export-pdf";
import type { ForensicCaseUnified } from "@/types/forensic-case";

function fixture(): ForensicCaseUnified {
  return {
    metadata: {
      id: "11111111-2222-3333-4444-555555555555",
      userId: "user-1",
      name: "Kauza Anna Nováková",
      subtitle: "",
      referenceDate: "2026-09-26",
      baseCurrency: "EUR",
      sha256Hash: "a".repeat(64),
      status: "analyzed",
      tags: [],
      createdAt: "2026-09-26T00:00:00.000Z",
      updatedAt: "2026-09-26T00:00:00.000Z",
      isDemo: false,
    },
    documents: [
      {
        id: "doc-1",
        name: "vypoved-anna.pdf",
        size: 20,
        mimeType: "application/pdf",
        sha256: "b".repeat(64),
        classification: "court_dossier",
        ocrStatus: "completed",
        usedOcr: true,
        pageCount: 2,
        passages: [
          { page: 1, paragraph: 1, text: "Anna Nováková uviedla platbu." },
        ],
      },
    ],
    entities: [
      {
        id: "entity-1",
        name: "Anna Nováková",
        kind: "person",
        role: "svedkyňa",
        country: "SK",
        address: "Hlavná 1",
        position: { x: 1, y: 1 },
        intelligence: {
          verified: true,
          riskScore: 35,
          isShellCompany: false,
          taxDebtor: false,
          inBankruptcy: false,
          inRestructuring: false,
        },
      },
    ],
    transactions: [
      {
        id: "transaction-1",
        date: "2026-09-01",
        amount: 12_000,
        currency: "EUR",
        fromEntityId: "entity-1",
        toEntityId: "entity-1",
        method: "cash",
        description: "hotovostný vklad Anny Novákovej",
        anomalies: ["cash_deposit"],
        sourceRef: {
          documentId: "doc-1",
          page: 1,
          paragraph: 1,
          excerpt: "platbu",
        },
      },
    ],
    relationships: [],
    timeline: [
      {
        id: "event-1",
        timestamp: "2026-09-01",
        title: "Vklad",
        detail: "Anna Nováková vykonala vklad.",
        severity: "high",
        involvedEntityIds: ["entity-1"],
        chainBreak: false,
        sourceRef: {
          documentId: "doc-1",
          page: 1,
          paragraph: 1,
          excerpt: "platbu",
        },
      },
    ],
  };
}

describe("court dossier export", () => {
  it("builds source-file integrity and court sections", () => {
    const report = buildCourtDossierData(fixture(), { issuer: "Test" });
    expect(report.caseHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.documents).toEqual([
      expect.objectContaining({ sha256: "b".repeat(64), pages: 2 }),
    ]);
    expect(report.transactions[0]?.source).toContain("Strana 1");
    expect(report.timeline[0]?.source).toContain("Odsek 1");
  });

  it("hashes the canonical report payload", () => {
    const report = buildCourtDossierData(fixture(), { issuer: "Test" });
    const { reportHash, ...payload } = report;
    expect(reportHash).toBe(sha256Hex(canonicalJson(payload)));
  });

  it("redacts personal data before creating export data", () => {
    const report = buildCourtDossierData(fixture(), { issuer: "Test" });
    const rendered = JSON.stringify(report);
    expect(rendered).not.toContain("Anna Nováková");
    expect(rendered).not.toContain("Hlavná 1");
    expect(rendered).toContain("S1");
  });
});
