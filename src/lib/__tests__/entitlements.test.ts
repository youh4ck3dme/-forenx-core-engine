import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

describe("Entitlements (fail-closed na free)", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("vráti pro, keď RPC vráti pro", async () => {
    rpc.mockResolvedValue({ data: "pro", error: null });
    const { getPlanId, getQuotas } = await import("@/lib/entitlements.server");
    expect(await getPlanId("user-1")).toBe("pro");
    const quotas = await getQuotas("user-1");
    expect(quotas.plan).toBe("pro");
    expect(quotas.aiPerDay).toBeGreaterThan(25);
  });

  it("pri chybe RPC aj výnimke ostane free (fail-closed)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "fn missing" } });
    const { getPlanId } = await import("@/lib/entitlements.server");
    expect(await getPlanId("user-1")).toBe("free");

    rpc.mockRejectedValue(new Error("network"));
    expect(await getPlanId("user-1")).toBe("free");
  });

  it("neznámy plán z RPC nie je eskalácia na pro", async () => {
    rpc.mockResolvedValue({ data: "enterprise", error: null });
    const { getPlanId } = await import("@/lib/entitlements.server");
    expect(await getPlanId("user-1")).toBe("free");
  });
});
