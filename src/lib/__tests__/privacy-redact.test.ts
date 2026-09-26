import { describe, expect, it } from "vitest";
import { analyzeCase, EMPTY_CASE } from "@/forensic";
import type { ForensicCase } from "@/forensic";
import { buildAiPayload, buildPseudonyms } from "@/lib/ai/redact";

function sampleCase(): ForensicCase {
  return {
    ...EMPTY_CASE,
    id: "11111111-2222-3333-4444-555555555555",
    name: "Kauza Peter Novák",
    entities: [
      {
        id: "ent-koval",
        name: "Denis Koval",
        kind: "person",
        role: "šofér",
        country: "SK",
        x: 1,
        y: 1,
        ico: "51234567",
        address: "Hlavná 1, Košice",
      },
      {
        id: "ent-firm",
        name: "VELTRA s.r.o.",
        kind: "company",
        role: "konateľ",
        country: "SK",
        x: 2,
        y: 2,
        ico: "36801234",
      },
    ],
    transactions: [
      {
        id: "tx-cash-1",
        date: "2025-01-22",
        amount: 32000,
        currency: "EUR",
        method: "cash",
        fromId: "ent-koval",
        toId: "ent-firm",
        originCountry: "SK",
        destinationCountry: "SK",
        description: "vklad hotovosti Denis Koval na účet VELTRA",
      },
    ],
  };
}

describe("Privacy / PII redakcia pred odoslaním do AI", () => {
  it("nahradí UUID a mená konzistentnými pseudonymami S/T", () => {
    const analysis = analyzeCase(sampleCase());
    const { payload, pseudonyms } = buildAiPayload(analysis, {
      task: "case_summary",
    });
    const identityDump = JSON.stringify({
      case: payload.case,
      entities: payload.entities,
      txIds: payload.transactions.map((t) => ({
        id: t.id,
        from: t.from,
        to: t.to,
      })),
    });
    expect(identityDump).not.toContain("Denis Koval");
    expect(identityDump).not.toContain("VELTRA");
    expect(identityDump).not.toContain("11111111-2222-3333-4444-555555555555");
    expect(identityDump).not.toContain("ent-koval");
    expect(identityDump).not.toContain("tx-cash-1");
    expect(identityDump).not.toContain("51234567");
    expect(payload.entities[0]).not.toHaveProperty("name");
    expect(payload.entities[0]).not.toHaveProperty("ico");
    expect(payload.entities[0]).not.toHaveProperty("address");
    expect(payload.entities.map((e) => e.id)).toEqual(["S1", "S2"]);
    expect(payload.transactions.map((t) => t.id)).toEqual(["T1"]);
    expect(payload.transactions[0]?.from).toBe("S1");
    expect(payload.transactions[0]?.to).toBe("S2");
    expect(pseudonyms.entityBack["S1"]).toBe("ent-koval");
    expect(pseudonyms.transactionBack["T1"]).toBe("tx-cash-1");
  });

  it("explain_finding posiela len entity viazané na nález, nie celý spis", () => {
    const analysis = analyzeCase(sampleCase());
    const { payload: summary } = buildAiPayload(analysis, {
      task: "case_summary",
    });
    const { payload: explain } = buildAiPayload(analysis, {
      task: "explain_finding",
      alertId: "neexistuje",
    });
    expect(summary.entities.length).toBeGreaterThan(0);
    expect(explain.entities.length).toBe(0);
    expect(explain.transactions.length).toBe(0);
  });

  it("buildPseudonyms je deterministické pre rovnaké poradie entít", () => {
    const analysis = analyzeCase(sampleCase());
    const a = buildPseudonyms(analysis);
    const b = buildPseudonyms(analysis);
    expect(a.entity).toEqual(b.entity);
    expect(a.transaction).toEqual(b.transaction);
  });
});
