import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");

describe("Secrets boundary (kľúče nesmú ísť do klienta)", () => {
  it("klientsky kód nečíta MISTRAL_API_KEY ani XAI_API_KEY", () => {
    const files = globSync("src/{components,hooks,routes}/**/*.{ts,tsx}", {
      cwd: ROOT,
    }).filter((f) => !f.includes(`${path.sep}api${path.sep}`));

    const leaks: string[] = [];
    for (const rel of files) {
      const text = readFileSync(path.join(ROOT, rel), "utf8");
      if (
        /process\.env\[["'](MISTRAL_API_KEY(?:_CHAT|_ANALYSIS)?|XAI_API_KEY|STRIPE_LIVE_SECRET_KEY|STRIPE_SANDBOX_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY)["']\]/.test(
          text,
        )
      ) {
        leaks.push(rel);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("VITE_ premenné v klientovi nie sú serverové AI kľúče", () => {
    const files = globSync("src/**/*.{ts,tsx}", { cwd: ROOT });
    const leaks: string[] = [];
    for (const rel of files) {
      const text = readFileSync(path.join(ROOT, rel), "utf8");
      if (/VITE_(MISTRAL|XAI|STRIPE_LIVE|SERVICE_ROLE)/.test(text)) {
        leaks.push(rel);
      }
    }
    expect(leaks).toEqual([]);
  });
});
