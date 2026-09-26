import { z } from "zod";
import type { Entity, Flag, Relation, SourceRecord } from "../types";
import {
  deduplicateStrings,
  normalizeAddress,
  normalizeCompanyName,
  normalizeCountry,
  normalizeIco,
} from "../normalization";

export type StatutoryPerson = {
  name: string;
  role?: string | undefined;
  validFrom?: string | undefined;
  validTo?: string | undefined;
  sourcePersonId?: string | undefined;
};

export type AddressHistoryItem = {
  address: string;
  validFrom?: string | undefined;
  validTo?: string | undefined;
};

export type CompanyRegistryProfile = {
  ico: string;
  legalName: string;
  legalForm?: string | undefined;
  registeredAddress?: string | undefined;
  country: string;
  status?: string | undefined;
  incorporatedAt?: string | undefined;
  dissolvedAt?: string | undefined;
  statutoryPersons: StatutoryPerson[];
  businessActivities: string[];
  addressHistory?: AddressHistoryItem[] | undefined;
  stakeholders?: { name: string; type?: string | undefined }[] | undefined;
  registrationCourt?: string | undefined;
  registrationNumber?: string | undefined;
  shareCapital?: { amount: number } | null | undefined;
  mainActivity?: string | null | undefined;
  source: SourceRecord;
};

/**
 * Deterministická kanonická serializácia JSON objektu pre výpočet integritného hashu.
 * Rekurzívne zoraďuje kľúče objektov abecedne a ignoruje undefined hodnoty,
 * čím zaručuje rovnaký hash bez ohľadu na poradie kľúčov v payloadoch.
 */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return (
      "[" + value.map((item) => canonicalJsonStringify(item)).join(",") + "]"
    );
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
  return "{" + pairs.join(",") + "}";
}

const SourceRecordSchema = z.object({
  id: z.string().default(() => `src-${Date.now()}`),
  source: z.enum([
    "manual",
    "csv-import",
    "document",
    "ico-atlas",
    "orsr",
    "dimitri-checker",
    "ai",
    "whoiswho",
  ]),
  sourceVersion: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  capturedAt: z.string().min(1, "Chýba čas získania (capturedAt)"),
  sourceHash: z.string().nullable().optional(),
  confidence: z
    .number()
    .min(0, "Confidence musí byť minimálne 0")
    .max(100, "Confidence musí byť maximálne 100")
    .nullable()
    .optional(),
  rawReference: z.string().nullable().optional(),
});

const StatutoryPersonSchema = z.object({
  name: z.string().min(1, "Meno štatutára je povinné"),
  role: z.string().nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  sourcePersonId: z.string().nullable().optional(),
});

const AddressHistorySchema = z.object({
  address: z.string().min(1, "Adresa v histórii nesmie byť prázdna"),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
});

export const CompanyRegistryProfileSchema = z.object({
  ico: z.string().min(1, "Chýba IČO"),
  legalName: z.string().min(1, "Chýba názov firmy (legalName)"),
  legalForm: z.string().nullable().optional(),
  registeredAddress: z.string().nullable().optional(),
  country: z.string().default("SK"),
  status: z.string().nullable().optional(),
  incorporatedAt: z.string().nullable().optional(),
  dissolvedAt: z.string().nullable().optional(),
  statutoryPersons: z.array(StatutoryPersonSchema).default([]),
  businessActivities: z.array(z.string()).default([]),
  addressHistory: z.array(AddressHistorySchema).nullable().optional(),
  source: SourceRecordSchema,
});

/**
 * Validuje a parseruje profil z ICO Atlas.
 */
