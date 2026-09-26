import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Všetky zápisy do prípadu idú cez tieto serverové funkcie.
 * Identita sa berie výhradne z overenej relácie (`context.userId`),
 * nikdy z dát poslaných klientom. Databáza navyše vynucuje vlastníctvo prípadu,
 * platnosť referencií a audit log.
 */

const uuid = z.string().uuid("Neplatný identifikátor.");
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dátum musí byť v tvare RRRR-MM-DD.")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Neplatný dátum.");
const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Mena musí byť trojpísmenový kód (napr. EUR).");
const money = z
  .number()
  .finite("Suma musí byť číslo.")
  .refine((value) => value !== 0, "Suma nesmie byť nula.")
  .refine((value) => Math.abs(value) < 1e15, "Suma je mimo rozsahu.")
  .refine(
    (value) => Math.round(value * 100) === value * 100,
    "Najviac dve desatinné miesta.",
  );
const shortText = z.string().trim().max(200);
const longText = z.string().trim().max(2000);
const revision = z.number().int().positive();

function fail(
  error: { message: string; code?: string } | null,
  fallback: string,
): never {
  if (error?.code === "42501")
    throw new Error("Nemáte oprávnenie na túto operáciu.");
  throw new Error(error?.message ? `${fallback} (${error.message})` : fallback);
}

/** Optimistické zamykanie: ak sa revízia nezhoduje, niekto záznam medzitým zmenil. */
function assertUpdated(count: number | null): void {
  if (!count) {
    throw new Error(
      "Záznam bol medzičasom zmenený inde. Načítajte prípad znova a zopakujte úpravu.",
    );
  }
}

/* ---------------------------------- prípad --------------------------------- */

export const saveCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: uuid.optional(),
        name: z.string().trim().min(1, "Zadajte názov prípadu.").max(160),
        subtitle: shortText.default(""),
        referenceDate: isoDate.optional(),
        baseCurrency: currency.default("EUR"),
        expectedRevision: revision.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      name: data.name,
      subtitle: data.subtitle,
      reference_date:
        data.referenceDate ?? new Date().toISOString().slice(0, 10),
      base_currency: data.baseCurrency,
    };
    if (data.id) {
      const query = context.supabase
        .from("cases")
        .update(payload)
        .eq("id", data.id);
      const { data: rows, error } = await (
        data.expectedRevision
          ? query.eq("revision", data.expectedRevision)
          : query
      ).select("id");
      if (error) fail(error, "Prípad sa nepodarilo uložiť.");
      assertUpdated(rows?.length ?? 0);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("cases")
      .insert({ ...payload, user_id: context.userId })
      .select("id")
      .single();
    if (error || !row) fail(error, "Prípad sa nepodarilo vytvoriť.");
    return { id: row.id };
  });

/* --------------------------------- subjekty -------------------------------- */

