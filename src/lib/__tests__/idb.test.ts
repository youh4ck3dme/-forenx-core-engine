import { describe, expect, it } from "vitest";
import { idbClear, idbGet, idbSet } from "../idb";

describe("IndexedDB store", () => {
  it("surfaces an explicit error when IndexedDB is unavailable", async () => {
    await expect(idbGet("state")).rejects.toThrow("IndexedDB nie je dostupné");
    await expect(idbSet("state", { ok: true })).rejects.toThrow(
      "IndexedDB nie je dostupné",
    );
    await expect(idbClear()).rejects.toThrow("IndexedDB nie je dostupné");
  });
});
