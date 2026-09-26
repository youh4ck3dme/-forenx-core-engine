import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import {
  handleParseUploadedCaseDocument,
  parseUploadedCaseDocument,
  extractCaseEntities,
} from "@/lib/ai.functions";

describe("Extrakcia a parsovanie spisu: parseUploadedCaseDocument", () => {
  const realEvidencePath = path.resolve(
    process.cwd(),
    "quarantine/docs-forenz/DOKAZ_07_Vysluch_Erik_Babcan_12-13.08.2026.md",
  );

  it("správne načíta a extrahuje entity z reálneho vyšetrovacieho spisu Erika Babčana", async () => {
    expect(fs.existsSync(realEvidencePath)).toBe(true);
    const content = fs.readFileSync(realEvidencePath, "utf-8");

    const result = await handleParseUploadedCaseDocument(
      "DOKAZ_07_Vysluch_Erik_Babcan_12-13.08.2026.md",
      undefined,
      content,
    );

    expect(result.success).toBe(true);
    expect(result.fileName).toBe(
      "DOKAZ_07_Vysluch_Erik_Babcan_12-13.08.2026.md",
    );
    expect(result.charCount).toBeGreaterThan(30000);
    expect(result.usedOcr).toBe(false);

    // Metadata spisu ÚBOK
    expect(result.metadata.caseId).toBe("PPZ-51/UBOK-PZ-ST-2025");
    expect(result.metadata.documentType).toBe("Zápisnica o výsluchu");
    expect(result.metadata.location).toBe("Košice");

    // Extrahované osoby a rodinné väzby
    const personNames = result.entities.persons.map((p) => p.name);
    expect(personNames).toContain("Erik Babčan");
    expect(personNames).toContain("Milan Babčan");
    expect(personNames).toContain("Dáša Babčanová");
    expect(personNames).toContain("Kada Dakaj");
    expect(personNames).toContain("Dea Babčan");
    expect(personNames).toContain("Dimitri Cohen");

    const babcan = result.entities.persons.find(
      (p) => p.name === "Erik Babčan",
    );
    expect(babcan?.role).toBe("Podozrivý / Vypočúvaný");
    expect(babcan?.birthDate).toBe("30.05.1989");

    const otec = result.entities.persons.find((p) => p.name === "Milan Babčan");
    expect(otec?.role).toBe("Otec");

    // Extrahované spoločnosti
    expect(result.entities.companies).toContain("Podtrubie a.s.");

    // Extrahované právne paragrafy (Trestný poriadok)
    const hasTP = result.entities.legalParagraphs.some(
      (p) => p.includes("§ 85") || p.includes("§ 33b") || p.includes("§ 119"),
    );
    expect(hasTP).toBe(true);
  });

  it("serverová funkcia parseUploadedCaseDocument je správne definovaná", () => {
    expect(parseUploadedCaseDocument).toBeDefined();
    expect(typeof parseUploadedCaseDocument).toBe("function");
  });

  it("správne extrahuje zbrane a vozidlá z modelového textu", () => {
    const sampleText = `
      ČVS: PPZ-51/UBOK-PZ-ST-2025
      Vozidlo: BMW X6 s evidenčným číslom.
      Zaistené veci: 48 ks pištolí Glock 19 Gen 5, zbraň GP K100 a zbraň v. č. CGDV051.
      Firma: ARMIVEX s.r.o. a VELTRA s.r.o.
      Právna kvalifikácia: § 294 ods. 1 TZ.
    `;

    const { metadata, entities } = extractCaseEntities(sampleText);

    expect(metadata.caseId).toBe("PPZ-51/UBOK-PZ-ST-2025");
    expect(entities.vehicles).toContain("BMW X6");
    expect(entities.weapons).toContain("Glock 19 Gen 5");
    expect(entities.weapons).toContain("Grand Power K100");
    expect(entities.weapons).toContain("Zbraň v. č. CGDV051");
    expect(entities.companies).toContain("ARMIVEX s.r.o.");
    expect(entities.companies).toContain("VELTRA s.r.o.");
    expect(entities.legalParagraphs.some((p) => p.includes("§ 294"))).toBe(
      true,
    );
  });

  it("vráti informatívnu chybu pri pokuse o OCR obrázka, ak chýbajú API kľúče", async () => {
    const originalMistral = process.env["MISTRAL_API_KEY"];
    const originalXai = process.env["XAI_API_KEY"];
    delete process.env["MISTRAL_API_KEY"];
    delete process.env["XAI_API_KEY"];

    try {
      const dummyImageBase64 =
        Buffer.from("dummy-image-data").toString("base64");
      await expect(
        handleParseUploadedCaseDocument("zapisnica_scan.png", dummyImageBase64),
      ).rejects.toThrow(/OCR nie je nakonfigurované/);
    } finally {
      if (originalMistral) process.env["MISTRAL_API_KEY"] = originalMistral;
      if (originalXai) process.env["XAI_API_KEY"] = originalXai;
    }
  });

  it("správne simuluje Mistral OCR fallback pri mockovanom API volaní", async () => {
    process.env["MISTRAL_API_KEY"] =
      process.env["MISTRAL_API_KEY"] || "test-key";
    const mistralServer = await import("@/lib/ai/mistral.server");
    const ocrSpy = vi.spyOn(mistralServer, "callMistralOcr").mockResolvedValue(`
# ZÁPISNICA O VÝSLUCHU SVIEDKA
Miesto: Žilina
Dátum: 12.01.2026
Osoba: Marek Hruška, nar. 14.04.1982
Spoločnosť: ARMIVEX s.r.o.
Zbrane: Glock 19 a GP K100
Ustanovenie: § 119 TP
    `);

    try {
      const dummyImageBase64 =
        Buffer.from("dummy-scan-bytes").toString("base64");
      const result = await handleParseUploadedCaseDocument(
        "vysluch_hruska_scan.png",
        dummyImageBase64,
      );

      expect(result.success).toBe(true);
      expect(result.usedOcr).toBe(true);
      expect(result.metadata.documentType).toBe("Zápisnica o výsluchu");
      expect(result.metadata.location).toBe("Žilina");

      const names = result.entities.persons.map((p) => p.name);
      expect(names).toContain("Marek Hruška");
      expect(result.entities.companies).toContain("ARMIVEX s.r.o.");
      expect(result.entities.weapons).toContain("Glock 19 Gen 5");
    } finally {
      ocrSpy.mockRestore();
    }
  });
});
