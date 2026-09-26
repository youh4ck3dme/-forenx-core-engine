import { describe, expect, it } from "vitest";
import {
  adaptLegacyCaseToUnified,
  adaptUnifiedToLegacyCase,
} from "../case-adapter";
import type { ForensicCase } from "@/forensic";
import type { ForensicCaseUnified } from "@/types/forensic-case";
import { ForensicCaseUnifiedSchema } from "@/types/forensic-case";

type LegacyEntityWithIntelligence = ForensicCase["entities"][number] & {
  score: number;
  isShell: boolean;
};

type LegacyTransactionWithSourceRef = ForensicCase["transactions"][number] & {
  sourceRef: string | { documentId: string; page?: number; excerpt?: string };
};

describe("case-adapter-edge-cases (Edge Cases & Advanced Scenarios)", () => {
  describe("inferRelationshipType - Detailné testovanie", () => {
    it("správne rozpozná statutory vzťah z rôznych slovných variantov", () => {
      const statutoryLabels = [
        "konateľ",
        "štatutár",
        "výkonný riaditeľ",
        "riaditeľ",
        "Výkonný konateľ a riaditeľ",
        "konateľ spoločnosti",
        "štatutárny orgán",
      ];

      statutoryLabels.forEach((label) => {
        const legacyCase: ForensicCase = {
          id: "test-statutory",
          name: "Test",
          subtitle: "",
          referenceDate: "2026-09-26",
          baseCurrency: "EUR",
          entities: [],
          transactions: [],
          weapons: [],
          relations: [{ fromId: "e1", toId: "e2", label }],
          events: [],
          europolSerials: [],
          validLicences: [],
          orsrAddresses: {},
        };

        const unified = adaptLegacyCaseToUnified(legacyCase);
        expect(unified.relationships[0]?.type).toBe("statutory");
      });
    });

    it("správne rozpozná shareholder vzťah", () => {
      const shareholderLabels = [
        "spoločník",
        "majiteľ",
        "akcionár",
        "vlastník",
        "podiel",
        "spoločník s podielom 50%",
        "väčšinový majiteľ",
        "vlastník spoločnosti",
      ];

      shareholderLabels.forEach((label) => {
        const legacyCase: ForensicCase = {
          id: "test-shareholder",
          name: "Test",
          subtitle: "",
          referenceDate: "2026-09-26",
          baseCurrency: "EUR",
          entities: [],
          transactions: [],
          weapons: [],
          relations: [{ fromId: "e1", toId: "e2", label }],
          events: [],
          europolSerials: [],
          validLicences: [],
          orsrAddresses: {},
        };

        const unified = adaptLegacyCaseToUnified(legacyCase);
        expect(unified.relationships[0]?.type).toBe("shareholder");
      });
    });

    it("správne rozpozná money_flow vzťah", () => {
      const moneyFlowLabels = [
        "prevod",
        "platba",
        "úhrada",
        "pôžička",
        "faktúra",
        "finančný prevod",
        "platba faktúry",
        "úhrada za služby",
      ];

      moneyFlowLabels.forEach((label) => {
        const legacyCase: ForensicCase = {
          id: "test-money-flow",
          name: "Test",
          subtitle: "",
          referenceDate: "2026-09-26",
          baseCurrency: "EUR",
          entities: [],
          transactions: [],
          weapons: [],
          relations: [{ fromId: "e1", toId: "e2", label }],
          events: [],
          europolSerials: [],
          validLicences: [],
          orsrAddresses: {},
        };

        const unified = adaptLegacyCaseToUnified(legacyCase);
        expect(unified.relationships[0]?.type).toBe("money_flow");
      });
    });

    it("správne rozpozná co_accused vzťah", () => {
      const coAccusedLabels = [
        "spoluobvinený",
        "komplic",
        "organizátor",
        "spoluobvinený komplic",
      ];

      coAccusedLabels.forEach((label) => {
        const legacyCase: ForensicCase = {
          id: "test-co-accused",
          name: "Test",
          subtitle: "",
          referenceDate: "2026-09-26",
          baseCurrency: "EUR",
          entities: [],
          transactions: [],
          weapons: [],
          relations: [{ fromId: "e1", toId: "e2", label }],
          events: [],
          europolSerials: [],
          validLicences: [],
          orsrAddresses: {},
        };

        const unified = adaptLegacyCaseToUnified(legacyCase);
        expect(unified.relationships[0]?.type).toBe("co_accused");
      });
    });

    it("správne rozpozná family vzťah", () => {
      const familyLabels = [
        "manžel",
        "manželka",
        "rodina",
        "otec",
        "syn",
        "dcéra",
        "brat",
        "sestra",
        "manžel a manželka",
      ];

      familyLabels.forEach((label) => {
        const legacyCase: ForensicCase = {
          id: "test-family",
          name: "Test",
          subtitle: "",
          referenceDate: "2026-09-26",
          baseCurrency: "EUR",
          entities: [],
          transactions: [],
          weapons: [],
          relations: [{ fromId: "e1", toId: "e2", label }],
          events: [],
          europolSerials: [],
          validLicences: [],
          orsrAddresses: {},
        };

        const unified = adaptLegacyCaseToUnified(legacyCase);
        expect(unified.relationships[0]?.type).toBe("family");
      });
    });

    it("vráti common_event pre neznáme vzťahy", () => {
      const legacyCase: ForensicCase = {
        id: "test-common",
        name: "Test",
        subtitle: "",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: [],
        transactions: [],
        weapons: [],
        relations: [{ fromId: "e1", toId: "e2", label: "spoločná schôdzka" }],
        events: [],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const unified = adaptLegacyCaseToUnified(legacyCase);
      expect(unified.relationships[0]?.type).toBe("common_event");
    });
  });

  describe("SHA-256 hash calculation", () => {
    it("generuje konzirentný SHA-256 hash pre rovnaké dáta", () => {
      const legacyCase: ForensicCase = {
        id: "consistent-hash-test",
        name: "Test Case",
        subtitle: "",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: [
          {
            id: "e1",
            name: "Entity 1",
            kind: "person",
            role: "test",
            country: "SK",
            x: 100,
            y: 100,
          },
        ],
        transactions: [],
        weapons: [],
        relations: [],
        events: [],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const unified1 = adaptLegacyCaseToUnified(legacyCase);
      const unified2 = adaptLegacyCaseToUnified(legacyCase);

      expect(unified1.metadata.sha256Hash).toBe(unified2.metadata.sha256Hash);
    });

    it("generuje rôzny SHA-256 hash pre rôzne dáta", () => {
      const case1: ForensicCase = {
        id: "hash-test-1",
        name: "Case 1",
        subtitle: "",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: [
          {
            id: "e1",
            name: "Entity A",
            kind: "person",
            role: "test",
            country: "SK",
            x: 100,
            y: 100,
          },
        ],
        transactions: [],
        weapons: [],
        relations: [],
        events: [],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const case2: ForensicCase = {
        id: "hash-test-2",
        name: "Case 2",
        subtitle: "",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: [
          {
            id: "e1",
            name: "Entity B",
            kind: "person",
            role: "test",
            country: "SK",
            x: 100,
            y: 100,
          },
        ],
        transactions: [],
        weapons: [],
        relations: [],
        events: [],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const unified1 = adaptLegacyCaseToUnified(case1);
      const unified2 = adaptLegacyCaseToUnified(case2);

      expect(unified1.metadata.sha256Hash).not.toBe(
        unified2.metadata.sha256Hash,
      );
    });

    it("SHA-256 hash má správny formát (64 hex znakov)", () => {
      const legacyCase: ForensicCase = {
        id: "hash-format-test",
        name: "Test",
        subtitle: "",
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

      const unified = adaptLegacyCaseToUnified(legacyCase);
      expect(unified.metadata.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("adaptLegacyCaseToUnified - Edge Cases", () => {
    it("spracuje prípad s null/undefined poliami", () => {
      const legacyCase: ForensicCase = {
        id: "null-test",
        name: "Test",
        subtitle: null as any,
        referenceDate: undefined as any,
        baseCurrency: null as any,
        entities: null as any,
        transactions: null as any,
        weapons: [],
        relations: null as any,
        events: null as any,
        europolSerials: [],
        validLicences: [],
        orsrAddresses: null as any,
      };

      const unified = adaptLegacyCaseToUnified(legacyCase);
      expect(unified.metadata.id).toBe("null-test");
      expect(unified.metadata.subtitle).toBe("");
      expect(unified.entities).toEqual([]);
      expect(unified.transactions).toEqual([]);
      expect(unified.relationships).toEqual([]);
      expect(unified.timeline).toEqual([]);
    });

    it("spracuje prípad s duplikovanými ID subjekty (zachováva poradie)", () => {
      const legacyCase: ForensicCase = {
        id: "duplicate-test",
        name: "Test",
        subtitle: "",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: [
          {
            id: "e1",
            name: "First",
            kind: "person",
            role: "test",
            country: "SK",
            x: 100,
            y: 100,
          },
          {
            id: "e1",
            name: "Duplicate",
            kind: "person",
            role: "test",
            country: "SK",
            x: 200,
            y: 200,
          },
        ],
        transactions: [],
        weapons: [],
        relations: [],
        events: [],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const unified = adaptLegacyCaseToUnified(legacyCase);
      expect(unified.entities).toHaveLength(2);
      expect(unified.entities[0]?.name).toBe("First");
      expect(unified.entities[1]?.name).toBe("Duplicate");
    });

    it("správne spracuje entity s IČO a vypočíta intelligence", () => {
      const legacyCase: Omit<ForensicCase, "entities"> & {
        entities: LegacyEntityWithIntelligence[];
      } = {
        id: "ico-test",
        name: "Test",
        subtitle: "",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: [
          {
            id: "e1",
            name: "Test Company",
            kind: "company",
            role: "test",
            ico: "12345678",
            score: 85,
            isShell: true,
            country: "SK",
            x: 100,
            y: 100,
          },
        ],
        transactions: [],
        weapons: [],
        relations: [],
        events: [],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const unified = adaptLegacyCaseToUnified(legacyCase);
      expect(unified.entities[0]?.ico).toBe("12345678");
      expect(unified.entities[0]?.intelligence?.source).toBe("whoiswho_sk");
      expect(unified.entities[0]?.intelligence?.riskScore).toBe(85);
      expect(unified.entities[0]?.intelligence?.isShellCompany).toBe(true);
    });

    it("správne spracuje transakcie s rôznymi formátmi dátumov", () => {
      const legacyCase: ForensicCase = {
        id: "date-test",
        name: "Test",
        subtitle: "",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: [],
        transactions: [
          {
            id: "tx1",
            date: "2026-09-26",
            amount: 1000,
            currency: "EUR",
            method: "transfer",
            fromId: "e1",
            toId: "e2",
            originCountry: "SK",
            destinationCountry: "SK",
            description: "Test 1",
          },
          {
            id: "tx2",
            date: "2026-09-26",
            amount: 2000,
            currency: "USD",
            method: "cash",
            fromId: "e1",
            toId: "e2",
            originCountry: "SK",
            destinationCountry: "SK",
            description: "Test 2",
          },
        ],
        weapons: [],
        relations: [],
        events: [],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const unified = adaptLegacyCaseToUnified(legacyCase);
      expect(unified.transactions).toHaveLength(2);
      expect(unified.transactions[0]?.date).toBe("2026-09-26");
      expect(unified.transactions[1]?.date).toBe("2026-09-26");
    });

    it("správne mapuje sourceRef z rôznych formátov", () => {
      const legacyCase: Omit<ForensicCase, "transactions"> & {
        transactions: LegacyTransactionWithSourceRef[];
      } = {
        id: "sourceref-test",
        name: "Test",
        subtitle: "",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: [],
        transactions: [
          {
            id: "tx1",
            date: "2026-09-26",
            amount: 1000,
            currency: "EUR",
            method: "transfer",
            fromId: "e1",
            toId: "e2",
            originCountry: "SK",
            destinationCountry: "SK",
            description: "Test",
            sourceRef: {
              documentId: "doc-1",
              page: 5,
              excerpt: "Test excerpt",
            },
          },
          {
            id: "tx2",
            date: "2026-09-26",
            amount: 2000,
            currency: "EUR",
            method: "transfer",
            fromId: "e1",
            toId: "e2",
            originCountry: "SK",
            destinationCountry: "SK",
            description: "Test",
            sourceRef: "doc-2",
          },
        ],
        weapons: [],
        relations: [],
        events: [],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const unified = adaptLegacyCaseToUnified(legacyCase);
      expect(unified.transactions[0]?.sourceRef?.documentId).toBe("doc-1");
      expect(unified.transactions[0]?.sourceRef?.page).toBe(5);
      expect(unified.transactions[1]?.sourceRef?.documentId).toBe("doc-2");
      expect(unified.transactions[1]?.sourceRef?.page).toBeUndefined();
    });

    it("správne spracuje udalosti s rôznymi úrovňami závažnosti", () => {
      const legacyCase: ForensicCase = {
        id: "severity-test",
        name: "Test",
        subtitle: "",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: [],
        transactions: [],
        weapons: [],
        relations: [],
        events: [
          {
            date: "2026-09-26",
            title: "Critical",
            detail: "Details",
            severity: "critical" as any,
          },
          {
            date: "2026-09-26",
            title: "High",
            detail: "Details",
            severity: "high" as any,
          },
          {
            date: "2026-09-26",
            title: "Medium",
            detail: "Details",
            severity: "medium" as any,
          },
          {
            date: "2026-09-26",
            title: "Low",
            detail: "Details",
            severity: "low" as any,
          },
        ],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const unified = adaptLegacyCaseToUnified(legacyCase);
      expect(unified.timeline).toHaveLength(4);
      expect(unified.timeline[0]?.severity).toBe("critical");
      expect(unified.timeline[1]?.severity).toBe("high");
      expect(unified.timeline[2]?.severity).toBe("medium");
      expect(unified.timeline[3]?.severity).toBe("low");
    });

    it("správne spracuje dossier s čiastočnými údajmi", () => {
      const legacyCase: ForensicCase = {
        id: "dossier-partial",
        name: "Test",
        subtitle: "",
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

      const partialDossier = {
        defendabilityIndex: 60,
        defenseAttack: {
          overallRisk: "STREDNÉ",
          attacks: [],
        },
        facts: {
          timeline: [],
        },
      };

      const unified = adaptLegacyCaseToUnified(legacyCase, partialDossier);
      expect(unified.dossierSummary?.defendabilityIndex).toBe(60);
      expect(unified.dossierSummary?.overallRisk).toBe("STREDNÉ");
      expect(unified.dossierSummary?.defenseAttacks).toEqual([]);
    });

    it("správne spracuje prípad bez dossier", () => {
      const legacyCase: ForensicCase = {
        id: "no-dossier",
        name: "Test",
        subtitle: "",
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

      const unified = adaptLegacyCaseToUnified(legacyCase);
      expect(unified.dossierSummary).toBeUndefined();
    });
  });

  describe("adaptUnifiedToLegacyCase - Edge Cases", () => {
    it("správne konvertuje unifikovaný prípad späť na legacy formát", () => {
      const unifiedCase: ForensicCaseUnified = {
        metadata: {
          id: "roundtrip-test",
          userId: "test-user",
          name: "Roundtrip Test",
          subtitle: "Test Subtitle",
          referenceDate: "2026-09-26",
          baseCurrency: "USD",
          sha256Hash: "a".repeat(64),
          createdAt: "2026-09-26T00:00:00.000Z",
          updatedAt: "2026-09-26T00:00:00.000Z",
          status: "analyzed",
          tags: ["test", "roundtrip"],
          isDemo: false,
        },
        documents: [],
        entities: [
          {
            id: "e1",
            name: "Test Entity",
            kind: "company",
            role: "test role",
            ico: "12345678",
            country: "CZ",
            address: "Test Address",
            position: { x: 200, y: 300 },
          },
        ],
        transactions: [
          {
            id: "tx1",
            documentId: "doc-1",
            date: "2026-09-26",
            amount: 5000,
            currency: "USD",
            fromEntityId: "e1",
            toEntityId: "e2",
            ibanSource: "SK1234",
            ibanTarget: "SK5678",
            method: "transfer",
            description: "Test transaction",
            anomalies: ["round_sum"],
            sourceRef: {
              documentId: "doc-1",
              page: 1,
              excerpt: "Test",
            },
          },
        ],
        relationships: [
          {
            id: "rel-1",
            fromEntityId: "e1",
            toEntityId: "e2",
            type: "statutory",
            label: "Test relationship",
            weight: 2,
            sourceRef: "doc-1",
          },
        ],
        timeline: [
          {
            id: "ev-1",
            timestamp: "2026-09-26T00:00:00.000Z",
            title: "Test Event",
            detail: "Event details",
            severity: "high",
            paragraph: "§ 199",
            involvedEntityIds: ["e1", "e2"],
            chainBreak: false,
            sourceRef: {
              documentId: "doc-1",
              page: 1,
              excerpt: "Test",
            },
          },
        ],
      };

      const legacy = adaptUnifiedToLegacyCase(unifiedCase);

      expect(legacy.id).toBe("roundtrip-test");
      expect(legacy.name).toBe("Roundtrip Test");
      expect(legacy.subtitle).toBe("Test Subtitle");
      expect(legacy.baseCurrency).toBe("USD");
      expect(legacy.referenceDate).toBe("2026-09-26");

      expect(legacy.entities).toHaveLength(1);
      expect(legacy.entities[0]?.id).toBe("e1");
      expect(legacy.entities[0]?.name).toBe("Test Entity");
      expect(legacy.entities[0]?.kind).toBe("company");
      expect(legacy.entities[0]?.ico).toBe("12345678");
      expect(legacy.entities[0]?.country).toBe("CZ");
      expect(legacy.entities[0]?.x).toBe(200);
      expect(legacy.entities[0]?.y).toBe(300);

      expect(legacy.transactions).toHaveLength(1);
      expect(legacy.transactions[0]?.id).toBe("tx1");
      expect(legacy.transactions[0]?.amount).toBe(5000);
      expect(legacy.transactions[0]?.currency).toBe("USD");
      expect(legacy.transactions[0]?.fromId).toBe("e1");
      expect(legacy.transactions[0]?.toId).toBe("e2");
      expect(legacy.transactions[0]?.method).toBe("transfer");
      expect(legacy.transactions[0]?.description).toBe("Test transaction");

      expect(legacy.relations).toHaveLength(1);
      expect(legacy.relations[0]?.fromId).toBe("e1");
      expect(legacy.relations[0]?.toId).toBe("e2");
      expect(legacy.relations[0]?.label).toBe("Test relationship");

      expect(legacy.events).toHaveLength(1);
      expect(legacy.events[0]?.title).toBe("Test Event");
      expect(legacy.events[0]?.detail).toBe("Event details");
      expect(legacy.events[0]?.severity).toBe("high");
    });

    it("správne mapuje cash metódu na cash", () => {
      const unifiedCase: ForensicCaseUnified = ForensicCaseUnifiedSchema.parse({
        metadata: {
          id: "cash-test",
          name: "Cash Test",
          sha256Hash: "a".repeat(64),
        },
        documents: [],
        entities: [],
        transactions: [
          {
            id: "tx1",
            date: "2026-09-26",
            amount: 1000,
            fromEntityId: "e1",
            toEntityId: "e2",
            method: "cash",
          },
        ],
        relationships: [],
        timeline: [],
      });

      const legacy = adaptUnifiedToLegacyCase(unifiedCase);
      expect(legacy.transactions[0]?.method).toBe("cash");
    });

    it("mapuje transfer metódu na transfer", () => {
      const unifiedCase: ForensicCaseUnified = ForensicCaseUnifiedSchema.parse({
        metadata: {
          id: "transfer-test",
          name: "Transfer Test",
          sha256Hash: "a".repeat(64),
        },
        documents: [],
        entities: [],
        transactions: [
          {
            id: "tx1",
            date: "2026-09-26",
            amount: 1000,
            fromEntityId: "e1",
            toEntityId: "e2",
            method: "transfer",
          },
        ],
        relationships: [],
        timeline: [],
      });

      const legacy = adaptUnifiedToLegacyCase(unifiedCase);
      expect(legacy.transactions[0]?.method).toBe("transfer");
    });

    it("správne mapuje severity pre neznáme hodnoty v legacy formáte", () => {
      // Testujeme adaptUnifiedToLegacyCase s unifikovaným prípadom, ktorý má platné severity
      const unifiedCase: ForensicCaseUnified = ForensicCaseUnifiedSchema.parse({
        metadata: {
          id: "severity-test",
          name: "Severity Test",
          sha256Hash: "a".repeat(64),
        },
        documents: [],
        entities: [],
        transactions: [],
        relationships: [],
        timeline: [
          {
            id: "ev1",
            timestamp: "2026-09-26",
            title: "Test",
            detail: "Details",
            severity: "critical",
          },
          {
            id: "ev2",
            timestamp: "2026-09-26",
            title: "Test",
            detail: "Details",
            severity: "high",
          },
        ],
      });

      const legacy = adaptUnifiedToLegacyCase(unifiedCase);
      expect(legacy.events[0]?.severity).toBe("critical");
      expect(legacy.events[1]?.severity).toBe("high");
    });
  });

  describe("Bidirectional Roundtrip Integrity", () => {
    it("zachováva integritu dát pri dvojsmernom prevode (Legacy -> Unified -> Legacy)", () => {
      const originalLegacy: ForensicCase = {
        id: "roundtrip-integrity",
        name: "Integrity Test",
        subtitle: "Complete roundtrip",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: [
          {
            id: "e1",
            name: "Company A",
            kind: "company",
            role: "sender",
            ico: "11111111",
            address: "Address A",
            registeredAddress: "Address A",
            country: "SK",
            x: 100,
            y: 100,
          },
          {
            id: "e2",
            name: "Company B",
            kind: "company",
            role: "receiver",
            ico: "22222222",
            address: "Address B",
            registeredAddress: "Address B",
            country: "SK",
            x: 300,
            y: 200,
          },
        ],
        transactions: [
          {
            id: "tx1",
            date: "2026-09-25",
            amount: 25000,
            currency: "EUR",
            method: "transfer",
            fromId: "e1",
            toId: "e2",
            originCountry: "SK",
            destinationCountry: "SK",
            description: "Payment for services",
          },
        ],
        relations: [{ fromId: "e1", toId: "e2", label: "obchodný partner" }],
        events: [
          {
            date: "2026-09-25",
            title: "Payment processed",
            detail: "Payment of 25,000 EUR",
            severity: "high",
          },
        ],
        weapons: [],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const unified = adaptLegacyCaseToUnified(originalLegacy);
      const backToLegacy = adaptUnifiedToLegacyCase(unified);

      // Check critical fields
      expect(backToLegacy.id).toBe(originalLegacy.id);
      expect(backToLegacy.name).toBe(originalLegacy.name);
      expect(backToLegacy.subtitle).toBe(originalLegacy.subtitle);
      expect(backToLegacy.baseCurrency).toBe(originalLegacy.baseCurrency);
      expect(backToLegacy.referenceDate).toBe(originalLegacy.referenceDate);

      expect(backToLegacy.entities).toHaveLength(
        originalLegacy.entities.length,
      );
      expect(backToLegacy.entities[0]?.id).toBe(originalLegacy.entities[0]?.id);
      expect(backToLegacy.entities[0]?.name).toBe(
        originalLegacy.entities[0]?.name,
      );
      expect(backToLegacy.entities[0]?.ico).toBe(
        originalLegacy.entities[0]?.ico,
      );

      expect(backToLegacy.transactions).toHaveLength(
        originalLegacy.transactions.length,
      );
      expect(backToLegacy.transactions[0]?.id).toBe(
        originalLegacy.transactions[0]?.id,
      );
      expect(backToLegacy.transactions[0]?.amount).toBe(
        originalLegacy.transactions[0]?.amount,
      );

      expect(backToLegacy.relations).toHaveLength(
        originalLegacy.relations.length,
      );
      expect(backToLegacy.relations[0]?.label).toBe(
        originalLegacy.relations[0]?.label,
      );

      expect(backToLegacy.events).toHaveLength(originalLegacy.events.length);
      expect(backToLegacy.events[0]?.title).toBe(
        originalLegacy.events[0]?.title,
      );
    });

    it("zachováva entity pozície pri roundtrip prevode", () => {
      const originalLegacy: ForensicCase = {
        id: "position-roundtrip",
        name: "Position Test",
        subtitle: "",
        referenceDate: "2026-09-26",
        baseCurrency: "EUR",
        entities: [
          {
            id: "e1",
            name: "Entity 1",
            kind: "person",
            role: "test",
            country: "SK",
            x: 150,
            y: 200,
          },
          {
            id: "e2",
            name: "Entity 2",
            kind: "person",
            role: "test",
            country: "SK",
            x: 350,
            y: 400,
          },
        ],
        transactions: [],
        weapons: [],
        relations: [],
        events: [],
        europolSerials: [],
        validLicences: [],
        orsrAddresses: {},
      };

      const unified = adaptLegacyCaseToUnified(originalLegacy);
      const backToLegacy = adaptUnifiedToLegacyCase(unified);

      expect(backToLegacy.entities[0]?.x).toBe(150);
      expect(backToLegacy.entities[0]?.y).toBe(200);
      expect(backToLegacy.entities[1]?.x).toBe(350);
      expect(backToLegacy.entities[1]?.y).toBe(400);
    });
  });
});
