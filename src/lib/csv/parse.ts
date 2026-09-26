/**
 * Lokálne parsovanie CSV — bez AI, bez odosielania dát kamkoľvek.
 * Modul je čistý (žiadne DOM API), aby bol testovateľný aj spustiteľný vo Web Workeri.
 */

export const PARSER_VERSION = "csv-1.0.0";

export const DELIMITERS = {
  ",": "čiarka",
  ";": "bodkočiarka",
  "\t": "tabulátor",
} as const;
export type Delimiter = keyof typeof DELIMITERS;

export const ENCODINGS = ["utf-8", "windows-1250", "iso-8859-2"] as const;
export type Encoding = (typeof ENCODINGS)[number];

export const DATE_FORMATS = [
  "YYYY-MM-DD",
  "DD.MM.YYYY",
  "DD/MM/YYYY",
  "MM/DD/YYYY",
] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export type DecimalSeparator = "," | ".";

/** Odstráni BOM, ak je prítomný. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Rozparsuje text na riadky a bunky. Podporuje úvodzovky, zdvojené úvodzovky a CRLF. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = stripBom(text);

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // ignoruj — koniec riadka rieši \n
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export type Detection<T> = {
  value: T | null;
  /** Viac rovnako pravdepodobných možností — používateľ musí zvoliť explicitne. */
  ambiguous: boolean;
  candidates: T[];
};

export function detectDelimiter(sample: string): Detection<Delimiter> {
  const firstLine = stripBom(sample).split(/\r?\n/)[0] ?? "";
  const counts = (Object.keys(DELIMITERS) as Delimiter[]).map((d) => ({
    d,
    n: firstLine.split(d).length - 1,
  }));
  const present = counts.filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
  if (present.length === 0)
    return {
      value: null,
      ambiguous: true,
      candidates: [...(Object.keys(DELIMITERS) as Delimiter[])],
    };
  const top = present[0]!;
  const tie = present.filter((c) => c.n === top.n);
  return {
    value: tie.length === 1 ? top.d : null,
    ambiguous: tie.length > 1,
    candidates: present.map((c) => c.d),
  };
}

/** Rozpozná desatinný oddeľovač zo vzorky súm. Pri nejednoznačnosti nehádame. */
export function detectDecimalSeparator(
  samples: string[],
): Detection<DecimalSeparator> {
  let comma = 0;
  let dot = 0;
  for (const raw of samples) {
    const s = raw.trim();
    if (/,\d{1,2}$/.test(s)) comma += 1;
    if (/\.\d{1,2}$/.test(s)) dot += 1;
  }
  if (comma > 0 && dot === 0)
    return { value: ",", ambiguous: false, candidates: [","] };
  if (dot > 0 && comma === 0)
    return { value: ".", ambiguous: false, candidates: ["."] };
  if (comma === 0 && dot === 0)
    return { value: null, ambiguous: true, candidates: [",", "."] };
  return { value: null, ambiguous: true, candidates: [",", "."] };
}

export function detectDateFormat(samples: string[]): Detection<DateFormat> {
  const fits = DATE_FORMATS.filter((f) =>
    samples.every((s) => parseDateValue(s, f) !== null),
  );
  if (fits.length === 1)
    return { value: fits[0]!, ambiguous: false, candidates: fits };
  return {
    value: null,
    ambiguous: true,
    candidates: fits.length ? fits : [...DATE_FORMATS],
  };
}

/** Vráti ISO dátum (RRRR-MM-DD) alebo null, ak hodnota formátu nezodpovedá. */
export function parseDateValue(raw: string, format: DateFormat): string | null {
  const s = raw.trim();
  const m = s.match(/^(\d{1,4})[.\-/](\d{1,2})[.\-/](\d{1,4})$/);
  if (!m) return null;
  const [a, b, c] = [m[1]!, m[2]!, m[3]!];
  let year: number;
  let month: number;
  let day: number;
  if (format === "YYYY-MM-DD") {
    if (a.length !== 4) return null;
    year = +a;
    month = +b;
    day = +c;
  } else if (format === "MM/DD/YYYY") {
    if (c.length !== 4) return null;
    year = +c;
    month = +a;
    day = +b;
  } else {
    if (c.length !== 4) return null;
    year = +c;
    month = +b;
    day = +a;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const check = new Date(`${iso}T00:00:00Z`);
  if (
    Number.isNaN(check.getTime()) ||
    check.getUTCDate() !== day ||
    check.getUTCMonth() + 1 !== month
  ) {
    return null;
  }
  return iso;
}

/**
 * Prevedie textovú sumu na číslo s presnosťou na 2 desatinné miesta.
 * Rešpektuje zvolený desatinný oddeľovač; oddeľovač tisícov odstráni.
 * Záporné sumy (mínus aj zátvorky) sú povolené — znamenajú opačný smer.
 */
export function parseAmountValue(
  raw: string,
  decimal: DecimalSeparator,
): number | null {
  let s = raw.trim().replace(/\s|\u00a0/g, "");
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/^([+-])/, (_, sign) => {
    if (sign === "-") negative = true;
    return "";
  });
  s = s.replace(/[A-Za-z€$£]/g, "");
  const thousands = decimal === "," ? "." : ",";
  s = s.split(thousands).join("");
  if (decimal === ",") s = s.replace(",", ".");
  // Najviac dve desatinné miesta — viac by znamenalo iný formát, nie zaokrúhlenie.
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  const signed = negative ? -value : value;
  return Math.round(signed * 100) / 100;
}

export function parseCurrencyValue(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(s)) return s;
  const map: Record<string, string> = {
    "€": "EUR",
    $: "USD",
    "£": "GBP",
    KČ: "CZK",
  };
  return map[s] ?? null;
}
