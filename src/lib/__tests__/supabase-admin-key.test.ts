import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Supabase admin client (service role)", () => {
  const originalUrl = process.env["SUPABASE_URL"];
  const originalKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env["SUPABASE_URL"];
    else process.env["SUPABASE_URL"] = originalUrl;
    if (originalKey === undefined) {
      delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
    } else {
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = originalKey;
    }
    vi.resetModules();
  });

  it("spadne s jasnou hláškou bez SUPABASE_SERVICE_ROLE_KEY", async () => {
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    delete process.env["SUPABASE_SERVICE_ROLE_KEY"];

    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");

    expect(() => {
      // Proxy vytvorí klienta až pri prvom prístupe k vlastnosti.
      void supabaseAdmin.from;
    }).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("spadne aj keď chýba SUPABASE_URL", async () => {
    delete process.env["SUPABASE_URL"];
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role";

    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");

    expect(() => {
      void supabaseAdmin.from;
    }).toThrow(/SUPABASE_URL/);
  });
});
