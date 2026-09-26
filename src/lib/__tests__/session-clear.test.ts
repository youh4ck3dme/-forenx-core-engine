import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/idb", () => ({ idbClear: vi.fn(async () => {}) }));

import { clearClientState } from "@/lib/session";
import { idbClear as idbClearMock } from "@/lib/idb";

const idbClear = idbClearMock as unknown as ReturnType<typeof vi.fn>;

type Store = Map<string, string>;

function makeStorage(initial: Record<string, string> = {}) {
  const store: Store = new Map(Object.entries(initial));
  return {
    store,
    api: {
      get length() {
        return store.size;
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  };
}

describe("vyčistenie klientského stavu", () => {
  let local: ReturnType<typeof makeStorage>;
  let deleted: string[];

  beforeEach(() => {
    idbClear.mockClear();
    deleted = [];
    local = makeStorage({
      "forendo:pin-entry": "true",
      "malte:active-case": "abc",
      "forenx:local-profile": "{}",
      "cudzia-aplikacia": "nechaj",
    });
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: local.api,
      sessionStorage: makeStorage().api,
      caches: {
        keys: async () => ["forenx-cache-v5"],
        delete: async (key: string) => {
          deleted.push(key);
          return true;
        },
      },
    };
    (globalThis as unknown as { caches: unknown }).caches = (
      globalThis as unknown as { window: { caches: unknown } }
    ).window.caches;
  });

  it("zmaže len kľúče aplikácie a nechá cudzie dáta", async () => {
    await clearClientState();
    expect(local.store.has("forendo:pin-entry")).toBe(false);
    expect(local.store.has("malte:active-case")).toBe(false);
    expect(local.store.has("forenx:local-profile")).toBe(false);
    expect(local.store.get("cudzia-aplikacia")).toBe("nechaj");
  });

  it("vyčistí IndexedDB aplikácie a offline pamäť", async () => {
    await clearClientState();
    expect(idbClear).toHaveBeenCalledTimes(1);
    expect(deleted).toContain("forenx-cache-v5");
  });

  it("zlyhanie jedného úložiska nezastaví ostatné", async () => {
    idbClear.mockRejectedValueOnce(new Error("IDB nedostupné"));
    await expect(clearClientState()).resolves.toBeUndefined();
    expect(deleted).toContain("forenx-cache-v5");
  });

  it("zruší bežiace dotazy a vyprázdni pamäť dotazov", async () => {
    const cancelQueries = vi.fn(async () => {});
    const clear = vi.fn();
    await clearClientState({ cancelQueries, clear } as never);
    expect(cancelQueries).toHaveBeenCalled();
    expect(clear).toHaveBeenCalledTimes(2);
  });
});
