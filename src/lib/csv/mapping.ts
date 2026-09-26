import {
  parseAmountValue,
  parseCurrencyValue,
  parseDateValue,
  type DateFormat,
  type DecimalSeparator,
} from "./parse";

/** Ktorý stĺpec súboru zodpovedá ktorému poľu transakcie. -1 = nepriradené. */
export type ColumnMapping = {
  date: number;
  amount: number;
  currency: number;
  description: number;
  counterpartyFrom: number;
  counterpartyTo: number;
  method: number;
};

export const EMPTY_MAPPING: ColumnMapping = {
  date: -1,
  amount: -1,
  currency: -1,
  description: -1,
  counterpartyFrom: -1,
  counterpartyTo: -1,
  method: -1,
};

export const MAPPING_LABELS: Record<keyof ColumnMapping, string> = {
  date: "Dátum",
  amount: "Suma",
  currency: "Mena",
  description: "Popis",
  counterpartyFrom: "Odosielateľ",
  counterpartyTo: "Príjemca",
  method: "Spôsob platby",
};

export const REQUIRED_FIELDS: (keyof ColumnMapping)[] = [
  "date",
  "amount",
  "counterpartyFrom",
  "counterpartyTo",
];

export type ParsedRow = {
  /** Číslo riadka v pôvodnom súbore (1 = hlavička). */
  sourceRow: number;
  date: string;
  amount: number;
  currency: string;
  description: string;
  from: string;
  to: string;
  method: "cash" | "transfer";
};

export type RowError = {
  sourceRow: number;
  reasons: string[];
  raw: string[];
};

export type ValidationResult = {
  valid: ParsedRow[];
  errors: RowError[];
  totalsByCurrency: Record<string, number>;
  counterparties: string[];
};

export type ValidationOptions = {
  mapping: ColumnMapping;
  dateFormat: DateFormat;
  decimal: DecimalSeparator;
  defaultCurrency: string;
  /** Ak súbor nemá stĺpec so spôsobom platby. */
  defaultMethod: "cash" | "transfer";
  hasHeader: boolean;
};

function cell(row: string[], index: number): string {
  return index >= 0 ? (row[index] ?? "").trim() : "";
}

const CASH_WORDS = ["hotovost", "hotovosť", "cash", "vklad v hotovosti"];

export function validateRows(
  rows: string[][],
  options: ValidationOptions,
): ValidationResult {
  const {
    mapping,
    dateFormat,
    decimal,
    defaultCurrency,
    defaultMethod,
    hasHeader,
  } = options;
  const body = hasHeader ? rows.slice(1) : rows;
  const offset = hasHeader ? 2 : 1;

  const valid: ParsedRow[] = [];
  const errors: RowError[] = [];
  const totals: Record<string, number> = {};
  const parties = new Set<string>();

  body.forEach((raw, index) => {
    const sourceRow = index + offset;
    const reasons: string[] = [];

    const dateRaw = cell(raw, mapping.date);
    const date = parseDateValue(dateRaw, dateFormat);
    if (!date)
      reasons.push(
        `Dátum „${dateRaw || "—"}" nezodpovedá formátu ${dateFormat}.`,
      );

    const amountRaw = cell(raw, mapping.amount);
    const amount = parseAmountValue(amountRaw, decimal);
    if (amount === null)
      reasons.push(`Suma „${amountRaw || "—"}" sa nedá prečítať.`);
    else if (amount === 0) reasons.push("Suma je nula.");

    let currency = defaultCurrency;
    if (mapping.currency >= 0) {
      const parsed = parseCurrencyValue(cell(raw, mapping.currency));
      if (!parsed)
        reasons.push(`Menu „${cell(raw, mapping.currency) || "—"}" nepoznám.`);
      else currency = parsed;
    }

    const from = cell(raw, mapping.counterpartyFrom);
    const to = cell(raw, mapping.counterpartyTo);
    if (!from) reasons.push("Chýba odosielateľ.");
    if (!to) reasons.push("Chýba príjemca.");
    if (from && to && from.toLowerCase() === to.toLowerCase()) {
      reasons.push("Odosielateľ a príjemca sú rovnakí.");
    }

    let method = defaultMethod;
    if (mapping.method >= 0) {
      const value = cell(raw, mapping.method).toLowerCase();
      method = CASH_WORDS.some((w) => value.includes(w)) ? "cash" : "transfer";
    }

    if (reasons.length > 0 || amount === null || !date) {
      errors.push({ sourceRow, reasons, raw });
      return;
    }

    parties.add(from);
    parties.add(to);
    totals[currency] =
      Math.round(((totals[currency] ?? 0) + Math.abs(amount)) * 100) / 100;
    valid.push({
      sourceRow,
      date,
      amount,
      currency,
      description: cell(raw, mapping.description),
      from,
      to,
      method,
    });
  });

  return {
    valid,
    errors,
    totalsByCurrency: totals,
    counterparties: [...parties].sort((a, b) => a.localeCompare(b, "sk")),
  };
}

/**
 * Podobné transakcie v rámci jedného súboru. Nejde o duplicitu na zmazanie —
 * dve identické platby môžu byť legitímne. Slúži len na upozornenie používateľa.
 */
export function findSimilar(
  rows: ParsedRow[],
): { key: string; rows: number[] }[] {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    const key = `${r.date}|${r.amount}|${r.currency}|${r.from}→${r.to}`;
    groups.set(key, [...(groups.get(key) ?? []), r.sourceRow]);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, rows: list }));
}
