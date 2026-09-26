import { describe, expect, it } from "./harness";
import { analyzeCase } from "@/forensic";
import { EMPTY_CASE } from "@/forensic/data/empty";
import {
  flagTransaction,
  cashRatio,
  netAmount,
} from "@/forensic/core/transactions";
import {
  roundMoney,
  sumByCurrency,
  sumMoney,
  sumVolume,
} from "@/forensic/core/money";
import { RULES_VERSION } from "@/forensic/core/rules";
import type { ForensicCase, Transaction } from "@/forensic";

const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? "t1",
  date: over.date ?? "2026-01-10",
  amount: over.amount ?? 1234.5,
  currency: over.currency ?? "EUR",
  method: over.method ?? "transfer",
  fromId: over.fromId ?? "a",
  toId: over.toId ?? "b",
  originCountry: over.originCountry ?? "SK",
  destinationCountry: over.destinationCountry ?? "SK",
  description: over.description ?? "",
  ...(over.payerId ? { payerId: over.payerId } : {}),
});

describe("peňažná aritmetika", () => {
  it("drží presnosť na dve desatinné miesta", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(-1.005)).toBe(-1.01);
  });

  it("objem používa absolútne hodnoty (záporná suma = opačný smer)", () => {
    expect(sumVolume([100, -40])).toBe(140);
    expect(
      netAmount([tx({ amount: 100 }), tx({ id: "t2", amount: -40 })]),
    ).toBe(60);
  });

  it("nesčítava rôzne meny do jednej sumy", () => {
    const result = sumByCurrency([
      { amount: 100, currency: "EUR" },
      { amount: 50, currency: "CZK" },
      { amount: -20, currency: "EUR" },
    ]);
    expect(result).toEqual({ EUR: 120, CZK: 50 });
  });
});

describe("pravidlá transakcií", () => {
  it("bežná transakcia nevyvolá žiadne zistenie", () => {
    const one = tx({ amount: 1234.5 });
    expect(flagTransaction(one, [one])).toEqual([]);
  });

  it("hotovosť nad prahom je fakt s odkazom na zdrojový záznam", () => {
    const one = tx({ id: "cash", amount: 15_000, method: "cash" });
    const flags = flagTransaction(one, [one]);
    const cash = flags.find((f) => f.code === "CASH_HIGH_VALUE");
    expect(cash?.kind).toBe("fakt");
    expect(cash?.ruleVersion).toBe(RULES_VERSION);
    expect(cash?.evidence).toEqual([{ type: "transaction", id: "cash" }]);
  });

  it("hranica prahu: 14 999,99 v hotovosti ešte nespúšťa pravidlo", () => {
    const one = tx({ amount: 14_999.99, method: "cash" });
    expect(
      flagTransaction(one, [one]).some((f) => f.code === "CASH_HIGH_VALUE"),
    ).toBe(false);
  });

  it("pravidlo rovnakého dňa neporovnáva rôzne meny", () => {
    const a = tx({ id: "a", amount: 30_000, currency: "EUR" });
    const b = tx({ id: "b", amount: 30_000, currency: "CZK" });
    const flags = flagTransaction(a, [a, b]);
    expect(flags.some((f) => f.code === "SAME_DAY")).toBe(false);
  });

  it("dve transakcie v jednej mene v jeden deň spúšťajú pravidlo", () => {
    const a = tx({ id: "a", amount: 30_000 });
    const b = tx({ id: "b", amount: 30_000 });
    const flag = flagTransaction(a, [a, b]).find((f) => f.code === "SAME_DAY");
    expect(flag?.evidence?.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  it("platba tretej strany odkazuje na platiteľa", () => {
    const one = tx({ id: "x", payerId: "c" });
    const flag = flagTransaction(one, [one]).find(
      (f) => f.code === "THIRD_PARTY_PAYMENT",
    );
    expect(flag?.evidence).toContainEqual({ type: "entity", id: "c" });
  });

  it("podiel hotovosti počíta z absolútnych hodnôt", () => {
    const list = [
      tx({ id: "1", amount: 100, method: "cash" }),
      tx({ id: "2", amount: -100 }),
    ];
    expect(cashRatio(list)).toBe(0.5);
  });
});

describe("analýza prípadu", () => {
  it("prázdny prípad nepadá a nevracia zistenia", () => {
    const analysis = analyzeCase(EMPTY_CASE);
    expect(analysis.alerts).toEqual([]);
    expect(analysis.totals.volume).toBe(0);
    expect(analysis.rulesVersion).toBe(RULES_VERSION);
  });

  it("objem prípadu ignoruje iné než základnú menu, ale eviduje ju osobitne", () => {
    const forensicCase: ForensicCase = {
      ...EMPTY_CASE,
      id: "c1",
      baseCurrency: "EUR",
      entities: [
        {
          id: "a",
          name: "A",
          kind: "person",
          role: "",
          country: "SK",
          x: 10,
          y: 10,
        },
        {
          id: "b",
          name: "B",
          kind: "company",
          role: "",
          country: "SK",
          x: 20,
          y: 20,
        },
      ],
      transactions: [
        tx({ id: "1", amount: 1000, currency: "EUR" }),
        tx({ id: "2", amount: 500, currency: "CZK" }),
      ],
    };
    const analysis = analyzeCase(forensicCase);
    expect(analysis.totals.volume).toBe(1000);
    expect(analysis.totals.volumeByCurrency).toEqual({ EUR: 1000, CZK: 500 });
    expect(analysis.totals.currencies).toEqual(["CZK", "EUR"]);
  });

  it("je reprodukovateľná — dvakrát rovnaké dáta dajú rovnaký výsledok", () => {
    const first = analyzeCase(EMPTY_CASE);
    const second = analyzeCase(EMPTY_CASE);
    expect(JSON.stringify(first.alerts)).toBe(JSON.stringify(second.alerts));
    expect(first.caseScore).toBe(second.caseScore);
  });
});
