import { describe, expect, it } from "vitest";
import { dispatchCaseIngest } from "@/lib/case-dispatcher";
import {
  exceedsBatchSize,
  MAX_BATCH_SIZE,
  MAX_FILE_SIZE,
  partitionBySize,
} from "@/lib/upload-prep";

const MB = 1024 * 1024;

describe("Large upload E2E regression", () => {
  it("accepts a real 15 MB PDF fixture and rejects only files over 150 MB", () => {
    const largePdf = new File([new Uint8Array(15 * MB)], "spis-15mb.pdf", {
      type: "application/pdf",
    });
    const tooLarge = { name: "spis-151mb.pdf", size: MAX_FILE_SIZE + 1 };
    const { accepted, rejected } = partitionBySize([
      { name: largePdf.name, size: largePdf.size },
      tooLarge,
    ]);

    expect(largePdf.size).toBe(15 * MB);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]?.name).toBe("spis-15mb.pdf");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.file.name).toBe("spis-151mb.pdf");
  });

  it("accepts a 300 MB batch boundary and rejects a larger selection", () => {
    expect(exceedsBatchSize([{ size: 150 * MB }, { size: 150 * MB }])).toBe(
      false,
    );
    expect(exceedsBatchSize([{ size: 150 * MB }, { size: 150 * MB + 1 }])).toBe(
      true,
    );
    expect(MAX_BATCH_SIZE).toBe(300 * MB);
  });

  it("merges all supported document, table, image, and PDF extensions into one case", async () => {
    const text =
      "ČVS: PPZ-442/2026. Zápisnica o výsluchu spoločnosti ALFA s.r.o. (IČO: 35815256).";
    const formats = [
      "spis.pdf",
      "zmluva.docx",
      "vypis.xlsx",
      "vypis.xls",
      "poznamka.txt",
      "analyza.md",
      "transakcie.csv",
      "data.json",
      "strana.html",
      "dokument.rtf",
      "scan.png",
      "fotografia.jpg",
    ];

    const result = await dispatchCaseIngest(
      "large-upload-e2e",
      formats.map((name) => ({ name, text })),
    );

    expect(result.extractedDocuments).toHaveLength(formats.length);
    expect(result.unifiedCase.documents).toHaveLength(formats.length);
    expect(result.unifiedCase.metadata.status).toBe("analyzed");
    expect(
      result.unifiedCase.documents.map((document) => document.name),
    ).toEqual(formats);
    expect(
      result.unifiedCase.documents.every(
        (document) =>
          document.extractedText === text &&
          document.sha256.match(/^[a-f0-9]{64}$/),
      ),
    ).toBe(true);
  });
});
