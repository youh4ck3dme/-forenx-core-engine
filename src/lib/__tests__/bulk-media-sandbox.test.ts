import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  classifyExtractResult,
  extractSingleBufferText,
} from "../ai.functions";
import {
  assessPdfMemory,
  countPdfPages,
  isMemoryConstrainedBrowser,
} from "../upload-prep";
import { statusLabel } from "@/components/malte/UploadFileList";

describe("Bulk Media Sandbox & File Extraction", () => {
  it("extrahuje čistý text z TXT súboru", async () => {
    const textContent = "Zápisnica o výsluchu svedka Mareka Hrušku.";
    const res = await extractSingleBufferText(
      "vyslech.txt",
      undefined,
      textContent,
    );
    expect(res.success).toBe(true);
    expect(res.text).toBe(textContent);
    expect(res.charCount).toBe(textContent.length);
  });

  it("extrahuje a očistí CSV a JSON súbory", async () => {
    const csvContent =
      "datum,suma,platitel,prijemca\n2025-01-22,32000,vklad,VELTRA";
    const resCsv = await extractSingleBufferText(
      "transakcie.csv",
      undefined,
      csvContent,
    );
    expect(resCsv.success).toBe(true);
    expect(resCsv.text).toContain("32000");

    const jsonContent = JSON.stringify({ kauza: "Armivex", zbrane: 242 });
    const resJson = await extractSingleBufferText(
      "data.json",
      undefined,
      jsonContent,
    );
    expect(resJson.success).toBe(true);
    expect(resJson.text).toContain("Armivex");
  });

  it("extrahuje a zbaví HTML značiek", async () => {
    const htmlContent =
      "<html><body><h1>Zápisnica</h1><p>Peter Novák bol prítomný.</p></body></html>";
    const base64 = Buffer.from(htmlContent, "utf-8").toString("base64");
    const res = await extractSingleBufferText("zapisnica.html", base64);
    expect(res.success).toBe(true);
    expect(res.text).toContain("Zápisnica");
    expect(res.text).toContain("Peter Novák bol prítomný.");
    expect(res.text).not.toContain("<html>");
    expect(res.text).not.toContain("<h1>");
  });

  it("extrahuje tabuľky z XLSX súboru", async () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["ID", "Dátum", "Suma", "Typ"],
      ["SF-01", "2025-01-22", 32000, "Hotovosť"],
      ["SF-02", "2025-01-23", 31850, "Prevod"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Platby");
    const xlsxBuffer = XLSX.write(wb, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;
    const base64 = xlsxBuffer.toString("base64");

    const res = await extractSingleBufferText("transakcie.xlsx", base64);
    expect(res.success).toBe(true);
    expect(res.text).toContain("SF-01");
    expect(res.text).toContain("32000");
    expect(res.text).toContain("Platby");
  });

  it("označí príliš krátky text ako zlyhanie súboru, nie tichý úspech", () => {
    const short = classifyExtractResult("prazdny.txt", {
      text: "ok",
      charCount: 2,
    });
    expect(short.success).toBe(false);
    expect(short.error).toMatch(/30 znakov/);
    expect(short.text).toBe("");

    const ok = classifyExtractResult("vyslech.txt", {
      text: "Zápisnica o výsluchu svedka Mareka Hrušku v kauze Armivex.",
      charCount: 58,
      usedOcr: true,
    });
    expect(ok.success).toBe(true);
    expect(ok.usedOcr).toBe(true);
    expect(ok.error).toBeUndefined();
  });

  it("odmietne nepodporovaný formát s jasným chybovým hlásením", async () => {
    const base64 = Buffer.from("fake exe content").toString("base64");
    await expect(
      extractSingleBufferText("malware.exe", base64),
    ).rejects.toThrow(/Nepodporovaný formát/);
  });
});

describe("Multi-file intake queue", () => {
  it("spočíta strany PDF z metadát bez dekódovania celého dokumentu", async () => {
    const pdf =
      "%PDF-1.4\n" +
      "1 0 obj<</Type /Pages /Count 3>>endobj\n" +
      "2 0 obj<</Type /Page /Parent 1 0 R>>endobj\n" +
      "3 0 obj<</Type /Page /Parent 1 0 R>>endobj\n" +
      "4 0 obj<</Type /Page /Parent 1 0 R>>endobj\n%%EOF";
    const file = new File([pdf], "spis.pdf", { type: "application/pdf" });
    expect(await countPdfPages(file)).toBe(3);
  });

  it("nezisťuje strany pri iných formátoch", async () => {
    const file = new File(["text"], "poznamka.txt", { type: "text/plain" });
    expect(await countPdfPages(file)).toBeUndefined();
  });

  it("rozpozná prehliadač s obmedzenou pamäťou (iPhone, iPad)", () => {
    expect(
      isMemoryConstrainedBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"),
    ).toBe(true);
    expect(
      isMemoryConstrainedBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X)", 5),
    ).toBe(true);
    expect(isMemoryConstrainedBrowser("Mozilla/5.0 (Windows NT 10.0)", 0)).toBe(
      false,
    );
  });

  it("spracuje mnohostranové PDF na mobile po dávkach bez manuálneho delenia", async () => {
    const pages = Array.from(
      { length: 12 },
      (_, i) => `${i + 2} 0 obj<</Type /Page>>endobj\n`,
    ).join("");
    const file = new File([`%PDF-1.4\n${pages}%%EOF`], "vyslech.pdf", {
      type: "application/pdf",
    });
    const blocked = await assessPdfMemory(file, true);
    expect(blocked.pages).toBe(12);
    expect(blocked.blockedReason).toBeUndefined();

    const allowed = await assessPdfMemory(file, false);
    expect(allowed.pages).toBe(12);
    expect(allowed.blockedReason).toBeUndefined();
  });

  it("krátke PDF prejde aj na mobile", async () => {
    const file = new File(
      [
        "%PDF-1.4\n1 0 obj<</Type /Page>>endobj\n2 0 obj<</Type /Page>>endobj\n%%EOF",
      ],
      "kratke.pdf",
      { type: "application/pdf" },
    );
    const res = await assessPdfMemory(file, true);
    expect(res.pages).toBe(2);
    expect(res.blockedReason).toBeUndefined();
  });

  it("stavy fronty majú slovenské označenia", () => {
    expect(statusLabel("queued")).toBe("čaká");
    expect(statusLabel("reading")).toBe("beží");
    expect(statusLabel("done")).toBe("hotovo");
    expect(statusLabel("failed")).toBe("chyba");
  });
});
