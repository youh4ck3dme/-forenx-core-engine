import { describe, expect, it } from "vitest";
import {
  ARMIVEX_CROSS_CONTRADICTIONS,
  getCrossContradictionStats,
} from "@/lib/cross-contradictions";

describe("cross-contradictions (Krížová konfrontačná matica rozporov § 125 TP)", () => {
  it("obsahuje všetkých 6 kľúčových rozporov medzi obvinenými a svedkami", () => {
    expect(ARMIVEX_CROSS_CONTRADICTIONS).toHaveLength(6);
    const ids = ARMIVEX_CROSS_CONTRADICTIONS.map((c) => c.id);
    expect(ids).toEqual(["TC-01", "TC-02", "TC-03", "TC-04", "TC-05", "TC-06"]);
  });

  it("každý rozpor má kompletnú procesnú štruktúru pre súdne dokazovanie", () => {
    for (const item of ARMIVEX_CROSS_CONTRADICTIONS) {
      expect(item.id).toMatch(/^TC-\d{2}$/);
      expect(item.topic.length).toBeGreaterThan(10);

      // Osoba A
      expect(item.personA.name.length).toBeGreaterThan(3);
      expect(item.personA.status.length).toBeGreaterThan(3);
      expect(item.personA.claim.length).toBeGreaterThan(15);

      // Osoba B
      expect(item.personB).toBeDefined();
      if (item.personB) {
        expect(item.personB.name.length).toBeGreaterThan(3);
        expect(item.personB.status.length).toBeGreaterThan(3);
        expect(item.personB.claim.length).toBeGreaterThan(15);
      }

      // Fyzický a listinný dôkazový stav
      expect(item.factualRecord.length).toBeGreaterThan(20);

      // Miera klamstva / účelovosti a závažnosť
      expect(item.deceitPercentage).toBeGreaterThanOrEqual(50);
      expect(item.deceitPercentage).toBeLessThanOrEqual(100);
      expect(["critical", "high", "medium", "low"]).toContain(
        item.contradictionSeverity,
      );

      // Procesný návrh podľa Trestného poriadku
      expect(item.proceduralResolution).toContain("TP");
      expect(item.proceduralResolution.length).toBeGreaterThan(20);
    }
  });

  it("pokrýva kľúčových aktérov kauzy Armivex / Novák", () => {
    const allText = JSON.stringify(ARMIVEX_CROSS_CONTRADICTIONS);
    expect(allText).toContain("Peter Novák");
    expect(allText).toContain("Marek Hruška");
    expect(allText).toContain("Michal Ondruš");
    expect(allText).toContain("Igor Malina");
    expect(allText).toContain("Denis Koval");
    expect(allText).toContain("ARMIVEX");
    expect(allText).toContain("PETRIS-SLOVAKIA");
    expect(allText).toContain("Shadowarms");
  });

  it("správne počíta štatistiky závažnosti a priemerné percento klamstva", () => {
    const stats = getCrossContradictionStats(ARMIVEX_CROSS_CONTRADICTIONS);
    expect(stats.total).toBe(6);
    expect(stats.critical).toBe(3);
    expect(stats.high).toBe(3);
    expect(stats.medium).toBe(0);
    expect(stats.avgDeceitPercentage).toBe(91); // Math.round((95 + 92 + 88 + 95 + 90 + 85) / 6) = 91
  });

  it("správne ošetrí prázdne pole rozporov", () => {
    const emptyStats = getCrossContradictionStats([]);
    expect(emptyStats).toEqual({
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      avgDeceitPercentage: 0,
    });
  });

  it("každý procesný návrh odkazuje na § 125 TP (konfrontácia) alebo priame vyšetrovacie úkony", () => {
    const resolutionsWith125OrExpertise = ARMIVEX_CROSS_CONTRADICTIONS.filter(
      (c) =>
        c.proceduralResolution.includes("§ 125") ||
        c.proceduralResolution.includes("§ 142") ||
        c.proceduralResolution.includes("§ 119") ||
        c.proceduralResolution.includes("§ 89"),
    );
    expect(resolutionsWith125OrExpertise.length).toBe(6);
  });
});
