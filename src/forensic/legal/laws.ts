/**
 * Verzionované právne zdroje. Každý zákon má vlastný stav dostupnosti —
 * nedostupnosť jedného zdroja NIKDY nesmie vypnúť posúdenie podľa ostatných.
 */

export type LawCode = "300/2005" | "301/2005" | "460/1992";

export type LawAvailability = "available" | "unavailable";

export type Provision = {
  /** napr. "§ 233" alebo "čl. 20" */
  ref: string;
  title: string;
  summary: string;
  /** Typ použitia: hmotnoprávna kvalifikácia, procesný úkon, ústavný limit. */
  kind: "substantive" | "procedural" | "constitutional";
};

export type LawSource = {
  code: LawCode;
  title: string;
  /** Verzia datasetu — účinnosť znenia, z ktorého sa cituje. */
  version: string;
  effectiveFrom: string;
  availability: LawAvailability;
  /** Dôvod nedostupnosti, ak availability === "unavailable". */
  unavailableReason?: string;
  provisions: Provision[];
};

export const LEGAL_SOURCES: Record<LawCode, LawSource> = {
  "300/2005": {
    code: "300/2005",
    title: "Trestný zákon",
    version: "2024-01-01",
    effectiveFrom: "2024-01-01",
    availability: "available",
    provisions: [
      {
        ref: "§ 233",
        title: "Legalizácia výnosu z trestnej činnosti",
        summary:
          "Zatajenie pôvodu alebo prevod veci pochádzajúcej z trestnej činnosti s cieľom zastrieť jej pôvod.",
        kind: "substantive",
      },
      {
        ref: "§ 294",
        title: "Nedovolené ozbrojovanie a obchodovanie so zbraňami",
        summary:
          "Zadováženie, držba alebo sprostredkovanie zbraní bez oprávnenia.",
        kind: "substantive",
      },
      {
        ref: "§ 296",
        title: "Založenie, zosnovanie a podporovanie zločineckej skupiny",
        summary:
          "Účasť na štruktúrovanej skupine zameranej na páchanie trestnej činnosti.",
        kind: "substantive",
      },
      {
        ref: "§ 277a",
        title: "Daňový podvod",
        summary:
          "Neoprávnené uplatnenie nároku alebo skrátenie dane vo väčšom rozsahu.",
        kind: "substantive",
      },
      {
        ref: "§ 261",
        title: "Poškodzovanie finančných záujmov Európskej únie",
        summary:
          "Použitie nepravdivého dokladu pri cezhraničných finančných tokoch.",
        kind: "substantive",
      },
    ],
  },
  "301/2005": {
    code: "301/2005",
    title: "Trestný poriadok",
    version: "2024-01-01",
    effectiveFrom: "2024-01-01",
    availability: "available",
    provisions: [
      {
        ref: "§ 89",
        title: "Zaistenie veci dôležitej pre trestné konanie",
        summary:
          "Zaistenie zbraní, dokladov a nosičov dát potrebných na dokazovanie.",
        kind: "procedural",
      },
      {
        ref: "§ 95",
        title: "Zaistenie peňažných prostriedkov",
        summary:
          "Blokácia prostriedkov na účte, ak zistené skutočnosti nasvedčujú ich pôvodu z TČ.",
        kind: "procedural",
      },
      {
        ref: "§ 116",
        title: "Zisťovanie údajov o bankových operáciách",
        summary:
          "Vyžiadanie výpisov a údajov o transakciách na základe príkazu sudcu.",
        kind: "procedural",
      },
      {
        ref: "§ 3",
        title: "Súčinnosť orgánov a medzinárodná spolupráca",
        summary:
          "Podklad pre dožiadanie do zahraničia a overenie v EUROPOL evidencii.",
        kind: "procedural",
      },
    ],
  },
  "460/1992": {
    code: "460/1992",
    title: "Ústava Slovenskej republiky",
    version: "2023-01-01",
    effectiveFrom: "2023-01-01",
    availability: "available",
    provisions: [
      {
        ref: "čl. 20",
        title: "Právo vlastniť majetok",
        summary:
          "Zásah do majetku (zaistenie) je prípustný len na základe zákona a primerane.",
        kind: "constitutional",
      },
      {
        ref: "čl. 22",
        title: "Listové tajomstvo a tajomstvo správ",
        summary:
          "Získavanie údajov o komunikácii a platbách vyžaduje zákonný podklad.",
        kind: "constitutional",
      },
      {
        ref: "čl. 17",
        title: "Osobná sloboda",
        summary:
          "Obmedzenie slobody len zo zákonných dôvodov a na nevyhnutný čas.",
        kind: "constitutional",
      },
    ],
  },
};

export function lawSource(code: LawCode): LawSource {
  return LEGAL_SOURCES[code];
}

export function isLawAvailable(code: LawCode): boolean {
  return LEGAL_SOURCES[code].availability === "available";
}

export function findProvision(
  code: LawCode,
  ref: string,
): Provision | undefined {
  return LEGAL_SOURCES[code].provisions.find((p) => p.ref === ref);
}
