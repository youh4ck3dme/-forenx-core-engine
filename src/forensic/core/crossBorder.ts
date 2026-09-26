import type { Corridor, CrossBorderAlert, Transaction } from "../types";
import { levelFromScore } from "./utils";

export const EU_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

export const HIGH_RISK_DESTINATIONS = new Set(["ES", "PL", "FR", "UK"]);
const AMOUNT_THRESHOLD = 50_000;

export const COUNTRY_LABEL: Record<string, string> = {
  SK: "Slovensko",
  ES: "Španielsko",
  PL: "Poľsko",
  FR: "Francúzsko",
  UK: "Spojené kráľovstvo",
  CZ: "Česko",
  AT: "Rakúsko",
  HU: "Maďarsko",
  DE: "Nemecko",
};

export function detectSuspiciousFlows(
  transactions: Transaction[],
): CrossBorderAlert[] {
  return transactions
    .filter((t) => t.originCountry !== t.destinationCountry)
    .filter(
      (t) =>
        HIGH_RISK_DESTINATIONS.has(t.destinationCountry) &&
        t.amount >= AMOUNT_THRESHOLD,
    )
    .map((t) => ({
      transactionId: t.id,
      route: `${t.originCountry} → ${t.destinationCountry}`,
      amount: t.amount,
      score: Math.min(100, 55 + Math.round(t.amount / 4000)),
    }))
    .sort((a, b) => b.score - a.score);
}

/** Agregácia tokov do koridorov medzi krajinami. */
export function buildCorridors(transactions: Transaction[]): Corridor[] {
  const map = new Map<string, Corridor>();

  for (const t of transactions) {
    if (t.originCountry === t.destinationCountry) continue;
    const route = `${t.originCountry} → ${t.destinationCountry}`;
    const existing = map.get(route);
    if (existing) {
      existing.count += 1;
      existing.amount += t.amount;
    } else {
      map.set(route, {
        route,
        originCountry: t.originCountry,
        destinationCountry: t.destinationCountry,
        count: 1,
        amount: t.amount,
        highRisk: HIGH_RISK_DESTINATIONS.has(t.destinationCountry),
        score: 0,
        severity: "low",
      });
    }
  }

  return [...map.values()]
    .map((c) => {
      const score = Math.min(
        100,
        Math.round((c.highRisk ? 45 : 20) + c.count * 8 + c.amount / 5_000),
      );
      return { ...c, score, severity: levelFromScore(score) };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Tranzitná anomália — tovar/peniaze idú do krajiny, kde protistrana nesídli
 * (napr. platba španielskej firme smerovaná do Poľska).
 */
export function detectTransitAnomalies(
  transactions: Transaction[],
  countryOf: (entityId: string) => string | undefined,
): CrossBorderAlert[] {
  return transactions
    .filter((t) => {
      const counterparty = countryOf(t.toId);
      return (
        counterparty !== undefined &&
        t.destinationCountry !== counterparty &&
        t.destinationCountry !== t.originCountry
      );
    })
    .map((t) => ({
      transactionId: t.id,
      route: `${t.originCountry} → ${t.destinationCountry} (protistrana ${countryOf(t.toId)})`,
      amount: t.amount,
      score: Math.min(100, 68 + Math.round(t.amount / 6_000)),
    }))
    .sort((a, b) => b.score - a.score);
}
