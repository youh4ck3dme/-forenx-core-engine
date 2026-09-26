import type { CaseSummary } from "@/lib/case-data";
import type {
  ForensicCase,
  Entity,
  Transaction,
  Weapon,
  Relation,
  CaseEvent,
  Severity,
} from "@/forensic";

const DEV_CASES_STORAGE_KEY = "forendo:dev-cases-store";

export type StoredDevCase = {
  id: string;
  name: string;
  subtitle?: string;
  referenceDate: string;
  baseCurrency: string;
  createdAt: string;
  revision: number;
  entities: Entity[];
  transactions: Transaction[];
  weapons: Weapon[];
  relations: Relation[];
  events: CaseEvent[];
  europolSerials?: string[];
  validLicences?: string[];
  orsrAddresses?: Record<string, string>;
};

function generateId(prefix = "dev"): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildSyntheticDemoCase(): StoredDevCase {
  const caseId = generateId("case");
  const today = new Date();
  const day = (offset: number) =>
    new Date(today.getTime() - offset * 86400000).toISOString().slice(0, 10);

  const entAId = generateId("ent");
  const entBId = generateId("ent");
  const entCId = generateId("ent");
  const entDId = generateId("ent");

  const entities: Entity[] = [
    {
      id: entAId,
      name: "Subjekt A s.r.o.",
      kind: "company",
      role: "odberateľ",
      country: "SK",
      x: 20,
      y: 30,
      ico: "51234567",
      address: "Bratislava, Priemyselná 4",
      registeredAddress: "Bratislava, Priemyselná 4",
    },
    {
      id: entBId,
      name: "Subjekt B s.r.o.",
      kind: "company",
      role: "sprostredkovateľ",
      country: "CZ",
      x: 55,
      y: 20,
      ico: "27123456",
      address: "Praha, Rohanské nábřeží 12",
      registeredAddress: "Praha, Rohanské nábřeží 12",
    },
    {
      id: entCId,
      name: "Subjekt C Ltd.",
      kind: "company",
      role: "príjemca",
      country: "CY",
      x: 80,
      y: 60,
      address: "Nicosia, Cyprus",
    },
    {
      id: entDId,
      name: "Osoba D (fiktívna)",
      kind: "person",
      role: "konateľ",
      country: "SK",
      x: 35,
      y: 70,
    },
  ];

  const transactions: Transaction[] = [
    {
      id: generateId("tx"),
      date: day(30),
      amount: 48000,
      currency: "EUR",
      method: "transfer",
      fromId: entAId,
      toId: entBId,
      originCountry: "SK",
      destinationCountry: "CZ",
      description: "Poradenské služby (ukážka)",
    },
    {
      id: generateId("tx"),
      date: day(28),
      amount: 47500,
      currency: "EUR",
      method: "transfer",
      fromId: entBId,
      toId: entCId,
      originCountry: "CZ",
      destinationCountry: "CY",
      description: "Licenčný poplatok (ukážka)",
    },
    {
      id: generateId("tx"),
      date: day(21),
      amount: 9900,
      currency: "EUR",
      method: "transfer",
      fromId: entAId,
      toId: entBId,
      originCountry: "SK",
      destinationCountry: "CZ",
      description: "Marketing (ukážka)",
    },
    {
      id: generateId("tx"),
      date: day(20),
      amount: 9900,
      currency: "EUR",
      method: "transfer",
      fromId: entAId,
      toId: entBId,
      originCountry: "SK",
      destinationCountry: "CZ",
      description: "Marketing (ukážka)",
    },
    {
      id: generateId("tx"),
      date: day(19),
      amount: 9900,
      currency: "EUR",
      method: "transfer",
      fromId: entAId,
      toId: entBId,
      originCountry: "SK",
      destinationCountry: "CZ",
      description: "Marketing (ukážka)",
    },
    {
      id: generateId("tx"),
      date: day(7),
      amount: 62000,
      currency: "EUR",
      method: "transfer",
      fromId: entBId,
      toId: entCId,
      originCountry: "CZ",
      destinationCountry: "CY",
      description: "Vyrovnanie (ukážka)",
    },
  ];

  const weapons: Weapon[] = [
    {
      id: generateId("wpn"),
      brand: "ČZ Uherský Brod",
      model: "Samopal vz. 58",
      serial: "EUROPOL-SK-2024-9981",
      holderId: entAId,
      supplierId: entBId,
      acquiredAt: day(60),
      licence: "ZBR-2022-881",
    },
  ];

  const relations: Relation[] = [
    {
      fromId: entDId,
      toId: entAId,
      label: "konateľ a spoločník",
    },
    {
      fromId: entAId,
      toId: entBId,
      label: "obchodný partner",
    },
  ];

  const events: CaseEvent[] = [
    {
      date: day(32),
      title: "Začiatok vyšetrovania",
      detail: "Podnet Finančnej správy na nezvyčajné obchodné operácie.",
      severity: "high" as Severity,
    },
    {
      date: day(14),
      title: "Medzinárodná výmena informácií (EUROPOL)",
      detail: "Zachytená korelácia cezhraničných tokov SK -> CZ -> CY.",
      severity: "critical" as Severity,
    },
  ];

  return {
    id: caseId,
    name: "UKÁŽKA — syntetické dáta",
    subtitle: "Vzorový prípad bez osobných údajov",
    referenceDate: day(0),
    baseCurrency: "EUR",
    createdAt: new Date().toISOString(),
    revision: 1,
    entities,
    transactions,
    weapons,
    relations,
    events,
    europolSerials: ["EUROPOL-SK-2024-9981"],
    validLicences: ["ZBR-2022-881"],
    orsrAddresses: {
      "51234567": "Bratislava, Priemyselná 4",
      "27123456": "Praha, Rohanské nábřeží 12",
    },
  };
}

