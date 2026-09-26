import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractWithOcrFallback } from "@/lib/ai/llm.server";
import * as mistral from "@/lib/ai/mistral.server";
import { extractSingleBufferText } from "@/lib/ai.functions";

vi.mock("pdf-parse", () => ({
  default: async () => ({ text: "\u0000\u0000 ## $$ %%" }),
}));

describe("Mistral-only OCR", () => {
  beforeEach(() => {
    for (const key of [
      "MISTRAL_API_KEY",
      "MISTRAL_API_KEY_CHAT",
      "MISTRAL_API_KEY_ANALYSIS",
    ])
      vi.stubEnv(key, "");
    vi.stubEnv("AI_PRIMARY", "xai");
    vi.stubEnv("XAI_API_KEY", "unused");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  it("requires a Mistral analysis key and never uses a different provider", async () => {
    const spy = vi.spyOn(mistral, "callMistralOcr");
    await expect(
      extractWithOcrFallback(Buffer.from("fixture"), "scan.png"),
    ).rejects.toThrow(/OCR nie je nakonfigurované/);
    expect(spy).not.toHaveBeenCalled();
  });
  it.each(["scan.pdf", "scan.png", "scan.jpg"])(
    "routes %s to Mistral OCR",
    async (name) => {
      vi.stubEnv("MISTRAL_API_KEY", "fixture");
      const spy = vi
        .spyOn(mistral, "callMistralOcr")
        .mockResolvedValue("Text fixture");
      const buffer = Buffer.from("fixture");
      expect(await extractWithOcrFallback(buffer, name)).toBe("Text fixture");
      expect(spy).toHaveBeenCalledExactlyOnceWith(buffer, name);
    },
  );
  it("propagates OCR errors without a provider fallback", async () => {
    vi.stubEnv("MISTRAL_API_KEY_ANALYSIS", "fixture");
    const spy = vi
      .spyOn(mistral, "callMistralOcr")
      .mockRejectedValue(new Error("OCR failed"));
    await expect(
      extractWithOcrFallback(Buffer.from("fixture"), "scan.png"),
    ).rejects.toThrow("OCR failed");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("garbage PDF text → forced OCR", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("po garbage pdf-parse volá OCR fallback", async () => {
    const llm = await import("@/lib/ai/llm.server");
    const spy = vi
      .spyOn(llm, "extractWithOcrFallback")
      .mockResolvedValue(
        "OCR text zo skenu s dostatočným počtom znakov pre prah kvality.",
      );

    const res = await extractSingleBufferText(
      "sken.pdf",
      Buffer.from("%PDF-1.4 garbage").toString("base64"),
    );
    expect(spy).toHaveBeenCalled();
    expect(res.usedOcr).toBe(true);
    expect(res.success).toBe(true);
    expect(res.text).toMatch(/OCR text/);
  });
});
