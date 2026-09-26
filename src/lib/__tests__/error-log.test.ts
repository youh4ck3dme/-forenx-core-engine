import { describe, expect, it, vi } from "vitest";
import { logError, toErrorLogEntry } from "@/lib/error-log.server";

const inserted: Record<string, unknown>[] = [];

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        inserted.push(row);
        return { error: null };
      },
    }),
  },
}));

describe("zápis chýb do error_logs", () => {
  it("zabalí Error na záznam so stackom", () => {
    const entry = toErrorLogEntry(new Error("bum"), { route: "/prehlad" });
    expect(entry.message).toBe("bum");
    expect(entry.stack).toContain("Error: bum");
    expect(entry.route).toBe("/prehlad");
  });

  it("zvládne aj chybu, ktorá nie je Error", () => {
    expect(toErrorLogEntry("text").message).toBe("text");
    expect(toErrorLogEntry(null).message).toBe("Neznáma chyba");
  });

  it("uloží záznam s prednastavenou závažnosťou a zdrojom", async () => {
    await logError({ message: "chyba", route: "/stav" });
    const row = inserted.at(-1)!;
    expect(row["message"]).toBe("chyba");
    expect(row["severity"]).toBe("error");
    expect(row["source"]).toBe("server");
  });

  it("skráti príliš dlhý výpis", async () => {
    await logError({ message: "x".repeat(2_000) });
    expect(String(inserted.at(-1)!["message"]).length).toBeLessThanOrEqual(
      1_001,
    );
  });
});
