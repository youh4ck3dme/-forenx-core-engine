import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { regressionDossier } from "@/test-fixtures/autopilot";
import {
  buildReportHTML,
  computeDossierSha256,
  sha256Hex,
} from "@/lib/export-pdf";

describe("PDF provenance regression", () => {
  it("renders model, prompt, documents, sources, partial status and truncation warning", () => {
    const d = regressionDossier();
    d.analysisMeta!.analysisStatus = "partial";
    d.analysisMeta!.truncation = {
      ...d.analysisMeta!.truncation,
      truncated: true,
      inputChars: 90000,
      analyzedChars: 80000,
      chunkCount: 4,
    };
    const html = buildReportHTML(d);
    for (const value of [
      "fixture-model",
      "fixture-v1",
      "fixture.txt",
      "fixture.txt:1",
      "fixture.txt · s.1 · „Platba 100 EUR“",
      "Chronológia skutkov",
      "Zdroj (dokument · strana · výňatok)",
      "partial",
      "80000",
      "90000",
      "Upozornenie na skrátenie",
      "Doložka AI pôvodu",
      "AI pracovná analýza",
      computeDossierSha256(d),
    ])
      expect(html).toContain(value);
    expect(html).toContain("Bankový záznam");
    expect(html).toContain("fixture.txt · s.1 · „100 EUR“");
    expect(html).toContain("Zdroj:</strong> <code>fixture.txt · s.1");
    expect(html).not.toMatch(/<h[1-6][^>]*>[^<]*znalecký posudok/i);
  });
  it("marks demo exports and still exports older dossiers without metadata", () => {
    const d = regressionDossier();
    d.analysisMeta!.isDemo = true;
    expect(buildReportHTML(d)).toContain("SYNTETICKÁ UKÁŽKA");
    delete d.analysisMeta;
    expect(buildReportHTML(d)).toContain("SHA-256");
    expect(buildReportHTML(d)).not.toContain("undefined");
  });
  it.each(["", "abc", "Žilina — dôkazy 🔎", "x".repeat(1000)])(
    "matches Node SHA-256 for %j",
    (text) => {
      expect(sha256Hex(text)).toBe(
        createHash("sha256").update(text).digest("hex"),
      );
    },
  );
  it("changes the dossier hash when nested evidence or provenance changes", () => {
    const d = regressionDossier();
    const hash = computeDossierSha256(d);
    d.facts.timeline[0]!.event = "Platba 999 EUR";
    expect(computeDossierSha256(d)).not.toBe(hash);
    const meta = regressionDossier();
    meta.analysisMeta!.model = "different-model";
    expect(computeDossierSha256(meta)).not.toBe(hash);
  });
  it("ignores property insertion order at every level when hashing", () => {
    const d = regressionDossier();
    const reordered = structuredClone(d);
    reordered.facts = { traces: d.facts.traces, timeline: d.facts.timeline };
    expect(computeDossierSha256(reordered)).toBe(computeDossierSha256(d));
  });
});
