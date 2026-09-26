import { describe, expect, it } from "vitest";
import {
  DOSSIER_SCHEMA_ERROR,
  parseForensicDossier,
  stripCodeFences,
} from "@/lib/forensic-dossier.schema";

const valid = {
  caseId: "c1",
  facts: { timeline: [{ date: "2026-01-01", event: "prevod" }], traces: [] },
  defenseAttack: { overallRisk: "VYSOKÉ", attacks: [] },
  evidenceStrength: { traces: [], paragraphs: [] },
  judgeReadyText: { summary: "text" },
};

describe("validácia odpovede forenzného autopilota", () => {
  it("prijme platný dossier", () => {
    const parsed = parseForensicDossier(JSON.stringify(valid));
    expect(parsed.facts.timeline).toHaveLength(1);
  });

  it("odstráni značky ```json", () => {
    const raw = "```json\n" + JSON.stringify(valid) + "\n```";
    expect(stripCodeFences(raw).startsWith("{")).toBe(true);
    expect(parseForensicDossier(raw).caseId).toBe("c1");
  });

  it("odmietne halucinovanú štruktúru", () => {
    const bogus = JSON.stringify({ zaver: "vinný", dovod: "lebo" });
    expect(() => parseForensicDossier(bogus)).toThrow(DOSSIER_SCHEMA_ERROR);
  });

  it("odmietne chýbajúcu časovú os", () => {
    const broken = JSON.stringify({ ...valid, facts: { traces: [] } });
    expect(() => parseForensicDossier(broken)).toThrow(DOSSIER_SCHEMA_ERROR);
  });

  it("odmietne odpoveď, ktorá nie je JSON", () => {
    expect(() => parseForensicDossier("Prepáčte, nemôžem pomôcť.")).toThrow(
      "Odpoveď AI nebola platným JSON.",
    );
  });
});