const entityInput = z.object({
  id: uuid.optional(),
  caseId: uuid,
  name: z.string().trim().min(1, "Zadajte meno alebo názov.").max(160),
  kind: z.enum(["person", "company"]).default("person"),
  role: shortText.default(""),
  ico: shortText.optional().nullable(),
  address: shortText.optional().nullable(),
  registeredAddress: shortText.optional().nullable(),
  licence: shortText.optional().nullable(),
  incorporatedAt: isoDate.optional().nullable(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Krajina musí byť dvojpísmenový kód.")
    .default("SK"),
  physicalInventory: z.boolean().optional().nullable(),
  responsive: z.boolean().optional().nullable(),
  note: longText.optional().nullable(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  expectedRevision: revision.optional(),
});

export const saveEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => entityInput.parse(input))
  .handler(async ({ data, context }) => {
    const payload = {
      case_id: data.caseId,
      name: data.name,
      kind: data.kind,
      role: data.role,
      ico: data.ico || null,
      address: data.address || null,
      registered_address: data.registeredAddress || null,
      licence: data.licence || null,
      incorporated_at: data.incorporatedAt || null,
      country: data.country,
      physical_inventory: data.physicalInventory ?? null,
      responsive: data.responsive ?? null,
      note: data.note || null,
    };
    if (data.id) {
      const query = context.supabase
        .from("case_entities")
        .update(payload)
        .eq("id", data.id);
      const { data: rows, error } = await (
        data.expectedRevision
          ? query.eq("revision", data.expectedRevision)
          : query
      ).select("id");
      if (error) fail(error, "Subjekt sa nepodarilo uložiť.");
      assertUpdated(rows?.length ?? 0);
      return { id: data.id };
    }
    // Pozícia v grafe je len rozloženie zobrazenia, nie vstup do analýzy.
    const { data: row, error } = await context.supabase
      .from("case_entities")
      .insert({
        ...payload,
        user_id: context.userId,
        x: data.x ?? 50,
        y: data.y ?? 50,
      })
      .select("id")
      .single();
    if (error || !row) fail(error, "Subjekt sa nepodarilo pridať.");
    return { id: row.id };
  });

/* -------------------------------- transakcie ------------------------------- */

const transactionInput = z.object({
  id: uuid.optional(),
  caseId: uuid,
  date: isoDate,
  amount: money,
  currency: currency.default("EUR"),
  method: z.enum(["cash", "transfer"]).default("transfer"),
  fromId: uuid,
  toId: uuid,
  payerId: uuid.optional().nullable(),
  originCountry: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .default("SK"),
  destinationCountry: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .default("SK"),
  description: longText.default(""),
  expectedRevision: revision.optional(),
});

export const saveTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    transactionInput
      .refine((value) => value.fromId !== value.toId, {
        message: "Odosielateľ a príjemca nesmú byť rovnaký subjekt.",
        path: ["toId"],
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      case_id: data.caseId,
      date: data.date,
      amount: data.amount,
      currency: data.currency,
      method: data.method,
      from_id: data.fromId,
      to_id: data.toId,
      payer_id: data.payerId || null,
      origin_country: data.originCountry,
      destination_country: data.destinationCountry,
      description: data.description,
    };
    if (data.id) {
      const query = context.supabase
        .from("case_transactions")
        .update(payload)
        .eq("id", data.id);
      const { data: rows, error } = await (
        data.expectedRevision
          ? query.eq("revision", data.expectedRevision)
          : query
      ).select("id");
      if (error) fail(error, "Transakciu sa nepodarilo uložiť.");
      assertUpdated(rows?.length ?? 0);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("case_transactions")
      .insert({ ...payload, user_id: context.userId })
      .select("id")
      .single();
    if (error || !row) fail(error, "Transakciu sa nepodarilo pridať.");
    return { id: row.id };
  });

/* ---------------------------------- vzťahy --------------------------------- */

export const saveRelation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: uuid.optional(),
        caseId: uuid,
        fromId: uuid,
        toId: uuid,
        label: z.string().trim().min(1, "Popíšte vzťah.").max(120),
        expectedRevision: revision.optional(),
      })
      .refine((value) => value.fromId !== value.toId, {
        message: "Vzťah musí spájať dva rôzne subjekty.",
        path: ["toId"],
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      case_id: data.caseId,
      from_id: data.fromId,
      to_id: data.toId,
      label: data.label,
    };
    if (data.id) {
      const query = context.supabase
        .from("case_relations")
        .update(payload)
        .eq("id", data.id);
      const { data: rows, error } = await (
        data.expectedRevision
          ? query.eq("revision", data.expectedRevision)
          : query
      ).select("id");
      if (error) fail(error, "Vzťah sa nepodarilo uložiť.");
      assertUpdated(rows?.length ?? 0);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("case_relations")
      .insert({ ...payload, user_id: context.userId })
      .select("id")
      .single();
    if (error || !row) fail(error, "Vzťah sa nepodarilo pridať.");
    return { id: row.id };
  });

/* ---------------------------------- zbrane --------------------------------- */

export const saveWeapon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: uuid.optional(),
        caseId: uuid,
        brand: z.string().trim().min(1, "Zadajte značku.").max(120),
        model: shortText.default(""),
        serial: z.string().trim().min(1, "Zadajte výrobné číslo.").max(80),
        holderId: uuid,
        supplierId: uuid,
        acquiredAt: isoDate.optional().nullable(),
        licence: shortText.optional().nullable(),
        expectedRevision: revision.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      case_id: data.caseId,
      brand: data.brand,
      model: data.model,
      serial: data.serial,
      holder_id: data.holderId,
      supplier_id: data.supplierId,
      acquired_at: data.acquiredAt || null,
      licence: data.licence || null,
    };
    if (data.id) {
      const query = context.supabase
        .from("case_weapons")
        .update(payload)
        .eq("id", data.id);
      const { data: rows, error } = await (
        data.expectedRevision
          ? query.eq("revision", data.expectedRevision)
          : query
      ).select("id");
      if (error) fail(error, "Zbraň sa nepodarilo uložiť.");
      assertUpdated(rows?.length ?? 0);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("case_weapons")
      .insert({ ...payload, user_id: context.userId })
      .select("id")
      .single();
    if (error || !row) fail(error, "Zbraň sa nepodarilo pridať.");
    return { id: row.id };
  });

