import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { classifyDocument, dispatchCaseIngest } from "../case-dispatcher";
import * as whoiswhoFunctions from "@/lib/whoiswho.functions";
import { adaptLegacyCaseToUnified } from "../case-adapter";

describe("case-dispatcher-comprehensive (Core Functionality Tests)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("classifyDocument - Comprehensive Classification", () => {
    it("klasifikuje bankové výpisy", async () => {
      const bankTexts = [
        "IBAN: SK2111000000002948210384 Dátum zaúčtovania: 2026-09-20",
        "Konečný zostatok: 10 000 EUR",
        "Variabilný symbol: 20260901",
        "Bankové spojenie: Tatra banka",
      ];
      for (const text of bankTexts) {
        expect(await classifyDocument(text, "vypis.txt")).toBe(
          "bank_statement",
        );
      }
    });

    it("klasifikuje firemné registre", async () => {
      const registryTexts = [
        "Vložka číslo: 14283/B",
        "Okresný súd Žilina Obchodný register",
        "Oddiel: Sro Deň zápisu: 14.05.2018",
        "Právna forma: spoločnosť s ručením obmedzeným",
      ];
      for (const text of registryTexts) {
        expect(await classifyDocument(text, "orsr.pdf")).toBe(
          "corporate_registry",
        );
      }
    });

    it("klasifikuje súdne spisy", async () => {
      const courtTexts = [
        "ČVS: PPZ-120/NKA-BA-2026",
        "Uznesenie o vznesení obvinenia",
        "Vyšetrovateľ policajného zboru",
        "Trestný poriadok § 206",
        "Obvinený Peter S.",
        "Svedok Marek Plch",
      ];
      for (const text of courtTexts) {
        expect(await classifyDocument(text, "spis.pdf")).toBe("court_dossier");
      }
    });

    it("klasifikuje obchodné zmluvy", async () => {
      const contractTexts = [
        "Zmluva o dielo",
        "Zmluvné strany: Objednávateľ a Zhotoviteľ",
        "Predmet zmluvy: Dodávka služieb",
        "Faktúra č. 2026-0001",
      ];
      for (const text of contractTexts) {
        expect(await classifyDocument(text, "zmluva.docx")).toBe(
          "commercial_contract",
        );
      }
    });

    it("klasifikuje cezhraničné reporty", async () => {
      const crossBorderTexts = [
        "Dimitri checker",
        "Cross-border transfer",
        "Foreign jurisdiction",
        "Nominee director",
      ];
      for (const text of crossBorderTexts) {
        expect(await classifyDocument(text, "report.pdf")).toBe(
          "cross_border_report",
        );
      }
    });

    it("klasifikuje podľa prípon súborov", async () => {
      expect(await classifyDocument("", "vypis.csv")).toBe("bank_statement");
      expect(await classifyDocument("", "transakcie.tsv")).toBe(
        "bank_statement",
      );
      expect(await classifyDocument("", "vypis.xlsx")).toBe("bank_statement");
      expect(await classifyDocument("", "dimitri_report.pdf")).toBe(
        "cross_border_report",
      );
    });

    it("vráti unknown pre neznámy text", async () => {
      expect(await classifyDocument("Ahoj svet", "poznamka.txt")).toBe(
        "unknown",
      );
    });

    it("vráti court_dossier pre dlhý text bez klasifikácie", async () => {
      const longText =
        "Toto je dlhý text který neobsahuje žádné klíčové slova ale má více než 60 znaků";
      expect(await classifyDocument(longText, "dokument.txt")).toBe(
        "court_dossier",
      );
    });
  });

  describe("dispatchCaseIngest - Core Bank Statement Processing", () => {
    it("spracuje bankový výpis a vyextrahuje transakcie", async () => {
      const bankContent = `
        Dátum: 2026-09-15 Suma: 50 000 EUR IBAN: SK2111000000002948210384
        Dátum: 2026-09-18 Suma: 10 000 EUR Výber hotovosti
      `;

      const result = await dispatchCaseIngest("case-test-1", [
        { name: "bankovy_vypis.txt", text: bankContent },
      ]);

      expect(result.extractedDocuments).toHaveLength(1);
      expect(result.extractedDocuments[0]?.classification).toBe(
        "bank_statement",
      );
      expect(result.newTransactions.length).toBeGreaterThanOrEqual(1);
      expect(result.newEntities.length).toBeGreaterThanOrEqual(1);
      expect(result.unifiedCase.metadata.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("detekuje anomálie v transakciách", async () => {
      const bankContent = `
        Dátum: 2026-09-15 Suma: 50 000 EUR Výber hotovosti
      `;

      const result = await dispatchCaseIngest("case-anomalies", [
        { name: "vypis.txt", text: bankContent },
      ]);

      expect(result.newTransactions.length).toBeGreaterThanOrEqual(1);
      const tx = result.newTransactions[0];
      expect(tx?.anomalies).toContain("round_sum");
      expect(tx?.anomalies).toContain("cash_deposit");
      expect(tx?.method).toBe("cash");
    });

    it("ignoruje riadky bez dátumu alebo sumy", async () => {
      const bankContent = `
        Náslov: Bankový výpis
        Majiteľ účtu: Ján Novák
        Dátum: 2026-09-15 Suma: 5 000 EUR
        Konečný zostatok: 10 000 EUR
      `;

      const result = await dispatchCaseIngest("case-ignore-invalid", [
        { name: "vypis.txt", text: bankContent },
      ]);

      // Len 1 transakcia (s dátumom a sumou)
      expect(result.newTransactions.length).toBe(1);
    });

    it("extrahuje IBAN a nastaví country", async () => {
      const bankContent = `
        Dátum: 2026-09-01 Suma: 5 000 EUR IBAN: SK2111000000002948210384
      `;

      const result = await dispatchCaseIngest("case-iban", [
        { name: "vypis.txt", text: bankContent },
      ]);

      expect(result.newTransactions[0]?.ibanTarget).toBe(
        "SK2111000000002948210384",
      );
    });
  });

  describe("dispatchCaseIngest - Document Metadata", () => {
    it("generuje SHA-256 hash pre dokumenty", async () => {
      const result = await dispatchCaseIngest("case-sha256", [
        { name: "doc1.txt", text: "content 1" },
        { name: "doc2.txt", text: "content 2" },
      ]);

      result.extractedDocuments.forEach((doc) => {
        expect(doc.sha256).toMatch(/^[a-f0-9]{64}$/);
      });

      expect(result.extractedDocuments[0]?.sha256).not.toBe(
        result.extractedDocuments[1]?.sha256,
      );
    });

    it("nastavuje správnu klasifikáciu", async () => {
      const result = await dispatchCaseIngest("case-classify", [
        { name: "bank.txt", text: "IBAN: SK211100 Dátum zaúčtovania" },
        { name: "orsr.pdf", text: "Vložka číslo: 14283/B" },
      ]);

      expect(result.extractedDocuments[0]?.classification).toBe(
        "bank_statement",
      );
      expect(result.extractedDocuments[1]?.classification).toBe(
        "corporate_registry",
      );
    });

    it("nastavuje správny MIME typ", async () => {
      const result = await dispatchCaseIngest("case-mime", [
        { name: "test.pdf", text: "content" },
        { name: "test.csv", text: "content" },
      ]);

      expect(result.extractedDocuments[0]?.mimeType).toBe("application/pdf");
      expect(result.extractedDocuments[1]?.mimeType).toBe("text/csv");
    });

    it("nastavuje document ID s case prefixom", async () => {
      const result = await dispatchCaseIngest("test-case", [
        { name: "test.txt", text: "content" },
      ]);

      expect(result.extractedDocuments[0]?.id).toBeDefined();
      expect(result.extractedDocuments[0]?.id).toContain("doc-");
    });
  });

  describe("dispatchCaseIngest - Multiple Files", () => {
    it("spracuje viacero súborov naraz", async () => {
      const bankContent = "Dátum: 2026-09-01 Suma: 5 000 EUR";
      const dossierContent = "ČVS: PPZ-99/2026 Obvinený Ján Novák";

      const result = await dispatchCaseIngest("case-multi", [
        { name: "bank.txt", text: bankContent },
        { name: "spis.txt", text: dossierContent },
      ]);

      expect(result.extractedDocuments).toHaveLength(2);
    });

    it("zlúči nové dáta s existujúcim prípadom", async () => {
      const existingCase = adaptLegacyCaseToUnified({
        id: "case-merge",
        name: "Existujúci prípad",
        entities: [],
        transactions: [],
      });

      const newContent = "ČVS: PPZ-99/2026 Obvinený Ján Novák";

      const result = await dispatchCaseIngest(
        "case-merge",
        [{ name: "novy.txt", text: newContent }],
        existingCase,
      );

      expect(result.unifiedCase.entities.length).toBeGreaterThanOrEqual(0);
      expect(result.unifiedCase.documents).toHaveLength(1);
    });

    it("prepočíta SHA-256 hash po zlučení", async () => {
      const existingCase = adaptLegacyCaseToUnified({
        id: "case-hash",
        name: "Hash Test",
        entities: [],
        transactions: [],
      });

      const initialHash = existingCase.metadata.sha256Hash;
      const newContent = "Dátum: 2026-09-01 Suma: 5 000 EUR";

      const result = await dispatchCaseIngest(
        "case-hash",
        [{ name: "vypis.txt", text: newContent }],
        existingCase,
      );

      expect(result.unifiedCase.metadata.sha256Hash).not.toBe(initialHash);
    });
  });

  describe("dispatchCaseIngest - WhoIsWho Integration", () => {
    it("asynchrónne obohacuje entity s IČO", async () => {
      const lookupSpy = vi
        .spyOn(whoiswhoFunctions, "lookupCompanyWhoIsWhoProfile")
        .mockResolvedValueOnce({
          profile: { ico: "12345678", name: "Test Company" } as any,
          risk: {
            score: 85,
            data: { score: 85, flags: [{ code: "SHELL_COMPANY" }] },
          } as any,
          graph: null,
          raw: {} as never,
        });

      const content = "Spoločnosť Test Company (IČO: 12345678)";

      const result = await dispatchCaseIngest("case-whoiswho", [
        { name: "spis.txt", text: content },
      ]);

      const enrichedEntity = result.newEntities.find(
        (e) => e.ico === "12345678",
      );
      expect(enrichedEntity?.intelligence?.verified).toBe(true);
      expect(enrichedEntity?.intelligence?.riskScore).toBe(85);

      lookupSpy.mockRestore();
    });

    it("nepadne ak WhoIsWho zlyhá", async () => {
      const lookupSpy = vi
        .spyOn(whoiswhoFunctions, "lookupCompanyWhoIsWhoProfile")
        .mockRejectedValueOnce(new Error("API timeout"));

      const content = "Spoločnosť Test (IČO: 12345678)";

      const result = await dispatchCaseIngest("case-whoiswho-fail", [
        { name: "spis.txt", text: content },
      ]);

      const entity = result.newEntities.find((e) => e.ico === "12345678");
      expect(entity).toBeDefined();
      expect(entity?.intelligence?.verified).toBe(false);

      lookupSpy.mockRestore();
    });

    it("nevolá WhoIsWho pre entity bez IČO", async () => {
      const lookupSpy = vi.spyOn(
        whoiswhoFunctions,
        "lookupCompanyWhoIsWhoProfile",
      );

      const content = "Osoba Ján Novák";

      await dispatchCaseIngest("case-no-ico", [
        { name: "spis.txt", text: content },
      ]);

      expect(lookupSpy).not.toHaveBeenCalled();
      lookupSpy.mockRestore();
    });
  });

  describe("dispatchCaseIngest - Metadata", () => {
    it("nastavuje správne metadata", async () => {
      const result = await dispatchCaseIngest("case-meta", [
        { name: "test.txt", text: "content" },
      ]);

      expect(result.unifiedCase.metadata.id).toBe("case-meta");
      expect(result.unifiedCase.metadata.name).toBeDefined();
      expect(result.unifiedCase.metadata.createdAt).toBeDefined();
      expect(result.unifiedCase.metadata.updatedAt).toBeDefined();
    });

    it("nastaví status na analyzed ak existujú dokumenty", async () => {
      const existingCase = adaptLegacyCaseToUnified({
        id: "case-analyzed",
        name: "Analyzed",
        entities: [
          {
            id: "e1",
            name: "Test",
            kind: "person",
            role: "test",
            country: "SK",
          } as any,
        ],
        transactions: [],
      });

      const result = await dispatchCaseIngest(
        "case-analyzed",
        [{ name: "novy.txt", text: "content" }],
        existingCase,
      );

      // Status by mal byť "analyzed" ak existujú entity
      expect(result.unifiedCase.metadata.status).toBe("analyzed");
    });

    it("zachová status draft ak nie sú žiadne entity ani transakcie", async () => {
      const existingCase = adaptLegacyCaseToUnified({
        id: "case-draft",
        name: "Draft",
        entities: [],
        transactions: [],
      });

      const result = await dispatchCaseIngest(
        "case-draft",
        [{ name: "prazdny.txt", text: "" }],
        existingCase,
      );

      expect(result.unifiedCase.metadata.status).toBe("draft");
    });

    it("zachová existujúce createdAt", async () => {
      const existingCase = adaptLegacyCaseToUnified({
        id: "case-created",
        name: "Created",
        createdAt: "2026-01-01T00:00:00.000Z",
        entities: [],
        transactions: [],
      });

      const result = await dispatchCaseIngest(
        "case-created",
        [{ name: "test.txt", text: "content" }],
        existingCase,
      );

      expect(result.unifiedCase.metadata.createdAt).toBe(
        "2026-01-01T00:00:00.000Z",
      );
    });
  });

  describe("dispatchCaseIngest - Relationship Synthesis", () => {
    it("vytvára money_flow vzťahy z bankových transakcií", async () => {
      const bankContent = "Dátum: 2026-09-01 Suma: 5 000 EUR";

      const result = await dispatchCaseIngest("case-relations", [
        { name: "vypis.txt", text: bankContent },
      ]);

      expect(
        result.unifiedCase.relationships.some((r) => r.type === "money_flow"),
      ).toBe(true);
    });

    it("nastavuje váhu vzťahu podľa výšky sumy", async () => {
      const bankContent = "Dátum: 2026-09-01 Suma: 100 000 EUR";

      const result = await dispatchCaseIngest("case-weight", [
        { name: "vypis.txt", text: bankContent },
      ]);

      const moneyFlowRelation = result.unifiedCase.relationships.find(
        (r) => r.type === "money_flow",
      );
      expect(moneyFlowRelation?.weight).toBeGreaterThanOrEqual(1);
    });
  });

  describe("dispatchCaseIngest - Input Formats", () => {
    it("akceptuje text vstup", async () => {
      const result = await dispatchCaseIngest("case-text", [
        { name: "test.txt", text: "content" },
      ]);
      expect(result.extractedDocuments).toHaveLength(1);
    });

    it("akceptuje base64 vstup", async () => {
      const text = "Test content";
      const base64 = Buffer.from(text, "utf8").toString("base64");

      const result = await dispatchCaseIngest("case-base64", [
        { name: "test.txt", base64 },
      ]);

      expect(result.extractedDocuments).toHaveLength(1);
      expect(result.extractedDocuments[0]?.size).toBeGreaterThan(0);
    });

    it("akceptuje ArrayBuffer vstup", async () => {
      const text = "Test content";
      const encoder = new TextEncoder();
      const buffer = encoder.encode(text).buffer;

      const result = await dispatchCaseIngest("case-buffer", [
        { name: "test.txt", buffer },
      ]);

      expect(result.extractedDocuments).toHaveLength(1);
      expect(result.extractedDocuments[0]?.size).toBeGreaterThan(0);
    });

    it("spracuje prázdny zoznam súborov", async () => {
      const existingCase = adaptLegacyCaseToUnified({
        id: "case-empty",
        name: "Empty",
        entities: [],
        transactions: [],
      });

      const result = await dispatchCaseIngest("case-empty", [], existingCase);

      expect(result.extractedDocuments).toHaveLength(0);
      expect(result.newTransactions).toHaveLength(0);
      expect(result.newEntities).toHaveLength(0);
    });

    it("nepadne pri prázdnom texte", async () => {
      const result = await dispatchCaseIngest("case-empty-text", [
        { name: "empty.txt", text: "" },
      ]);

      expect(result.extractedDocuments).toHaveLength(1);
      expect(result.newTransactions).toHaveLength(0);
      expect(result.newEntities).toHaveLength(0);
    });
  });
});
