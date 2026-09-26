import { describe, expect, it } from "vitest";
import type { ForensicDossier } from "@/lib/types";

// Import sample dossier matching asistent.tsx
const sampleDossier: ForensicDossier = {
  caseId: "PPZ-51/UBOK-PZ-ST-2025",
  caseTitle: "Kauza Armivex & Novák (Nedovolené ozbrojovanie & Legalizácia)",
  defendabilityIndex: 38,
  generatedAt: new Date().toISOString(),
  facts: {
    timeline: [
      {
        time: "2024-10-15 08:30",
        event:
          "Prevzatie 48 ks pištolí Glock 19 a GP K100 z predajne Armivex v Žiline.",
        source: "Zápisnica o výsluchu svedka M. Hrušku (č. l. 42)",
        chainBreak: false,
        severity: "info",
        paragraph: "§ 119 TP",
      },
      {
        time: "2024-10-18 14:00",
        event:
          "Zaistenie vozidla BMW X6 (D. Malina) — nájdené kúpne zmluvy a pečiatky.",
        source: "Protokol o prehliadke iných priestorov (č. l. 88)",
        chainBreak: true,
        severity: "critical",
        paragraph: "§ 95 ods. 1 TP",
      },
    ],
    traces: [
      {
        id: "TR-01",
        type: "balistická",
        description: "Glock 19 Gen 5 v. č. CGDV051 (zhoda s nábojnicou)",
        light: "green",
        chainComplete: true,
        lr: "> 1 000 000",
        paragraph: "§ 119 ods. 2 TP",
      },
      {
        id: "TR-05",
        type: "dokument",
        description: "Evidenčná kniha zbraní Armivex s.r.o. — nezabezpečená",
        light: "red",
        chainComplete: false,
        lr: "—",
        paragraph: "§ 98 TP",
      },
    ],
  },
  defenseAttack: {
    overallRisk: "KRITICKÉ",
    attacks: [
      {
        id: "DA-1",
        defenseClaim: "Koval: 'V aute som sa len viezol ako tlmočník.'",
        risk: "VYSOKÉ",
        counterStrike:
          "Vozidlo malo pečiatky VELTRA a rukou písané zoznamy kalibrov.",
        evidenceGap: "Chýba grafologická expertíza rukou písaných zoznamov.",
        paragraph: "§ 142 TP",
      },
      {
        id: "DA-2",
        defenseClaim:
          "Novák: 'V Armivexe som v živote nebol a Mareka Hrušku nepoznám.'",
        risk: "KRITICKÉ",
        counterStrike: "Svedok Marek Hruška 3x overil totožnosť z OP a ZP.",
        evidenceGap: "Protokoly neboli podrobené porovnaniu podpisového vzoru.",
        paragraph: "§ 125 TP",
      },
    ],
  },
  evidenceStrength: {
    traces: [
      {
        id: "TR-01",
        name: "Glock 19 Gen 5 (CGDV051) — Europol",
        lr: "> 1 000 000",
        strength: "Nepriestrelné",
        light: "green",
        paragraph: "§ 119 ods. 2 TP",
      },
    ],
    paragraphs: [
      {
        para: "§ 294 TZ",
        title: "Nedovolené ozbrojovanie",
        status: "OK",
        note: "Znaky organizovanej skupiny naplnené",
      },
      {
        para: "§ 98 TP",
        title: "Zabezpečenie vecí",
        status: "Narušené",
        note: "Originál evidenčnej knihy z predajne nebol zaistený",
      },
    ],
  },
  judgeReadyText: {
    skutkovyStav:
      "Skutkový stav preukázaný listinnými dôkazmi a výpoveďami svedkov.",
    vyporiadanie:
      "Tvrdenia obhajoby sú účelové a vyvrátené konfrontáciou podľa § 125 TP.",
    vedecke:
      "Znalecké posudky KEU PZ spĺňajú podmienky § 100 TP s LR > 1 000 000.",
  },
};

describe("autopilot-dossier (Forenzný Autopilot Integrácia)", () => {
  it("spĺňa štruktúru ForensicDossier pre súdny audit", () => {
    expect(sampleDossier.caseId).toBe("PPZ-51/UBOK-PZ-ST-2025");
    expect(sampleDossier.defendabilityIndex).toBeGreaterThanOrEqual(0);
    expect(sampleDossier.defendabilityIndex).toBeLessThanOrEqual(100);
  });

  it("deteguje zlom v reťazci zabezpečenia stôp", () => {
    const broken = sampleDossier.facts.timeline.filter((e) => e.chainBreak);
    expect(broken.length).toBeGreaterThan(0);
    expect(broken[0]?.severity).toBe("critical");
    expect(broken[0]?.paragraph).toBe("§ 95 ods. 1 TP");
  });

  it("obsahuje simuláciu útokov obhajoby s protiúderom a dôkazovou medzerou", () => {
    expect(sampleDossier.defenseAttack.attacks.length).toBeGreaterThan(0);
    for (const attack of sampleDossier.defenseAttack.attacks) {
      expect(attack.defenseClaim.length).toBeGreaterThan(5);
      expect(attack.counterStrike.length).toBeGreaterThan(5);
      expect(attack.evidenceGap.length).toBeGreaterThan(5);
      expect(["KRITICKÉ", "VYSOKÉ", "STREDNÉ", "NÍZKE"]).toContain(attack.risk);
    }
  });

  it("overuje stav zákonných paragrafov", () => {
    const narusene = sampleDossier.evidenceStrength.paragraphs.find(
      (p) => p.status === "Narušené",
    );
    expect(narusene).toBeDefined();
    expect(narusene?.para).toBe("§ 98 TP");
  });

  it("obsahuje rozsudkové odôvodnenie v troch častiach podľa § 168 TP", () => {
    expect(sampleDossier.judgeReadyText.skutkovyStav).toBeTruthy();
    expect(sampleDossier.judgeReadyText.vyporiadanie).toBeTruthy();
    expect(sampleDossier.judgeReadyText.vedecke).toBeTruthy();
  });
});
