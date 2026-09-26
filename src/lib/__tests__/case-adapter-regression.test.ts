import { describe, expect, it } from "vitest";
import {
  adaptLegacyCaseToUnified,
  adaptUnifiedToLegacyCase,
} from "../case-adapter";
import type { ForensicCase as LegacyForensicCase } from "@/forensic";

describe("case-adapter-regression (Legacy <-> Unified Case Bidirectional Adapter)", () => {
  describe("adaptLegacyCaseToUnified", () => {
    it("spracuje minimálny / prázdny vstup a doplní defaultné hodnoty", () => {
      const minimalCase = {};
      const unified = adaptLegacyCaseToUnified(minimalCase);

      expect(unified.metadata.id).toBeDefined();
      expect(unified.metadata.name).toBe("Bez názvu");
      expect(unified.metadata.baseCurrency).toBe("EUR");
      expect(unified.metadata.status).toBe("draft");
      expect(unified.metadata.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
      expect(unified.entities).toEqual([]);
      expect(unified.transactions).toEqual([]);
      expect(unified.relationships).toEqual([]);
      expect(unified.timeline).toEqual([]);
      expect(unified.documents).toEqual([]);
    });

    it("správne inferuje rôzne typy vzťahov podľa kľúčových slov v popise hrany", () => {
      const legacyWithRelations: LegacyForensicCase = {
        id: "case-rel-infer",
        name: "Test vzťahov",
        subtitle: "",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: [
          {
            id: "e1",
            name: "Osoba A",
            kind: "person",
            role: "podozrivý",
            country: "SK",
            x: 0,
            y: 0,
          },
          {
            id: "e2",
            name: "Firma B",
            kind: "company",
            role: "spoločnosť",
            country: "SK",
            x: 0,
            y: 0,
          },
        ],
        transactions: [],
        weapons: [],
        relations: [
          { fromId: "e1", toId: "e2", label: "výkonný riaditeľ a konateľ" },
          {
            fromId: "e1",
            toId: "e2",
            label: "väčšinový spoločník a vlastník podielu",
          },
          {
            fromId: "e1",
            toId: "e2",
            label: "prevod finančných prostriedkov a úhrada faktúry",
          },
          {
            fromId: "e1",
            toId: "e2",
            label: "spoluobvinený komplic v trestnej činnosti",
          },
          { fromId: "e1", toId: "e2", label: "manžel a rodina" },
          { fromId: "e1", toId: "e2", label: "obchodné stretnutie v kaviarni" },
        ],
        events: [],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const unified = adaptLegacyCaseToUnified(legacyWithRelations);
      expect(unified.relationships).toHaveLength(6);
      expect(unified.relationships[0]?.type).toBe("statutory");
      expect(unified.relationships[1]?.type).toBe("shareholder");
      expect(unified.relationships[2]?.type).toBe("money_flow");
      expect(unified.relationships[3]?.type).toBe("co_accused");
      expect(unified.relationships[4]?.type).toBe("family");
      expect(unified.relationships[5]?.type).toBe("common_event");
    });

    it("prepočítava pozície entít mriežkovo, ak chýbajú explicitné súradnice x a y", () => {
      const legacyEntitiesWithoutCoords: LegacyForensicCase = {
        id: "case-grid-pos",
        name: "Mriežka",
        subtitle: "",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: Array.from({ length: 7 }, (_, i) => ({
          id: `ent-${i}`,
          name: `Subjekt ${i}`,
          kind: i % 2 === 0 ? ("company" as const) : ("person" as const),
          role: "aktér",
          country: "SK",
          x: undefined as any,
          y: undefined as any,
        })),
        transactions: [],
        weapons: [],
        relations: [],
        events: [],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const unified = adaptLegacyCaseToUnified(legacyEntitiesWithoutCoords);
      expect(unified.entities).toHaveLength(7);
      expect(unified.entities[0]?.position.x).toBe(100);
      expect(unified.entities[0]?.position.y).toBe(100);
      expect(unified.entities[5]?.position.x).toBe(100); // nový riadok po 5 prvkoch
      expect(unified.entities[5]?.position.y).toBe(200);
    });

    it("správne integruje dossier dáta (dossierSummary, dokumenty a fakty)", () => {
      const legacyCase: LegacyForensicCase = {
        id: "case-with-dossier",
        name: "Spis s autopilotom",
        subtitle: "Audit",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: [],
        transactions: [],
        weapons: [],
        relations: [],
        events: [],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const mockDossier = {
        defendabilityIndex: 82,
        defenseAttack: {
          overallRisk: "NÍZKE",
          attacks: ["Chybná identifikácia subjektu na strane obžaloby"],
        },
        judgeReadyText: "Zhrnutie pre samosudcu...",
        investigativeAnswers: [
          {
            question: "Existuje dôkaz o úmysle?",
            answer: "Nie",
            confidence: "high",
          },
        ],
        analysisMeta: {
          documentIds: ["vypis_banka.pdf", "zmluva_o_dielo.pdf"],
        },
        facts: {
          timeline: [
            {
              id: "ev-dos-1",
              date: "2026-09-12",
              title: "Podpis zmluvy",
              detail: "Podpis v notárskej kancelárii",
              severity: "low",
              chainBreak: false,
              source: "zmluva_o_dielo.pdf",
            },
          ],
        },
      };

      const unified = adaptLegacyCaseToUnified(legacyCase, mockDossier);

      expect(unified.dossierSummary?.defendabilityIndex).toBe(82);
      expect(unified.dossierSummary?.overallRisk).toBe("NÍZKE");
      expect(unified.dossierSummary?.defenseAttacks).toHaveLength(1);
      expect(unified.documents).toHaveLength(2);
      expect(unified.documents[0]?.name).toBe("vypis_banka.pdf");
      expect(unified.timeline).toHaveLength(1);
      expect(unified.timeline[0]?.title).toBe("Podpis zmluvy");
      expect(unified.timeline[0]?.sourceRef?.documentId).toBe(
        "zmluva_o_dielo.pdf",
      );
    });
  });

  describe("adaptUnifiedToLegacyCase & Roundtrip", () => {
    it("bezstratovo prevedie kompletný unifikovaný prípad späť do LegacyForensicCase formátu", () => {
      const originalLegacy: LegacyForensicCase = {
        id: "case-roundtrip-perfect",
        name: "Kompletný test roundtripu",
        subtitle: "Overenie integrity dát",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: [
          {
            id: "ent-1",
            name: "ALPHA INVEST s.r.o.",
            kind: "company",
            role: "odosielateľ",
            ico: "88776655",
            address: "Hlavná 1, Košice",
            registeredAddress: "Hlavná 1, Košice",
            country: "SK",
            x: 200,
            y: 300,
          },
          {
            id: "ent-2",
            name: "BETA CONSULTING s.r.o.",
            kind: "company",
            role: "príjemca",
            ico: "11223344",
            address: "Štúrova 5, Bratislava",
            registeredAddress: "Štúrova 5, Bratislava",
            country: "SK",
            x: 500,
            y: 300,
          },
        ],
        transactions: [
          {
            id: "tx-rt-1",
            date: "2026-09-24",
            amount: 75000,
            currency: "EUR",
            method: "transfer",
            fromId: "ent-1",
            toId: "ent-2",
            originCountry: "SK",
            destinationCountry: "SK",
            description: "Úhrada za konzultačnú činnosť",
          },
        ],
        relations: [
          {
            fromId: "ent-1",
            toId: "ent-2",
            label: "obchodný partner",
          },
        ],
        events: [
          {
            date: "2026-09-24",
            title: "Prevod 75 000 EUR",
            detail: "Finančný prevod medzi firmami",
            severity: "high",
          },
        ],
        weapons: [],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const unified = adaptLegacyCaseToUnified(originalLegacy);
      const convertedBack = adaptUnifiedToLegacyCase(unified);

      expect(convertedBack.id).toBe(originalLegacy.id);
      expect(convertedBack.name).toBe(originalLegacy.name);
      expect(convertedBack.subtitle).toBe(originalLegacy.subtitle);
      expect(convertedBack.entities).toHaveLength(2);
      expect(convertedBack.entities[0]?.id).toBe("ent-1");
      expect(convertedBack.entities[0]?.ico).toBe("88776655");
      expect(convertedBack.entities[0]?.address).toBe("Hlavná 1, Košice");
      expect(convertedBack.transactions).toHaveLength(1);
      expect(convertedBack.transactions[0]?.amount).toBe(75000);
      expect(convertedBack.transactions[0]?.fromId).toBe("ent-1");
      expect(convertedBack.transactions[0]?.toId).toBe("ent-2");
      expect(convertedBack.relations).toHaveLength(1);
      expect(convertedBack.relations[0]?.label).toBe("obchodný partner");
      expect(convertedBack.events).toHaveLength(1);
      expect(convertedBack.events[0]?.severity).toBe("high");
      expect(convertedBack.weapons).toEqual([]);
      expect(convertedBack.validLicences).toEqual([]);
    });
  });
});