/* --------------------------------- udalosti -------------------------------- */

export const saveEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: uuid.optional(),
        caseId: uuid,
        date: isoDate,
        title: z.string().trim().min(1, "Zadajte názov udalosti.").max(160),
        detail: longText.default(""),
        severity: z.enum(["critical", "high", "medium", "low"]).default("low"),
        expectedRevision: revision.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      case_id: data.caseId,
      date: data.date,
      title: data.title,
      detail: data.detail,
      severity: data.severity,
    };
    if (data.id) {
      const query = context.supabase
        .from("case_events")
        .update(payload)
        .eq("id", data.id);
      const { data: rows, error } = await (
        data.expectedRevision
          ? query.eq("revision", data.expectedRevision)
          : query
      ).select("id");
      if (error) fail(error, "Udalosť sa nepodarilo uložiť.");
      assertUpdated(rows?.length ?? 0);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("case_events")
      .insert({ ...payload, user_id: context.userId })
      .select("id")
      .single();
    if (error || !row) fail(error, "Udalosť sa nepodarilo pridať.");
    return { id: row.id };
  });

/* --------------------------------- mazanie --------------------------------- */

const RECORD_TABLES = {
  case: "cases",
  entity: "case_entities",
  transaction: "case_transactions",
  relation: "case_relations",
  weapon: "case_weapons",
  event: "case_events",
} as const;

type RecordType = keyof typeof RECORD_TABLES;

const deleteInput = z.object({
  type: z.enum([
    "case",
    "entity",
    "transaction",
    "relation",
    "weapon",
    "event",
  ]),
  id: uuid,
});

/** Zistí, čo mazanie ovplyvní — aby nevznikli osirelé referencie. */
export const getDeleteImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => deleteInput.parse(input))
  .handler(async ({ data, context }) => {
    const blockers: string[] = [];
    const cascades: string[] = [];

    if (data.type === "entity") {
      const [tx, relations, weapons] = await Promise.all([
        context.supabase
          .from("case_transactions")
          .select("id", { count: "exact", head: true })
          .or(
            `from_id.eq.${data.id},to_id.eq.${data.id},payer_id.eq.${data.id}`,
          ),
        context.supabase
          .from("case_relations")
          .select("id", { count: "exact", head: true })
          .or(`from_id.eq.${data.id},to_id.eq.${data.id}`),
        context.supabase
          .from("case_weapons")
          .select("id", { count: "exact", head: true })
          .or(`holder_id.eq.${data.id},supplier_id.eq.${data.id}`),
      ]);
      if (tx.count) blockers.push(`${tx.count} transakcií`);
      if (relations.count) blockers.push(`${relations.count} vzťahov`);
      if (weapons.count) blockers.push(`${weapons.count} zbraní`);
    }

    if (data.type === "case") {
      const tables = [
        "case_entities",
        "case_transactions",
        "case_relations",
        "case_weapons",
        "case_events",
      ] as const;
      const labels = [
        "subjektov",
        "transakcií",
        "vzťahov",
        "zbraní",
        "udalostí",
      ];
      const counts = await Promise.all(
        tables.map((table) =>
          context.supabase
            .from(table)
            .select("id", { count: "exact", head: true })
            .eq("case_id", data.id),
        ),
      );
      counts.forEach((result: { count: number | null }, index: number) => {
        if (result.count) cascades.push(`${result.count} ${labels[index]}`);
      });
    }

    return { blockers, cascades, canDelete: blockers.length === 0 };
  });

