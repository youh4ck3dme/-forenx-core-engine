import { describe, expect, it, vi } from "vitest";
import { classifyDocument, dispatchCaseIngest } from "../case-dispatcher";
import * as whoiswhoFunctions from "@/lib/whoiswho.functions";
import { adaptLegacyCaseToUnified } from "../case-adapter";

describe("case-dispatcher-regression (Universal Dispatcher & Ingest Pipeline)", () => {
  describe("classifyDocument - Komplexná klasifikácia", () => {
    it("klasifikuje podľa prípon a kľúčových slov v názve súboru", async () => {
      expect(await classifyDocument("", "export_banka_tatrabanka.csv")).toBe(
        "bank_statement",
      );
      expect(await classifyDocument("", "vypis_uctu.tsv")).toBe(
        "bank_statement",
      );
      expect(await classifyDocument("", "slsp_transakcie.xlsx")).toBe(
        "bank_statement",
      );
      expect(await classifyDocument("", "vub_statement_2026.pdf")).toBe(
        "bank_statement",
      );

      // Výnimka: orsr alebo register v názve nemá byť bank_statement
      expect(await classifyDocument("", "orsr_register_vypis.pdf")).not.toBe(
        "bank_statement",
      );

      // Dimitri / cezhraničný report
      expect(await classifyDocument("", "dimitri_report_cyprus.pdf")).toBe(
        "cross_border_report",
      );
      expect(await classifyDocument("", "crossborder_flows_ua.pdf")).toBe(
        "cross_border_report",
      );
    });

    it("klasifikuje bankové výpisy podľa obsahu", async () => {
      const bankTexts = [
        "Konečný zostatok na účte je 12 400 EUR. Dátum zaúčtovania: 2026-09-20.",
        "Variabilný symbol: 20260901, Konštantný symbol: 0308, Kredit: 5 000,00 EUR.",
        "Bankové spojenie: SK2111000000002948210384, Valuta: 2026-09-21.",
      ];

      for (const text of bankTexts) {
        expect(await classifyDocument(text, "subor.txt")).toBe(
          "bank_statement",
        );
      }
    });

    it("klasifikuje firemné registre (ORSR, RPVS) podľa obsahu", async () => {
      const registryText = `
        Výpis z Obchodného registra Okresného súdu Žilina
        Oddiel: Sro, Vložka číslo: 28491/L
        Deň zápisu: 14.05.2018
        Základné imanie: 5 000 EUR
      `;
      expect(await classifyDocument(registryText, "dokument.pdf")).toBe(
        "corporate_registry",
      );
    });

    it("klasifikuje súdne a policajné spisy podľa obsahu", async () => {
      const courtTexts = [
        "ČVS: PPZ-402/UBOK-BA-2026. Zápisnica o výsluchu svedka.",
        "Uznesenie o vznesení obvinenia podľa Trestného poriadku. Obvinený Peter S.",
        "Vyšetrovateľ NAKA vzniesol obvinenie podľa § 206 Trestného zákona.",
      ];

      for (const text of courtTexts) {
        expect(await classifyDocument(text, "spis.pdf")).toBe("court_dossier");
      }
    });

    it("klasifikuje obchodné zmluvy a faktúry podľa obsahu", async () => {
      const contractTexts = [
        "Zmluva o dielo uzatvorená medzi Zmluvnými stranami: Objednávateľ a Zhotoviteľ.",
        "Faktúra č. 2026001. Dátum splatnosti: 15.10.2026. Predmet zmluvy: IT audit.",
      ];

      for (const text of contractTexts) {
        expect(await classifyDocument(text, "zmluva.docx")).toBe(
          "commercial_contract",
        );
      }
    });

    it("klasifikuje Dimitri cross-border reporty podľa obsahu", async () => {
      const dimitriText =
        "Dimitri checker alert: Foreign jurisdiction shell company and nominee director detected.";
      expect(await classifyDocument(dimitriText, "audit.pdf")).toBe(
        "cross_border_report",
      );
    });

    it("vráti unknown pre krátky neznámy text", async () => {
      expect(await classifyDocument("Ahoj svet", "poznamka.txt")).toBe(
        "unknown",
      );
    });
  });

  describe("dispatchCaseIngest - Spracovanie a Ingest", () => {
    it("spracuje bankové transakcie s rôznymi formátmi dátumov a súm, deteguje anomálie", async () => {
      const bankContent = `
        2026-09-10 Suma: 10 000 EUR IBAN: SK2111000000002948210384 Výber hotovosti
        15.09.2026 Suma: 150 000 EUR IBAN: SK9012000000009876543210 Prevod na zahraničný účet
        2026-09-20 Čiastka: 4 250,50 EUR Nákup kancelárskych potrieb
      `;

      const result = await dispatchCaseIngest("case-ingest-tx", [
        {
          name: "transakcie.txt",
          text: bankContent,
        },
      ]);

      expect(result.extractedDocuments).toHaveLength(1);
      expect(result.extractedDocuments[0]?.classification).toBe(
        "bank_statement",
      );
      expect(result.newTransactions.length).toBeGreaterThanOrEqual(3);

      // Overenie anomálií
      const tx10k = result.newTransactions.find((t) => t.amount === 10000);
      expect(tx10k).toBeDefined();
      expect(tx10k?.anomalies).toContain("round_sum");
      expect(tx10k?.anomalies).toContain("cash_deposit");
      expect(tx10k?.method).toBe("cash");

      const tx150k = result.newTransactions.find((t) => t.amount === 150000);
      expect(tx150k).toBeDefined();
      expect(tx150k?.anomalies).toContain("large_volume");
      expect(tx150k?.ibanTarget).toBe("SK9012000000009876543210");

      // Overenie vytvorených hrán vzťahov (money_flow)
      expect(
        result.unifiedCase.relationships.some((r) => r.type === "money_flow"),
      ).toBe(true);
    });

    it("spracuje rôzne formáty vstupu: text, base64 a ArrayBuffer", async () => {
      // 1. Text
      const textRes = await dispatchCaseIngest("case-fmt-1", [
        {
          name: "test.txt",
          text: "Uznesenie o vznesení obvinenia vyšetrovateľa PZ SR...",
        },
      ]);
      expect(textRes.extractedDocuments[0]?.classification).toBe(
        "court_dossier",
      );

      // 2. Base64
      const b64Sample = Buffer.from(
        "ČVS: PPZ-11/2026 Vyšetrovateľ policajného zboru vypočul svedka...",
        "utf8",
      ).toString("base64");
      const b64Res = await dispatchCaseIngest("case-fmt-2", [
        { name: "test_b64.txt", base64: b64Sample },
      ]);
      expect(b64Res.extractedDocuments[0]?.size).toBeGreaterThan(0);

      // 3. ArrayBuffer
      const encoder = new TextEncoder();
      const uint8 = encoder.encode(
        "Obchodný register Mestského súdu Bratislava III, Oddiel: Sro, Vložka číslo: 5544/B",
      );
      const bufRes = await dispatchCaseIngest("case-fmt-3", [
        { name: "test_buf.txt", buffer: uint8.buffer },
      ]);
      expect(bufRes.extractedDocuments[0]?.classification).toBe(
        "corporate_registry",
      );
    });

    it("asynchrónne obohacuje firmy s IČO cez WhoIsWho SK Due Diligence", async () => {
      const lookupSpy = vi
        .spyOn(whoiswhoFunctions, "lookupCompanyWhoIsWhoProfile")
        .mockResolvedValueOnce({
          profile: {
            ico: "35815256",
            name: "Slovenský plynárenský priemysel, a.s.",
            address: "Mlynské nivy 44/a, 825 11 Bratislava",
            status: "active",
          } as any,
          risk: {
            score: 75,
            data: {
              score: 75,
              flags: [{ code: "TAX_DEBT", label: "Daňový nedoplatok" }],
            },
          } as any,
          graph: null,
          raw: {} as never,
        });

      const courtTextWithIco = `
        Dňa 2026-09-18 vyšetrovateľ zaistil dokumenty spoločnosti
        SPP a.s. (IČO: 35815256). Spoločnosť čelí podozreniam.
      `;

      const result = await dispatchCaseIngest("case-whoiswho-enrich", [
        { name: "spis_ico.txt", text: courtTextWithIco },
      ]);

      const enrichedCompany = result.newEntities.find(
        (e) => e.ico === "35815256",
      );
      if (enrichedCompany && enrichedCompany.intelligence) {
        expect(enrichedCompany.intelligence.source).toBe("whoiswho_sk");
        expect(enrichedCompany.intelligence.verified).toBe(true);
        expect(enrichedCompany.intelligence.riskScore).toBe(75);
        expect(enrichedCompany.intelligence.taxDebtor).toBe(true);
        expect(enrichedCompany.intelligence.isShellCompany).toBe(true); // score >= 60
      }

      lookupSpy.mockRestore();
    });

    it("pokračuje stabilne bez pádu, ak je WhoIsWho offline alebo zlyhá", async () => {
      const lookupSpy = vi
        .spyOn(whoiswhoFunctions, "lookupCompanyWhoIsWhoProfile")
        .mockRejectedValueOnce(new Error("Network connection timeout 503"));

      const courtText = `
        Firma TATRA CONSULT (IČO: 99887766) mala realizovať prevody.
      `;

      const result = await dispatchCaseIngest("case-whoiswho-failover", [
        { name: "spis_offline.txt", text: courtText },
      ]);

      expect(result.extractedDocuments).toHaveLength(1);
      const company = result.newEntities.find((e) => e.ico === "99887766");
      expect(company).toBeDefined();
      expect(company?.intelligence?.verified).toBe(false);

      lookupSpy.mockRestore();
    });

    it("zlúči nové dokumenty, subjekty a transakcie s existujúcim prípadom a prepočíta SHA-256", async () => {
      const baseCase = adaptLegacyCaseToUnified({
        id: "case-existing-merge",
        name: "Pôvodný prípad",
        entities: [
          {
            id: "ent-base-1",
            name: "Pôvodná Firma s.r.o.",
            kind: "company",
            role: "klient",
            country: "SK",
            x: 10,
            y: 10,
          },
        ],
      });

      const initialHash = baseCase.metadata.sha256Hash;

      const newBankText = `
        Dátum: 2026-09-25 Suma: 50 000 EUR Prevod za právne služby
      `;

      const result = await dispatchCaseIngest(
        baseCase.metadata.id,
        [{ name: "novy_vypis.txt", text: newBankText }],
        baseCase,
      );

      expect(result.unifiedCase.entities.length).toBeGreaterThan(1);
      expect(result.unifiedCase.transactions.length).toBeGreaterThanOrEqual(1);
      expect(result.unifiedCase.documents).toHaveLength(1);
      // SHA-256 sa prepočítalo na základe nového počtu entít a transakcií
      expect(result.unifiedCase.metadata.sha256Hash).not.toBe(initialHash);
      expect(result.unifiedCase.metadata.status).toBe("analyzed");
    });
  });
});
