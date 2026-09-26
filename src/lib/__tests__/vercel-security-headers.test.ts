import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("vercel security headers", () => {
  it("declares HSTS, Referrer-Policy, Permissions-Policy and CSP", () => {
    const raw = readFileSync(
      resolve(import.meta.dirname, "../../../vercel.json"),
      "utf8",
    );
    const config = JSON.parse(raw) as {
      headers: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
    };

    const global = config.headers.find((h) => h.source === "/(.*)");
    expect(global).toBeTruthy();
    const keys = new Map(
      (global?.headers ?? []).map((h) => [h.key, h.value] as const),
    );

    expect(keys.get("Strict-Transport-Security")).toContain("max-age=31536000");
    expect(keys.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(keys.get("Permissions-Policy")).toContain("camera=()");
    expect(keys.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(keys.get("Content-Security-Policy")).toContain(
      "fonts.googleapis.com",
    );
    expect(keys.get("X-Content-Type-Options")).toBe("nosniff");
    expect(keys.get("X-Frame-Options")).toBe("DENY");
  });
});
