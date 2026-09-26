import { beforeEach, describe, expect, it, vi } from "vitest";

const order = vi.fn();
const eq = vi.fn(() => ({ order }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const getUser = vi.fn(async () => ({
  data: { user: { id: "u1" } },
  error: null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from, auth: { getUser } },
}));

const shouldUseLocalCaseStore = vi.fn(async () => false);
vi.mock("@/lib/identity", () => ({
  shouldUseLocalCaseStore: () => shouldUseLocalCaseStore(),
}));
const isLocalOnlyMode = shouldUseLocalCaseStore;

// Modul sa natiahne raz, mimo timeoutu jednotlivých testov (stabilita
// pri plnej paralelnej záťaži workera).
const { listCases } = await import("@/lib/case-data");

describe("listCases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    isLocalOnlyMode.mockResolvedValue(false);
  });

  it("propaguje chybu čítania namiesto prázdneho zoznamu", async () => {
    order.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(listCases()).rejects.toThrow("Prípady sa nepodarilo načítať.");
  });

  it("prázdny výsledok zostáva prázdnym zoznamom", async () => {
    order.mockResolvedValue({ data: [], error: null });
    await expect(listCases()).resolves.toEqual([]);
  });

  it("mapuje riadky na zhrnutia prípadov", async () => {
    order.mockResolvedValue({
      data: [
        {
          id: "c1",
          name: "Prípad",
          subtitle: null,
          reference_date: "2026-01-01",
          base_currency: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    });
    const rows = await listCases();
    expect(rows[0]).toMatchObject({
      id: "c1",
      subtitle: "",
      baseCurrency: "EUR",
    });
  });

  it("filtruje zoznam na prihláseného vlastníka", async () => {
    order.mockResolvedValue({ data: [], error: null });
    await listCases();
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("bez platnej relácie neposiela dopyt", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null } as never);
    await expect(listCases()).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
});
