import { describe, expect, it } from "vitest";
import { ARMIVEX_CASE_DOSSIER } from "@/lib/demo-dossier";
import {
  ARMIVEX_CROSS_CONTRADICTIONS,
  getCrossContradictionStats,
} from "@/lib/cross-contradictions";
import { LAWYER_TOUR_STEPS } from "@/lib/lawyer-tour-steps";

describe("Lawyer Workflow E2E — Kompletný proces obhajoby od spisu po rozsudok", () => {
  const dossier = ARMIVEX_CASE_DOSSIER;

  // ─────────────────────────────────────────────────────────────
  // 1. KROK: NAHRATIE A SPRACOVANIE SPISU V SANDBOXE (§ 119 TP)
  // ─────────────────────────────────────────────────────────────
  describe("Fáza 1: Ingescia a procesné spracovanie spisu", () => {
    it("spis obsahuje identifikačné znaky trestného konania PPZ ÚBOK", () => {
      expect(dossier.caseId).toContain("UBOK");
      expect(dossier.caseTitle).toContain("Armivex");
    });

    it("tri hlavné vyšetrovacie otázky majú vyčíslenú mieru istoty a priame dôkazy", () => {
      const answers = dossier.investigativeAnswers;
      expect(answers).toBeDefined();
      if (!answers) throw new Error("answers missing");

      // Q1: Kupujúci vs predávajúci
      expect(answers.q1_buyer_seller.confidenceLevel).toBeGreaterThanOrEqual(
        90,
      );
      expect(
        answers.q1_buyer_seller.directEvidence.length,
      ).toBeGreaterThanOrEqual(1);

      // Q2: Plánovač a koordinátor
      expect(
        answers.q2_planner_coordinator.confidenceLevel,
      ).toBeGreaterThanOrEqual(80);
      expect(
        answers.q2_planner_coordinator.identifiedPersons.length,
      ).toBeGreaterThanOrEqual(1);

      // Q3: Financovanie a hotovostné toky
      expect(answers.q3_financier.confidenceLevel).toBeGreaterThanOrEqual(85);
      expect(answers.q3_financier.directEvidence.length).toBeGreaterThanOrEqual(
        1,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. KROK: REKONŠTRUKCIA ČASOVEJ OSI A REŤAZEC STÔP (§ 98 TP)
  // ─────────────────────────────────────────────────────────────
  describe("Fáza 2: Rekonštrukcia časovej osi a integrita stôp", () => {
    it("odhaľuje kritický zlom v reťazci zaistenia zbraní na D1 Trenčín", () => {
      const breakEvent = dossier.facts.timeline.find(
        (t) => t.chainBreak && t.severity === "critical",
      );
      expect(breakEvent).toBeDefined();
      expect(breakEvent!.paragraph).toBe("§ 98 TP");
      expect(breakEvent!.event).toContain("BMW 7");
      expect(breakEvent!.source).toContain("Malina");
    });

    it("verifikuje balistické stopy zaistené v Španielsku (Europol)", () => {
      const glockTrace = dossier.facts.traces.find((t) => t.id === "TR-01");
      expect(glockTrace).toBeDefined();
      expect(glockTrace!.type).toBe("balistická");
      expect(glockTrace!.light).toBe("green");
      expect(glockTrace!.chainComplete).toBe(true);
      expect(glockTrace!.lr).toContain("> 1 000 000");

      const bookTrace = dossier.facts.traces.find((t) => t.id === "TR-03");
      expect(bookTrace).toBeDefined();
      expect(bookTrace!.light).toBe("red");
      expect(bookTrace!.chainComplete).toBe(false);
      expect(bookTrace!.paragraph).toBe("§ 98 TP");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. KROK: TOKY FINANCIÍ & DETEKCIA SMURFINGU (§ 233a TZ)
  // ─────────────────────────────────────────────────────────────
  describe("Fáza 3: Finančná forenzná analýza a pranie špinavých peňazí", () => {
    it("dokazuje 71.4 % podiel anonymných hotovostných vkladov pred nákupom zbraní", () => {
      const fa = dossier.financialAnalysis;
      expect(fa).toBeDefined();
      expect(fa!.cashRatioPercent).toBe(71.4);
      expect(fa!.cashVolume).toBe(106000);
      expect(fa!.totalVolume).toBe(148500);
    });

    it("identifikuje techniku štiepenia (smurfing) pod limit 15 000 €", () => {
      const smurfing = dossier.financialAnalysis?.suspiciousFlows.find(
        (f) => f.id === "SF-03",
      );
      expect(smurfing).toBeDefined();
      expect(smurfing!.amount).toBe(44000);
      expect(smurfing!.purpose).toContain("14 500 €");
      expect(smurfing!.redFlag).toContain("297/2008");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. KROK: KRÍŽOVÁ MATICA ROZPOROV A KONFRONTÁCIA (§ 125 TP)
  // ─────────────────────────────────────────────────────────────
  describe("Fáza 4: Krížový výsluch a matica nepravdivosti svedkov", () => {
    it("obsahuje 6 detailných rozporov s priamou konfrontáciou", () => {
      expect(ARMIVEX_CROSS_CONTRADICTIONS).toHaveLength(6);
      const stats = getCrossContradictionStats(ARMIVEX_CROSS_CONTRADICTIONS);
      expect(stats.total).toBe(6);
      expect(stats.critical).toBeGreaterThanOrEqual(2);
      expect(stats.avgDeceitPercentage).toBeGreaterThanOrEqual(75);
    });

    it("poskytuje právne návrhy pre obhajobu Petra Nováka voči Marekovi Hruškovi", () => {
      const tc01 = ARMIVEX_CROSS_CONTRADICTIONS.find((c) => c.id === "TC-01");
      expect(tc01).toBeDefined();
      expect(tc01!.personA.name).toContain("Peter Novák");
      expect(tc01!.personB?.name).toContain("Marek Hruška");
      expect(tc01!.deceitPercentage).toBe(95);
      expect(tc01!.proceduralResolution).toContain("§ 125 TP");
      expect(tc01!.proceduralResolution).toContain("písmoznalectva");
    });

    it("identifikuje zlyhanie pri rekognícii z fotografií (§ 126 TP)", () => {
      const tc02 = ARMIVEX_CROSS_CONTRADICTIONS.find((c) => c.id === "TC-02");
      expect(tc02).toBeDefined();
      expect(tc02!.proceduralResolution).toContain("§ 126 TP");
      expect(tc02!.proceduralResolution).toContain("rekogníci");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. KROK: PROCESNÝ AUDIT OBHAJOBY & ROZSUDOK (§ 168 TP)
  // ─────────────────────────────────────────────────────────────
  describe("Fáza 5: Simulátor útoku advokáta a rozsudkový formát", () => {
    it("spis má vypočítaný index obhájiteľnosti a realistické procesné riziko", () => {
      expect(dossier.defendabilityIndex).toBe(74);
      expect(dossier.defenseAttack.overallRisk).toBe("VYSOKÉ");
    });

    it("obsahuje 3 detailné scenáre obhajoby s pripraveným protiúderom", () => {
      expect(dossier.defenseAttack.attacks).toHaveLength(3);
      for (const atk of dossier.defenseAttack.attacks) {
        expect(atk.defenseClaim.length).toBeGreaterThan(20);
        expect(atk.counterStrike.length).toBeGreaterThan(30);
        expect(atk.evidenceGap.length).toBeGreaterThan(15);
        expect(atk.paragraph).toContain("TP");
      }
    });

    it("poskytuje kompletné znenie odôvodnenia rozsudku podľa § 168 TP", () => {
      const judge = dossier.judgeReadyText;
      expect(judge.skutkovyStav.length).toBeGreaterThan(50);
      expect(judge.vyporiadanie.length).toBeGreaterThan(50);
      expect(judge.vedecke.length).toBeGreaterThan(50);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. KROK: INTEGROVANÝ SPRIEVODCA SPISOM (TOUR GUIDE)
  // ─────────────────────────────────────────────────────────────
  describe("Fáza 6: Integrovaný 6-krokový sprievodca spisom", () => {
    it("prepája všetky kroky od nahrávania po PDF export", () => {
      const stepTargets = LAWYER_TOUR_STEPS.map((s) => s.targetId);
      expect(stepTargets).toEqual([
        "tour-upload-zone",
        "tour-timeline",
        "tour-switcher",
        "tour-contradictions",
        "tour-legal-audit",
        "tour-export-pdf",
      ]);
    });

    it("každý krok sprievodcu má priradený relevantný zákonný paragraf", () => {
      const legalRefs = LAWYER_TOUR_STEPS.map((s) => s.proceduralParagraph);
      expect(legalRefs.some((ref) => ref?.includes("§ 119"))).toBe(true);
      expect(legalRefs.some((ref) => ref?.includes("§ 98"))).toBe(true);
      expect(legalRefs.some((ref) => ref?.includes("§ 233"))).toBe(true);
      expect(legalRefs.some((ref) => ref?.includes("§ 125"))).toBe(true);
      expect(legalRefs.some((ref) => ref?.includes("§ 168"))).toBe(true);
    });
  });
});
