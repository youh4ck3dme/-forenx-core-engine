import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the fetch function
const mockFetch = vi.fn();

describe("Mistral API Integration Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Save original fetch and process.env
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("callMistral function", () => {
    it("should return not_configured when MISTRAL_API_KEY is missing", async () => {
      const originalKey = process.env["MISTRAL_API_KEY"];
      delete process.env["MISTRAL_API_KEY"];

      try {
        const { callMistral } = await import("@/lib/ai/mistral.server");
        const result = await callMistral({
          messages: [{ role: "user", content: "Test" }],
        });

        expect(result.status).toBe("not_configured");
        if (result.status === "not_configured") {
          expect(result.message).toBe("AI nie je nakonfigurovaná.");
        }
      } finally {
        if (originalKey) process.env["MISTRAL_API_KEY"] = originalKey;
      }
    });

    it("should call Mistral API with correct endpoint and headers", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '{"test": "response"}' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        headers: new Map(),
      };

      mockFetch.mockResolvedValue(mockResponse);
      process.env["MISTRAL_API_KEY"] = "test_api_key";

      const { callMistral } = await import("@/lib/ai/mistral.server");
      const result = await callMistral({
        messages: [{ role: "user", content: "Test message" }],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.mistral.ai/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "content-type": "application/json",
            authorization: "Bearer test_api_key",
          }),
        }),
      );

      const firstCall = mockFetch.mock.calls[0];
      const requestInit = firstCall?.[1] as RequestInit | undefined;
      expect(requestInit?.body).toBeDefined();
      const requestBody = JSON.parse(String(requestInit?.body));
      expect(requestBody).toMatchObject({
        model: "mistral-large-latest",
        temperature: 0.2,
        max_tokens: 900,
        messages: [{ role: "user", content: "Test message" }],
      });

      expect(result.status).toBe("ok");
      if (result.status === "ok") {
        expect(result.content).toBe('{"test": "response"}');
      }
    });

    it("should handle API errors correctly", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Invalid API key" }),
        headers: new Map(),
      };

      mockFetch.mockResolvedValue(mockResponse);
      process.env["MISTRAL_API_KEY"] = "invalid_key";

      const { callMistral } = await import("@/lib/ai/mistral.server");
      const result = await callMistral({
        messages: [{ role: "user", content: "Test" }],
      });

      expect(result.status).toBe("failed");
    });

    it("should handle rate limiting (429) with retry", async () => {
      const mockRateLimitResponse = {
        ok: false,
        status: 429,
        headers: new Map([["retry-after", "2"]]),
        json: () => Promise.resolve({}),
      };

      const mockSuccessResponse = {
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '{"test": "success"}' } }],
          }),
        headers: new Map(),
      };

      mockFetch
        .mockResolvedValueOnce(mockRateLimitResponse)
        .mockResolvedValueOnce(mockSuccessResponse);

      process.env["MISTRAL_API_KEY"] = "test_api_key";

      const { callMistral } = await import("@/lib/ai/mistral.server");
      const result = await callMistral({
        messages: [{ role: "user", content: "Test" }],
        fetchImpl: mockFetch,
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.status).toBe("ok");
    });

    it("should handle timeout correctly", async () => {
      mockFetch.mockImplementation(() => {
        const err = new Error("AbortError");
        err.name = "AbortError";
        return Promise.reject(err);
      });

      process.env["MISTRAL_API_KEY"] = "test_api_key";

      const { callMistral } = await import("@/lib/ai/mistral.server");
      const result = await callMistral({
        messages: [{ role: "user", content: "Test" }],
        fetchImpl: mockFetch,
      });

      expect(result.status).toBe("timeout");
      if (result.status === "timeout") {
        expect(result.message).toContain("prekročilo časový limit");
      }
    });

    it("should treat empty AI content as failed", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: "   " } }],
          }),
        headers: new Map(),
      });
      process.env["MISTRAL_API_KEY"] = "test_api_key";

      const { callMistral } = await import("@/lib/ai/mistral.server");
      const result = await callMistral({
        messages: [{ role: "user", content: "Test" }],
        fetchImpl: mockFetch,
      });

      expect(result.status).toBe("failed");
      if (result.status === "failed") {
        expect(result.message).toContain("Odpoveď AI bola prázdna");
      }
    });

    it("should treat network failure as offline/failed connection", async () => {
      mockFetch.mockRejectedValue(new TypeError("fetch failed"));
      process.env["MISTRAL_API_KEY"] = "test_api_key";

      const { callMistral } = await import("@/lib/ai/mistral.server");
      const result = await callMistral({
        messages: [{ role: "user", content: "Test" }],
        fetchImpl: mockFetch,
      });

      expect(result.status).toBe("failed");
      if (result.status === "failed") {
        expect(result.message).toContain("Spojenie s poskytovateľom zlyhalo");
      }
    });
  });

  describe("callMistralOcr function", () => {
    it("should throw error when MISTRAL_API_KEY is missing", async () => {
      const originalKey = process.env["MISTRAL_API_KEY"];
      delete process.env["MISTRAL_API_KEY"];

      try {
        const { callMistralOcr } = await import("@/lib/ai/mistral.server");
        const buffer = Buffer.from("test content");

        await expect(callMistralOcr(buffer, "test.pdf")).rejects.toThrow(
          /MISTRAL_API_KEY(_ANALYSIS)? nie je nastavený/,
        );
      } finally {
        if (originalKey) process.env["MISTRAL_API_KEY"] = originalKey;
      }
    });

    it("should upload file, get signed URL, call OCR, and cleanup", async () => {
      // Mock responses for each step
      const mockUploadResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "test_file_id" }),
      };

      const mockSignedUrlResponse = {
        ok: true,
        json: () =>
          Promise.resolve({ url: "https://signed.url/test_file_id.txt" }),
      };

      const mockOcrResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            pages: [{ index: 0, markdown: "Extracted text from OCR" }],
          }),
      };

      const mockDeleteResponse = {
        ok: true,
        json: () => Promise.resolve({}),
      };

      mockFetch
        .mockResolvedValueOnce(mockUploadResponse)
        .mockResolvedValueOnce(mockSignedUrlResponse)
        .mockResolvedValueOnce(mockOcrResponse)
        .mockResolvedValueOnce(mockDeleteResponse);

      process.env["MISTRAL_API_KEY"] = "test_api_key";

      const { callMistralOcr } = await import("@/lib/ai/mistral.server");
      const buffer = Buffer.from("test content");

      const result = await callMistralOcr(buffer, "test.pdf");

      // Verify all steps were called
      expect(mockFetch).toHaveBeenCalledTimes(4);

      // Verify upload was called
      expect(mockFetch.mock.calls[0]![1]).toEqual(
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            authorization: "Bearer test_api_key",
          }),
        }),
      );

      // Verify signed URL was requested
      expect(mockFetch.mock.calls[1]![0]).toBe(
        "https://api.mistral.ai/v1/files/test_file_id/url",
      );

      // Verify OCR was called
      expect(mockFetch.mock.calls[2]![0]).toBe("https://api.mistral.ai/v1/ocr");

      expect(result).toBe("Extracted text from OCR");
    });

    it("should handle OCR failure for empty text", async () => {
      const mockUploadResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "test_file_id" }),
      };

      const mockSignedUrlResponse = {
        ok: true,
        json: () =>
          Promise.resolve({ url: "https://signed.url/test_file_id.txt" }),
      };

      const mockOcrResponse = {
        ok: true,
        json: () => Promise.resolve({ pages: [] }),
      };

      mockFetch
        .mockResolvedValueOnce(mockUploadResponse)
        .mockResolvedValueOnce(mockSignedUrlResponse)
        .mockResolvedValueOnce(mockOcrResponse)
        .mockResolvedValueOnce({ ok: true });

      process.env["MISTRAL_API_KEY"] = "test_api_key";

      const { callMistralOcr } = await import("@/lib/ai/mistral.server");
      const buffer = Buffer.from("test content");

      await expect(callMistralOcr(buffer, "test.pdf")).rejects.toThrow(
        "Mistral OCR nerozpoznalo žiadny text",
      );
    });
  });

  describe("mistralConfigured and mistralModel functions", () => {
    it("should return false when API key is not set", async () => {
      const originalKey = process.env["MISTRAL_API_KEY"];
      delete process.env["MISTRAL_API_KEY"];

      try {
        const { mistralConfigured } = await import("@/lib/ai/mistral.server");
        expect(mistralConfigured()).toBe(false);
      } finally {
        if (originalKey) process.env["MISTRAL_API_KEY"] = originalKey;
      }
    });

    it("should return true when API key is set", async () => {
      process.env["MISTRAL_API_KEY"] = "test_key";

      const { mistralConfigured } = await import("@/lib/ai/mistral.server");
      expect(mistralConfigured()).toBe(true);
    });

    it("should return default model when MISTRAL_MODEL is not set", async () => {
      const originalModel = process.env["MISTRAL_MODEL"];
      delete process.env["MISTRAL_MODEL"];

      try {
        const { mistralModel } = await import("@/lib/ai/mistral.server");
        expect(mistralModel()).toBe("mistral-large-latest");
      } finally {
        if (originalModel) process.env["MISTRAL_MODEL"] = originalModel;
      }
    });

    it("should return custom model when MISTRAL_MODEL is set", async () => {
      process.env["MISTRAL_MODEL"] = "mistral-small-latest";

      const { mistralModel } = await import("@/lib/ai/mistral.server");
      expect(mistralModel()).toBe("mistral-small-latest");
    });
  });
});
