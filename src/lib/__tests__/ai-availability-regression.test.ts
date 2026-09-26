import { describe, expect, it } from "vitest";
import { aiUnavailableReason } from "@/lib/ai/availability";

describe("AI configuration is distinct from availability", () => {
  it("distinguishes loading, network error and missing configuration", () => {
    expect(aiUnavailableReason({ isPending: true }, "chat", true)).toContain(
      "Zisťujem",
    );
    expect(aiUnavailableReason({ isError: true }, "chat", true)).toContain(
      "nepodarilo zistiť",
    );
    expect(
      aiUnavailableReason({ data: { configured: false } }, "chat", true),
    ).toContain("chýba");
  });
  it("fails closed on a refresh error even with previously configured data", () => {
    expect(
      aiUnavailableReason(
        { isError: true, data: { configured: true } },
        "chat",
        true,
      ),
    ).toContain("nepodarilo");
  });
  it("does not mix chat and analysis keys", () => {
    const status = {
      data: {
        configured: false,
        chatConfigured: false,
        analysisConfigured: true,
      },
    };
    expect(aiUnavailableReason(status, "chat", true)).toContain("rýchle úlohy");
    expect(aiUnavailableReason(status, "analysis", true)).toBeNull();
    expect(aiUnavailableReason(status, "analysis", false)).toContain(
      "internet",
    );
  });
});
