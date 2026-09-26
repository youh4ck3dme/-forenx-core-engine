import type { EuropolRecord } from "../types";

/**
 * Referenčný zoznam sledovaných sériových čísel.
 * Prázdny zámerne — zhody sa vyhodnocujú výhradne voči zoznamu,
 * ktorý si používateľ zadá v nastaveniach prípadu (`europolSerials`).
 * Žiadne vzorové ani vymyslené záznamy sa do analýzy nepočítajú.
 */
export const EUROPOL_RECORDS: EuropolRecord[] = [];

const BY_SERIAL = new Map(
  EUROPOL_RECORDS.map((r) => [normalizeSerial(r.serial), r]),
);

export function normalizeSerial(serial: string): string {
  return serial.replace(/[\s\-_.]/g, "").toUpperCase();
}

/** Presná zhoda sériového čísla (po normalizácii). */
export function matchEuropolSerial(serial: string): EuropolRecord | null {
  return BY_SERIAL.get(normalizeSerial(serial)) ?? null;
}

/**
 * Fuzzy zhoda — zachytí prepis s jedným chybným znakom (OCR, preklep v spise).
 * Vracia záznam len ak je práve jeden kandidát.
 */
export function fuzzyEuropolSerial(serial: string): EuropolRecord | null {
  const target = normalizeSerial(serial);
  const candidates = EUROPOL_RECORDS.filter((r) => {
    const other = normalizeSerial(r.serial);
    return other.length === target.length && hamming(other, target) === 1;
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

function hamming(a: string, b: string): number {
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) diff += 1;
  return diff;
}

export const EUROPOL_STATUS_LABEL: Record<EuropolRecord["status"], string> = {
  seized: "Zaistená",
  wanted: "Hľadaná",
  crime_scene: "Miesto činu",
};
