import { describe, expect, it } from "vitest";
import { mapCaseRows } from "@/lib/case-mapper";

describe("Case mapper (DB riadky → forenzná entita)", () => {
  const caseRow = {
    id: "case-1",
    name: "Test",
    subtitle: null,
    reference_date: "2026-01-01",
    base_currency: "EUR",
    europol_serials: ["CGDV051"],
    valid_licences: ["LA 002318"],
    orsr_addresses: { "51234567": "Bratislava" },
  };

  it("mapuje entity, zbrane a relácie vrátane snake_case polí", () => {
    const forensic = mapCaseRows(
      caseRow,
      [
        {
          id: "e1",
          name: "Firma",
          kind: "company",
          role: "dodávateľ",
          ico: "51234567",
          registered_address: "Priemyselná 4",
          country: "SK",
          x: "10",
          y: "20",
        },
      ],
      [],
      [
        {
          id: "w1",
          brand: "Glock",
          model: "19",
          serial: "CGDV051",
          holder_id: "e1",
          supplier_id: "e1",
          acquired_at: "2025-01-23",
        },
      ],
      [{ from_id: "e1", to_id: "e1", label: "konateľ" }],
      [{ date: "2025-01-23", title: "Nákup", detail: "", severity: "high" }],
    );
    expect(forensic.entities[0]?.kind).toBe("company");
    expect(forensic.entities[0]?.registeredAddress).toBe("Priemyselná 4");
    expect(forensic.entities[0]?.x).toBe(10);
    expect(forensic.weapons[0]?.holderId).toBe("e1");
    expect(forensic.relations).toHaveLength(1);
    expect(forensic.events[0]?.severity).toBe("high");
    expect(forensic.europolSerials).toEqual(["CGDV051"]);
  });

  it("zahodí transakcie bez from_id/to_id a neznámu závažnosť zníži na low", () => {
    const forensic = mapCaseRows(
      caseRow,
      [],
      [
        {
          id: "t-ok",
          date: "2025-01-22",
          amount: "100",
          from_id: "a",
          to_id: "b",
          method: "cash",
        },
        {
          id: "t-bad",
          date: "2025-01-22",
          amount: 1,
          from_id: null,
          to_id: "b",
        },
      ],
      [],
      [{ from_id: null, to_id: "x", label: "broken" }],
      [{ date: "2025-01-01", title: "x", severity: "explosive" }],
    );
    expect(forensic.transactions).toHaveLength(1);
    expect(forensic.transactions[0]?.amount).toBe(100);
    expect(forensic.transactions[0]?.method).toBe("cash");
    expect(forensic.relations).toHaveLength(0);
    expect(forensic.events[0]?.severity).toBe("low");
  });
});
