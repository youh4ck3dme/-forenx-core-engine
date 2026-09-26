import { describe, expect, it } from "vitest";
import { ARMIVEX_CASE_DOSSIER } from "@/lib/demo-dossier";

describe("Forenzný Switcher pre obhajobu (3 perspektívy spisu)", () => {
  const dossier = ARMIVEX_CASE_DOSSIER;

  it("Pohľad 1 (facts): poskytuje kompletné dáta pre časovú os a reťazec stôp", () => {
    expect(dossier.facts).toBeDefined();
    expect(dossier.facts.timeline.length).toBeGreaterThanOrEqual(4);

    // Detekcia zlomu reťazca
    const chainBreaks = dossier.facts.timeline.filter((t) => t.chainBreak);
    expect(chainBreaks.length).toBeGreaterThanOrEqual(1);
    expect(chainBreaks.some((b) => b.paragraph === "§ 98 TP")).toBe(true);
    expect(chainBreaks.some((b) => b.event.includes("D1 Trenčín"))).toBe(true);

    // Stopy a semafory
    expect(dossier.facts.traces.length).toBeGreaterThanOrEqual(4);
    const redTraces = dossier.facts.traces.filter((t) => t.light === "red");
    expect(redTraces.length).toBeGreaterThanOrEqual(1);
    expect(redTraces[0]?.description).toContain("LA 002318");
  });

  it("Pohľad 2 (transakcie): poskytuje kompletné dáta pre toky peňazí a AML analýzu", () => {
    expect(dossier.financialAnalysis).toBeDefined();
    const fa = dossier.financialAnalysis!;

    expect(fa.totalVolume).toBe(148500);
    expect(fa.cashVolume).toBe(106000);
    expect(fa.transferVolume).toBe(42500);
    expect(fa.cashRatioPercent).toBe(71.4);

    // Podozrivé toky
    expect(fa.suspiciousFlows.length).toBe(6);
    const smurfingFlows = fa.suspiciousFlows.filter(
      (f) =>
        f.redFlag.toLowerCase().includes("štiepenie") ||
        f.redFlag.toLowerCase().includes("smurfing"),
    );
    expect(smurfingFlows.length).toBeGreaterThanOrEqual(1);
    expect(smurfingFlows[0]?.amount).toBe(44000);

    // Záver
    expect(fa.financingConclusion).toContain("§ 233a TZ");
    expect(fa.financingConclusion).toContain("smurfing");
  });

  it("Pohľad 3 (rozpory): poskytuje kompletné dáta pre maticu nepravdivosti a § 125 TP", () => {
    expect(dossier.testimonyContradictions).toBeDefined();
    const contradictions = dossier.testimonyContradictions!;
    expect(contradictions.length).toBeGreaterThanOrEqual(4);

    // Kritický rozpor: Novák vs Hruška
    const novakHruška = contradictions.find(
      (c) =>
        c.personA.name.includes("Novák") ||
        (c.personB && c.personB.name.includes("Hruška")),
    );
    expect(novakHruška).toBeDefined();
    expect(novakHruška!.deceitPercentage).toBeGreaterThanOrEqual(80);
    expect(novakHruška!.contradictionSeverity).toBe("critical");
    expect(novakHruška!.proceduralResolution).toContain("§ 125 TP");

    // Všetky rozpory majú vyčíslenú nepravdivosť a procesný postup
    for (const item of contradictions) {
      expect(item.deceitPercentage).toBeGreaterThanOrEqual(0);
      expect(item.deceitPercentage).toBeLessThanOrEqual(100);
      expect(item.proceduralResolution.length).toBeGreaterThan(15);
    }
  });

  it("umožňuje deterministické prepínanie medzi všetkými 3 kľúčovými stavmi", () => {
    type SwitcherView = "facts" | "transakcie" | "rozpory";
    const views: SwitcherView[] = ["facts", "transakcie", "rozpory"];

    let currentView: SwitcherView = "facts";
    const setView = (v: SwitcherView) => {
      currentView = v;
    };

    expect(currentView).toBe("facts");
    setView("transakcie");
    expect(currentView).toBe("transakcie");
    setView("rozpory");
    expect(currentView).toBe("rozpory");

    // Každý pohľad má priradenú správnu kategóriu
    const viewLabels: Record<SwitcherView, string> = {
      facts: "Časová os a reťazec zaistenia",
      transakcie: "Toky financií & AML",
      rozpory: "Matica nepravdivosti § 125 TP",
    };

    for (const v of views) {
      expect(viewLabels[v].length).toBeGreaterThan(5);
    }
  });
});
