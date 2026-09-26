import type { Flag, ForensicCase, Weapon, WeaponAnalysis } from "../types";
import {
  fuzzyEuropolSerial,
  matchEuropolSerial,
  normalizeSerial,
} from "../data/europol";
import { daysBetween } from "./utils";

export function analyzeWeapon(
  weapon: Weapon,
  forensicCase: ForensicCase,
): WeaponAnalysis {
  const flags: Flag[] = [];
  const record = matchEuropolSerial(weapon.serial);
  const fuzzy = record ? null : fuzzyEuropolSerial(weapon.serial);
  const inCaseList = forensicCase.europolSerials
    .map(normalizeSerial)
    .includes(normalizeSerial(weapon.serial));
  const europolMatch = record !== null || inCaseList;
  const invalidLicence =
    !weapon.licence || !forensicCase.validLicences.includes(weapon.licence);

  if (europolMatch) {
    flags.push({
      code: "EUROPOL_MATCH",
      label: "Zhoda v sledovanom zozname sériových čísel",
      detail: record
        ? `${weapon.serial} • ${record.caseRef} • ${record.seizedCountry} • ${record.context}`
        : `Sériové číslo ${weapon.serial} je na sledovanom zozname prípadu`,
      weight: 35,
      severity: "critical",
    });
  }

  if (!record && fuzzy) {
    flags.push({
      code: "EUROPOL_FUZZY",
      label: "Pravdepodobná zhoda v sledovanom zozname",
      detail: `${weapon.serial} sa líši od evidovaného ${fuzzy.serial} v jednom znaku (${fuzzy.caseRef})`,
      weight: 20,
      severity: "high",
    });
  }

  if (record?.status === "crime_scene") {
    flags.push({
      code: "CRIME_SCENE_LINK",
      label: "Väzba na miesto činu",
      detail: `${record.context} • ${record.seizedCountry}`,
      weight: 30,
      severity: "critical",
    });
  }

  if (invalidLicence) {
    flags.push({
      code: "INVALID_LICENSE",
      label: "Neplatná zbrojná licencia",
      detail: weapon.licence
        ? `Licencia ${weapon.licence} nie je platná`
        : "Prevod bez licencie",
      weight: 28,
      severity: "critical",
    });
  }

  return {
    weapon,
    flags,
    europolMatch,
    invalidLicence,
    ...(record ? { europolRecord: record } : {}),
    ...(!record && fuzzy ? { europolRecord: fuzzy, fuzzyMatch: true } : {}),
  };
}

/**
 * Sekvenčné sériové čísla — zbrane z jednej výrobnej dávky rozdelené
 * medzi viacero držiteľov naznačujú rozbitie zásielky.
 */
export function detectSerialBatches(weapons: Weapon[]): {
  prefix: string;
  serials: string[];
  holderIds: string[];
}[] {
  const groups = new Map<string, Weapon[]>();
  for (const w of weapons) {
    const prefix = normalizeSerial(w.serial).replace(/\d+$/, "");
    groups.set(prefix, [...(groups.get(prefix) ?? []), w]);
  }

  return [...groups.entries()]
    .filter(
      ([, group]) =>
        group.length >= 3 && new Set(group.map((w) => w.holderId)).size >= 2,
    )
    .map(([prefix, group]) => ({
      prefix,
      serials: group.map((w) => w.serial).sort(),
      holderIds: Array.from(new Set(group.map((w) => w.holderId))),
    }));
}

/** Náhly nárast objemu: prvé nadobudnutie vs. počet kusov v okne 8 mesiacov. */
export function detectVolumeSurge(
  weapons: Weapon[],
  holderId: string,
): Flag | null {
  const own = weapons
    .filter((w) => w.holderId === holderId)
    .sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt));
  if (own.length < 3) return null;
  const first = own[0]!.acquiredAt;
  const last = own[own.length - 1]!.acquiredAt;
  if (daysBetween(first, last) > 245) return null;
  return {
    code: "VOLUME_SURGE",
    label: "Náhly nárast objemu",
    detail: `${own.length} zbraní nadobudnutých za menej než 8 mesiacov`,
    weight: 20,
    severity: "high",
  };
}
