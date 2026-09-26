import { describe, expect, it, beforeEach } from "vitest";
import {
  decideNextStep,
  isProfileSkipped,
  setProfileSkipped,
  clearProfileSkip,
} from "@/lib/onboarding";

/** Pamäťová náhrada sessionStorage (testy bežia v prostredí Node). */
function installSessionStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
}

describe("rozhodovanie o ďalšom kroku", () => {
  it("nedokončený profil vedie na profil", () => {
    expect(decideNextStep({ profileCompleted: false, caseCount: 3 })).toEqual({
      kind: "profile",
      to: "/profil",
    });
  });

  it("bez prípadov vedie na založenie prípadu", () => {
    expect(decideNextStep({ profileCompleted: true, caseCount: 0 })).toEqual({
      kind: "new-case",
      to: "/pripady",
    });
  });

  it("vracajúci sa používateľ ide rovno na prehľad", () => {
    expect(decideNextStep({ profileCompleted: true, caseCount: 2 })).toEqual({
      kind: "overview",
      to: "/prehlad",
    });
  });

  it("preskočený profil nezacyklí používateľa", () => {
    expect(
      decideNextStep({
        profileCompleted: false,
        caseCount: 1,
        profileSkipped: true,
      }),
    ).toEqual({ kind: "overview", to: "/prehlad" });
  });

  it("zlyhané načítanie je chyba, nie „žiadne prípady“", () => {
    expect(
      decideNextStep({
        profileCompleted: true,
        caseCount: 0,
        loadFailed: true,
      }),
    ).toEqual({ kind: "error" });
  });
});

describe("preskočenie profilu", () => {
  beforeEach(() => {
    installSessionStorage();
  });

  it("je viazané na konkrétny účet", () => {
    setProfileSkipped("a@b.sk");
    expect(isProfileSkipped("a@b.sk")).toBe(true);
    expect(isProfileSkipped("iny@b.sk")).toBe(false);
    clearProfileSkip("a@b.sk");
    expect(isProfileSkipped("a@b.sk")).toBe(false);
  });

  it("bez účtu nič neukladá", () => {
    setProfileSkipped(null);
    expect(isProfileSkipped(null)).toBe(false);
  });
});
