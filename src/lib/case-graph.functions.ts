import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Prenesie výsledok AI (osoby, firmy, časová os) do dát prípadu,
 * aby sa zobrazil v sieťovom grafe a v časovej osi.
 * Zápis je idempotentný — rovnaký spis spustený dvakrát nevytvorí duplicity.
 */

const MAX_ENTITIES = 60;
const MAX_EVENTS = 60;
const MAX_RELATIONS = 80;

const nameSchema = z.string().trim().min(2).max(160);

const inputSchema = z.object({
  caseId: z.string().uuid("Neplatný identifikátor prípadu."),
  persons: z
    .array(
      z.object({
        name: nameSchema,
        role: z.string().trim().max(120).optional(),
      }),
    )
    .max(200)
    .default([]),
  companies: z.array(nameSchema).max(200).default([]),
  timeline: z
    .array(
      z.object({
        date: z.string().trim().max(60).optional(),
        event: z.string().trim().max(400).optional(),
        detail: z.string().trim().max(1000).optional(),
        actors: z.array(z.string().trim().max(160)).max(20).optional(),
      }),
    )
    .max(200)
    .default([]),
});

export type ApplyAiResultsInput = z.input<typeof inputSchema>;

/** Prevedie rôzne tvary dátumu z AI na RRRR-MM-DD; inak vráti null. */
export function normalizeDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dotted = text.match(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/);
  if (dotted) {
    const day = dotted[1]!.padStart(2, "0");
    const month = dotted[2]!.padStart(2, "0");
    return `${dotted[3]}-${month}-${day}`;
  }
  const monthOnly = text.match(/^(\d{4})-(\d{2})$/);
  if (monthOnly) return `${monthOnly[1]}-${monthOnly[2]}-01`;
  const yearOnly = text.match(/^(\d{4})$/);
  if (yearOnly) return `${yearOnly[1]}-01-01`;
  return null;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export const applyAiResultsToCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { caseId } = data;
    const supabase = context.supabase;

    const { data: caseRow, error: caseError } = await supabase
      .from("cases")
      .select("id, reference_date")
      .eq("id", caseId)
      .maybeSingle();
    if (caseError)
      throw new Error(`Prípad sa nepodarilo načítať. (${caseError.message})`);
    if (!caseRow)
      throw new Error("Prípad sa nenašiel alebo naň nemáte oprávnenie.");

    const fallbackDate =
      (caseRow as { reference_date?: string }).reference_date ??
      new Date().toISOString().slice(0, 10);

    /* ------------------------------- entity ------------------------------- */
    const { data: existingEntities, error: entitiesError } = await supabase
      .from("case_entities")
      .select("id, name")
      .eq("case_id", caseId);
    if (entitiesError)
      throw new Error(
        `Entity sa nepodarilo načítať. (${entitiesError.message})`,
      );

    const byName = new Map<string, string>();
    for (const row of (existingEntities ?? []) as {
      id: string;
      name: string;
    }[]) {
      byName.set(normalizeKey(row.name), row.id);
    }

    type EntityInsert = {
      case_id: string;
      user_id: string;
      name: string;
      kind: string;
      role: string;
      x: number;
      y: number;
    };
    const toInsert: EntityInsert[] = [];
    const queued = new Set<string>();
    const queue = (name: string, kind: "person" | "company", role: string) => {
      const key = normalizeKey(name);
      if (!key || byName.has(key) || queued.has(key)) return;
      if (toInsert.length >= MAX_ENTITIES) return;
      queued.add(key);
      const index = toInsert.length;
      toInsert.push({
        case_id: caseId,
        user_id: context.userId,
        name: name.trim(),
        kind,
        role,
        // Rozloženie do mriežky, aby graf nezobrazil všetko na jednom bode.
        x: 80 + (index % 5) * 90,
        y: 80 + Math.floor(index / 5) * 90,
      });
    };

    for (const person of data.persons) {
      queue(person.name, "person", person.role?.trim() || "osoba");
    }
    for (const company of data.companies) queue(company, "company", "firma");

    if (toInsert.length > 0) {
      const { data: inserted, error } = await supabase
        .from("case_entities")
        .insert(toInsert)
        .select("id, name");
      if (error)
        throw new Error(`Entity sa nepodarilo uložiť. (${error.message})`);
      for (const row of (inserted ?? []) as { id: string; name: string }[]) {
        byName.set(normalizeKey(row.name), row.id);
      }
    }

    /* ------------------------------ časová os ----------------------------- */
    const { data: existingEvents, error: eventsError } = await supabase
      .from("case_events")
      .select("date, title")
      .eq("case_id", caseId);
    if (eventsError)
      throw new Error(
        `Časovú os sa nepodarilo načítať. (${eventsError.message})`,
      );

    const eventKeys = new Set(
      ((existingEvents ?? []) as { date: string; title: string }[]).map(
        (row) => `${row.date}|${normalizeKey(row.title)}`,
      ),
    );

    const eventRows: {
      case_id: string;
      user_id: string;
      date: string;
      title: string;
      detail: string;
      severity: string;
    }[] = [];
    const relationPairs: { from: string; to: string; label: string }[] = [];

    for (const item of data.timeline) {
      const title = (item.event ?? item.detail ?? "").trim();
      if (!title) continue;
      const date = normalizeDate(item.date) ?? fallbackDate;
      const key = `${date}|${normalizeKey(title)}`;
      if (!eventKeys.has(key) && eventRows.length < MAX_EVENTS) {
        eventKeys.add(key);
        eventRows.push({
          case_id: caseId,
          user_id: context.userId,
          date,
          title: title.slice(0, 160),
          detail: (item.detail ?? item.event ?? "").slice(0, 600),
          severity: "medium",
        });
      }
      // Osoby vystupujúce v tej istej udalosti sú v grafe prepojené.
      const actorIds = (item.actors ?? [])
        .map((actor) => byName.get(normalizeKey(actor)))
        .filter((id): id is string => Boolean(id));
      for (let i = 0; i < actorIds.length; i++) {
        for (let j = i + 1; j < actorIds.length; j++) {
          relationPairs.push({
            from: actorIds[i]!,
            to: actorIds[j]!,
            label: title.slice(0, 80),
          });
        }
      }
    }

    if (eventRows.length > 0) {
      const { error } = await supabase.from("case_events").insert(eventRows);
      if (error)
        throw new Error(`Časovú os sa nepodarilo uložiť. (${error.message})`);
    }

    /* ------------------------------- vzťahy ------------------------------- */
    const { data: existingRelations, error: relationsError } = await supabase
      .from("case_relations")
      .select("from_id, to_id")
      .eq("case_id", caseId);
    if (relationsError)
      throw new Error(
        `Vzťahy sa nepodarilo načítať. (${relationsError.message})`,
      );

    const relationKeys = new Set(
      (
        (existingRelations ?? []) as {
          from_id: string | null;
          to_id: string | null;
        }[]
      )
        .filter((row) => row.from_id && row.to_id)
        .map((row) => [row.from_id, row.to_id].sort().join("|")),
    );

    const relationRows: {
      case_id: string;
      user_id: string;
      from_id: string;
      to_id: string;
      label: string;
    }[] = [];
    for (const pair of relationPairs) {
      const key = [pair.from, pair.to].sort().join("|");
      if (relationKeys.has(key)) continue;
      if (relationRows.length >= MAX_RELATIONS) break;
      relationKeys.add(key);
      relationRows.push({
        case_id: caseId,
        user_id: context.userId,
        from_id: pair.from,
        to_id: pair.to,
        label: pair.label || "spoločná udalosť",
      });
    }

    if (relationRows.length > 0) {
      const { error } = await supabase
        .from("case_relations")
        .insert(relationRows);
      if (error)
        throw new Error(`Vzťahy sa nepodarilo uložiť. (${error.message})`);
    }

    return {
      entities: toInsert.length,
      events: eventRows.length,
      relations: relationRows.length,
    };
  });

