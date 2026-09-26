import { describe, expect, it } from "vitest";
import { classifyDocument, dispatchCaseIngest } from "../case-dispatcher";

describe("case-dispatcher (Classification & Ingest Pipeline)", () => {
  describe("classifyDocument", () => {
    it("správne klasifikuje bankový výpis podľa názvu a obsahu", async () => {
      const typeByName = await classifyDocument("", "vypis_tatra_banka.csv");
      expect(typeByName).toBe("bank_statement");

      const typeByText = await classifyDocument(
        "Výpis z účtu SK2111000000002948210384 Dátum zaúčtovania: 2026-09-20 Konečný zostatok: 45 200,00 EUR",
        "export.txt",
      );
      expect(typeByText).toBe("bank_statement");
    });

    it("správne klasifikuje výpis z obchodného registra", async () => {
      const type = await classifyDocument(
        "Výpis z Obchodného registra Mestského súdu Bratislava III, Oddiel: Sro, Vložka číslo: 14283/B",
        "orsr.pdf",
      );
      expect(type).toBe("corporate_registry");
    });

    it("správne klasifikuje súdny / vyšetrovací spis", async () => {
      const type = await classifyDocument(
        "ČVS: PPZ-120/NKA-BA-2026. Uznesenie o vznesení obvinenia podľa § 206 Trestného poriadku voči obvinenému.",
        "uznesenie.pdf",
      );
      expect(type).toBe("court_dossier");
    });

    it("správne klasifikuje obchodnú zmluvu", async () => {
      const type = await classifyDocument(
        "Zmluva o dielo uzatvorená podľa § 536 Obchodného zákonníka. Objednávateľ a Zhotoviteľ sa dohodli...",
        "zmluva.docx",
      );
      expect(type).toBe("commercial_contract");
    });
  });

  describe("dispatchCaseIngest", () => {
    it("spracuje bankový výpis a vyextrahuje transakcie a prepojenia", async () => {
      const bankContent = `
        Dátum: 2026-09-15 Suma: 50 000 EUR IBAN: SK2111000000002948210384 Platba za poradenské služby
        Dátum: 2026-09-18 Suma: 10 000 EUR Výber hotovosti z bankomatu
      `;

      const result = await dispatchCaseIngest("case-test-1", [
        {
          name: "bankovy_vypis.txt",
          text: bankContent,
        },
      ]);

      expect(result.extractedDocuments).toHaveLength(1);
      expect(result.extractedDocuments[0]?.classification).toBe(
        "bank_statement",
      );
      expect(result.newTransactions.length).toBeGreaterThanOrEqual(1);
      expect(result.newEntities.length).toBeGreaterThanOrEqual(1);
      expect(result.newTransactions[0]?.amount).toBe(50000);
      expect(result.unifiedCase.metadata.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("spracuje vyšetrovací spis a extrahuje osoby, firmy a časovú os", async () => {
      const dossierContent = `
        ČVS: PPZ-99/UBOK-2026. Dňa 2026-09-10 vyšetrovateľ v Bratislave vykonal výsluch.
        Svedok Marek Plch uviedol skutočnosti k spoločnosti TATRAGEN s.r.o. (IČO: 44556677).
        Porušený bol § 199 Trestného zákona.
      `;

      const result = await dispatchCaseIngest("case-test-2", [
        {
          name: "vysetrovaci_spis.txt",
          text: dossierContent,
        },
      ]);

      expect(result.extractedDocuments).toHaveLength(1);
      expect(result.extractedDocuments[0]?.classification).toBe(
        "court_dossier",
      );
      expect(result.newEntities.some((e) => e.name === "Marek Plch")).toBe(
        true,
      );
      expect(result.newEntities.some((e) => e.name === "TATRAGEN s.r.o.")).toBe(
        true,
      );
      expect(result.unifiedCase.metadata.status).toBe("analyzed");
    });
  });
});