export function parseCompanyRegistryProfile(
  input: unknown,
): CompanyRegistryProfile {
  const parsed = CompanyRegistryProfileSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".");
    throw new Error(
      `Neplatné dáta profilu ICO Atlas: ${field ? `${field} — ` : ""}${issue?.message || "neznáma chyba"}`,
    );
  }

  const raw = parsed.data;
  const normalizedIco = normalizeIco(raw.ico);
  if (!normalizedIco) {
    throw new Error("IČO po normalizácii je neplatné.");
  }

  const normalizedLegalName = normalizeCompanyName(raw.legalName);
  if (!normalizedLegalName) {
    throw new Error("Názov firmy je povinný.");
  }

  // Deduplikácia štatutárov — voliteľné polia vynechaj, keď chýbajú
  // (exactOptionalPropertyTypes: prítomný kľúč nesmie byť undefined).
  // Zachovávame rôzne osoby so zhodným menom aj viacnásobné roly s rôznou platnosťou.
  const personSeen = new Set<string>();
  const statutoryPersons: StatutoryPerson[] = [];
  for (const person of raw.statutoryPersons) {
    const key = `${person.sourcePersonId || ""}|${person.name.trim().toLowerCase()}|${(person.role || "").trim().toLowerCase()}|${person.validFrom || ""}|${person.validTo || ""}`;
    if (!personSeen.has(key)) {
      personSeen.add(key);
      const item: StatutoryPerson = { name: person.name.trim() };
      if (person.role) item.role = person.role.trim();
      if (person.validFrom) item.validFrom = person.validFrom;
      if (person.validTo) item.validTo = person.validTo;
      if (person.sourcePersonId) item.sourcePersonId = person.sourcePersonId;
      statutoryPersons.push(item);
    }
  }

  const businessActivities = deduplicateStrings(raw.businessActivities);

  const cleanSource: SourceRecord = {
    id: raw.source.id,
    source: raw.source.source,
    capturedAt: raw.source.capturedAt,
  };
  if (raw.source.sourceVersion)
    cleanSource.sourceVersion = raw.source.sourceVersion;
  if (raw.source.sourceUrl) cleanSource.sourceUrl = raw.source.sourceUrl;
  if (raw.source.sourceHash) cleanSource.sourceHash = raw.source.sourceHash;
  if (raw.source.confidence !== undefined && raw.source.confidence !== null) {
    cleanSource.confidence = raw.source.confidence;
  }
  if (raw.source.rawReference)
    cleanSource.rawReference = raw.source.rawReference;

  const profile: CompanyRegistryProfile = {
    ico: normalizedIco,
    legalName: normalizedLegalName,
    country: normalizeCountry(raw.country),
    statutoryPersons,
    businessActivities,
    source: cleanSource,
  };
  if (raw.legalForm) profile.legalForm = raw.legalForm;
  if (raw.registeredAddress) {
    profile.registeredAddress = normalizeAddress(raw.registeredAddress);
  }
  if (raw.status) profile.status = raw.status;
  if (raw.incorporatedAt) profile.incorporatedAt = raw.incorporatedAt;
  if (raw.dissolvedAt) profile.dissolvedAt = raw.dissolvedAt;
  if (raw.addressHistory) {
    profile.addressHistory = raw.addressHistory.map((h) => {
      const item: AddressHistoryItem = { address: h.address };
      if (h.validFrom) item.validFrom = h.validFrom;
      if (h.validTo) item.validTo = h.validTo;
      return item;
    });
  }
  return profile;
}

/**
 * Vyhľadá existujúcu entitu firmy podľa normalizovaného IČO.
 */
export function findEntityByIco(
  entities: Entity[],
  ico: string,
): Entity | undefined {
  if (!ico || !entities) return undefined;
  const target = normalizeIco(ico);
  return entities.find(
    (e) => e.kind === "company" && e.ico && normalizeIco(e.ico) === target,
  );
}

/**
 * Vytvorí objekt Entity pre firmu z profilu ICO Atlas.
 */
export function buildCompanyEntity(
  profile: CompanyRegistryProfile,
  caseId: string,
  existingEntityId?: string,
): Entity {
  const id =
    existingEntityId ||
    `ent-company-${profile.ico.toLowerCase()}-${Date.now()}`;
  const entity: Entity = {
    id,
    name: profile.legalName,
    kind: "company",
    role: profile.legalForm || "spoločnosť",
    ico: profile.ico,
    country: profile.country,
    responsive: profile.status?.toLowerCase() === "active",
    x: 100,
    y: 100,
    note: `Zdroj: ICO Atlas (${profile.source.capturedAt})`,
  };
  if (profile.registeredAddress) {
    entity.address = profile.registeredAddress;
    entity.registeredAddress = profile.registeredAddress;
  }
  if (profile.incorporatedAt) entity.incorporatedAt = profile.incorporatedAt;
  return entity;
}

/**
 * Vytvorí objekty Entity pre štatutárov z profilu ICO Atlas.
 */
export function buildStatutoryPersonEntities(
  profile: CompanyRegistryProfile,
  companyEntityId: string,
): Entity[] {
  return profile.statutoryPersons.map((person, index) => {
    const slug = person.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");
    const id = `ent-person-${slug}-${index + 1}-${Date.now().toString(36)}`;
    return {
      id,
      name: person.name,
      kind: "person",
      role: person.role || "štatutárny orgán",
      country: profile.country,
      x: 50 + index * 30,
      y: 150 + index * 20,
      note: `Štatutár spoločnosti ${profile.legalName} (IČO: ${profile.ico})`,
    };
  });
}

export type StatutoryPersonEntityMapping = {
  personName: string;
  entityId: string;
  role?: string | undefined;
};

/**
 * Vyhľadá existujúcu entitu osoby podľa mena v rámci existujúcich entít prípadu.
 */
