import { describe, expect, it } from "vitest";
import { buildGoldenDemoCase } from "../golden-demo-case";

describe("golden demo case", () => {
  it("provides the complete deterministic court presentation scenario", () => {
    const demo = buildGoldenDemoCase();

    expect(demo.metadata.isDemo).toBe(true);
    expect(demo.metadata.name).toContain("PPZ-442/2026");
    expect(demo.entities).toHaveLength(12);
    expect(demo.transactions).toHaveLength(15);
    expect(demo.timeline).toHaveLength(8);
    expect(demo.dossierSummary).toMatchObject({
      defendabilityIndex: 28,
      overallRisk: "KRITICKÉ",
    });
  });

  it("contains a cited round-trip and cash withdrawal before bankruptcy", () => {
    const demo = buildGoldenDemoCase();
    const roundTrip = demo.transactions.filter((transaction) =>
      transaction.anomalies.includes("round-tripping"),
    );
    const cashWithdrawal = demo.transactions.find(
      (transaction) =>
        transaction.method === "cash" && transaction.amount === 50000,
    );

    expect(roundTrip).toHaveLength(2);
    expect(demo.transactions[0]).toMatchObject({
      fromEntityId: "a",
      toEntityId: "b",
    });
    expect(demo.transactions[2]).toMatchObject({
      fromEntityId: "c",
      toEntityId: "a",
    });
    expect(cashWithdrawal).toMatchObject({ date: "2026-03-28" });
    expect(
      [...demo.transactions, ...demo.timeline].every(
        (item) => item.sourceRef?.documentId === demo.documents[0]?.id,
      ),
    ).toBe(true);
  });
});
