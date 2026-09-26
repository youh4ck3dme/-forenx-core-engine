import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  extractRootJsonText,
  parseAiJson,
  stripCodeFences,
} from "@/lib/ai/parse-json";
import {
  assessControlReadiness,
  CASE_NOT_READY_MESSAGE,
  NO_TRANSACTION_DATA_MESSAGE,
  snapshotFromCounts,
} from "@/lib/ai/control-readiness";
import { aiTaskSchemas } from "@/lib/ai/task-schemas";

const normalizeSchema = aiTaskSchemas.normalize_descriptions;
const altSchema = aiTaskSchemas.alt_devil;
const admissSchema = aiTaskSchemas.admiss_audit;

describe("parseAiJson — spoločný parser AI kontrol", () => {
  it("prijme platný čistý JSON", () => {
    const raw = JSON.stringify({
      suggestions: [
        {
          transaction: "T1",
          normalized: "prevod",
          confidence: "high",
        },
      ],
      unverified: [],
    });
    const result = parseAiJson(raw, normalizeSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.suggestions).toHaveLength(1);
      expect(result.data.suggestions[0]?.transaction).toBe("T1");
    }
  });

  it("odstráni ohradu ```json", () => {
    const inner = JSON.stringify({
      suggestions: [],
      unverified: [],
    });
    const raw = "```json\n" + inner + "\n```";
    expect(stripCodeFences(raw).startsWith("{")).toBe(true);
    const result = parseAiJson(raw, normalizeSchema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.suggestions).toEqual([]);
  });

  it("odstráni úvodnú prózu pred JSON", () => {
    const raw =
      "Tu je výsledok kontroly:\n\n" +
      JSON.stringify({
        overallStatus: "admissible",
        score: 90,
        defects: [],
        courtReadySummary: "OK",
        unverified: [],
        cited: [],
      });
    expect(extractRootJsonText(raw)?.startsWith("{")).toBe(true);
    const result = parseAiJson(raw, admissSchema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.score).toBe(90);
  });

  it("odmietne neplatný JSON s čitateľnou diagnostikou", () => {
    const result = parseAiJson("{nie-json", normalizeSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/JSON/i);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics).not.toMatch(/MISTRAL|sk-|api[_-]?key/i);
    }
  });

  it("prijme platný JSON s prázdnymi poľami (NO_FINDINGS kandidát)", () => {
    const result = parseAiJson(
      JSON.stringify({ suggestions: [], unverified: [] }),
      normalizeSchema,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.suggestions).toEqual([]);
  });

  it("odmietne nesprávnu štruktúru", () => {
    const result = parseAiJson(
      JSON.stringify({ zaver: "vinný", dovod: 1 }),
      altSchema,
    );
    // alt_devil má defaulty — prázdne hypotheses sú OK; zlé typy v known fields nie
    // Objekt bez hypotheses je platný (default []). Overíme inú schému s typovou chybou.
    const bad = parseAiJson(
      JSON.stringify({ suggestions: "nie-pole" }),
      normalizeSchema,
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.error).toMatch(/štruktúr/i);
      expect(bad.diagnostics).not.toMatch(/system prompt|ROLE:/i);
    }
    expect(result.ok).toBe(true);
  });

  it("odmietne prázdny vstup", () => {
    const result = parseAiJson("   ", normalizeSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics).toBe("empty_content");
  });
});

