/**
 * Pomocné funkcie pre normalizáciu dát z externých registrov a reportov.
 * Normalizácia nesmie ničiť pôvodnú hodnotu uloženú v raw/source dátach.
 */

/**
 * Normalizuje IČO na 8 číslic pri slovenskom IČO.
 * Ak obsahuje nečíselné znaky, o Oreže a vyčistí ich.
 */
export function normalizeIco(value: string): string {
  if (!value) return "";
  const cleaned = value.trim().replace(/\s+/g, "");
  const digitsOnly = cleaned.replace(/\D/g, "");

  if (digitsOnly.length === 0) {
    return "";
  }

  if (digitsOnly.length <= 8) {
    return digitsOnly.padStart(8, "0");
  }
  const trimmedZeros = digitsOnly.replace(/^0+/, "");
  if (trimmedZeros.length > 0 && trimmedZeros.length <= 8) {
    return trimmedZeros.padStart(8, "0");
  }
  return trimmedZeros;
}

/**
 * Overí, či je zadaná hodnota platné IČO (6 až 10 číslic, štandardne 8).
 */
export function isValidIco(value: string): boolean {
  if (!value) return false;
  const digits = value.trim().replace(/\s+/g, "");
  return /^\d{6,10}$/.test(digits);
}

/**
 * Normalizuje názov firmy (odstránenie nadbytočných medzier, trim).
 */
export function normalizeCompanyName(value: string): string {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Normalizuje adresu (odstránenie nadbytočných medzier, trim).
 */
export function normalizeAddress(value: string): string {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Normalizuje kód krajiny (napr. "Slovensko" -> "SK", ISO-3166 alpha-2).
 */
export function normalizeCountry(value: string): string {
  if (!value) return "";
  const trimmed = value.trim().toUpperCase();
  const countryMap: Record<string, string> = {
    SLOVENSKO: "SK",
    SLOVAKIA: "SK",
    "ČESKÁ REPUBLIKA": "CZ",
    CESKA_REPUBLIKA: "CZ",
    CZECHIA: "CZ",
    NEMECKO: "DE",
    GERMANY: "DE",
    RAKÚSKO: "AT",
    RAKUSKO: "AT",
    AUSTRIA: "AT",
    POĽSKO: "PL",
    POLSKO: "PL",
    POLAND: "PL",
    MAĎARSKO: "HU",
    MADARSKO: "HU",
    HUNGARY: "HU",
    UKRAJINA: "UA",
    UKRAINE: "UA",
  };

  const mapped = countryMap[trimmed];
  if (mapped) {
    return mapped;
  }
  return trimmed;
}

/**
 * Deduplikuje pole reťazcov (nerozlišuje veľké/malé písmená, zachová prvý výskyt).
 */
export function deduplicateStrings(values: string[]): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of values) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }

  return result;
}
