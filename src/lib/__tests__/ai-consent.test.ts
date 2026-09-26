import { describe, expect, it, beforeEach } from "vitest";
import {
  AI_CONSENT_VERSION,
  aiConsentKey,
  assertAiConsent,
  buildDocumentPreview,
  buildFilesPreview,
  grantAiConsent,
  hasAiConsent,
  revokeAiConsent,
} from "@/lib/ai-consent";
import { AI_DISCLAIMER } from "@/config/brand";

function installLocalStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  (globalThis as { localStorage?: unknown }).localStorage = storage;
  (globalThis as { window?: unknown }).window = { localStorage: storage };
}

describe("AI súhlas (TASK 4)", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("kľúč je scoped na používateľa a prípad", () => {
    expect(aiConsentKey("u1", "c1")).toBe("forenx:ai-consent:u1:c1");
    expect(aiConsentKey("u1", "c1")).not.toBe(aiConsentKey("u2", "c1"));
  });

  it("súhlas sa udelí, prečíta a odvolá", () => {
    expect(hasAiConsent("u1", "c1")).toBe(false);
    grantAiConsent("u1", "c1");
    expect(hasAiConsent("u1", "c1")).toBe(true);
    expect(hasAiConsent("u1", "c2")).toBe(false);
    revokeAiConsent("u1", "c1");
    expect(hasAiConsent("u1", "c1")).toBe(false);
  });

  it("server je fail-closed bez súhlasu alebo pri inej verzii", () => {
    expect(() => assertAiConsent(undefined)).toThrow();
    expect(() => assertAiConsent("2000.01-0")).toThrow();
    expect(() => assertAiConsent(AI_CONSENT_VERSION)).not.toThrow();
  });

  it("náhľad odosielaných dát je skrátený a obsahuje názvy súborov", () => {
    const preview = buildDocumentPreview("x".repeat(5000), 3);
    expect(preview.length).toBeLessThan(2000);
    expect(buildFilesPreview([{ name: "spis.pdf", size: 1024 }])).toContain(
      "spis.pdf",
    );
  });
});

describe("Právne upozornenie (TASK 5)", () => {
  it("disclaimer je v slovenčine a hovorí, že AI výstup nie je dôkaz", () => {
    expect(AI_DISCLAIMER).toContain("nie je dôkaz");
  });
});
