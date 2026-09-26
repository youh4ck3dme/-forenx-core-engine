import { describe, expect, it } from "vitest";
import {
  CaseMetadataSchema,
  CaseDocumentSchema,
  CaseEntitySchema,
  CaseTransactionSchema,
  CaseRelationshipSchema,
  CaseTimelineEventSchema,
  CaseDossierSummarySchema,
  ForensicCaseUnifiedSchema,
} from "@/types/forensic-case";

describe("forensic-case-schema-regression (Zod Schemas & Validation)", () => {
  describe("CaseMetadataSchema", () => {
    it("akceptuje platné metadáta s predvolenými a voliteľnými poliami", () => {
      const valid = CaseMetadataSchema.parse({
        id: "case-reg-001",
        userId: "user-42",
        name: "Vyšetrovanie fiktívnych faktúr",
        subtitle: "Spis č. PPZ-44/2026",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        sha256Hash:
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        status: "analyzed",
        tags: ["DPH", "karusel", "high-priority"],
        isDemo: false,
      });

      expect(valid.id).toBe("case-reg-001");
      expect(valid.status).toBe("analyzed");
      expect(valid.tags).toEqual(["DPH", "karusel", "high-priority"]);
      expect(valid.createdAt).toBeDefined();
      expect(valid.updatedAt).toBeDefined();
    });

    it("odmietne neplatný SHA-256 hash (nesprávna dĺžka alebo znaky)", () => {
      expect(() =>
        CaseMetadataSchema.parse({
          id: "case-reg-002",
          name: "Test invalid hash",
          sha256Hash: "invalid-hash-short",
        }),
      ).toThrow();

      expect(() =>
        CaseMetadataSchema.parse({
          id: "case-reg-003",
          name: "Test invalid chars",
          sha256Hash: "Z".repeat(64), // Nie je hex
        }),
      ).toThrow();
    });

    it("odmietne neplatný status", () => {
      expect(() =>
        CaseMetadataSchema.parse({
          id: "case-reg-004",
          name: "Invalid status test",
          sha256Hash: "a".repeat(64),
          status: "unknown_invalid_status" as any,
        }),
      ).toThrow();
    });
  });

  describe("CaseDocumentSchema", () => {
    it("validuje všetky povolené klasifikácie dokumentov a OCR stavy", () => {
      const classifications = [
        "bank_statement",
        "corporate_registry",
        "court_dossier",
        "commercial_contract",
        "cross_border_report",
        "unknown",
      ] as const;

      for (const classification of classifications) {
        const doc = CaseDocumentSchema.parse({
          id: `doc-${classification}`,
          name: `${classification}.pdf`,
          size: 1024,
          mimeType: "application/pdf",
          sha256: "b".repeat(64),
          classification,
          ocrStatus: "completed",
          usedOcr: true,
          pageCount: 3,
          rawTextPreview: "Ukážka textu dokumentu...",
        });
        expect(doc.classification).toBe(classification);
        expect(doc.ocrStatus).toBe("completed");
      }
    });

    it("odmietne zápornú veľkosť súboru alebo počet strán", () => {
      expect(() =>
        CaseDocumentSchema.parse({
          id: "doc-neg-size",
          name: "subor.pdf",
          size: -100,
          mimeType: "application/pdf",
          sha256: "c".repeat(64),
          classification: "unknown",
          ocrStatus: "none",
          usedOcr: false,
        }),
      ).toThrow();

      expect(() =>
        CaseDocumentSchema.parse({
          id: "doc-neg-pages",
          name: "subor.pdf",
          size: 500,
          pageCount: -1,
          mimeType: "application/pdf",
          sha256: "c".repeat(64),
          classification: "unknown",
          ocrStatus: "none",
          usedOcr: false,
        }),
      ).toThrow();
    });
  });

  describe("CaseEntitySchema", () => {
    it("validuje fyzickú aj právnickú osobu s IČO a WhoIsWho intelligence", () => {
      const company = CaseEntitySchema.parse({
        id: "ent-company-1",
        name: "SLOVAK FORENSIC LAB s.r.o.",
        kind: "company",
        role: "dodávateľ",
        ico: "50123456",
        country: "SK",
        address: "Karpatská 15, 811 05 Bratislava",
        position: { x: 250, y: 350 },
        intelligence: {
          verified: true,
          source: "whoiswho_sk",
          riskScore: 35,
          isShellCompany: false,
          taxDebtor: false,
          inBankruptcy: false,
          inRestructuring: false,
          lastCheckedAt: "2026-09-26T10:00:00Z",
        },
      });

      expect(company.kind).toBe("company");
      expect(company.ico).toBe("50123456");
      expect(company.intelligence?.verified).toBe(true);
      expect(company.intelligence?.riskScore).toBe(35);
    });

    it("odmietne neplatný rozsah risk skóre (menej ako 0 alebo viac ako 100)", () => {
      expect(() =>
        CaseEntitySchema.parse({
          id: "ent-invalid-score-neg",
          name: "Subjekt Negatívny",
          kind: "company",
          role: "spoločnosť",
          country: "SK",
          intelligence: {
            verified: false,
            source: "manual",
            riskScore: -5,
            isShellCompany: false,
            taxDebtor: false,
            inBankruptcy: false,
            inRestructuring: false,
          },
        }),
      ).toThrow();

      expect(() =>
        CaseEntitySchema.parse({
          id: "ent-invalid-score-high",
          name: "Subjekt Príliš vysoký",
          kind: "company",
          role: "spoločnosť",
          country: "SK",
          intelligence: {
            verified: false,
            source: "manual",
            riskScore: 105,
            isShellCompany: false,
            taxDebtor: false,
            inBankruptcy: false,
            inRestructuring: false,
          },
        }),
      ).toThrow();
    });
  });

  describe("CaseTransactionSchema", () => {
    it("validuje bankový prevod aj hotovostnú transakciu", () => {
      const tx = CaseTransactionSchema.parse({
        id: "tx-reg-1",
        documentId: "doc-1",
        date: "2026-09-20",
        amount: 125000.5,
        currency: "EUR",
        fromEntityId: "ent-payer",
        toEntityId: "ent-receiver",
        ibanSource: "SK2111000000002948210384",
        ibanTarget: "SK3112000000001928374650",
        method: "transfer",
        description: "Úhrada konzultačných služieb",
        anomalies: ["large_volume", "round_sum"],
        sourceRef: {
          documentId: "doc-1",
          page: 2,
          excerpt: "Platba 125 000,50 EUR dňa 20.09.2026",
        },
      });

      expect(tx.amount).toBe(125000.5);
      expect(tx.method).toBe("transfer");
      expect(tx.anomalies).toContain("large_volume");
      expect(tx.sourceRef?.page).toBe(2);
    });
  });

  describe("CaseRelationshipSchema", () => {
    it("validuje vzťahy rôznych typov a ich váhy", () => {
      const types = [
        "statutory",
        "shareholder",
        "money_flow",
        "co_accused",
        "family",
        "common_event",
      ] as const;

      for (const type of types) {
        const rel = CaseRelationshipSchema.parse({
          id: `rel-${type}`,
          fromEntityId: "ent-1",
          toEntityId: "ent-2",
          type,
          label: `Vzťah: ${type}`,
          weight: 3,
        });
        expect(rel.type).toBe(type);
        expect(rel.weight).toBe(3);
      }
    });
  });

  describe("CaseTimelineEventSchema", () => {
    it("validuje udalosť na časovej osi so závažnosťou a právnym odsekom", () => {
      const event = CaseTimelineEventSchema.parse({
        id: "ev-reg-01",
        timestamp: "2026-09-22T14:30:00Z",
        title: "Výsluch svedka",
        detail: "Svedok uviedol informácie k prevodom na účet v zahraničí",
        severity: "critical",
        paragraph: "§ 206 Trestného poriadku",
        involvedEntityIds: ["ent-1", "ent-2"],
        chainBreak: true,
      });

      expect(event.severity).toBe("critical");
      expect(event.chainBreak).toBe(true);
      expect(event.involvedEntityIds).toHaveLength(2);
    });
  });

  describe("CaseDossierSummarySchema", () => {
    it("validuje sumár spisu a index obhájiteľnosti", () => {
      const summary = CaseDossierSummarySchema.parse({
        defendabilityIndex: 78,
        overallRisk: "NÍZKE",
        defenseAttacks: ["Spochybnenie zákonnosti príkazu na prehliadku"],
        judgeReadyText: "Na základe vykonaného dokazovania...",
        investigativeAnswers: [
          {
            question: "Kto bol konečným užívateľom výhod?",
            answer: "Ing. Peter Horváth",
            confidence: "high",
          },
        ],
      });

      expect(summary.defendabilityIndex).toBe(78);
      expect(summary.defenseAttacks).toHaveLength(1);
      expect(
        Array.isArray(summary.investigativeAnswers)
          ? summary.investigativeAnswers[0]
          : undefined,
      ).toMatchObject({ confidence: "high" });
    });
  });

  describe("ForensicCaseUnifiedSchema", () => {
    it("validuje kompletný unifikovaný prípad so všetkými prepojenými modulmi", () => {
      const fullCase = ForensicCaseUnifiedSchema.parse({
        metadata: {
          id: "case-complete-001",
          name: "Vyšetrovanie podvodu",
          sha256Hash: "d".repeat(64),
          status: "analyzed",
        },
        documents: [
          {
            id: "doc-1",
            name: "vypis.pdf",
            size: 2048,
            mimeType: "application/pdf",
            sha256: "e".repeat(64),
            classification: "bank_statement",
            ocrStatus: "completed",
            usedOcr: false,
          },
        ],
        entities: [
          {
            id: "ent-1",
            name: "Firma A s.r.o.",
            kind: "company",
            role: "odosielateľ",
            country: "SK",
            position: { x: 100, y: 100 },
          },
        ],
        transactions: [
          {
            id: "tx-1",
            date: "2026-09-25",
            amount: 25000,
            currency: "EUR",
            fromEntityId: "ent-1",
            toEntityId: "ent-2",
            method: "transfer",
            description: "Platba",
          },
        ],
        relationships: [
          {
            id: "rel-1",
            fromEntityId: "ent-1",
            toEntityId: "ent-2",
            type: "money_flow",
            label: "25 000 EUR",
          },
        ],
        timeline: [
          {
            id: "ev-1",
            timestamp: "2026-09-25",
            title: "Prevod peňazí",
            detail: "25 000 EUR",
            severity: "medium",
          },
        ],
        dossierSummary: {
          defendabilityIndex: 65,
          overallRisk: "STREDNÉ",
          defenseAttacks: [],
        },
      });

      expect(fullCase.metadata.id).toBe("case-complete-001");
      expect(fullCase.documents).toHaveLength(1);
      expect(fullCase.entities).toHaveLength(1);
      expect(fullCase.transactions).toHaveLength(1);
      expect(fullCase.relationships).toHaveLength(1);
      expect(fullCase.timeline).toHaveLength(1);
      expect(fullCase.dossierSummary?.defendabilityIndex).toBe(65);
    });
  });
});
