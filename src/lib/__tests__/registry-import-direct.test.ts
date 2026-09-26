import { describe, expect, it } from "vitest";
import {
  commitCompanyRegistryImportDirect,
  isRegistryRpcMissingFromSchema,
} from "@/lib/registry.functions";

describe("priamy import registra, keď RPC v schéme chýba", () => {
  it("rozpozná hlášku PostgREST schema cache", () => {
    expect(
      isRegistryRpcMissingFromSchema({
        code: "PGRST202",
        message:
          "Could not find the function public.commit_company_registry_import(_case_id, _existing_entity_id, _mode, _snapshot_id) in the schema cache",
      }),
    ).toBe(true);
    expect(
      isRegistryRpcMissingFromSchema({
        code: "42883",
        message: "function commit_company_registry_import does not exist",
      }),
    ).toBe(false);
  });

  it("vytvorí firmu, štatutára a väzbu a pri chybe väzby zápis zmaže", async () => {
    const entities = new Map<string, Record<string, unknown>>();
    const relations = new Map<string, Record<string, unknown>>();
    const snapshots = new Map<string, Record<string, unknown>>();
    let seq = 0;
    const nextId = () => `id-${++seq}`;

    const admin = {
      from(table: string) {
        const filters: Record<string, unknown> = {};
        const builder: Record<string, unknown> = {
          select: () => builder,
          eq(col: string, val: unknown) {
            filters[col] = val;
            return builder;
          },
          in(col: string, ids: string[]) {
            const store = table === "case_relations" ? relations : entities;
            for (const id of ids) {
              const row = store.get(id);
              if (row && row[col] === id) store.delete(id);
            }
            return Promise.resolve({ error: null });
          },
          maybeSingle: async () => {
            const store = table === "case_entities" ? entities : snapshots;
            const row = [...store.values()].find((item) =>
              Object.entries(filters).every(([k, v]) => item[k] === v),
            );
            return { data: row ?? null, error: null };
          },
          async then(resolve: (value: unknown) => unknown) {
            const store = table === "case_entities" ? entities : relations;
            const rows = [...store.values()].filter((item) =>
              Object.entries(filters).every(([k, v]) => item[k] === v),
            );
            return resolve({ data: rows, error: null });
          },
          insert(record: Record<string, unknown>) {
            const id = nextId();
            const full = { ...record, id };
            const store =
              table === "case_entities"
                ? entities
                : table === "case_relations"
                  ? relations
                  : snapshots;
            store.set(id, full);
            return {
              select: () => ({
                single: async () => ({ data: full, error: null }),
              }),
            };
          },
          update(fields: Record<string, unknown>) {
            return {
              eq(col: string, val: unknown) {
                filters[col] = val;
                return {
                  eq(col2: string, val2: unknown) {
                    filters[col2] = val2;
                    const store =
                      table === "company_registry_profiles"
                        ? snapshots
                        : entities;
                    for (const item of store.values()) {
                      if (
                        Object.entries(filters).every(([k, v]) => item[k] === v)
                      ) {
                        Object.assign(item, fields);
                      }
                    }
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          },
        };
        return builder;
      },
    };

    const snapshot = {
      id: "snap-1",
      case_id: "case-1",
      user_id: "user-1",
      ico: "54684994",
      legal_name: "Papi Hair Design, s. r. o.",
      legal_form: "s.r.o.",
      registered_address: "Dénešova 1143/79, Košice",
      country: "SK",
      source: "whoiswho",
      source_hash: "sha256:abc1234567890abcdef",
      statutory_persons: [
        { name: "Róbert Papcun", role: "konateľ", validFrom: "2022-06-16" },
      ],
    };
    snapshots.set(snapshot.id, { ...snapshot });

    const created = await commitCompanyRegistryImportDirect(admin, {
      caseId: "case-1",
      userId: "user-1",
      snapshot,
      mode: "new",
      existingEntityId: null,
    });

    expect(created.idempotent).toBe(false);
    expect(entities.size).toBe(2);
    expect(relations.size).toBe(1);
    expect([...relations.values()][0]?.["label"]).toBe(
      "konateľ (od 2022-06-16)",
    );
    expect(snapshots.get("snap-1")?.["entity_id"]).toBe(created.company_id);

    await expect(
      commitCompanyRegistryImportDirect(admin, {
        caseId: "case-1",
        userId: "user-1",
        snapshot,
        mode: "new",
        existingEntityId: null,
      }),
    ).rejects.toThrow("režim new");
  });
});
