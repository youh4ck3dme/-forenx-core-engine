/**
 * Vzorová redakcia voľného textu pred odoslaním do modelu.
 * Rodné číslo, číslo OP, IBAN a adresa s PSČ. Mená entít rieši volajúci.
 */

const IBAN = /\b[A-Z]{2}\d{2}(?:[ \u00a0-]?[A-Z0-9]){11,30}\b/gi;

/** 9–10 číslic, voliteľná lomka, ľubovoľné medzery medzi číslicami. */
const BIRTH_NUMBER =
  /(?<![\d])(?:\d[ \u00a0]*){6}\/?[ \u00a0]*(?:\d[ \u00a0]*){3,4}(?![\d])/g;

const ID_CARD = /\b[A-Z]{2}[ \u00a0]?\d{6}\b/gi;

const ADDRESS =
  /\b\p{Lu}[\p{L}.'’-]*(?:\s+\p{Lu}?[\p{L}.'’-]+){0,4}\s+\d{1,4}[A-Za-z]?(?:\s*\/\s*\d{1,4})?\s*,?\s*\d{3}[ \u00a0]?\d{2}\b/gu;

export function redactEvidenceText(input: string): string {
  return input
    .replace(ID_CARD, "[OP]")
    .replace(IBAN, "[IBAN]")
    .replace(BIRTH_NUMBER, "[RODNÉ ČÍSLO]")
    .replace(ADDRESS, "[ADRESA]");
}
