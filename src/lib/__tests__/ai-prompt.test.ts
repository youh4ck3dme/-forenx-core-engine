import { describe, expect, it } from "vitest";
import {
  AUTOPILOT_DOCUMENT_CHAR_LIMIT,
  buildUserPrompt,
  compactDocumentText,
  FORENSIC_AUTOPILOT_SYSTEM_PROMPT,
} from "@/lib/ai-prompt";

describe("ai-prompt (Forenzný Autopilot System Prompt & User Builder)", () => {
  it("obsahuje kľúčové paragrafy Trestného poriadku SR", () => {
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain("§ 95 TP");
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain("§ 98 TP");
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain("§ 100 TP");
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain("§ 119 TP");
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain("§ 120 TP");
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain("§ 168 TP");
  });

  it("definuje ENFSI Likelihood Ratio metodiku pre forenzné stopy", () => {
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain("LR > 1 000 000");
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain("Nepriestrelné");
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain("Procesná mína");
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain("Zraniteľná");
  });

  it("zahŕňa audit kognitívnych skreslení (Bias Audit)", () => {
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain("CONFIRMATION BIAS");
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain("PROSECUTOR'S FALLACY");
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain("ANCHORING");
  });

  it("vymedzuje striktný JSON výstup pre 3 karty a rozsudkový formát", () => {
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain('"defendabilityIndex"');
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain('"facts"');
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain('"defenseAttack"');
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain('"evidenceStrength"');
    expect(FORENSIC_AUTOPILOT_SYSTEM_PROMPT).toContain('"judgeReadyText"');
  });

  it("buildUserPrompt neopakuje systémový prompt a oreže dlhý spis", () => {
    const longText = "A".repeat(150_000);
    const prompt = buildUserPrompt(longText);

    expect(prompt).toContain("VSTUPNÝ TEXT SPISU");
    expect(prompt).toContain("VRÁŤ LEN ČISTÝ JSON");
    expect(prompt).not.toContain("FORENZNÝ AUTOPILOT");
    expect(prompt.length).toBeLessThan(AUTOPILOT_DOCUMENT_CHAR_LIMIT + 1500);
  });

  it("buildUserPrompt označí časť spisu a zakáže dopĺňanie z iných častí", () => {
    const prompt = buildUserPrompt("text spisu", { index: 2, total: 3 });
    expect(prompt).toContain("časť 2 z 3");
    expect(prompt).toContain("NEUVEDENÉ");
    expect(buildUserPrompt("text spisu", { index: 1, total: 1 })).not.toContain(
      "ROZSAH:",
    );
  });

  it("compactDocumentText zmaže prázdne riadky navyše", () => {
    expect(compactDocumentText("a\n\n\n\nb  \n")).toBe("a\n\nb");
  });
});
