import type {
  CaseEvent,
  Entity,
  ForensicCase,
  Relation,
  Severity,
  Transaction,
  Weapon,
} from "@/forensic";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = any;

/** Poskladá riadky z databázy do tvaru, ktorý očakáva forenzné jadro. */
export function mapCaseRows(
  row: Row,
  entities: Row[],
  transactions: Row[],
  weapons: Row[],
  relations: Row[],
  events: Row[],
): ForensicCase {
  const mappedEntities: Entity[] = (entities ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind === "company" ? "company" : "person",
    role: e.role ?? "",
    ico: e.ico ?? undefined,
    address: e.address ?? undefined,
    registeredAddress: e.registered_address ?? undefined,
    licence: e.licence ?? undefined,
    incorporatedAt: e.incorporated_at ?? undefined,
    physicalInventory: e.physical_inventory ?? undefined,
    responsive: e.responsive ?? undefined,
    country: e.country ?? "SK",
    x: Number(e.x ?? 50),
    y: Number(e.y ?? 50),
    note: e.note ?? undefined,
  }));

  const mappedTransactions: Transaction[] = (transactions ?? [])
    .filter((t) => t.from_id && t.to_id)
    .map((t) => ({
      id: t.id,
      date: t.date,
      amount: Number(t.amount ?? 0),
      currency: (t.currency as string) ?? row.base_currency ?? "EUR",
      method: t.method === "cash" ? "cash" : "transfer",
      fromId: t.from_id as string,
      toId: t.to_id as string,
      payerId: t.payer_id ?? undefined,
      originCountry: t.origin_country ?? "SK",
      destinationCountry: t.destination_country ?? "SK",
      description: t.description ?? "",
      importId: t.import_id ?? undefined,
      sourceRow: typeof t.source_row === "number" ? t.source_row : undefined,
    }));

  const mappedWeapons: Weapon[] = (weapons ?? []).map((w) => ({
    id: w.id,
    brand: w.brand ?? "",
    model: w.model ?? "",
    serial: w.serial ?? "",
    holderId: w.holder_id ?? "",
    supplierId: w.supplier_id ?? "",
    acquiredAt: w.acquired_at ?? row.reference_date,
    licence: w.licence ?? undefined,
  }));

  const mappedRelations: Relation[] = (relations ?? [])
    .filter((r) => r.from_id && r.to_id)
    .map((r) => ({
      fromId: r.from_id as string,
      toId: r.to_id as string,
      label: r.label ?? "",
    }));

  const mappedEvents: CaseEvent[] = (events ?? []).map((ev) => ({
    date: ev.date,
    title: ev.title ?? "",
    detail: ev.detail ?? "",
    severity: (["critical", "high", "medium", "low"].includes(ev.severity)
      ? ev.severity
      : "low") as Severity,
  }));

  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle ?? "",
    referenceDate: row.reference_date,
    baseCurrency: row.base_currency ?? "EUR",
    entities: mappedEntities,
    transactions: mappedTransactions,
    weapons: mappedWeapons,
    relations: mappedRelations,
    events: mappedEvents,
    europolSerials: row.europol_serials ?? [],
    validLicences: row.valid_licences ?? [],
    orsrAddresses: (row.orsr_addresses as Record<string, string>) ?? {},
  };
}