export function getStoredDevCases(): StoredDevCase[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DEV_CASES_STORAGE_KEY);
    if (!raw) {
      const initial = [buildSyntheticDemoCase()];
      window.localStorage.setItem(
        DEV_CASES_STORAGE_KEY,
        JSON.stringify(initial),
      );
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as StoredDevCase[];
  } catch (err) {
    console.error("Chyba pri čítaní dev prípadov:", err);
  }
  return [];
}

export function saveStoredDevCases(cases: StoredDevCase[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEV_CASES_STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.error("Chyba pri ukladaní dev prípadov:", err);
  }
}

export function listDevCases(): CaseSummary[] {
  const cases = getStoredDevCases();
  return cases.map((c) => ({
    id: c.id,
    name: c.name,
    subtitle: c.subtitle ?? "",
    referenceDate: c.referenceDate,
    baseCurrency: c.baseCurrency,
    createdAt: c.createdAt,
    isDemo: false,
  }));
}

export function loadDevCase(caseId: string): ForensicCase {
  const cases = getStoredDevCases();
  const found = cases.find((c) => c.id === caseId);
  if (!found) {
    // Ak sa prípad nenájde, vezmi prvý dostupný alebo vytvor nový
    if (cases.length > 0) return toForensicCase(cases[0]!);
    const fallback = buildSyntheticDemoCase();
    saveStoredDevCases([fallback]);
    return toForensicCase(fallback);
  }
  return toForensicCase(found);
}

function toForensicCase(stored: StoredDevCase): ForensicCase {
  return {
    id: stored.id,
    name: stored.name,
    subtitle: stored.subtitle ?? "",
    referenceDate: stored.referenceDate,
    baseCurrency: stored.baseCurrency ?? "EUR",
    entities: stored.entities ?? [],
    transactions: stored.transactions ?? [],
    weapons: stored.weapons ?? [],
    relations: stored.relations ?? [],
    events: stored.events ?? [],
    europolSerials: stored.europolSerials ?? [],
    validLicences: stored.validLicences ?? [],
    orsrAddresses: stored.orsrAddresses ?? {},
  };
}

export function loadDevCaseRevisions(caseId: string): Record<string, number> {
  const cases = getStoredDevCases();
  const found = cases.find((c) => c.id === caseId);
  if (!found) return {};
  const out: Record<string, number> = { [found.id]: found.revision ?? 1 };
  for (const e of found.entities) out[e.id] = 1;
  for (const t of found.transactions) out[t.id] = 1;
  for (const w of found.weapons) out[w.id] = 1;
  for (const r of found.relations) out[`${r.fromId}-${r.toId}`] = 1;
  return out;
}

