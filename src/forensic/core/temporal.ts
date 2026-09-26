import type { TemporalPattern, Transaction } from "../types";
import { daysBetween, formatDate, formatEur, levelFromScore } from "./utils";

const WEEKDAYS = [
  "nedeľa",
  "pondelok",
  "utorok",
  "streda",
  "štvrtok",
  "piatok",
  "sobota",
];

/** Detekcia časových vzorov v transakciách (deň v týždni, pravidelnosť, dávky, eskalácia). */
export function detectTemporalPatterns(
  transactions: Transaction[],
): TemporalPattern[] {
  if (transactions.length < 3) return [];
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const patterns: TemporalPattern[] = [];

  // 1. Koncentrácia na jeden deň v týždni.
  const byWeekday = new Map<number, Transaction[]>();
  for (const t of sorted) {
    const day = new Date(t.date).getUTCDay();
    byWeekday.set(day, [...(byWeekday.get(day) ?? []), t]);
  }
  for (const [day, group] of byWeekday) {
    const share = group.length / sorted.length;
    if (group.length >= 3 && share >= 0.35) {
      const score = Math.min(100, Math.round(40 + share * 70));
      patterns.push({
        code: "WEEKDAY_CONCENTRATION",
        label: `Vzor: vždy ${WEEKDAYS[day]}`,
        detail: `${group.length} z ${sorted.length} transakcií (${Math.round(share * 100)} %) pripadá na ${WEEKDAYS[day]}`,
        transactionIds: group.map((t) => t.id),
        score,
        severity: levelFromScore(score),
      });
    }
  }

  // 2. Víkendová aktivita — mimo bežných obchodných dní.
  const weekend = sorted.filter((t) =>
    [0, 6].includes(new Date(t.date).getUTCDay()),
  );
  if (weekend.length >= 2) {
    patterns.push({
      code: "WEEKEND_ACTIVITY",
      label: "Aktivita cez víkend",
      detail: `${weekend.length} transakcií mimo pracovných dní • ${formatEur(weekend.reduce((s, t) => s + t.amount, 0))}`,
      transactionIds: weekend.map((t) => t.id),
      score: 62,
      severity: "high",
    });
  }

  // 3. Pravidelný interval (metronóm) — nízky rozptyl odstupov.
  if (sorted.length >= 4) {
    const gaps = sorted
      .slice(1)
      .map((t, i) => daysBetween(sorted[i]!.date, t.date));
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const sd = Math.sqrt(
      gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length,
    );
    if (mean > 0 && sd / mean <= 0.45) {
      patterns.push({
        code: "REGULAR_INTERVAL",
        label: "Pravidelný interval",
        detail: `Transakcie sa opakujú približne každých ${Math.round(mean)} dní (odchýlka ${Math.round(sd)} dní)`,
        transactionIds: sorted.map((t) => t.id),
        score: 66,
        severity: "high",
      });
    }
  }

  // 4. Dávky — viac transakcií v krátkom okne.
  for (const anchor of sorted) {
    const burst = sorted.filter((t) => daysBetween(anchor.date, t.date) <= 3);
    if (burst.length >= 2 && burst[0]!.id === anchor.id) {
      const volume = burst.reduce((s, t) => s + t.amount, 0);
      if (volume >= 50_000) {
        patterns.push({
          code: "BURST",
          label: "Dávka transakcií",
          detail: `${burst.length} transakcií v okne 72 hodín od ${formatDate(anchor.date)} • ${formatEur(volume)}`,
          transactionIds: burst.map((t) => t.id),
          score: 70,
          severity: "high",
        });
      }
    }
  }

  // 5. Eskalácia súm v čase.
  const first = sorted.slice(0, Math.ceil(sorted.length / 2));
  const second = sorted.slice(Math.ceil(sorted.length / 2));
  const avgFirst =
    first.reduce((s, t) => s + t.amount, 0) / Math.max(1, first.length);
  const avgSecond =
    second.reduce((s, t) => s + t.amount, 0) / Math.max(1, second.length);
  if (avgFirst > 0 && avgSecond / avgFirst >= 1.5) {
    patterns.push({
      code: "ESCALATION",
      label: "Eskalácia objemov",
      detail: `Priemerná suma stúpla z ${formatEur(avgFirst)} na ${formatEur(avgSecond)} (+${Math.round((avgSecond / avgFirst - 1) * 100)} %)`,
      transactionIds: second.map((t) => t.id),
      score: 64,
      severity: "high",
    });
  }

  // 6. Koniec mesiaca / štvrťroka.
  const monthEnd = sorted.filter((t) => new Date(t.date).getUTCDate() >= 25);
  if (monthEnd.length >= 3 && monthEnd.length / sorted.length >= 0.3) {
    patterns.push({
      code: "MONTH_END",
      label: "Koncentrácia na koniec mesiaca",
      detail: `${monthEnd.length} transakcií v poslednej dekáde mesiaca`,
      transactionIds: monthEnd.map((t) => t.id),
      score: 52,
      severity: "medium",
    });
  }

  return dedupe(patterns).sort((a, b) => b.score - a.score);
}

function dedupe(patterns: TemporalPattern[]): TemporalPattern[] {
  const seen = new Set<string>();
  return patterns.filter((p) => {
    const key = `${p.code}:${p.transactionIds.join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
