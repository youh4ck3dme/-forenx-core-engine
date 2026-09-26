import type { Relation, TraffickingChain, Transaction } from "../types";

/** Reťazce dodávateľ → schránková firma → odberateľ z hrán siete. */
export function detectChains(
  relations: Relation[],
  transactions: Transaction[],
  shellIds: string[],
): TraffickingChain[] {
  const edges = [
    ...relations.map((r) => [r.fromId, r.toId] as const),
    ...transactions.map((t) => [t.fromId, t.toId] as const),
  ];

  return shellIds
    .map<TraffickingChain | null>((shellId) => {
      const supplierIds = unique(
        edges.filter(([, to]) => to === shellId).map(([from]) => from),
      );
      const buyerIds = unique(
        edges.filter(([from]) => from === shellId).map(([, to]) => to),
      );
      if (supplierIds.length === 0 || buyerIds.length === 0) return null;
      return {
        shellId,
        supplierIds,
        buyerIds,
        severity:
          supplierIds.length + buyerIds.length >= 4 ? "critical" : "high",
      };
    })
    .filter((c): c is TraffickingChain => c !== null);
}

/** Izolované firmy — najviac 2 väzby v sieti. */
export function detectIsolatedCompanies(
  relations: Relation[],
  companyIds: string[],
): string[] {
  return companyIds.filter((id) => {
    const degree = relations.filter(
      (r) => r.fromId === id || r.toId === id,
    ).length;
    return degree <= 2;
  });
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
