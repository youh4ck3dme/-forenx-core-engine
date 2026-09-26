// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/idb", () => ({ idbClear: vi.fn(async () => undefined) }));

import {
  POST_SIGN_OUT_ROUTE,
  clearClientState,
  signOutEverywhere,
} from "@/lib/session";
import {
  beginIntentionalSignOut,
  isIntentionalSignOut,
  resetSessionExpiryGuard,
} from "@/lib/session-guard";

describe("odhlásenie → welcome + ochrana Späť", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetSessionExpiryGuard();
  });

  it("po odhlásení ide na welcome (/), nie na /auth", () => {
    expect(POST_SIGN_OUT_ROUTE).toBe("/");
  });

  it("signOutEverywhere vyčistí pamäť prípadu a označí úmyselné odhlásenie", async () => {
    window.localStorage.setItem("malte:active-case", "case-1");
    window.localStorage.setItem("forenx:theme", "dark");
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const qc = {
      cancelQueries: vi.fn(async () => undefined),
      clear: vi.fn(),
    };

    beginIntentionalSignOut();
    expect(isIntentionalSignOut()).toBe(true);

    await signOutEverywhere(
      { auth: { signOut } } as never,
      qc as unknown as never,
    );

    expect(signOut).toHaveBeenCalled();
    expect(qc.clear).toHaveBeenCalled();
    expect(window.localStorage.getItem("malte:active-case")).toBeNull();
  });

  it("po vyčistení relácie chránená cesta nemá lokálne dáta prípadu (regresia Späť)", async () => {
    window.localStorage.setItem("malte:active-case", "secret-case");
    window.sessionStorage.setItem("peek", "1");
    await clearClientState();
    expect(window.localStorage.getItem("malte:active-case")).toBeNull();
    expect(window.sessionStorage.getItem("peek")).toBeNull();
    // Router beforeLoad na /_authenticated bez session redirectne na /auth —
    // Späť teda nesmie obnoviť obsah z localStorage.
  });
});
