/**
 * Konfigurácia plánov. Ceny sú TESTOVACIE, nie finálny cenník.
 * price_id sú stabilné identifikátory (rovnaké v testovacom aj živom prostredí).
 */
export type PlanId = "free" | "pro";

export type PlanConfig = {
  id: PlanId;
  name: string;
  description: string;
  /** Zobrazovaná cena; null = bez poplatku. */
  amount: number | null;
  currency: string;
  interval: "month" | "year" | null;
  priceId: string | null;
  quotas: {
    /** Denný limit AI volaní (serverovo vynútený). */
    aiPerDay: number;
    /** Maximálny počet riadkov v jednom importe (serverovo vynútený). */
    importRows: number;
  };
  features: string[];
};

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Základ",
    description: "Lokálna analýza, import a správy bez poplatku.",
    amount: null,
    currency: "EUR",
    interval: null,
    priceId: null,
    quotas: { aiPerDay: 25, importRows: 2000 },
    features: [
      "Neobmedzené prípady a transakcie",
      "Deterministické nálezy a správa so zdrojmi",
      "25 AI odpovedí denne",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro (testovacia cena)",
    description: "Vyšší limit serverových služieb pre intenzívnu prácu.",
    amount: 29,
    currency: "EUR",
    interval: "month",
    priceId: "pro_monthly",
    quotas: { aiPerDay: 200, importRows: 50000 },
    features: [
      "200 AI odpovedí denne",
      "Väčšie importy (50 000 riadkov)",
      "Prednostná podpora",
    ],
  },
};

export const YEARLY_PRICE_ID = "pro_yearly";

export function planOf(plan: string | null | undefined): PlanConfig {
  return plan === "pro" ? PLANS.pro : PLANS.free;
}

/** Stavy poskytovateľa, pri ktorých je platený plán aktívny. */
export const ACTIVE_STATUSES = ["active", "trialing", "past_due"];