export const deleteRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => deleteInput.parse(input))
  .handler(async ({ data, context }) => {
    const table = RECORD_TABLES[data.type as RecordType];
    const { error } = await context.supabase
      .from(table)
      .delete()
      .eq("id", data.id);
    if (error) {
      if (error.code === "23503") {
        throw new Error(
          "Záznam sa nedá zmazať, pretože naň odkazujú iné záznamy. Najprv zmažte tie.",
        );
      }
      fail(error, "Mazanie zlyhalo.");
    }
    return { ok: true };
  });

/* ------------------------------ demo prípad -------------------------------- */

/**
 * Vytvorí výslovne označený syntetický ukážkový prípad.
 * Neobsahuje osobné údaje a vytvára sa len na výslovné vyžiadanie používateľa —
 * nikdy sa nepridáva automaticky do reálnych prípadov.
 */
export const createDemoCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date();
    const day = (offset: number) =>
      new Date(today.getTime() - offset * 86400000).toISOString().slice(0, 10);

    const { data: created, error: caseError } = await supabase
      .from("cases")
      .insert({
        user_id: userId,
        name: "UKÁŽKA — syntetické dáta",
        subtitle: "Vzorový prípad bez osobných údajov",
        is_demo: true,
        base_currency: "EUR",
        reference_date: day(0),
      })
      .select("id")
      .single();
    if (caseError || !created)
      fail(caseError, "Ukážkový prípad sa nepodarilo vytvoriť.");
    const caseId = created.id;

    const entities = [
      {
        name: "Subjekt A s.r.o.",
        kind: "company",
        role: "odberateľ",
        country: "SK",
        x: 20,
        y: 30,
      },
      {
        name: "Subjekt B s.r.o.",
        kind: "company",
        role: "sprostredkovateľ",
        country: "CZ",
        x: 55,
        y: 20,
      },
      {
        name: "Subjekt C Ltd.",
        kind: "company",
        role: "príjemca",
        country: "CY",
        x: 80,
        y: 60,
      },
      {
        name: "Osoba D (fiktívna)",
        kind: "person",
        role: "konateľ",
        country: "SK",
        x: 35,
        y: 70,
      },
    ];
    const { data: rows, error: entityError } = await supabase
      .from("case_entities")
      .insert(entities.map((e) => ({ ...e, case_id: caseId, user_id: userId })))
      .select("id, name");
    if (entityError || !rows)
      fail(entityError, "Ukážkové subjekty sa nepodarilo vytvoriť.");

    const byName = (needle: string) =>
      rows.find((r: { id: string; name: string }) => r.name.startsWith(needle))
        ?.id ?? null;
    const a = byName("Subjekt A");
    const b = byName("Subjekt B");
    const c = byName("Subjekt C");

    const transactions = [
      {
        date: day(30),
        amount: 48000,
        from_id: a,
        to_id: b,
        destination_country: "CZ",
        description: "Poradenské služby (ukážka)",
      },
      {
        date: day(28),
        amount: 47500,
        from_id: b,
        to_id: c,
        destination_country: "CY",
        description: "Licenčný poplatok (ukážka)",
      },
      {
        date: day(21),
        amount: 9900,
        from_id: a,
        to_id: b,
        destination_country: "CZ",
        description: "Marketing (ukážka)",
      },
      {
        date: day(20),
        amount: 9900,
        from_id: a,
        to_id: b,
        destination_country: "CZ",
        description: "Marketing (ukážka)",
      },
      {
        date: day(19),
        amount: 9900,
        from_id: a,
        to_id: b,
        destination_country: "CZ",
        description: "Marketing (ukážka)",
      },
      {
        date: day(7),
        amount: 62000,
        from_id: b,
        to_id: c,
        destination_country: "CY",
        description: "Vyrovnanie (ukážka)",
      },
    ];
    const { error: txError } = await supabase.from("case_transactions").insert(
      transactions.map((t) => ({
        ...t,
        case_id: caseId,
        user_id: userId,
        currency: "EUR",
        method: "transfer",
        origin_country: "SK",
      })),
    );
    if (txError) fail(txError, "Ukážkové transakcie sa nepodarilo vytvoriť.");

    await supabase.from("case_events").insert([
      {
        case_id: caseId,
        user_id: userId,
        date: day(30),
        title: "Začiatok toku platieb",
        detail: "Syntetická udalosť pre ukážku.",
        severity: "low",
      },
    ]);

    return { id: caseId };
  });
