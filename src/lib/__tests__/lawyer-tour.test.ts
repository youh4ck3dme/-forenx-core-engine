import { describe, expect, it } from "vitest";
import { LAWYER_TOUR_STEPS } from "@/lib/lawyer-tour-steps";

describe("LawyerTourGuide - 6-krokový interaktívny sprievodca pre obhajcu", () => {
  it("obsahuje presne 6 definovaných krokov", () => {
    expect(LAWYER_TOUR_STEPS).toHaveLength(6);
    const ids = LAWYER_TOUR_STEPS.map((s) => s.id);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("každý krok má platné targetId, titulok, zhrnutie, odznak a právny odkaz", () => {
    for (const step of LAWYER_TOUR_STEPS) {
      expect(step.id).toBeGreaterThanOrEqual(1);
      expect(step.id).toBeLessThanOrEqual(6);
      expect(step.title.length).toBeGreaterThan(5);
      expect(step.summary.length).toBeGreaterThan(20);
      expect(step.targetId).toMatch(/^tour-[a-z-]+$/);
      expect(step.badge.length).toBeGreaterThan(2);
      expect(step.proceduralParagraph).toBeDefined();
      expect(step.proceduralParagraph).toContain("§");
      expect(step.lawyerTip.length).toBeGreaterThan(15);
    }
  });

  it("Krok 1 pokrýva nahrávanie spisu a forenzný sandbox", () => {
    const step1 = LAWYER_TOUR_STEPS.find((s) => s.id === 1)!;
    expect(step1.targetId).toBe("tour-upload-zone");
    expect(step1.title).toContain("Nahratie spisu");
    expect(step1.proceduralParagraph).toContain("§ 119");
    expect(step1.lawyerTip).toContain("OCR");
    expect(step1.actionLabel).toContain("modelové dáta");
  });

  it("Krok 2 pokrýva rekonštrukciu časovej osi a reťazec stôp", () => {
    const step2 = LAWYER_TOUR_STEPS.find((s) => s.id === 2)!;
    expect(step2.targetId).toBe("tour-timeline");
    expect(step2.title).toContain("časová os");
    expect(step2.proceduralParagraph).toContain("§ 98");
    expect(step2.lawyerTip).toContain("reťazci zabezpečenia");
  });

  it("Krok 3 pokrýva switcher entít, tokov a prania špinavých peňazí", () => {
    const step3 = LAWYER_TOUR_STEPS.find((s) => s.id === 3)!;
    expect(step3.targetId).toBe("tour-switcher");
    expect(step3.title).toContain("Entity a finančné toky");
    expect(step3.proceduralParagraph).toContain("§ 233");
    expect(step3.lawyerTip).toContain("hotovosti");
  });

  it("Krok 4 pokrýva maticu nepravdivosti a konfrontáciu podľa § 125 TP", () => {
    const step4 = LAWYER_TOUR_STEPS.find((s) => s.id === 4)!;
    expect(step4.targetId).toBe("tour-contradictions");
    expect(step4.title).toContain("Matica rozporov");
    expect(step4.proceduralParagraph).toContain("§ 125");
    expect(step4.summary).toContain("85 %");
  });

  it("Krok 5 pokrýva procesný audit spisu a simulator protiúderov obhajoby", () => {
    const step5 = LAWYER_TOUR_STEPS.find((s) => s.id === 5)!;
    expect(step5.targetId).toBe("tour-legal-audit");
    expect(step5.title).toContain("Právny audit");
    expect(step5.proceduralParagraph).toContain("§ 168");
    expect(step5.summary).toContain("Likelihood Ratio");
  });

  it("Krok 6 pokrýva 1-klikový export AI pracovnej analýzy so SHA-256 pečaťou", () => {
    const step6 = LAWYER_TOUR_STEPS.find((s) => s.id === 6)!;
    expect(step6.targetId).toBe("tour-export-pdf");
    expect(step6.title).toContain("export AI pracovnej analýzy");
    expect(step6.proceduralParagraph).toContain("§ 168");
    expect(step6.lawyerTip).toContain("SHA-256");
    expect(step6.actionLabel).toContain("PDF");
    expect(step6.summary).toContain("nie znalecký posudok");
  });

  it("kroky majú unikátne target IDs na namapovanie v DOM", () => {
    const targetIds = LAWYER_TOUR_STEPS.map((s) => s.targetId);
    const uniqueIds = new Set(targetIds);
    expect(uniqueIds.size).toBe(LAWYER_TOUR_STEPS.length);
  });
});
