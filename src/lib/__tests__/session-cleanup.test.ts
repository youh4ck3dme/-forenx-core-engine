// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const idbClear = vi.fn(async () => undefined);
vi.mock("@/lib/idb", () => ({ idbClear: () => idbClear() }));

import {
  SESSION_RESET_EVENT,
  POST_SIGN_OUT_ROUTE,
  adoptCloudSession,
  clearClientState,
  signOutEverywhere,
} from "@/lib/session";
const LEGACY_PIN_KEY = "forendo:pin-entry";

function fakeQueryClient() {
  return {
    cancelQueries: vi.fn(async () => undefined),
    clear: vi.fn(),
  };
}

describe("čistenie relácie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("vyčistí stav aj keď úložisko vyhodí chybu", async () => {
    const spy = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
    const qc = fakeQueryClient();
    await expect(
      clearClientState(qc as unknown as never),
    ).resolves.toBeUndefined();
    expect(idbClear).toHaveBeenCalled();
    expect(qc.clear).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("oznámi reset, aby sa pamäťové providery vyprázdnili", async () => {
    const seen = vi.fn();
    window.addEventListener(SESSION_RESET_EVENT, seen);
    await clearClientState();
    expect(seen).toHaveBeenCalled();
    window.removeEventListener(SESSION_RESET_EVENT, seen);
  });

  it("po úmyselnom odhlásení cieľ je welcome page", () => {
    expect(POST_SIGN_OUT_ROUTE).toBe("/");
  });

  it("pri zlyhaní siete odhlási aspoň lokálne a vždy upratuje", async () => {
    const signOut = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ error: null });
    const qc = fakeQueryClient();
    const result = await signOutEverywhere(
      { auth: { signOut } } as never,
      qc as unknown as never,
    );
    expect(signOut).toHaveBeenCalledTimes(2);
    expect(signOut).toHaveBeenLastCalledWith({ scope: "local" });
    expect(result.networkSignOut).toBe(false);
    expect(qc.clear).toHaveBeenCalled();
  });

  it("prechod na skutočný účet zmaže pozostatok po zdieľanom hesle", () => {
    window.localStorage.setItem(LEGACY_PIN_KEY, "true");
    const qc = fakeQueryClient();
    adoptCloudSession(qc as unknown as never);
    expect(window.localStorage.getItem(LEGACY_PIN_KEY)).toBeNull();
    expect(qc.clear).toHaveBeenCalled();
  });
});
