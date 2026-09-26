import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  SAFE_SERVER_FN_BYTES,
  bytesToBase64Sync,
  isOverServerFnBudget,
  mapUploadNetworkError,
  partitionBySize,
  tooLargeForServerFnMessage,
  tooLargeMessage,
} from "@/lib/upload-prep";
import { joinOcrPageTexts } from "@/lib/pdf-page-ocr";
import { isLowQualityPdfText } from "@/lib/ai.functions";

describe("strop veľkosti nahrávaných spisov", () => {
  it("default partition prijme PDF nad pôvodným serverovým limitom", () => {
    const small = { name: "a.pdf", size: 1024 };
    const overSafe = { name: "b.pdf", size: SAFE_SERVER_FN_BYTES + 1 };
    const { accepted, rejected } = partitionBySize([small, overSafe]);
    expect(accepted).toEqual([small, overSafe]);
    expect(rejected).toHaveLength(0);
  });

  it("explicitný MAX_UPLOAD_BYTES stále funguje", () => {
    const big = { name: "b.pdf", size: MAX_UPLOAD_BYTES + 1 };
    const { rejected } = partitionBySize([big], MAX_UPLOAD_BYTES);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toContain("150.0 MB");
  });

  it("hláška uvádza názov aj limit", () => {
    const message = tooLargeMessage({
      name: "spis.pdf",
      size: 12 * 1024 * 1024,
    });
    expect(message).toContain("spis.pdf");
    expect(message).toContain("12.0 MB");
    expect(message).toContain("150.0 MB");
  });

  it("serverFn hláška pre PDF spomína OCR stránky", () => {
    const message = tooLargeForServerFnMessage({
      name: "sken.pdf",
      size: 5 * 1024 * 1024,
    });
    expect(message).toContain("sken.pdf");
    expect(message).toMatch(/stránkach|OCR/i);
  });

  it("isOverServerFnBudget", () => {
    expect(isOverServerFnBudget({ size: SAFE_SERVER_FN_BYTES })).toBe(false);
    expect(isOverServerFnBudget({ size: SAFE_SERVER_FN_BYTES + 1 })).toBe(true);
  });

  it("presne SAFE_SERVER_FN_BYTES ešte prejde", () => {
    const { accepted } = partitionBySize([
      { name: "c.pdf", size: SAFE_SERVER_FN_BYTES },
    ]);
    expect(accepted).toHaveLength(1);
  });
});

describe("mapUploadNetworkError", () => {
  it("mapuje 413 na SK správu", () => {
    expect(
      mapUploadNetworkError(new Error("Failed 413 Payload Too Large")),
    ).toMatch(/príliš veľký/i);
  });

  it("ponechá inú chybu", () => {
    expect(mapUploadNetworkError(new Error("OCR failed"))).toBe("OCR failed");
  });
});

describe("záložný prevod na Base64", () => {
  it("prevedie bajty rovnako ako btoa", () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    expect(bytesToBase64Sync(bytes)).toBe("SGVsbG8=");
  });

  it("zvládne dáta väčšie ako jedna dávka", () => {
    const bytes = new Uint8Array(20_000).fill(65);
    const out = bytesToBase64Sync(bytes);
    expect(out.length).toBeGreaterThan(20_000);
    expect(atob(out).length).toBe(20_000);
  });
});

describe("isLowQualityPdfText", () => {
  it("krátky text je low quality", () => {
    expect(isLowQualityPdfText("abc")).toBe(true);
  });

  it("normálny text prejde", () => {
    expect(
      isLowQualityPdfText(
        "Zápisnica o výsluchu svedka Petra Nováka zo dňa 12. 3. 2024 v Bratislave.",
      ),
    ).toBe(false);
  });

  it("garbage s nulami a bez písmen je low quality", () => {
    expect(isLowQualityPdfText("\u0000\u0000   \u0001\u0002")).toBe(true);
  });
});

describe("joinOcrPageTexts", () => {
  it("zoradí a spojí stránky", () => {
    const out = joinOcrPageTexts([
      { page: 2, text: "druha" },
      { page: 1, text: "prva" },
    ]);
    expect(out).toContain("--- strana 1 ---");
    expect(out).toContain("prva");
    expect(out.indexOf("prva")).toBeLessThan(out.indexOf("druha"));
  });
});
