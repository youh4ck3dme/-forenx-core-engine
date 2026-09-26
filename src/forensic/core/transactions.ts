import type {
  EvidenceRef,
  Flag,
  Transaction,
  TransactionAnalysis,
} from "../types";
import { daysBetween, levelFromScore, scoreFromFlags } from "./utils";
import { formatMoney, sumMoney, sumVolume } from "./money";
import { withRuleMeta } from "./rules";

export const TX_RULES = {
  roundAmounts: [20_000, 25_000, 30_000, 35_000, 40_000],
  rapidSuccessive: { count: 3, days: 183 },
  sameDay: { count: 2, amount: 50_000 },
  cashIntensiveRatio: 0.8,
};

const txRef = (t: Transaction): EvidenceRef => ({
  type: "transaction",
  id: t.id,
});

/** Sumy sa porovnávajú v absolútnej hodnote — záporná suma je opačný smer, nie iná veľkosť. */
function magnitude(tx: Transaction): number {
  return Math.abs(tx.amount);
}

export function flagTransaction(tx: Transaction, all: Transaction[]): Flag[] {
  const flags: Flag[] = [];
  const currency = tx.currency || "EUR";
  const value = magnitude(tx);
  const sameCurrency = all.filter((t) => (t.currency || "EUR") === currency);

  if (TX_RULES.roundAmounts.includes(value)) {
    flags.push(
      withRuleMeta(
        {
          code: "ROUND_AMOUNT",
          label: "Zaokrúhlená suma",
          detail: `${formatMoney(value, currency)} presne na tisíce`,
          weight: 18,
          severity: "medium",
          values: { amount: value, currency },
        },
        [txRef(tx)],
      ),
    );
  }

  if (tx.method === "cash" && value >= 15_000) {
    flags.push(
      withRuleMeta(
        {
          code: "CASH_HIGH_VALUE",
          label: "Vysoká hotovostná platba",
          detail: `${formatMoney(value, currency)} v hotovosti`,
          weight: 24,
          severity: "high",
          values: { amount: value, currency, threshold: 15_000 },
        },
        [txRef(tx)],
      ),
    );
  }

  // Rovnaký deň sa vyhodnocuje len v rámci jednej meny — sumy sa nekonvertujú.
  const sameDay = sameCurrency.filter((t) => t.date === tx.date);
  const sameDaySum = sumVolume(sameDay.map((t) => t.amount));
  if (
    sameDay.length >= TX_RULES.sameDay.count &&
    sameDaySum >= TX_RULES.sameDay.amount
  ) {
    flags.push(
      withRuleMeta(
        {
          code: "SAME_DAY",
          label: "Viac transakcií v jeden deň",
          detail: `${sameDay.length} transakcie • spolu ${formatMoney(sameDaySum, currency)}`,
          weight: 20,
          severity: "high",
          values: { count: sameDay.length, sum: sameDaySum, currency },
        },
        sameDay.map(txRef),
      ),
    );
  }

  const related = all.filter(
    (t) =>
      (t.fromId === tx.fromId ||
        (tx.payerId != null && t.payerId === tx.payerId)) &&
      daysBetween(t.date, tx.date) <= TX_RULES.rapidSuccessive.days,
  );
  if (related.length >= TX_RULES.rapidSuccessive.count) {
    flags.push(
      withRuleMeta(
        {
          code: "RAPID_SUCCESSIVE",
          label: "Rýchle opakovanie nákupov",
          detail: `${related.length} transakcií rovnakej strany za 6 mesiacov`,
          weight: 16,
          severity: "high",
          values: {
            count: related.length,
            windowDays: TX_RULES.rapidSuccessive.days,
          },
        },
        related.map(txRef),
      ),
    );
  }

  if (tx.payerId && tx.payerId !== tx.fromId) {
    flags.push(
      withRuleMeta(
        {
          code: "THIRD_PARTY_PAYMENT",
          label: "Platba tretej strany",
          detail: "Skutočný platiteľ nie je zmluvnou stranou",
          weight: 18,
          severity: "high",
        },
        [txRef(tx), { type: "entity", id: tx.payerId }],
      ),
    );
  }

  return flags;
}

export function cashRatio(transactions: Transaction[]): number {
  if (transactions.length === 0) return 0;
  const cash = sumVolume(
    transactions.filter((t) => t.method === "cash").map((t) => t.amount),
  );
  const total = sumVolume(transactions.map((t) => t.amount));
  return total === 0 ? 0 : cash / total;
}

/** Čistý súčet podpísaných súm v jednej mene (kladné aj záporné korekcie). */
export function netAmount(transactions: Transaction[]): number {
  return sumMoney(transactions.map((t) => t.amount));
}

/** Vyhodnotí jednu transakciu v kontexte celého prípadu. */
export function monitorTransaction(
  transaction: Transaction,
  all: Transaction[],
): TransactionAnalysis {
  const flags = flagTransaction(transaction, all);
  const score = scoreFromFlags(flags);
  return { transaction, flags, score, level: levelFromScore(score) };
}

export function isCashIntensive(transactions: Transaction[]): boolean {
  return cashRatio(transactions) >= TX_RULES.cashIntensiveRatio;
}
