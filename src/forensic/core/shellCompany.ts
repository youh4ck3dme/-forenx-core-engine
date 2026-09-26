import type { Entity, Flag, ForensicCase, Transaction } from "../types";
import { daysBetween, formatEur } from "./utils";

const RECENT_REGISTRATION_DAYS = 90;
const HIGH_VALUE_THRESHOLD = 50_000;
const LOW_ACTIVITY_TX_COUNT = 6;

/** Detekcia znakov schránkovej firmy nad lokálnymi dátami (ORSR mock). */
export function detectShellCompany(
  entity: Entity,
  forensicCase: ForensicCase,
  transactions: Transaction[],
): Flag[] {
  if (entity.kind !== "company") return [];
  const flags: Flag[] = [];

  const registered = entity.ico
    ? forensicCase.orsrAddresses[entity.ico]
    : undefined;
  if (registered && entity.address && registered !== entity.address) {
    flags.push({
      code: "ADDRESS_MISMATCH",
      label: "Nesúlad adries",
      detail: `Deklarovaná ${entity.address} • ORSR ${registered}`,
      weight: 30,
      severity: "critical",
    });
  }
  if (registered === undefined && entity.ico) {
    flags.push({
      code: "NOT_IN_REGISTRY",
      label: "Subjekt mimo registra",
      detail: `IČO ${entity.ico} sa nenašlo v referenčnom registri`,
      weight: 25,
      severity: "high",
    });
  }

  if (entity.physicalInventory === false) {
    flags.push({
      code: "NO_PHYSICAL_PRESENCE",
      label: "Žiadny fyzický inventár",
      detail: "Na deklarovanej adrese nie sú zabezpečené priestory ani trezory",
      weight: 22,
      severity: "high",
    });
  }

  if (
    entity.incorporatedAt &&
    daysBetween(entity.incorporatedAt, forensicCase.referenceDate) < 365 &&
    daysBetween(
      entity.incorporatedAt,
      firstActivity(entity.id, transactions) ?? forensicCase.referenceDate,
    ) < RECENT_REGISTRATION_DAYS
  ) {
    flags.push({
      code: "RAPID_REGISTRATION",
      label: "Rýchly nábeh po registrácii",
      detail: "Obchodná aktivita do 90 dní od vzniku spoločnosti",
      weight: 15,
      severity: "medium",
    });
  }

  if (entity.responsive === false) {
    flags.push({
      code: "NO_CONTACT",
      label: "Nekontaktnosť",
      detail: "Žiadna reakcia na e-mailovú ani telefonickú výzvu",
      weight: 10,
      severity: "medium",
    });
  }

  const own = transactions.filter(
    (t) => t.fromId === entity.id || t.toId === entity.id,
  );
  const volume = own.reduce((s, t) => s + t.amount, 0);
  if (volume > HIGH_VALUE_THRESHOLD && own.length <= LOW_ACTIVITY_TX_COUNT) {
    flags.push({
      code: "HIGH_VALUE_LOW_ACTIVITY",
      label: "Vysoký obrat pri nízkej aktivite",
      detail: `${formatEur(volume)} v ${own.length} transakciách`,
      weight: 14,
      severity: "high",
    });
  }

  return flags;
}

export function isShell(flags: Flag[]): boolean {
  const codes = new Set(flags.map((f) => f.code));
  const core = [
    "ADDRESS_MISMATCH",
    "NO_PHYSICAL_PRESENCE",
    "RAPID_REGISTRATION",
    "NOT_IN_REGISTRY",
  ];
  return core.filter((c) => codes.has(c)).length >= 2;
}

function firstActivity(
  entityId: string,
  transactions: Transaction[],
): string | undefined {
  return transactions
    .filter((t) => t.fromId === entityId || t.toId === entityId)
    .map((t) => t.date)
    .sort()[0];
}
