import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
        /** Registry-issued key only; a name is intentionally not accepted here. */
        identityKey: z.string().trim().min(3).max(160).optional(),
      }),
    )
    .max(200)
    .default([]),
  companies: z
    .array(
      z.object({
        name: nameSchema,
        identityKey: z.string().trim().min(3).max(160).optional(),
      }),
    )
    .max(200)
    .default([]),
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

const commitResultSchema = z.object({
  entities: z.number().int().nonnegative(),
  events: z.number().int().nonnegative(),
  relations: z.number().int().nonnegative(),
});

type GraphEntity = {
  key: string;
  name: string;
  kind: "person" | "company";
  role: string;
  x: number;
  y: number;
  identityKey?: string;
};

export type ApplyAiResultsInput = z.input<typeof inputSchema>;

/** Prevedie rôzne tvary dátumu z AI na RRRR-MM-DD; inak vráti null. */
export function normalizeDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dotted = text.match(/^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})$/);
  if (dotted) {
    return `${dotted[3]}-${dotted[2]!.padStart(2, "0")}-${dotted[1]!.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
  if (/^\d{4}$/.test(text)) return `${text}-01-01`;
  return null;
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase("sk").replace(/\s+/g, " ");
}

/**
 * Builds relation keys only for uniquely named entities in this submission.
 * Ambiguous homonyms are deliberately not linked by an AI inference.
 */
export function buildGraphCommit(input: z.output<typeof inputSchema>) {
  const entities: GraphEntity[] = [];
  for (const [kind, items] of [
    ["person", input.persons],
    ["company", input.companies],
  ] as const) {
    for (const item of items) {
      if (entities.length === MAX_ENTITIES) break;
      const index = entities.length;
      entities.push({
        key: `ai-${kind}-${index}`,
        name: item.name,
        kind,
        role: kind === "person" && "role" in item ? item.role || "osoba" : "firma",
        x: 80 + (index % 5) * 90,
        y: 80 + Math.floor(index / 5) * 90,
        ...(item.identityKey ? { identityKey: item.identityKey } : {}),
      });
    }
  }
  const keysByName = new Map<string, string[]>();
  for (const entity of entities) {
    const name = normalizedName(entity.name);
    keysByName.set(name, [...(keysByName.get(name) ?? []), entity.key]);
  }

  const events = input.timeline
    .map((item) => {
      const title = (item.event ?? item.detail ?? "").trim();
      if (!title) return null;
      return {
        date: normalizeDate(item.date) ?? null,
        title: title.slice(0, 160),
        detail: (item.detail ?? item.event ?? "").slice(0, 600),
        actors: item.actors ?? [],
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, MAX_EVENTS);
  const relations = events.flatMap((event) => {
    if (!event.date) return [];
    const actorKeys = event.actors
      .map((actor) => keysByName.get(normalizedName(actor)))
      .filter((keys): keys is [string] => keys?.length === 1)
      .map(([key]) => key);
    const uniqueActorKeys = [...new Set(actorKeys)];
    const pairs: {
      fromKey: string;
      toKey: string;
      label: string;
      validFrom: string;
    }[] = [];
    for (let i = 0; i < uniqueActorKeys.length; i += 1)
      for (let j = i + 1; j < uniqueActorKeys.length; j += 1)
        pairs.push({
          fromKey: uniqueActorKeys[i]!,
          toKey: uniqueActorKeys[j]!,
          label: event.title.slice(0, 80),
          validFrom: event.date,
        });
    return pairs;
  });
  return {
    entities,
    events: events
      .filter((event): event is typeof event & { date: string } => !!event.date)
      .map(({ actors: _actors, ...event }) => event),
    relations: relations.slice(0, MAX_RELATIONS),
  };
}

export const applyAiResultsToCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const graph = buildGraphCommit(data);
    const { data: result, error } = await context.supabase.rpc(
      "commit_ai_case_graph",
      { _case_id: data.caseId, _graph: graph },
    );
    if (error)
      throw new Error(`Graf prípadu sa nepodarilo uložiť. (${error.message})`);
    return commitResultSchema.parse(result);
  });

const dossierTimelineSchema = z.object({
  facts: z
    .object({
      timeline: z
        .array(
          z.object({
            date: z.string().optional(),
            event: z.string().optional(),
            title: z.string().optional(),
            description: z.string().optional(),
            detail: z.string().optional(),
            actors: z.array(z.union([z.string(), z.object({ name: z.string() })])).optional(),
            persons: z.array(z.union([z.string(), z.object({ name: z.string() })])).optional(),
            entities: z.array(z.union([z.string(), z.object({ name: z.string() })])).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

/** Z dossiera AI vytiahne položky časovej osi v tvare, ktorý prijíma zápis. */
export function toTimelineInput(dossier: unknown): {
  date?: string;
  event?: string;
  detail?: string;
  actors?: string[];
}[] {
  const parsed = dossierTimelineSchema.safeParse(dossier);
  if (!parsed.success) return [];
  return (parsed.data.facts?.timeline ?? []).slice(0, 200).flatMap((row) => {
    const event = row.event?.trim() || row.title?.trim();
    const detail = row.detail?.trim() || row.description?.trim();
    if (!event && !detail) return [];
    const rawActors = row.actors ?? row.persons ?? row.entities ?? [];
    const actors = rawActors
      .map((actor) => (typeof actor === "string" ? actor : actor.name).trim())
      .filter(Boolean)
      .slice(0, 20);
    return [{
      ...(row.date?.trim() ? { date: row.date.trim() } : {}),
      ...(event ? { event } : {}),
      ...(detail ? { detail } : {}),
      ...(actors.length ? { actors } : {}),
    }];
  });
}
