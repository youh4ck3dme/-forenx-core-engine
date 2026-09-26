import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { regressionDossier } from "@/test-fixtures/autopilot";
import {
  runForensicAutopilotInner,
  handleSaveCaseDossier,
  extractSingleBufferText,
} from "@/lib/ai.functions";
import {
  buildAutopilotIdempotencyKey,
  PROMPT_VERSION,
} from "@/lib/autopilot-meta";

const { callLlm, extractWithOcrFallback } = vi.hoisted(() => ({
  callLlm: vi.fn(),
  extractWithOcrFallback: vi.fn(),
}));
vi.mock("@/lib/ai/llm.server", () => ({ callLlm, extractWithOcrFallback }));

function database() {
  const read = vi
    .fn()
    .mockResolvedValue({ data: { id: "regression-case" }, error: null });
  const write = vi
    .fn()
    .mockResolvedValue({ error: null, data: [{ id: "regression-case" }] });
  const update = vi.fn(() => ({
    eq: vi.fn(() => {
      const result = write();
      return Object.assign(result, { select: () => result });
    }),
  }));
  const from = vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: read })) })),
    update,
  }));
  return { supabase: { from }, read, write, update };
}
const input = {
  caseId: "regression-case",
  documentText: "Fiktívna zápisnica o platbe 100 EUR. ".repeat(4),
  documentIds: ["fixture.txt"],
};
const ok = () => ({
  status: "ok",
  content: JSON.stringify(regressionDossier()),
  model: "fixture-model",
  provider: "mock",
});

