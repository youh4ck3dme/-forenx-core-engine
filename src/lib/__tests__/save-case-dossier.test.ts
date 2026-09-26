import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ForensicDossier } from "@/lib/types";

// In-memory mock database state for cases table
let dbCases: Record<
  string,
  {
    id: string;
    forensic_dossier: unknown;
    forensic_dossier_updated_at: string | null;
  }
> = {};

// Mock Supabase admin client
vi.mock("@/integrations/supabase/client.server", () => {
  return {
    supabaseAdmin: {
      from: (table: string) => {
        if (table !== "cases") throw new Error(`Unexpected table: ${table}`);
        return {
          update: (fields: Record<string, unknown>) => {
            return {
              eq: (col: string, val: string) => {
                if (col !== "id") throw new Error(`Unexpected column: ${col}`);
                return {
                  select: () => {
                    if (val === "error-trigger") {
                      return Promise.resolve({
                        error: { message: "Database connection failed" },
                        data: null,
                      });
                    }
                    if (val === "missing-case") {
                      return Promise.resolve({ error: null, data: [] });
                    }
                    const target = dbCases[val] ?? {
                      id: val,
                      forensic_dossier: null,
                      forensic_dossier_updated_at: null,
                    };
                    Object.assign(target, fields);
                    dbCases[val] = target;
                    return Promise.resolve({
                      error: null,
                      data: [{ id: val }],
                    });
                  },
                };
              },
            };
          },
          select: (columns: string) => {
            return {
              eq: (col: string, val: string) => {
                return {
                  maybeSingle: () => {
                    const row = dbCases[val];
                    if (!row)
                      return Promise.resolve({ error: null, data: null });
                    return Promise.resolve({
                      error: null,
                      data: { forensic_dossier: row.forensic_dossier },
                    });
                  },
                };
              },
            };
          },
        };
      },
    },
  };
});

// Import the handlers and server functions under test
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ARMIVEX_CASE_DOSSIER } from "@/lib/demo-dossier";
import {
  handleSaveCaseDossier,
  handleGetForensicDossier,
  saveCaseDossier,
  getForensicDossier,
} from "@/lib/ai.functions";

