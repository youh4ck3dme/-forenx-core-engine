import { describe, expect, it } from "vitest";
import { detectChains, detectIsolatedCompanies } from "@/forensic/core/network";
import {
  detectSerialBatches,
  detectVolumeSurge,
} from "@/forensic/core/weapons";
import { detectTemporalPatterns } from "@/forensic/core/temporal";
import type { Transaction, Weapon } from "@/forensic/types";
import { EMPTY_CASE } from "@/forensic/data/empty";

const tx = (id: string, date: string, amount = 100): Transaction => ({
  id,
  date,
  amount,
  currency: "EUR",
  method: "transfer",
  fromId: "supplier",
  toId: "shell",
  originCountry: "SK",
  destinationCountry: "SK",
  description: "",
});

const weapon = (overrides: Partial<Weapon> = {}): Weapon => ({
  id: overrides.id ?? "w1",
  brand: "Test",
  model: "M1",
  serial: overrides.serial ?? "AB-001",
  holderId: overrides.holderId ?? "h1",
  supplierId: "supplier",
  acquiredAt: overrides.acquiredAt ?? "2026-01-01",
  licence: overrides.licence,
});

describe("temporal patterns", () => {
  it("returns no patterns for fewer than three transactions", () => {
    expect(detectTemporalPatterns([tx("1", "2026-01-01")])).toEqual([]);
  });

  it("detects weekend, burst, escalation and month-end patterns", () => {
    const transactions = [
      tx("1", "2026-01-25", 10_000),
      tx("2", "2026-01-26", 10_000),
      tx("3", "2026-01-27", 10_000),
      tx("4", "2026-02-01", 40_000),
      tx("5", "2026-02-02", 40_000),
      tx("6", "2026-02-03", 40_000),
    ];
    const codes = detectTemporalPatterns(transactions).map((p) => p.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "WEEKEND_ACTIVITY",
        "BURST",
        "ESCALATION",
        "MONTH_END",
      ]),
    );
  });

  it("detects weekday concentration and regular intervals", () => {
    const transactions = [
      tx("1", "2026-01-05"),
      tx("2", "2026-01-12"),
      tx("3", "2026-01-19"),
      tx("4", "2026-01-26"),
    ];
    const codes = detectTemporalPatterns(transactions).map((p) => p.code);
    expect(codes).toEqual(
      expect.arrayContaining(["WEEKDAY_CONCENTRATION", "REGULAR_INTERVAL"]),
    );
  });
});

describe("weapon and network patterns", () => {
  it("detects serial batches split between holders", () => {
    const weapons = [
      weapon({ id: "1", serial: "AB-001", holderId: "h1" }),
      weapon({ id: "2", serial: "AB-002", holderId: "h2" }),
      weapon({ id: "3", serial: "AB-003", holderId: "h2" }),
    ];
    expect(detectSerialBatches(weapons)).toEqual([
      {
        prefix: "AB",
        serials: ["AB-001", "AB-002", "AB-003"],
        holderIds: ["h1", "h2"],
      },
    ]);
  });

  it("detects a short volume surge and ignores long intervals", () => {
    const short = [
      weapon({ id: "1", acquiredAt: "2026-01-01" }),
      weapon({ id: "2", acquiredAt: "2026-02-01" }),
      weapon({ id: "3", acquiredAt: "2026-03-01" }),
    ];
    expect(detectVolumeSurge(short, "h1")?.code).toBe("VOLUME_SURGE");
    expect(
      detectVolumeSurge(
        short.map((w, i) => ({ ...w, acquiredAt: `202${i + 6}-01-01` })),
        "h1",
      ),
    ).toBeNull();
  });

  it("detects shell chains and isolated companies", () => {
    const relations = [{ fromId: "a", toId: "shell", label: "vlastní" }];
    const transactions = [tx("t", "2026-01-01")];
    transactions[0]!.fromId = "shell";
    transactions[0]!.toId = "buyer";
    expect(detectChains(relations, transactions, ["shell"])[0]).toMatchObject({
      shellId: "shell",
      supplierIds: ["a"],
      buyerIds: ["buyer"],
      severity: "high",
    });
    expect(detectIsolatedCompanies(relations, ["shell", "isolated"])).toEqual([
      "shell",
      "isolated",
    ]);
    expect(EMPTY_CASE.entities).toEqual([]);
  });
});