export function createDevCase(input: {
  name: string;
  subtitle?: string;
  referenceDate?: string;
  baseCurrency?: string;
}): string {
  const cases = getStoredDevCases();
  const newId = generateId("case");
  const newCase: StoredDevCase = {
    id: newId,
    name: input.name.trim(),
    subtitle: input.subtitle?.trim() ?? "",
    referenceDate: input.referenceDate ?? new Date().toISOString().slice(0, 10),
    baseCurrency: input.baseCurrency ?? "EUR",
    createdAt: new Date().toISOString(),
    revision: 1,
    entities: [],
    transactions: [],
    weapons: [],
    relations: [],
    events: [],
    europolSerials: [],
    validLicences: [],
    orsrAddresses: {},
  };
  saveStoredDevCases([newCase, ...cases]);
  return newId;
}

export function createDevDemoCase(): string {
  const cases = getStoredDevCases();
  const demo = buildSyntheticDemoCase();
  saveStoredDevCases([demo, ...cases]);
  return demo.id;
}

export function updateDevCase(data: {
  id?: string;
  name: string;
  subtitle?: string;
  referenceDate?: string;
  baseCurrency?: string;
}): { id: string } {
  const cases = getStoredDevCases();
  const id = data.id ?? generateId("case");
  const index = cases.findIndex((c) => c.id === id);
  if (index >= 0) {
    const existing = cases[index]!;
    const updatedSubtitle = data.subtitle ?? existing.subtitle;
    cases[index] = {
      ...existing,
      name: data.name,
      ...(updatedSubtitle !== undefined ? { subtitle: updatedSubtitle } : {}),
      referenceDate: data.referenceDate ?? existing.referenceDate,
      baseCurrency: data.baseCurrency ?? existing.baseCurrency,
      revision: (existing.revision ?? 1) + 1,
    };
  } else {
    cases.unshift({
      id,
      name: data.name,
      subtitle: data.subtitle ?? "",
      referenceDate:
        data.referenceDate ?? new Date().toISOString().slice(0, 10),
      baseCurrency: data.baseCurrency ?? "EUR",
      createdAt: new Date().toISOString(),
      revision: 1,
      entities: [],
      transactions: [],
      weapons: [],
      relations: [],
      events: [],
    });
  }
  saveStoredDevCases(cases);
  return { id };
}

export function upsertDevEntity(data: Record<string, unknown>): { id: string } {
  const cases = getStoredDevCases();
  const caseId = data["caseId"] as string;
  const target = cases.find((c) => c.id === caseId);
  const id = (data["id"] as string) || generateId("ent");
  if (!target) return { id };

  const entity: Entity = {
    id,
    name: String(data["name"] ?? "Nový subjekt"),
    kind: data["kind"] === "company" ? "company" : "person",
    role: String(data["role"] ?? ""),
    country: String(data["country"] ?? "SK"),
    x: Number(data["x"] ?? 50),
    y: Number(data["y"] ?? 50),
    ...(data["ico"] ? { ico: String(data["ico"]) } : {}),
    ...(data["address"] ? { address: String(data["address"]) } : {}),
    ...(data["registeredAddress"]
      ? { registeredAddress: String(data["registeredAddress"]) }
      : {}),
    ...(data["licence"] ? { licence: String(data["licence"]) } : {}),
    ...(data["incorporatedAt"]
      ? { incorporatedAt: String(data["incorporatedAt"]) }
      : {}),
    ...(data["note"] ? { note: String(data["note"]) } : {}),
  };

  const existingIdx = target.entities.findIndex((e) => e.id === id);
  if (existingIdx >= 0) {
    target.entities[existingIdx] = entity;
  } else {
    target.entities.push(entity);
  }
  saveStoredDevCases(cases);
  return { id };
}

