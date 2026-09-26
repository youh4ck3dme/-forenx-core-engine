/**
 * Jediné miesto s názvom a popisom produktu.
 * Pracovný názov — dostupnosť značky nie je overená.
 */
export const BRAND = {
  name: "ForenX",
  themeColor: "#07171c",
  pwaBackgroundColor: "#07171c",
  legalNote: "ForenX je pracovný názov. Dostupnosť značky nie je overená.",
  tagline:
    "Premeňte transakcie na prehľad finančných tokov, vysvetliteľné nálezy a správu so zdrojmi.",
  short: "Analytický nástroj pre finančné toky",
  /** Kroky hlavného toku — používajú sa v onboarde aj v prázdnych stavoch. */
  flow: [
    { to: "/pripady", label: "Vytvoriť prípad" },
    { to: "/import-csv", label: "Importovať alebo zadať transakcie" },
    { to: "/prehlad", label: "Preskúmať nálezy" },
    { to: "/viac", label: "Pripraviť správu" },
  ],
  /**
   * Vety, ktoré sa v produkte NEPOUŽÍVAJÚ: dokazovanie trestnej činnosti,
   * právna prípustnosť dôkazov, garantovaná rýchlosť analýzy.
   */
  disclaimer:
    "Výsledky sú analytické indikácie z vami zadaných údajov. Nepredstavujú dôkaz trestnej činnosti ani právne stanovisko.",
} as const;

/** Trvalé právne upozornenie nad každým výstupom AI (asistent aj PDF). */
export const AI_DISCLAIMER =
  "Výstup AI nie je dôkaz ani rozhodnutie súdu. Ide o AI pracovnú analýzu — skontrolujte každý dátum, sumu, osobu a citáciu voči originálu spisu pred použitím v konaní.";
