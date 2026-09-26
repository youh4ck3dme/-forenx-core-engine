import { describe, expect, it } from "vitest";
import {
  adaptLegacyCaseToUnified,
  adaptUnifiedToLegacyCase,
} from "../case-adapter";
import type { ForensicCase } from "@/forensic";

describe("case-adapter (Legacy <-> Unified ForensicCase)", () => {
  it("konvertuje prázdny prípad bez chýb", () => {
    const legacyEmpty: ForensicCase = {
      id: "empty-test-case",
      name: "Prázdny prípad",
      subtitle: "Testovací podtitul",
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

    const unified = adaptLegacyCaseToUnified(legacyEmpty);

    expect(unified.metadata.id).toBe("empty-test-case");
    expect(unified.metadata.name).toBe("Prázdny prípad");
    expect(unified.metadata.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
    expect(unified.entities).toEqual([]);
    expect(unified.transactions).toEqual([]);

    const roundtripLegacy = adaptUnifiedToLegacyCase(unified);
    expect(roundtripLegacy.id).toBe("empty-test-case");
    expect(roundtripLegacy.name).toBe("Prázdny prípad");
  });

  it("konvertuje subjekty, transakcie, vzťahy a udalosti vrátane IČO a intelligence", () => {
    const legacyCase: ForensicCase = {
      id: "case-full-test",
      name: "Kauza Tatra Invest",
      subtitle: "Podvodné prevody",
      referenceDate: "2026-09-20",
      baseCurrency: "EUR",
      entities: [
        {
          id: "ent-1",
          name: "Tatra Invest s.r.o.",
          kind: "company",
          role: "prijímateľ",
          ico: "12345678",
          country: "SK",
          x: 150,
          y: 200,
        },
        {
          id: "ent-2",
          name: "Ján Novák",
          kind: "person",
          role: "konateľ",
          country: "SK",
          x: 300,
          y: 200,
        },
      ],
      transactions: [
        {
          id: "tx-1",
          date: "2026-09-21",
          amount: 50000,
          currency: "EUR",
          method: "transfer",
          fromId: "ent-1",
          toId: "ent-2",
          originCountry: "SK",
          destinationCountry: "SK",
          description: "Mimoriadna odmena",
        },
      ],
      relations: [
        {
          fromId: "ent-2",
          toId: "ent-1",
          label: "konateľ",
        },
      ],
      events: [
        {
          date: "2026-09-21",
          title: "Prevod 50 000 EUR",
          detail: "Z účtu Tatra Invest na osobný účet konateľa",
          severity: "high",
        },
      ],
      weapons: [],
      europolSerials: [],
      validLicences: [],
      orsrAddresses: {},
    };

    const unified = adaptLegacyCaseToUnified(legacyCase);

    expect(unified.metadata.id).toBe("case-full-test");
    expect(unified.entities).toHaveLength(2);
    expect(unified.entities[0]?.ico).toBe("12345678");
    expect(unified.entities[0]?.intelligence?.source).toBe("whoiswho_sk");
    expect(unified.transactions).toHaveLength(1);
    expect(unified.transactions[0]?.amount).toBe(50000);
    expect(unified.relationships).toHaveLength(1);
    expect(unified.relationships[0]?.type).toBe("statutory"); // Zistené z label "konateľ"
    expect(unified.timeline).toHaveLength(1);
    expect(unified.timeline[0]?.severity).toBe("high");

    // Obojsmerný spätný prevod
    const roundtrip = adaptUnifiedToLegacyCase(unified);
    expect(roundtrip.entities).toHaveLength(2);
    expect(roundtrip.transactions).toHaveLength(1);
    expect(roundtrip.transactions[0]?.fromId).toBe("ent-1");
    expect(roundtrip.transactions[0]?.toId).toBe("ent-2");
    expect(roundtrip.relations[0]?.label).toBe("konateľ");
  });
});
