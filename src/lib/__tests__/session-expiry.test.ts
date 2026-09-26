import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession, getUser: vi.fn() } },
}));

class MockStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

const mockStorage = new MockStorage();

function useHost(hostname: string) {
  vi.stubGlobal("window", {
    location: { hostname, pathname: "/prehlad", replace: vi.fn() },
    localStorage: mockStorage,
  });
}

describe("shouldUseLocalCaseStore (explicitné zlyhanie relácie)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("v produkcii bez relácie vyhodí chybu aj s dev príznakom", async () => {
    useHost("whoiswho.at");
    mockStorage.setItem("forendo:dev-free-entry", "true");
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    const { shouldUseLocalCaseStore } = await import("@/lib/identity");
    await expect(shouldUseLocalCaseStore()).rejects.toThrow(
      "Relácia vypršala. Prihláste sa znova.",
    );
  });

  it("v produkcii s vypršaným tokenom vyhodí chybu", async () => {
    useHost("whoiswho.at");
    getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "u1" },
          expires_at: Math.floor(Date.now() / 1000) - 60,
        },
      },
      error: null,
    });
    const { shouldUseLocalCaseStore } = await import("@/lib/identity");
    await expect(shouldUseLocalCaseStore()).rejects.toThrow(
      "Relácia vypršala. Prihláste sa znova.",
    );
  });

  it("s platnou reláciou pracuje s cloudom", async () => {
    useHost("whoiswho.at");
    getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "u1" },
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      error: null,
    });
    const { shouldUseLocalCaseStore } = await import("@/lib/identity");
    await expect(shouldUseLocalCaseStore()).resolves.toBe(false);
  });

  it("na localhoste s dev vstupom povolí lokálne prípady", async () => {
    useHost("localhost");
    mockStorage.setItem("forendo:dev-free-entry", "true");
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    const { shouldUseLocalCaseStore } = await import("@/lib/identity");
    await expect(shouldUseLocalCaseStore()).resolves.toBe(true);
  });
});
