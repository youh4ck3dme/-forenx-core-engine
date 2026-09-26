import { sha256Hex } from "./export-pdf";
import type {
  CustodyLedgerEntry,
  CustodyLedgerVerificationResult,
} from "./types";

export const GENESIS_PREV_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Normalizuje dáta a vypočíta deterministický SHA-256 hash payloadu stopy.
 */
export function computePayloadHash(data: unknown): string {
  const json = typeof data === "string" ? data : JSON.stringify(data ?? {});
  return sha256Hex(json);
}

/**
 * Vypočíta hash bloku v reťazci zabezpečenia (Chain of Custody).
 */
export function computeEntryHash(
  index: number,
  traceId: string,
  timestamp: string,
  actor: string,
  action: string,
  location: string,
  payloadHash: string,
  prevHash: string,
): string {
  const rawString = `${index}|${traceId}|${timestamp}|${actor}|${action}|${location}|${payloadHash}|${prevHash}`;
  return sha256Hex(rawString);
}

/**
 * Vytvorí úvodný (Genesis) záznam pre zaistenie stopy.
 */
export function createGenesisEntry(
  traceId: string,
  actor: string,
  location: string,
  initialData: unknown,
  customTimestamp?: string,
): CustodyLedgerEntry {
  const timestamp = customTimestamp ?? new Date().toISOString();
  const payloadHash = computePayloadHash(initialData);
  const id = `cle-0-${Date.now()}`;
  const hash = computeEntryHash(
    0,
    traceId,
    timestamp,
    actor,
    "SEIZURE",
    location,
    payloadHash,
    GENESIS_PREV_HASH,
  );

  return {
    index: 0,
    id,
    traceId,
    timestamp,
    actor,
    action: "SEIZURE",
    location,
    payloadHash,
    prevHash: GENESIS_PREV_HASH,
    hash,
  };
}

/**
 * Pridá nový záznam do reťazca zabezpečenia stopy a overí kontinuitu predchádzajúceho hashu.
 */
export function appendLedgerEntry(
  chain: CustodyLedgerEntry[],
  params: {
    traceId: string;
    actor: string;
    action: CustodyLedgerEntry["action"];
    location: string;
    data: unknown;
    notes?: string;
    customTimestamp?: string;
  },
): CustodyLedgerEntry {
  if (!chain || chain.length === 0) {
    return createGenesisEntry(
      params.traceId,
      params.actor,
      params.location,
      params.data,
      params.customTimestamp,
    );
  }

  const lastEntry = chain[chain.length - 1];
  if (!lastEntry) {
    return createGenesisEntry(
      params.traceId,
      params.actor,
      params.location,
      params.data,
      params.customTimestamp,
    );
  }

  const nextIndex = lastEntry.index + 1;
  const timestamp = params.customTimestamp ?? new Date().toISOString();
  const payloadHash = computePayloadHash(params.data);
  const prevHash = lastEntry.hash;

  const hash = computeEntryHash(
    nextIndex,
    params.traceId,
    timestamp,
    params.actor,
    params.action,
    params.location,
    payloadHash,
    prevHash,
  );

  const entry: CustodyLedgerEntry = {
    index: nextIndex,
    id: `cle-${nextIndex}-${Date.now()}`,
    traceId: params.traceId,
    timestamp,
    actor: params.actor,
    action: params.action,
    location: params.location,
    payloadHash,
    prevHash,
    hash,
  };
  if (params.notes !== undefined) entry.notes = params.notes;
  return entry;
}

/**
 * Skontroluje kryptografickú integritu celého reťazca zabezpečenia.
 * Deteguje akúkoľvek zmenu v údajoch (zlom v reťazci).
 */
export function verifyLedgerIntegrity(
  chain: CustodyLedgerEntry[],
): CustodyLedgerVerificationResult {
  if (!chain || chain.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    if (!entry) {
      return {
        valid: false,
        totalEntries: chain.length,
        brokenIndex: i,
        reason: `Chýbajúci záznam na pozícii #${i}.`,
      };
    }

    // 1. Kontrola indexovania
    if (entry.index !== i) {
      return {
        valid: false,
        totalEntries: chain.length,
        brokenIndex: i,
        reason: `Nesprávny index záznamu: očakávaný ${i}, nájdený ${entry.index}.`,
      };
    }

    // 2. Kontrola prepojenia na predchádzajúci hash
    if (i === 0) {
      if (entry.prevHash !== GENESIS_PREV_HASH) {
        return {
          valid: false,
          totalEntries: chain.length,
          brokenIndex: 0,
          reason: "Genesis záznam nemá platný počiatočný prevHash.",
        };
      }
    } else {
      const prevEntry = chain[i - 1];
      if (!prevEntry || entry.prevHash !== prevEntry.hash) {
        return {
          valid: false,
          totalEntries: chain.length,
          brokenIndex: i,
          reason: `Zlom v reťazci na zázname #${i}: prevHash nesúhlasí s hashom predchádzajúceho záznamu.`,
        };
      }
    }

    // 3. Rekalkulácia vlastného hashu bloku
    const expectedHash = computeEntryHash(
      entry.index,
      entry.traceId,
      entry.timestamp,
      entry.actor,
      entry.action,
      entry.location,
      entry.payloadHash,
      entry.prevHash,
    );

    if (entry.hash !== expectedHash) {
      return {
        valid: false,
        totalEntries: chain.length,
        brokenIndex: i,
        reason: `Kryptografická neplatnosť záznamu #${i}: hash bol zmenený alebo dáta zmanipulované.`,
      };
    }
  }

  const first = chain[0];
  const last = chain[chain.length - 1];

  return {
    valid: true,
    totalEntries: chain.length,
    ...(first ? { genesisHash: first.hash } : {}),
    ...(last ? { latestHash: last.hash } : {}),
  };
}