export function upsertDevTransaction(data: Record<string, unknown>): {
  id: string;
} {
  const cases = getStoredDevCases();
  const caseId = data["caseId"] as string;
  const target = cases.find((c) => c.id === caseId);
  const id = (data["id"] as string) || generateId("tx");
  if (!target) return { id };

  const tx: Transaction = {
    id,
    date: String(data["date"] ?? new Date().toISOString().slice(0, 10)),
    amount: Number(data["amount"] ?? 0),
    currency: String(data["currency"] ?? "EUR"),
    method: data["method"] === "cash" ? "cash" : "transfer",
    fromId: String(data["fromId"] ?? ""),
    toId: String(data["toId"] ?? ""),
    originCountry: String(data["originCountry"] ?? "SK"),
    destinationCountry: String(data["destinationCountry"] ?? "SK"),
    description: String(data["description"] ?? ""),
    ...(data["payerId"] ? { payerId: String(data["payerId"]) } : {}),
  };

  const existingIdx = target.transactions.findIndex((t) => t.id === id);
  if (existingIdx >= 0) {
    target.transactions[existingIdx] = tx;
  } else {
    target.transactions.push(tx);
  }
  saveStoredDevCases(cases);
  return { id };
}

export function upsertDevRelation(data: Record<string, unknown>): {
  id: string;
} {
  const cases = getStoredDevCases();
  const caseId = data["caseId"] as string;
  const target = cases.find((c) => c.id === caseId);
  const id = (data["id"] as string) || generateId("rel");
  if (!target) return { id };

  const fromId = String(data["fromId"] ?? data["sourceId"] ?? "");
  const toId = String(data["toId"] ?? data["targetId"] ?? "");
  const rel: Relation = {
    fromId,
    toId,
    label: String(data["label"] ?? data["role"] ?? "Vzťah"),
  };

  const existingIdx = target.relations.findIndex(
    (r) => r.fromId === fromId && r.toId === toId,
  );
  if (existingIdx >= 0) {
    target.relations[existingIdx] = rel;
  } else {
    target.relations.push(rel);
  }
  saveStoredDevCases(cases);
  return { id };
}

export function upsertDevWeapon(data: Record<string, unknown>): { id: string } {
  const cases = getStoredDevCases();
  const caseId = data["caseId"] as string;
  const target = cases.find((c) => c.id === caseId);
  const id = (data["id"] as string) || generateId("wpn");
  if (!target) return { id };

  const wpn: Weapon = {
    id,
    brand: String(data["brand"] ?? "Neznáma"),
    model: String(data["model"] ?? ""),
    serial: String(data["serial"] ?? data["serialNumber"] ?? ""),
    holderId: String(data["holderId"] ?? data["ownerEntityId"] ?? ""),
    supplierId: String(data["supplierId"] ?? ""),
    acquiredAt: String(
      data["acquiredAt"] ?? new Date().toISOString().slice(0, 10),
    ),
    ...(data["licence"] ? { licence: String(data["licence"]) } : {}),
  };

  const existingIdx = target.weapons.findIndex((w) => w.id === id);
  if (existingIdx >= 0) {
    target.weapons[existingIdx] = wpn;
  } else {
    target.weapons.push(wpn);
  }
  saveStoredDevCases(cases);
  return { id };
}

export function upsertDevEvent(data: Record<string, unknown>): { id: string } {
  const cases = getStoredDevCases();
  const caseId = data["caseId"] as string;
  const target = cases.find((c) => c.id === caseId);
  const id = (data["id"] as string) || generateId("ev");
  if (!target) return { id };

  const ev: CaseEvent = {
    date: String(data["date"] ?? new Date().toISOString().slice(0, 10)),
    title: String(data["title"] ?? ""),
    detail: String(data["detail"] ?? ""),
    severity: (data["severity"] as Severity) ?? "low",
  };

  target.events.push(ev);
  saveStoredDevCases(cases);
  return { id };
}

export function deleteDevRecord(type: string, id: string): void {
  const cases = getStoredDevCases();
  if (type === "case") {
    const next = cases.filter((c) => c.id !== id);
    saveStoredDevCases(next);
    return;
  }
  for (const c of cases) {
    if (type === "entity") c.entities = c.entities.filter((e) => e.id !== id);
    if (type === "transaction")
      c.transactions = c.transactions.filter((t) => t.id !== id);
    if (type === "relation") {
      c.relations = c.relations.filter(
        (r) =>
          `${r.fromId}-${r.toId}` !== id && r.fromId !== id && r.toId !== id,
      );
    }
    if (type === "weapon") c.weapons = c.weapons.filter((w) => w.id !== id);
  }
  saveStoredDevCases(cases);
}
