import type {
  Entity,
  LaunderingSignal,
  MoneyPath,
  Severity,
  Transaction,
} from "../types";
import { daysBetween, formatEur, levelFromScore } from "./utils";

const MAX_HOPS = 4;
const MAX_SPAN_DAYS = 200;
/** Tolerancia poklesu sumy medzi krokmi (provízia vrstviteľa). */
const MIN_PASS_RATIO = 0.5;

/**
 * Sledovanie peňazí cez viacero spoločností (layering).
 * Prehľadáva reťaz transakcií v chronologickom poradí: A → B → C …
 */
export function traceMoneyPaths(
  transactions: Transaction[],
  shellIds: string[] = [],
): MoneyPath[] {
  const shells = new Set(shellIds);
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const paths: MoneyPath[] = [];

  const walk = (chain: Transaction[]) => {
    const last = chain[chain.length - 1]!;
    const next = sorted.filter(
      (t) =>
        t.fromId === last.toId &&
        t.date >= last.date &&
        !chain.some((c) => c.id === t.id) &&
        t.amount >= last.amount * MIN_PASS_RATIO &&
        daysBetween(chain[0]!.date, t.date) <= MAX_SPAN_DAYS,
    );

    if (chain.length >= 2) paths.push(toPath(chain, shells));
    if (chain.length >= MAX_HOPS) return;
    for (const t of next) walk([...chain, t]);
  };

  for (const t of sorted) walk([t]);

  return dedupePaths(paths)
    .filter((p) => p.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

function toPath(chain: Transaction[], shells: Set<string>): MoneyPath {
  const entityIds = [chain[0]!.fromId, ...chain.map((t) => t.toId)];
  const amount = Math.min(...chain.map((t) => t.amount));
  const spanDays = Math.round(
    daysBetween(chain[0]!.date, chain[chain.length - 1]!.date),
  );
  const viaShellIds = entityIds.slice(1, -1).filter((id) => shells.has(id));
  const crossesBorder = chain.some(
    (t) => t.originCountry !== t.destinationCountry,
  );
  const returnsToOrigin = entityIds[0] === entityIds[entityIds.length - 1];

  let score = 25 + chain.length * 12;
  if (viaShellIds.length > 0) score += 20 * viaShellIds.length;
  if (crossesBorder) score += 15;
  if (returnsToOrigin) score += 25;
  if (spanDays <= 60) score += 10;
  if (chain.some((t) => t.method === "cash")) score += 8;
  score = Math.min(100, score);

  return {
    id: chain.map((t) => t.id).join(">"),
    entityIds,
    transactionIds: chain.map((t) => t.id),
    hops: chain.length,
    amount,
    spanDays,
    viaShellIds,
    crossesBorder,
    returnsToOrigin,
    score,
    severity: levelFromScore(score),
  };
}

/** Odstráni trasy, ktoré sú len prefixom dlhšej trasy. */
function dedupePaths(paths: MoneyPath[]): MoneyPath[] {
  return paths.filter(
    (p) =>
      !paths.some(
        (other) => other.id !== p.id && other.id.startsWith(`${p.id}>`),
      ),
  );
}

/** Signály prania peňazí viazané na konkrétny subjekt. */
export function detectLaunderingSignals(
  entities: Entity[],
  transactions: Transaction[],
  shellIds: string[] = [],
): LaunderingSignal[] {
  const shells = new Set(shellIds);
  const signals: LaunderingSignal[] = [];

  for (const entity of entities) {
    const inflow = transactions.filter((t) => t.toId === entity.id);
    const outflow = transactions.filter((t) => t.fromId === entity.id);
    const inSum = sum(inflow);
    const outSum = sum(outflow);

    // Prietokový účet: čo pritečie, to takmer celé odtečie.
    if (inSum > 0 && outSum > 0) {
      const ratio = Math.min(inSum, outSum) / Math.max(inSum, outSum);
      const fastest = fastestTurnaround(inflow, outflow);
      if (ratio >= 0.7 && fastest !== null && fastest <= 120) {
        signals.push(
          signal(
            "PASS_THROUGH",
            entity,
            "Prietokový subjekt",
            `${formatEur(inSum)} dnu / ${formatEur(outSum)} von • najrýchlejší presun ${Math.round(fastest)} dní`,
            shells.has(entity.id) ? 82 : 64,
          ),
        );
      }
    }

    // Zberný lievik: veľa vstupov, jeden veľký výstup.
    if (inflow.length >= 3 && outflow.length <= 2 && outSum >= inSum * 0.6) {
      signals.push(
        signal(
          "FUNNEL_ACCOUNT",
          entity,
          "Zberný účet",
          `${inflow.length} vstupov zlúčených do ${outflow.length} výstupov`,
          68,
        ),
      );
    }

    // Štruktúrovanie: viac platieb tesne pod ohlasovacím limitom.
    const structuring = outflow.filter(
      (t) => t.amount >= 12_000 && t.amount < 15_000,
    );
    if (structuring.length >= 2) {
      signals.push(
        signal(
          "STRUCTURING",
          entity,
          "Štruktúrovanie platieb",
          `${structuring.length} platieb tesne pod ohlasovacím limitom 15 000 €`,
          72,
        ),
      );
    }

    // Vklad v hotovosti, výber prevodom do zahraničia (placement → integration).
    const cashIn = inflow.some((t) => t.method === "cash");
    const wireOutAbroad = outflow.some(
      (t) =>
        t.method === "transfer" && t.originCountry !== t.destinationCountry,
    );
    const cashOutAbroad = outflow.some((t) => t.method === "cash");
    if ((cashIn || cashOutAbroad) && wireOutAbroad) {
      signals.push(
        signal(
          "CASH_TO_WIRE",
          entity,
          "Hotovosť → cezhraničný prevod",
          "Hotovostné vloženie prostriedkov a následný prevod do zahraničia",
          76,
        ),
      );
    }
  }

  return signals.sort((a, b) => b.score - a.score);
}

function signal(
  code: string,
  entity: Entity,
  label: string,
  detail: string,
  score: number,
): LaunderingSignal {
  return {
    code,
    entityId: entity.id,
    label,
    detail,
    score,
    severity: levelFromScore(score) as Severity,
  };
}

function fastestTurnaround(
  inflow: Transaction[],
  outflow: Transaction[],
): number | null {
  let best: number | null = null;
  for (const i of inflow) {
    for (const o of outflow) {
      if (o.date < i.date) continue;
      const gap = daysBetween(i.date, o.date);
      if (best === null || gap < best) best = gap;
    }
  }
  return best;
}

function sum(transactions: Transaction[]): number {
  return transactions.reduce((s, t) => s + t.amount, 0);
}
