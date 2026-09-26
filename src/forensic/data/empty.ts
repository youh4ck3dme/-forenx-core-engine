import type { ForensicCase } from "../types";

/** Prázdny prípad — použije sa, kým používateľ nemá žiadne dáta. */
export const EMPTY_CASE: ForensicCase = {
  id: "",
  name: "Žiadny prípad",
  subtitle: "Vytvorte prvý prípad a pridajte subjekty",
  referenceDate: new Date().toISOString().slice(0, 10),
  baseCurrency: "EUR",
  entities: [],
  transactions: [],
  weapons: [],
  relations: [],
  events: [],
  europolSerials: [],
  validLicences: [],
  orsrAddresses: {},
};
