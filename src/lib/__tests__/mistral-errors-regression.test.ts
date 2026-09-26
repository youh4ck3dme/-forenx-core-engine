import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callMistralOcr } from "@/lib/ai/mistral.server";

describe("Mistral OCR actionable errors", () => {
  beforeEach(() => vi.stubEnv("MISTRAL_API_KEY_ANALYSIS", "fixture-only"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it.each([
    [401, "odmietol kľúč"],
    [403, "odmietol kľúč"],
    [402, "kredit"],
    [429, "limit"],
    [503, "nedostupný"],
  ])(
    "maps HTTP %s without exposing provider response",
    async (status, message) => {
      const fetch = vi
        .fn()
        .mockResolvedValue(
          new Response("private-provider-response", { status: Number(status) }),
        );
      vi.stubGlobal("fetch", fetch);
      await expect(
        callMistralOcr(Buffer.from("fixture"), "test.png"),
      ).rejects.toThrow(String(message));
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
  it("explains a timeout rather than reporting a missing key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")),
    );
    await expect(
      callMistralOcr(Buffer.from("fixture"), "test.png"),
    ).rejects.toThrow("časový limit");
  });
});
