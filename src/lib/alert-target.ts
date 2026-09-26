import type { DetectorTarget } from "@/components/malte/DetectorSheet";

/** Namapuje ID zistenia na cieľ detektora (entita / transakcia). */
export function alertTarget(alertId: string): DetectorTarget | null {
  if (alertId.startsWith("entity-"))
    return { kind: "entity", id: alertId.slice(7) };
  if (alertId.startsWith("tx-"))
    return { kind: "transaction", id: alertId.slice(3) };
  if (alertId.startsWith("chain-"))
    return { kind: "entity", id: alertId.slice(6) };
  if (alertId.startsWith("cb-"))
    return { kind: "transaction", id: alertId.slice(3) };
  return null;
}