describe("Integračný test: saveCaseDossier & getForensicDossier (Kauza Novák / Armivex)", () => {
  beforeEach(() => {
    dbCases = {};
  });

  const sampleBabcanDossier: ForensicDossier = {
    caseId: "PPZ-51/UBOK-PZ-ST-2025",
    caseTitle:
      "Kauza Armivex & Novák (Nedovolené ozbrojovanie & Legalizácia príjmov)",
    defendabilityIndex: 42,
    generatedAt: "2026-09-09T10:00:00.000Z",
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
      ],
    },
    evidenceStrength: {
      traces: [
        {
          id: "E-01",
          name: "Balistická stopa Glock 19",
          lr: "> 1 000 000",
          strength: "Nepriestrelné",
          light: "green",
          paragraph: "§ 119 ods. 2 TP",
        },
      ],
      paragraphs: [
        {
          para: "§ 294 TZ",
          title: "Nedovolené ozbrojovanie a obchodovanie so zbraňami",
          status: "OK",
          note: "48 zbraní kategórie B odovzdaných bez riadnych zbrojných sprievodných listov.",
        },
        {
          para: "§ 233 TZ",
          title: "Legalizácia výnosu z trestnej činnosti",
          status: "Narušené",
          note: "Finančný tok 120 000 EUR cez účet Koval v Tatrabanke nie je spárovaný s fiktívnou faktúrou.",
        },
      ],
    },
    judgeReadyText: {
      skutkovyStav:
        "Obvinený Peter Novák v presne nezistenom čase od septembra 2024 do októbra 2024 v Žiline a inde po predchádzajúcej dohode s Dimitrim Kovalom organizoval nelegálny nákup a transport 48 kusov krátkych palných zbraní.",
      vyporiadanie:
        "K námietke obhajoby, že vozidlo BMW X6 bolo prehľadané bez príkazu sudcu pre prípravné konanie: Súd konštatuje, že išlo o neodkladný úkon podľa § 95 ods. 1 TP.",
      vedecke:
        "Kriminalistický a expertízny ústav PZ potvrdil balistickú zhodu na úrovni LR > 1 000 000 (extrémne silná podpora hypotézy o totožnosti).",
    },
  };

  it("odmietne uloženie syntetickej ukážky (demo)", async () => {
    await expect(
      handleSaveCaseDossier(
        {
          caseId: "any-case",
          dossier: ARMIVEX_CASE_DOSSIER,
        },
        supabaseAdmin,
      ),
    ).rejects.toThrow(/Syntetická ukážka/);
  });

  it("saveCaseDossier uloží modelový spis Armivex a vráti stav 200", async () => {
    const result = await handleSaveCaseDossier(
      {
        caseId: "PPZ-51/UBOK-PZ-ST-2025",
        dossier: sampleBabcanDossier,
      },
      supabaseAdmin,
    );

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.caseId).toBe("PPZ-51/UBOK-PZ-ST-2025");
  });

  it("dáta sa z databázy dajú znova prečítať cez getForensicDossier bez straty štruktúry", async () => {
    // 1. Uložíme dossier
    await handleSaveCaseDossier(
      {
        caseId: "PPZ-51/UBOK-PZ-ST-2025",
        dossier: sampleBabcanDossier,
      },
      supabaseAdmin,
    );

    // 2. Prečítame dossier z databázy (user-scoped klient, RLS)
    const fetchResult = await handleGetForensicDossier(
      "PPZ-51/UBOK-PZ-ST-2025",
      supabaseAdmin,
    );

    expect(fetchResult.success).toBe(true);
    expect(fetchResult.dossier).toBeDefined();

    const retrieved = fetchResult.dossier as ForensicDossier;

    // 3. Overenie úplnej štrukturálnej zhody (Deep Equality)
    expect(retrieved).toEqual(sampleBabcanDossier);

    // 4. Exaktné overenie kľúčových forenzných atribútov
    expect(retrieved.caseId).toBe("PPZ-51/UBOK-PZ-ST-2025");
    expect(retrieved.caseTitle).toContain("Kauza Armivex & Novák");
    expect(retrieved.defendabilityIndex).toBe(42);

    // Časová os a stopy (Os O1, O2, O5)
    expect(retrieved.facts.timeline).toHaveLength(2);
    expect(retrieved.facts.timeline[0]?.source).toBe(
      "Zápisnica o výsluchu svedka M. Hrušku (č. l. 42)",
    );
    expect(retrieved.facts.timeline[1]?.chainBreak).toBe(true);
    expect(retrieved.facts.traces[0]?.lr).toBe("> 1 000 000");
    expect(retrieved.facts.traces[1]?.chainComplete).toBe(false);

    // Útok obhajoby & medzery (Os O6 Devil's Advocate)
    expect(retrieved.defenseAttack.attacks).toHaveLength(1);
    expect(retrieved.defenseAttack.attacks[0]?.defenseClaim).toContain(
      "tlmočník",
    );
    expect(retrieved.defenseAttack.attacks[0]?.evidenceGap).toContain(
      "grafologická expertíza",
    );

    // Súdna sila & paragrafy (Os O8 Trestný poriadok / Trestný zákon)
    expect(retrieved.evidenceStrength.paragraphs).toHaveLength(2);
    expect(retrieved.evidenceStrength.paragraphs[0]?.para).toBe("§ 294 TZ");
    expect(retrieved.evidenceStrength.paragraphs[0]?.status).toBe("OK");
    expect(retrieved.evidenceStrength.paragraphs[1]?.status).toBe("Narušené");

    // Text podľa § 168 TP pripravený pre sudcu
    expect(retrieved.judgeReadyText.skutkovyStav).toContain("Peter Novák");
    expect(retrieved.judgeReadyText.vyporiadanie).toContain("§ 95 ods. 1 TP");
    expect(retrieved.judgeReadyText.vedecke).toContain("LR > 1 000 000");
  });

  it("vyhodí chybu pri zlyhaní databázového zápisu", async () => {
    await expect(
      handleSaveCaseDossier(
        {
          caseId: "error-trigger",
          dossier: sampleBabcanDossier,
        },
        supabaseAdmin,
      ),
    ).rejects.toThrow("Supabase: Database connection failed");
  });

  it("odmietne zápis aj čítanie, keď RLS vráti 0 riadkov", async () => {
    await expect(
      handleSaveCaseDossier(
        {
          caseId: "missing-case",
          dossier: sampleBabcanDossier,
        },
        supabaseAdmin,
      ),
    ).rejects.toThrow("Prípad sa nenašiel alebo naň nemáte oprávnenie.");

    const missingResult = await handleGetForensicDossier(
      "case-does-not-exist",
      supabaseAdmin,
    );
    expect(missingResult).toEqual({ success: true, dossier: null });
  });
});
