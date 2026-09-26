import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Kľúče sa nesmú miešať: asistent/kontroly používajú MISTRAL_API_KEY_CHAT,
 * čítanie a analýza dokumentov MISTRAL_API_KEY_ANALYSIS.
 */
describe("Rozdelenie Mistral kľúčov podľa účelu", () => {
  beforeEach(() => {
    delete process.env["MISTRAL_API_KEY"];
    delete process.env["MISTRAL_API_KEY_CHAT"];
    delete process.env["MISTRAL_API_KEY_ANALYSIS"];
    delete process.env["XAI_API_KEY"];
  });

  const okResponse = () => ({
    ok: true,
    status: 200,
    headers: new Map(),
    json: async () => ({
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }),
  });

  const authHeader = (fetchImpl: ReturnType<typeof vi.fn>) =>
    (fetchImpl.mock.calls[0]?.[1] as RequestInit | undefined)?.headers as
      Record<string, string> | undefined;

  it("chat volanie použije chat kľúč", async () => {
    process.env["MISTRAL_API_KEY_CHAT"] = "key-chat";
    process.env["MISTRAL_API_KEY_ANALYSIS"] = "key-analysis";
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const { callMistral } = await import("@/lib/ai/mistral.server");
    const result = await callMistral({
      messages: [{ role: "user", content: "x" }],
      purpose: "chat",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.status).toBe("ok");
    expect(authHeader(fetchImpl)?.["authorization"]).toBe("Bearer key-chat");
  });

  it("analytické volanie použije analytický kľúč", async () => {
    process.env["MISTRAL_API_KEY_CHAT"] = "key-chat";
    process.env["MISTRAL_API_KEY_ANALYSIS"] = "key-analysis";
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const { callMistral } = await import("@/lib/ai/mistral.server");
    await callMistral({
      messages: [{ role: "user", content: "x" }],
      purpose: "analysis",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(authHeader(fetchImpl)?.["authorization"]).toBe(
      "Bearer key-analysis",
    );
  });

  it("chýbajúci účelový kľúč znamená nenakonfigurované", async () => {
    process.env["MISTRAL_API_KEY_CHAT"] = "key-chat";
    const { mistralConfigured } = await import("@/lib/ai/mistral.server");
    expect(mistralConfigured("chat")).toBe(true);
    expect(mistralConfigured("analysis")).toBe(false);
  });

  it("staršie MISTRAL_API_KEY funguje ako záloha pre oba účely", async () => {
    process.env["MISTRAL_API_KEY"] = "legacy";
    const { mistralApiKey } = await import("@/lib/ai/mistral.server");
    expect(mistralApiKey("chat")).toBe("legacy");
    expect(mistralApiKey("analysis")).toBe("legacy");
  });
});
