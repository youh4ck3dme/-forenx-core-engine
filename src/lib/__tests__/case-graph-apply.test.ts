import { describe, expect, it } from "vitest";
import { normalizeDate, toTimelineInput } from "@/lib/case-graph.functions";

describe("prenos výsledku AI do grafu a časovej osi", () => {
  it("normalizuje bežné tvary dátumu", () => {
    expect(normalizeDate("2026-03-04")).toBe("2026-03-04");
    expect(normalizeDate("4.3.2026")).toBe("2026-03-04");
    expect(normalizeDate("04. 03. 2026")).toBe("2026-03-04");
    expect(normalizeDate("2026-03")).toBe("2026-03-01");
    expect(normalizeDate("2026")).toBe("2026-01-01");
    expect(normalizeDate("neznámy dátum")).toBeNull();
    expect(normalizeDate(undefined)).toBeNull();
  });

  it("vytiahne udalosti a aktérov z dossiera", () => {
    const rows = toTimelineInput({
      facts: {
        timeline: [
          {
            date: "12.08.2026",
            event: "Prevod na účet",
            actors: ["Dimitri Cohen", { name: "Erik Babčan" }],
          },
          { title: "Výsluch", description: "Zápisnica" },
          { note: "bez textu" },
        ],
      },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "12.08.2026",
      event: "Prevod na účet",
      actors: ["Dimitri Cohen", "Erik Babčan"],
    });
    expect(rows[1]).toMatchObject({ event: "Výsluch", detail: "Zápisnica" });
  });

  it("prázdny alebo neplatný dossier nevyhodí chybu", () => {
    expect(toTimelineInput(null)).toEqual([]);
    expect(toTimelineInput({ facts: {} })).toEqual([]);
  });
});