describe("Autopilot regression: real orchestration, mocked AI/database", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callLlm.mockReset().mockResolvedValue(ok());
    extractWithOcrFallback.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("Network forbidden in regression tests");
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("extracts uploaded text, analyzes, attaches provenance and saves the exact dossier", async () => {
    const extracted = await extractSingleBufferText(
      "fixture.txt",
      undefined,
      input.documentText,
    );
    const db = database();
    const result = await runForensicAutopilotInner(
      { ...input, documentText: extracted.text },
      { ...db, userId: "test-user" },
    );
    expect(result.saveStatus).toBe("saved");
    expect(result.warnings).toEqual([]);
    expect(result.dossier.analysisMeta).toMatchObject({
      promptVersion: PROMPT_VERSION,
      model: "fixture-model",
      documentIds: ["fixture.txt"],
      analysisStatus: "complete",
      sourceReferences: [
        "fixture.txt · s.1 · „Platba 100 EUR“",
        "fixture.txt · s.1 · „Referencia platby“",
        "fixture.txt · s.1 · „100 EUR“",
      ],
      idempotencyKey: await buildAutopilotIdempotencyKey(input),
      truncation: { truncated: false, inputChars: input.documentText.length },
    });
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ forensic_dossier: result.dossier }),
    );
    expect(callLlm).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure once and merges distinct chunk results without duplicate facts", async () => {
    const second = regressionDossier();
    second.facts.timeline.push({
      time: "2026-01-02",
      event: "Druhá platba",
      source: "fixture.txt:2",
      chainBreak: true,
    });
    callLlm
      .mockResolvedValueOnce({ status: "error", message: "Transient" })
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce({ ...ok(), content: JSON.stringify(second) });
    const result = await runForensicAutopilotInner(
      { ...input, documentText: "x".repeat(25001) },
      { ...database(), userId: "test-user" },
    );
    expect(callLlm).toHaveBeenCalledTimes(3);
    expect(callLlm.mock.calls[0]).toEqual(callLlm.mock.calls[1]);
    expect(result.dossier.facts.timeline).toHaveLength(2);
    expect(result.dossier.analysisMeta?.chunks.map((c) => c.status)).toEqual([
      "ok",
      "ok",
    ]);
    expect(result.warnings.join(" ")).toMatch(/rozdelený/);
  });

  it("passes image OCR text into analysis and reports OCR failure without AI analysis", async () => {
    extractWithOcrFallback.mockResolvedValueOnce(input.documentText);
    const extracted = await extractSingleBufferText(
      "scan.png",
      Buffer.from("fixture-image").toString("base64"),
    );
    expect(extracted.usedOcr).toBe(true);
    expect(extractWithOcrFallback).toHaveBeenCalledWith(
      Buffer.from("fixture-image"),
      "scan.png",
    );
    await runForensicAutopilotInner(
      { ...input, documentText: extracted.text },
      { ...database(), userId: "test-user" },
    );
    expect(JSON.stringify(callLlm.mock.calls)).toContain(
      input.documentText.trim(),
    );
    callLlm.mockClear();
    extractWithOcrFallback.mockRejectedValueOnce(new Error("OCR unavailable"));
    await expect(
      extractSingleBufferText(
        "scan.png",
        Buffer.from("fixture-image").toString("base64"),
      ),
    ).rejects.toThrow("OCR unavailable");
    expect(callLlm).not.toHaveBeenCalled();
  });

  it("caps the document at 80k and each AI chunk at 25k with a visible warning", async () => {
    const result = await runForensicAutopilotInner(
      { ...input, documentText: "x".repeat(80000) + "OMITTED_SENTINEL" },
      { ...database(), userId: "test-user" },
    );
    expect(callLlm).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(callLlm.mock.calls)).not.toContain(
      "OMITTED_SENTINEL",
    );
    expect(result.truncation).toMatchObject({
      analyzedChars: 80000,
      truncated: true,
      chunkCount: 4,
    });
    expect(result.dossier.analysisMeta?.chunks.map((c) => c.charCount)).toEqual(
      [25000, 25000, 25000, 5000],
    );
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it.each(["timeout", "invalid-json", "error"])(
    "preserves usable chunks and reports partial on %s",
    async (failure) => {
      callLlm
        .mockResolvedValueOnce(ok())
        .mockResolvedValue(
          failure === "invalid-json"
            ? { ...ok(), content: "not JSON" }
            : { status: failure, message: "Chunk failed" },
        );
      const result = await runForensicAutopilotInner(
        { ...input, documentText: "x".repeat(25001) },
        { ...database(), userId: "test-user" },
      );
      expect(result.dossier.analysisMeta?.analysisStatus).toBe("partial");
      expect(result.dossier.analysisMeta?.chunks[1]?.status).toBe("failed");
      expect(result.warnings.join(" ")).toMatch(/čiastočný/);
      expect(result.dossier.facts.timeline).toHaveLength(1);
      expect(callLlm).toHaveBeenCalledTimes(failure === "error" ? 3 : 2);
    },
  );

  it("does not save if all chunks fail", async () => {
    const db = database();
    callLlm.mockResolvedValue({
      status: "error",
      message: "Provider unavailable",
    });
    await expect(
      runForensicAutopilotInner(input, { ...db, userId: "test-user" }),
    ).rejects.toThrow("Provider unavailable");
    expect(callLlm).toHaveBeenCalledTimes(2);
    expect(db.update).not.toHaveBeenCalled();
  });

  it.each(["short", "forbidden"])(
    "rejects %s input before calling AI",
    async (mode) => {
      const db = database();
      if (mode === "forbidden")
        db.read.mockResolvedValue({ data: null, error: null });
      await expect(
        runForensicAutopilotInner(
          {
            ...input,
            documentText: mode === "short" ? "x" : input.documentText,
          },
          { ...db, userId: "test-user" },
        ),
      ).rejects.toThrow();
      expect(callLlm).not.toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
    },
  );

  it.each(["returned-error", "exception"])(
    "returns a usable dossier and explicit save error on %s, then retries saving without AI",
    async (mode) => {
      const db = database();
      if (mode === "exception")
        db.write.mockRejectedValueOnce(new Error("Database unavailable"));
      else
        db.write.mockResolvedValueOnce({
          data: null,
          error: { message: "Database unavailable" },
        });
      const result = await runForensicAutopilotInner(input, {
        ...db,
        userId: "test-user",
      });
      expect(result).toMatchObject({
        success: true,
        saveStatus: "failed",
        saveError: "Database unavailable",
      });
      expect(
        await handleSaveCaseDossier(
          { caseId: input.caseId, dossier: result.dossier },
          db.supabase,
        ),
      ).toMatchObject({ success: true });
      expect(db.update).toHaveBeenCalledTimes(2);
      expect(callLlm).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["isDemo", "status"])(
    "blocks demo saving via %s before touching the database",
    async (flag) => {
      const dossier = regressionDossier();
      if (flag === "isDemo") dossier.analysisMeta!.isDemo = true;
      else dossier.analysisMeta!.analysisStatus = "demo";
      const db = database();
      await expect(
        handleSaveCaseDossier({ caseId: input.caseId, dossier }, db.supabase),
      ).rejects.toThrow(/Syntetická ukážka/);
      expect(db.supabase.from).not.toHaveBeenCalled();
    },
  );

  it.each(["current", "demo"])(
    "explicitly skips persistence for %s",
    async (caseId) => {
      const db = database();
      const result = await runForensicAutopilotInner(
        { ...input, caseId },
        { ...db, userId: "test-user" },
      );
      expect(result.saveStatus).toBe("skipped");
      expect(db.update).not.toHaveBeenCalled();
    },
  );

  it("separates idempotency keys by case, prompt version and equal-length text changes", async () => {
    const key = await buildAutopilotIdempotencyKey({
      ...input,
      promptVersion: "v1",
    });
    for (const changed of [
      { caseId: "other" },
      { promptVersion: "v2" },
      { documentText: input.documentText.replace("100", "200") },
    ]) {
      expect(
        await buildAutopilotIdempotencyKey({
          ...input,
          promptVersion: "v1",
          ...changed,
        }),
      ).not.toBe(key);
    }
  });
});
