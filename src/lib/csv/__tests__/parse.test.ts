import { describe, expect, it } from "vitest";
import {
  detectDelimiter,
  parseAmountValue,
  parseDateValue,
  parseDelimited,
  stripBom,
} from "../parse";
import { validateRows, findSimilar, EMPTY_MAPPING } from "../mapping";

describe("CSV parser", () => {
  it("odstráni BOM a rozpozná oddeľovač", () => {
    expect(stripBom("\ufeffa;b")).toBe("a;b");
    expect(detectDelimiter("a;b;c\n1;2;3").value).toBe(";");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3").value).toBe("\t");
  });

  it("rešpektuje úvodzovky a viacriadkové bunky", () => {
    const rows = parseDelimited('a,"b,c","d\ne"\n1,2,3', ",");
    expect(rows[0]).toEqual(["a", "b,c", "d\ne"]);
    expect(rows[1]).toEqual(["1", "2", "3"]);
  });

  it("číta sumy s desatinnou čiarkou aj záporné", () => {
    expect(parseAmountValue("1 234,56", ",")).toBe(1234.56);
    expect(parseAmountValue("-1,234.50", ".")).toBe(-1234.5);
    expect(parseAmountValue("abc", ",")).toBeNull();
  });

  it("neháda dátum mimo zvoleného formátu", () => {
    expect(parseDateValue("31.01.2026", "DD.MM.YYYY")).toBe("2026-01-31");
    expect(parseDateValue("2026-13-01", "YYYY-MM-DD")).toBeNull();
  });

  it("žiadny chybný riadok nezmizne a sumy sa delia podľa mien", () => {
    const rows = [
      ["datum", "suma", "mena", "od", "komu"],
      ["01.01.2026", "100,00", "EUR", "A", "B"],
      ["zle", "100,00", "EUR", "A", "B"],
      ["02.01.2026", "50,00", "USD", "A", "B"],
    ];
    const result = validateRows(rows, {
      mapping: {
        ...EMPTY_MAPPING,
        date: 0,
        amount: 1,
        currency: 2,
        counterpartyFrom: 3,
        counterpartyTo: 4,
      },
      dateFormat: "DD.MM.YYYY",
      decimal: ",",
      defaultCurrency: "EUR",
      defaultMethod: "transfer",
      hasHeader: true,
    });
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.sourceRow).toBe(3);
    expect(result.totalsByCurrency).toEqual({ EUR: 100, USD: 50 });
    expect(result.counterparties).toEqual(["A", "B"]);
  });

  it("podobné platby iba označí, nemaže ich", () => {
    const rows = [
      {
        sourceRow: 2,
        date: "2026-01-01",
        amount: 10,
        currency: "EUR",
        description: "",
        from: "A",
        to: "B",
        method: "transfer" as const,
      },
      {
        sourceRow: 3,
        date: "2026-01-01",
        amount: 10,
        currency: "EUR",
        description: "",
        from: "A",
        to: "B",
        method: "transfer" as const,
      },
    ];
    const groups = findSimilar(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.rows).toEqual([2, 3]);
  });
});
