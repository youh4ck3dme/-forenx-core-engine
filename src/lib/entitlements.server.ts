import { PLANS, type PlanId } from "@/config/billing";

/**
 * Serverové oprávnenia. Plán sa číta z overeného záznamu predplatného
 * (funkcia `current_plan` je volateľná len service_role), nikdy z klienta.
 */
export async function getPlanId(userId: string): Promise<PlanId> {
  try {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("current_plan", {
      _user: userId,
    });
    if (error) return "free";
    return data === "pro" ? "pro" : "free";
  } catch {
    return "free";
  }
}

export async function getQuotas(userId: string) {
  const plan = await getPlanId(userId);
  return { plan, ...PLANS[plan].quotas };
}
