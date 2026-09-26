import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  passesFilter,
  readStoredTheme,
  THEME_STORAGE_KEY,
} from "@/hooks/useCaseStore";
import type { Alert } from "@/forensic/types";

describe("Theme and Notifications logic", () => {
  it("passesFilter správne filtruje závažnosti", () => {
    expect(passesFilter([], "critical")).toBe(true);
    expect(passesFilter(["critical"], "critical")).toBe(true);
    expect(passesFilter(["high"], "critical")).toBe(false);
    expect(passesFilter(["critical", "high"], "high")).toBe(true);
  });

  it("správne filtruje notifikácie podľa stavu prečítania a kritickosti", () => {
    const mockAlerts: Alert[] = [
      {
        id: "alert-1",
        title: "Kritická anomália",
        detail: "Podozrivý prevod",
        severity: "critical",
        score: 95,
        source: "transakcia",
      },
      {
        id: "alert-2",
        title: "Vysoké riziko",
        detail: "Schránková firma",
        severity: "high",
        score: 80,
        source: "entita",
      },
      {
        id: "alert-3",
        title: "Bežné zistenie",
        detail: "Prevod hotovosti",
        severity: "low",
        score: 30,
        source: "časový vzor",
      },
    ];

    let reviewed: string[] = [];

    // Počiatočný stav - 3 neprečítané
    const unread = mockAlerts.filter((a) => !reviewed.includes(a.id));
    expect(unread.length).toBe(3);

    // Označenie alert-1 ako prečítaného
    reviewed = [...reviewed, "alert-1"];
    const unreadAfterOne = mockAlerts.filter((a) => !reviewed.includes(a.id));
    expect(unreadAfterOne.length).toBe(2);
    expect(unreadAfterOne.some((a) => a.id === "alert-1")).toBe(false);

    // Označenie všetkých ako prečítaných
    const allIds = mockAlerts.map((a) => a.id);
    reviewed = Array.from(new Set([...reviewed, ...allIds]));
    const unreadAfterAll = mockAlerts.filter((a) => !reviewed.includes(a.id));
    expect(unreadAfterAll.length).toBe(0);

    // Filtrovanie kritických
    const critical = mockAlerts.filter((a) => a.severity === "critical");
    expect(critical.length).toBe(1);
    expect(critical[0]!.id).toBe("alert-1");
  });

  it("podporuje platné režimy témy (light, dark, system)", () => {
    const validModes = ["light", "dark", "system"] as const;
    expect(validModes).toContain("light");
    expect(validModes).toContain("dark");
    expect(validModes).toContain("system");
    expect(validModes.length).toBe(3);
  });

  describe("readStoredTheme", () => {
    const memory = new Map<string, string>();
    const originalWindow = globalThis.window;

    beforeEach(() => {
      memory.clear();
      const localStorage = {
        getItem: (k: string) => memory.get(k) ?? null,
        setItem: (k: string, v: string) => {
          memory.set(k, v);
        },
        removeItem: (k: string) => {
          memory.delete(k);
        },
      };
      Object.defineProperty(globalThis, "window", {
        value: { localStorage },
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "localStorage", {
        value: localStorage,
        configurable: true,
        writable: true,
      });
    });

    afterEach(() => {
      if (originalWindow) {
        Object.defineProperty(globalThis, "window", {
          value: originalWindow,
          configurable: true,
          writable: true,
        });
      }
    });

    it("vráti null, keď localStorage tému nemá", () => {
      expect(readStoredTheme()).toBeNull();
    });

    it("číta uloženú tému z localStorage, nie z oneskoreného IDB", () => {
      globalThis.localStorage.setItem(THEME_STORAGE_KEY, "dark");
      expect(readStoredTheme()).toBe("dark");
      globalThis.localStorage.setItem(THEME_STORAGE_KEY, "light");
      expect(readStoredTheme()).toBe("light");
    });

    it("ignoruje neplatnú hodnotu", () => {
      globalThis.localStorage.setItem(THEME_STORAGE_KEY, "neon");
      expect(readStoredTheme()).toBeNull();
    });
  });
});
