import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callLlm,
  llmConfigured,
  activeProvider,
  preferredLlmModel,
} from "@/lib/ai/llm.server";

const reply = (status: number) => ({
  ok: status === 200,
  status,
  headers: new Headers(),
  json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
  text: async () => "provider error",
});
describe("Mistral-only API regression", () => {
  beforeEach(() => {
    for (const key of [
      "MISTRAL_API_KEY",
      "MISTRAL_API_KEY_CHAT",
      "MISTRAL_API_KEY_ANALYSIS",
      "MISTRAL_MODEL",
    ])
      vi.stubEnv(key, "");
    // Stará konfigurácia nesmie zmeniť poskytovateľa.
    vi.stubEnv("AI_PRIMARY", "xai");
    vi.stubEnv("XAI_API_KEY", "unused-legacy-key");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("does not make a request without a Mistral key even if legacy configuration exists", async () => {
    const fetchImpl = vi.fn();
    expect(llmConfigured()).toBe(false);
    expect(activeProvider()).toBeNull();
    expect((await callLlm({ messages: [], fetchImpl })).status).toBe(
      "not_configured",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it.each(["chat", "analysis"] as const)(
    "uses only the Mistral endpoint and the correct %s key",
    async (purpose) => {
      vi.stubEnv("MISTRAL_API_KEY_CHAT", "chat-fixture");
      vi.stubEnv("MISTRAL_API_KEY_ANALYSIS", "analysis-fixture");
      const fetchImpl = vi.fn().mockResolvedValue(reply(200));
      const result = await callLlm({
        messages: [{ role: "user", content: "fixture" }],
        purpose,
        fetchImpl,
      });
      expect(result).toMatchObject({ status: "ok", provider: "mistral" });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.mistral.ai/v1/chat/completions",
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: "Bearer " + purpose + "-fixture",
          }),
        }),
      );
      expect(preferredLlmModel()).toBe("mistral-large-latest");
    },
  );
  it("does not report chat configured from the analysis-only key", () => {
    vi.stubEnv("MISTRAL_API_KEY_ANALYSIS", "analysis-fixture");
    expect(llmConfigured("analysis")).toBe(true);
    expect(llmConfigured("chat")).toBe(false);
    expect(activeProvider("analysis")).toBe("mistral");
    expect(activeProvider("chat")).toBeNull();
  });
  it("uses the common API key for both purposes and ignores blank dedicated keys", async () => {
    vi.stubEnv("MISTRAL_API_KEY", " common-fixture ");
    vi.stubEnv("MISTRAL_API_KEY_CHAT", "   ");
    for (const purpose of ["chat", "analysis"] as const) {
      const fetchImpl = vi.fn().mockResolvedValue(reply(200));
      await callLlm({ messages: [], purpose, fetchImpl });
      expect(fetchImpl.mock.calls[0]?.[1].headers.authorization).toBe(
        "Bearer common-fixture",
      );
    }
  });
  it.each([401, 500])(
    "does not switch provider after HTTP %s",
    async (status) => {
      vi.stubEnv("MISTRAL_API_KEY", "fixture");
      const fetchImpl = vi.fn().mockResolvedValue(reply(status));
      expect((await callLlm({ messages: [], fetchImpl })).status).toBe(
        "failed",
      );
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(fetchImpl.mock.calls[0]?.[0]).toBe(
        "https://api.mistral.ai/v1/chat/completions",
      );
    },
  );
  it("does not switch provider or retry after timeout", async () => {
    vi.stubEnv("MISTRAL_API_KEY", "fixture");
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("aborted"), { name: "AbortError" }),
      );
    expect((await callLlm({ messages: [], fetchImpl })).status).toBe("timeout");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
