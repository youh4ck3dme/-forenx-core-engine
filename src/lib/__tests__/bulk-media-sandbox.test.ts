import { describe, it, expect } from "vitest";
import { statusLabel } from "@/components/malte/UploadFileList";
import ExcelJS from "exceljs";
import {
  classifyExtractResult,
  extractSingleBufferText,
} from "../ai.functions";
import {
  assessPdfMemory,
  countPdfPages,
  isMemoryConstrainedBrowser,
} from "../upload-prep";

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

  async function workbookBase64(sheets: Array<{ name: string; rows: Array<Array<string | number>> }>): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    for (const sheet of sheets) workbook.addWorksheet(sheet.name).addRows(sheet.rows);
    return Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64");
  }

  it("extrahuje tabuľky z XLSX súboru vrátane značiek hárkov", async () => {
    const base64 = await workbookBase64([{ name: "Platby", rows: [["ID", "Suma"], ["SF-01", 32000]] }, { name: "Poznámky", rows: [["Overiť pôvod platby"]] }]);
    const res = await extractSingleBufferText("transakcie.xlsx", base64);
    expect(res.success).toBe(true);
    expect(res.text).toContain("--- HÁROK: Platby ---");
    expect(res.text).toContain("SF-01,32000");
    expect(res.text).toContain("--- HÁROK: Poznámky ---");
  });

  it("odmietne starý XLS formát", async () => {
    await expect(extractSingleBufferText("stary.xls", Buffer.from("legacy").toString("base64"))).rejects.toThrow(/nie je podporovaný.*\.xlsx/i);
  });

  it("odmietne poškodený XLSX archív", async () => {
    await expect(extractSingleBufferText("poskodeny.xlsx", Buffer.from("nie je zip").toString("base64"))).rejects.toThrow(/platnú štruktúru XLSX/);
  });

  it("odmietne XLSX hárok s príliš veľkým počtom stĺpcov", async () => {
    const base64 = await workbookBase64([{ name: "Príliš široký", rows: [Array.from({ length: 201 }, () => "hodnota")] }]);
    await expect(extractSingleBufferText("siroky.xlsx", base64)).rejects.toThrow(/limit 200 stĺpcov/);
  });

  it("spracuje názvy hárkov s kľúčmi nebezpečnými pre prototyp", async () => {
    const base64 = await workbookBase64([{ name: "__proto__", rows: [["bezpečné"]] }, { name: "constructor", rows: [["tiež bezpečné"]] }]);
    const res = await extractSingleBufferText("kluce.xlsx", base64);
    expect(res.text).toContain("--- HÁROK: __proto__ ---");
    expect(res.text).toContain("--- HÁROK: constructor ---");
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, "bezpečné")).toBe(false);
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