/** Z dossiera AI vytiahne položky časovej osi v tvare, ktorý prijíma zápis. */
export function toTimelineInput(dossier: unknown): {
  date?: string;
  event?: string;
  detail?: string;
  actors?: string[];
}[] {
  const facts = (dossier as { facts?: { timeline?: unknown[] } })?.facts;
  const rows = Array.isArray(facts?.timeline) ? facts.timeline : [];
  const out: {
    date?: string;
    event?: string;
    detail?: string;
    actors?: string[];
  }[] = [];
  for (const raw of rows.slice(0, 200)) {
    const row = raw as {
      date?: unknown;
      event?: unknown;
      title?: unknown;
      description?: unknown;
      detail?: unknown;
      actors?: unknown;
      persons?: unknown;
      entities?: unknown;
    };
    const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const event = text(row.event) || text(row.title);
    const detail = text(row.detail) || text(row.description);
    if (!event && !detail) continue;
    const actorsRaw = [row.actors, row.persons, row.entities].find(
      Array.isArray,
    ) as unknown[] | undefined;
    const actors = (actorsRaw ?? [])
      .map((a) =>
        typeof a === "string"
          ? a.trim()
          : text((a as { name?: unknown })?.name),
      )
      .filter(Boolean)
      .slice(0, 20);
    out.push({
      ...(text(row.date) ? { date: text(row.date) } : {}),
      ...(event ? { event } : {}),
      ...(detail ? { detail } : {}),
      ...(actors.length ? { actors } : {}),
    });
  }
  return out;
}
