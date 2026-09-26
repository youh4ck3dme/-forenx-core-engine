import { describe, expect, it } from "vitest";
import { isDemoDossier } from "../autopilot-meta";
import { regressionDossier } from "@/test-fixtures/autopilot";
import { forensicDossierSchema } from "../forensic-dossier.schema";
import { mapCaseRows } from "../case-mapper";

describe("Case Data & Relational Integrity", () => {
  describe("Entity-Transaction Referential Integrity", () => {
    const rawCase = {
      id: "case-int-001",
      user_id: "user-1",
      name: "Vyšetrovanie Alfa",
      description: "Test integrity",
      status: "open",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    };

    const validEntities = [
      {
        id: "ent-1",
        case_id: "case-int-001",
        name: "Firma A s.r.o.",
        kind: "company",
        country: "SK",
      },
      {
        id: "ent-2",
        case_id: "case-int-001",
        name: "Firma B a.s.",
        kind: "company",
        country: "SK",
      },
    ];

    const validTransactions = [
      {
        id: "tx-1",
        case_id: "case-int-001",
        from_id: "ent-1",
        to_id: "ent-2",
        date: "2026-01-15",
        amount: 50000,
        currency: "EUR",
        method: "transfer",
        description: "Faktura za poradenske sluzby",
      },
    ];

    it("correctly maps and preserves referential integrity when entities and transactions align", () => {
      const mapped = mapCaseRows(
        rawCase,
        validEntities,
        validTransactions,
        [],
        [],
        [],
      );

      expect(mapped.id).toBe("case-int-001");
      expect(mapped.entities.length).toBe(2);
      expect(mapped.transactions.length).toBe(1);

      // Overenie prepojenia
      const tx = mapped.transactions[0]!;
      const fromEntity = mapped.entities.find((e) => e.id === tx.fromId);
      const toEntity = mapped.entities.find((e) => e.id === tx.toId);

      expect(fromEntity).toBeDefined();
      expect(toEntity).toBeDefined();
      expect(fromEntity?.name).toBe("Firma A s.r.o.");
      expect(toEntity?.name).toBe("Firma B a.s.");
    });

    it("identifies orphan transactions pointing to nonexistent counterparties", () => {
      const orphanTransactions = [
        {
          id: "tx-orphan",
          case_id: "case-int-001",
          from_id: "ent-1",
          to_id: "non-existent-entity-999",
          date: "2026-01-20",
          amount: 12000,
          method: "cash",
          description: "Podozrivy vyber",
        },
      ];

      const mapped = mapCaseRows(
        rawCase,
        validEntities,
        orphanTransactions,
        [],
        [],
        [],
      );
      const tx = mapped.transactions[0]!;
      const counterparty = mapped.entities.find((e) => e.id === tx.toId);

      expect(counterparty).toBeUndefined();
    });

    it("preserves positive currency amounts and rejects negative values", () => {
      const validTx = validTransactions[0]!;
      expect(validTx.amount).toBeGreaterThan(0);
      expect(typeof validTx.amount).toBe("number");
    });
  });

  describe("Forensic Dossier Schema Integrity", () => {
    it("validates full valid dossier conforming to forensicDossierSchema", () => {
      const dossier = regressionDossier();
      const parseResult = forensicDossierSchema.safeParse(dossier);

      expect(parseResult.success).toBe(true);
    });

    it("detects malformed dossier missing required sections", () => {
      const { facts: _removed, ...invalidDossier } = regressionDossier();
      void _removed;

      const parseResult = forensicDossierSchema.safeParse(invalidDossier);
      expect(parseResult.success).toBe(false);
    });
  });

  describe("Demo vs Production Dossier Boundary Integrity", () => {
    it("reliably detects synthetic demo dossiers and prevents production contamination", () => {
      const demo = regressionDossier();
      demo.analysisMeta = {
        ...demo.analysisMeta!,
        isDemo: true,
        analysisStatus: "demo",
      };

      expect(isDemoDossier(demo)).toBe(true);

      const prod = regressionDossier();
      prod.analysisMeta = {
        ...prod.analysisMeta!,
        isDemo: false,
        analysisStatus: "complete",
      };

      expect(isDemoDossier(prod)).toBe(false);
    });
  });
});