describe("assessControlReadiness — server guard predpoklady", () => {
  it("prázdny prípad → NOT_READY pre všetky kontroly", () => {
    const snap = snapshotFromCounts({
      entities: 0,
      transactions: 0,
      findings: 0,
      events: 0,
      hasDossier: false,
    });
    for (const task of [
      "case_summary",
      "normalize_descriptions",
      "admiss_audit",
      "alt_devil",
    ] as const) {
      const r = assessControlReadiness(task, snap);
      expect(r.ready).toBe(false);
      expect(r.status).toBe("NOT_READY");
      expect(r.message).toBe(
        task === "normalize_descriptions"
          ? NO_TRANSACTION_DATA_MESSAGE
          : CASE_NOT_READY_MESSAGE,
      );
      expect(r.missing.length).toBeGreaterThan(0);
    }
  });

  it("len dokument bez analýzy (žiadne DB dáta) → NOT_READY", () => {
    // Prehliadač má text, ale case_entities / transactions / findings sú prázdne.
    const snap = snapshotFromCounts({
      entities: 0,
      transactions: 0,
      findings: 0,
      events: 0,
      hasDossier: false,
    });
    const r = assessControlReadiness("alt_devil", snap);
    expect(r.ready).toBe(false);
    expect(r.missing.join(" ")).toMatch(
      /case_entities|case_transactions|findings/,
    );
  });

  it("po analýze s entitami: alt_devil READY, normalize bez transakcií NOT_READY", () => {
    const snap = snapshotFromCounts({
      entities: 3,
      transactions: 0,
      findings: 1,
      events: 2,
      hasDossier: true,
    });
    expect(assessControlReadiness("alt_devil", snap).ready).toBe(true);
    expect(assessControlReadiness("case_summary", snap).ready).toBe(true);
    expect(assessControlReadiness("admiss_audit", snap).ready).toBe(true);
    const norm = assessControlReadiness("normalize_descriptions", snap);
    expect(norm.ready).toBe(false);
    expect(norm.message).toBe(NO_TRANSACTION_DATA_MESSAGE);
    expect(norm.missing.some((m) => m.includes("case_transactions"))).toBe(
      true,
    );
  });

  it("s transakciami je normalize READY", () => {
    const snap = snapshotFromCounts({
      entities: 1,
      transactions: 4,
      findings: 0,
    });
    expect(assessControlReadiness("normalize_descriptions", snap).ready).toBe(
      true,
    );
  });
});

describe("schémy AI kontrol — prázdne polia a predvolené hodnoty", () => {
  it("alt_devil prijme prázdne hypotheses (bez vynútenia 2)", () => {
    const parsed = altSchema.safeParse({ hypotheses: [], unverified: [] });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.hypotheses).toEqual([]);
  });

  it("alt_devil prijme dve hypotézy pri existujúcich dôkazoch", () => {
    const parsed = altSchema.safeParse({
      hypotheses: [
        {
          id: "h1",
          title: "A",
          scenario: "scenár A",
          explainedEvidence: ["T1"],
          requiredTracesIfTrue: [],
          rebuttalTest: "test",
        },
        {
          id: "h2",
          title: "B",
          scenario: "scenár B",
          explainedEvidence: ["S1"],
          requiredTracesIfTrue: [],
          rebuttalTest: "test",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("admiss_audit doplní predvolené hodnoty pri prázdnom objekte", () => {
    const parsed = admissSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.defects).toEqual([]);
      expect(parsed.data.overallStatus).toBe("admissible");
      expect(parsed.data.score).toBe(100);
    }
  });
});

describe("upload → analýza → kontroly (logický tok)", () => {
  it("pred persistenciou kontroly nie sú READY; po entitách áno", () => {
    const before = snapshotFromCounts({
      entities: 0,
      transactions: 0,
      findings: 0,
      hasDossier: false,
    });
    expect(assessControlReadiness("case_summary", before).ready).toBe(false);

    // Po autopilot + applyAiResultsToCase sú entity v DB.
    const after = snapshotFromCounts({
      entities: 2,
      transactions: 0,
      findings: 0,
      events: 3,
      hasDossier: true,
    });
    expect(assessControlReadiness("case_summary", after).ready).toBe(true);
    expect(assessControlReadiness("admiss_audit", after).ready).toBe(true);
    // Normalize stále čaká na transakcie — nevymýšľa ich.
    expect(assessControlReadiness("normalize_descriptions", after).ready).toBe(
      false,
    );
  });

  it("parseAiJson + prázdne suggestions → platný výsledok (nie parse error)", () => {
    const fenced =
      "```json\n" +
      JSON.stringify({ suggestions: [], unverified: [] }) +
      "\n```";
    const parsed = parseAiJson(fenced, normalizeSchema);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      // UI / server mapuje toto na NO_FINDINGS, nie na failed.
      expect(parsed.data.suggestions).toHaveLength(0);
    }
  });
});

describe("parseAiJson — schema type guard", () => {
  it("funguje s ľubovoľnou Zod schémou", () => {
    const schema = z.object({ value: z.number().default(0) });
    const ok = parseAiJson('Tu: {"value": 3}', schema);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.data.value).toBe(3);
  });
});
