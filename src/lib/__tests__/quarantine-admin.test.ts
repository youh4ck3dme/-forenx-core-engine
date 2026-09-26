import { describe, expect, it } from "vitest";
import { claimEmail, isAdminEmail, parseAdminEmails } from "@/lib/admin";
import { resolveQuarantineFile } from "@/lib/quarantine-path";

describe("admin email gate", () => {
  it("parses FORENX_ADMIN_EMAILS allowlist", () => {
    const set = parseAdminEmails("Erik@Example.com, other@x.sk ,");
    expect(set.has("erik@example.com")).toBe(true);
    expect(set.has("other@x.sk")).toBe(true);
    expect(set.size).toBe(2);
  });

  it("matches allowlist case-insensitively", () => {
    const emails = parseAdminEmails("admin@forenx.sk");
    expect(isAdminEmail("Admin@Forenx.sk", { emails, allowLocal: false })).toBe(
      true,
    );
    expect(isAdminEmail("other@forenx.sk", { emails, allowLocal: false })).toBe(
      false,
    );
  });

  it("allows local dev identity only when enabled", () => {
    expect(
      isAdminEmail("dev@forendo.local", {
        emails: new Set(),
        allowLocal: true,
      }),
    ).toBe(true);
    expect(
      isAdminEmail("dev@forendo.local", {
        emails: new Set(),
        allowLocal: false,
      }),
    ).toBe(false);
  });

  it("reads email from claims", () => {
    expect(claimEmail({ email: "a@b.c" })).toBe("a@b.c");
    expect(claimEmail({})).toBeNull();
    expect(claimEmail(null)).toBeNull();
  });
});

describe("resolveQuarantineFile path safety", () => {
  it("rejects path traversal and nested paths", () => {
    expect(() => resolveQuarantineFile("../secret.md")).toThrow(/Neplatný/);
    expect(() => resolveQuarantineFile("sub/secret.md")).toThrow(/Neplatný/);
    expect(() => resolveQuarantineFile("..\\windows.md")).toThrow(/Neplatný/);
  });

  it("rejects unsupported extensions", () => {
    expect(() => resolveQuarantineFile("payload.exe")).toThrow(/Nepodporovaný/);
  });

  it("resolves basename-only allowed files under quarantine root", () => {
    const full = resolveQuarantineFile("01_UPLNY_PREPIS_stran_2-11.md");
    expect(full.replace(/\\/g, "/")).toMatch(
      /quarantine\/repo-root\/01_UPLNY_PREPIS_stran_2-11\.md$/,
    );
  });
});