export function findPersonByName(
  entities: Entity[],
  name: string,
): Entity | undefined {
  if (!name || !entities) return undefined;
  const target = name.trim().toLowerCase();
  return entities.find(
    (e) => e.kind === "person" && e.name.trim().toLowerCase() === target,
  );
}

/**
 * Vytvorí relácie medzi štatutármi a firmou.
 * Podporuje buď pole identifikátorov (pre spätnú kompatibilitu), alebo explicitné párovanie
 * StatutoryPersonEntityMapping, ktoré je odolné voči zmene poradia či vynechaniu niektorej osoby.
 */
export function buildRegistryRelations(
  profile: CompanyRegistryProfile,
  companyEntityId: string,
  personEntityIdsOrMapping: string[] | StatutoryPersonEntityMapping[],
): Relation[] {
  if (personEntityIdsOrMapping.length === 0) return [];

  // Ak je dodané explicitné mapovanie s menom osoby
  if (typeof personEntityIdsOrMapping[0] === "object") {
    const mappings = personEntityIdsOrMapping as StatutoryPersonEntityMapping[];
    return mappings.map((m) => {
      const matched = profile.statutoryPersons.find(
        (sp) =>
          sp.name.trim().toLowerCase() === m.personName.trim().toLowerCase(),
      );
      const label = m.role || matched?.role || "štatutárny orgán";
      return {
        fromId: m.entityId,
        toId: companyEntityId,
        label,
      };
    });
  }

  // Ak je dodané pole ID stringov (fallback / pôvodné testy)
  const ids = personEntityIdsOrMapping as string[];
  return ids.map((personId, index) => {
    const person = profile.statutoryPersons[index];
    const label = person?.role || "štatutárny orgán";
    return {
      fromId: personId,
      toId: companyEntityId,
      label,
    };
  });
}

/**
 * Vytvorí heuristické indikátory (Flagy) z profilu registra.
 * POZNÁMKA: Vždy používa neutrálne formulácie ("Indikátor vyžadujúci preverenie").
 */
export function buildRegistryFindings(
  profile: CompanyRegistryProfile,
  existingEntity?: Entity,
): Flag[] {
  const flags: Flag[] = [];
  const evidenceRef = { type: "company-profile" as const, id: profile.ico };

  // 1. Rozdiel medzi manuálne evidovanou a registrovanou adresou
  if (
    existingEntity?.address &&
    profile.registeredAddress &&
    normalizeAddress(existingEntity.address).toLowerCase() !==
      normalizeAddress(profile.registeredAddress).toLowerCase()
  ) {
    flags.push({
      code: "ADDRESS_MISMATCH",
      label: "Rozdiel v adrese subjektu",
      detail: `Indikátor vyžadujúci preverenie: Evidovaná adresa ("${existingEntity.address}") sa nezhoduje s registrovanou adresou ("${profile.registeredAddress}").`,
      weight: 15,
      severity: "medium",
      kind: "heuristika",
      evidence: [evidenceRef],
      values: {
        manualAddress: existingEntity.address,
        registeredAddress: profile.registeredAddress,
      },
    });
  }

  // 2. Neaktívny status firmy
  if (profile.status && profile.status.toLowerCase() !== "active") {
    flags.push({
      code: "INACTIVE_COMPANY_STATUS",
      label: "Neaktívny status v registri",
      detail: `Indikátor vyžadujúci preverenie: Spoločnosť má v registri evidovaný status "${profile.status}".`,
      weight: 25,
      severity: "high",
      kind: "heuristika",
      evidence: [evidenceRef],
      values: {
        status: profile.status,
      },
    });
  }

  // 3. Firma bez evidovaných činností
  if (!profile.businessActivities || profile.businessActivities.length === 0) {
    flags.push({
      code: "NO_BUSINESS_ACTIVITIES",
      label: "Absencia predpisov činnosti",
      detail:
        "Indikátor vyžadujúci preverenie: Subjekt nemá v registri evidované žiadne predmety podnikateľskej činnosti.",
      weight: 10,
      severity: "medium",
      kind: "heuristika",
      evidence: [evidenceRef],
    });
  }

  // 4. Zmena adresy v histórii
  if (profile.addressHistory && profile.addressHistory.length > 1) {
    flags.push({
      code: "ADDRESS_HISTORY_CHANGES",
      label: "História zmien adresy",
      detail: `Indikátor vyžadujúci preverenie: Spoločnosť má evidované ${profile.addressHistory.length} zmeny sídla v histórii.`,
      weight: 10,
      severity: "low",
      kind: "heuristika",
      evidence: [evidenceRef],
      values: {
        historyCount: profile.addressHistory.length,
      },
    });
  }

  return flags;
}
