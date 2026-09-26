import { describe, it, expect } from "vitest";
import type {
  InvestigativeQuestionAnswer,
  TestimonyContradiction,
  FinancialTransactionSummary,
} from "../types";

describe("Testimony & Financial Analysis Models", () => {
  it("overuje štruktúru 3 vyšetrovacích otázok (Source of Truth ÚBOK)", () => {
    const q1: InvestigativeQuestionAnswer = {
      questionNumber: 1,
      question: "1. Kto zbrane nakupoval a odovzdával?",
      answer:
        "Peter Novák nakupoval, Denis Koval distribuoval z BMW na odpočívadlách D1.",
      identifiedPersons: ["Peter Novák", "Denis Koval", "Marek Hruška"],
      directEvidence: ["Výpoveď Hrušku", "Kúpne zmluvy", "Pečiatky v BMW"],
      unverifiedHypotheses: ["Odberatelia na D1"],
      missingEvidence: ["Grafologický posudok podpisov"],
      confidenceLevel: 95,
    };

    expect(q1.questionNumber).toBe(1);
    expect(q1.confidenceLevel).toBeGreaterThanOrEqual(90);
    expect(q1.identifiedPersons).toContain("Peter Novák");
    expect(q1.directEvidence.length).toBeGreaterThan(0);
  });

  it("overuje výpočet a prahy miery nepravdivosti v rozporoch výpovedí", () => {
    const contradiction: TestimonyContradiction = {
      id: "TC-01",
      topic: "Osobná prítomnosť v predajni ARMIVEX Žilina",
      personA: {
        name: "Peter Novák",
        status: "obvinený",
        claim: "V predajni v Žiline som nikdy nebol a Hrušku nepoznám.",
      },
      personB: {
        name: "Marek Hruška",
        status: "konateľ ARMIVEX",
        claim: "Novák bol 3x osobne v predajni, predložil OP a ZP.",
      },
      factualRecord:
        "Hruška stotožnil Nováka, v hárkoch sú podpisy a ZP Nováka.",
      deceitPercentage: 95,
      contradictionSeverity: "critical",
      proceduralResolution: "Konfrontácia § 125 TP a grafológia § 142 TP.",
    };

    expect(contradiction.deceitPercentage).toBe(95);
    expect(contradiction.deceitPercentage).toBeGreaterThanOrEqual(85);
    expect(contradiction.contradictionSeverity).toBe("critical");
    expect(contradiction.proceduralResolution).toContain("§ 125 TP");
  });

  it("overuje matematickú konzistenciu a AML indikátory finančnej analýzy", () => {
    const fin: FinancialTransactionSummary = {
      totalVolume: 148500,
      cashVolume: 106000,
      transferVolume: 42500,
      cashRatioPercent: 71.4,
      suspiciousFlows: [
        {
          id: "SF-01",
          date: "2025-01-22",
          payer: "Anonym",
          recipient: "VELTRA",
          amount: 32000,
          method: "cash_deposit",
          purpose: "Hotovosť pred 1. odberom",
          redFlag: "Vklad bez pôvodu peňazí",
        },
        {
          id: "SF-03",
          date: "2025-04-10",
          payer: "Smurfing",
          recipient: "VELTRA",
          amount: 44000,
          method: "cash_deposit",
          purpose: "Štiepené vklady",
          redFlag: "Štiepenie pod 15k limit AML",
        },
      ],
      financingConclusion:
        "Klasické znaky legalizácie príjmov z TČ (§ 233a TZ).",
    };

    expect(fin.cashVolume + fin.transferVolume).toBe(fin.totalVolume);
    const calculatedRatio = Number(
      ((fin.cashVolume / fin.totalVolume) * 100).toFixed(1),
    );
    expect(fin.cashRatioPercent).toBe(calculatedRatio);
    expect(fin.cashRatioPercent).toBeGreaterThan(50); // dominantný podiel hotovosti
    expect(fin.suspiciousFlows.length).toBeGreaterThanOrEqual(2);
    expect(fin.financingConclusion).toContain("§ 233a TZ");
  });
});
