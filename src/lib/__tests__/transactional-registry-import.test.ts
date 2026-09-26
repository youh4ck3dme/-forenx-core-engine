import { beforeEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import {
  handleConfirmCompanyRegistryImport,
  handleLookupCompanyRegistryByIco,
  type RegistryLookupContext,
} from "@/lib/registry.functions";
import {
  canonicalJsonStringify,
  parseCompanyRegistryProfile,
} from "@/forensic";

interface MockCase {
  id: string;
  user_id: string;
  name: string;
}

interface MockSnapshot {
  id: string;
  case_id: string;
  user_id: string;
  ico: string;
  legal_name: string;
  legal_form: string | null;
  registered_address: string | null;
  country: string;
  status: string;
  incorporated_at: string | null;
  dissolved_at: string | null;
  statutory_persons: Array<{
    name: string;
    role?: string;
    validFrom?: string;
    validTo?: string;
    sourcePersonId?: string;
  }>;
  business_activities: string[];
  address_history: any[];
  source: string;
  source_url: string | null;
  source_hash: string;
  captured_at: string;
  raw_payload: any;
  entity_id?: string | null;
  updated_at?: string;
}

interface MockEntity {
  id: string;
  case_id: string;
  user_id: string;
  name: string;
  kind: "company" | "person";
  role: string;
  ico?: string | null;
  address?: string | null;
  registered_address?: string | null;
  country: string;
  incorporated_at?: string | null;
  note?: string;
}

interface MockRelation {
  id: string;
  case_id: string;
  user_id: string;
  from_id: string;
  to_id: string;
  label: string | null;
}

/**
 * SIMULÁCIA (InMemoryDatabase):
 * Táto trieda predstavuje pamäťovú simuláciu pre rýchle izolované unit testy.
 * Nenahrádza reálny PostgreSQL test. Skutočné overenie integrity, RLS, transakcií
 * a súbehu na reálnom PostgreSQL sa vykonáva v real-postgres-registry-import.test.ts.
 */
class InMemoryDatabase {
  cases: Map<string, MockCase> = new Map();
  snapshots: Map<string, MockSnapshot> = new Map();
  entities: Map<string, MockEntity> = new Map();
  relations: Map<string, MockRelation> = new Map();

  // Zámky pre simuláciu FOR UPDATE transakcie v PostgreSQL
  private locks: Set<string> = new Set();
  failOnInsertPerson = false;

  reset() {
    this.cases.clear();
    this.snapshots.clear();
    this.entities.clear();
    this.relations.clear();
    this.locks.clear();
    this.failOnInsertPerson = false;
  }

  // Simulácia Supabase RPC 'commit_company_registry_import'
  async rpcCommitImport(
    caseId: string,
    snapshotId: string,
    userId: string,
    mode: "auto" | "new" | "update" = "auto",
    existingEntityId?: string,
  ) {
    const c = this.cases.get(caseId);
    if (!c || c.user_id !== userId) {
      const err = new Error("Nedovolený prístup k prípadu.");
      (err as any).code = "42501";
      throw err;
    }

    const snap = this.snapshots.get(snapshotId);
    if (!snap || snap.case_id !== caseId || snap.user_id !== userId) {
      const err = new Error("Snapshot neexistuje alebo k nemu nemáte prístup.");
      (err as any).code = "42501";
      throw err;
    }

    if (!snap.source_hash || snap.source_hash.length < 16) {
      throw new Error("Snapshot nemá platný serverový source_hash.");
    }

    // Simulácia FOR UPDATE zámku nad snapshotom
    while (this.locks.has(snapshotId)) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    this.locks.add(snapshotId);

    try {
      // 1. Idempotentná kontrola: ak je už entity_id priradené a entita existuje
      if (snap.entity_id && this.entities.has(snap.entity_id)) {
        return {
          company_id: snap.entity_id,
          idempotent: true,
          action: "idempotent",
        };
      }

      // 2. Začiatok transakcie (snapshot stav pred zápisom pre prípadný rollback)
      const entitiesBackup = new Map(this.entities);
      const relationsBackup = new Map(this.relations);

      try {
        let compId: string;
        if (existingEntityId) {
          const target = this.entities.get(existingEntityId);
          if (!target || target.case_id !== caseId) {
            throw new Error("Cieľová firma sa v prípade nenašla.");
          }
          target.name = snap.legal_name;
          target.registered_address = snap.registered_address;
          target.country = snap.country;
          target.incorporated_at = snap.incorporated_at;
          compId = target.id;
        } else {
          // Hľadáme existujúcu firmu s rovnakým IČO v prípade
          let foundComp: MockEntity | undefined;
          if (mode !== "new") {
            for (const ent of this.entities.values()) {
              if (
                ent.case_id === caseId &&
                ent.kind === "company" &&
                ent.ico === snap.ico
              ) {
                foundComp = ent;
                break;
              }
            }
          }

          if (foundComp) {
            foundComp.name = snap.legal_name;
            foundComp.registered_address = snap.registered_address;
            foundComp.country = snap.country;
            foundComp.incorporated_at = snap.incorporated_at;
            compId = foundComp.id;
          } else {
            compId = `comp-${crypto.randomUUID()}`;
            this.entities.set(compId, {
              id: compId,
              case_id: caseId,
              user_id: userId,
              name: snap.legal_name,
              kind: "company",
              role: snap.legal_form || "spoločnosť",
              ico: snap.ico,
              address: snap.registered_address,
              registered_address: snap.registered_address,
              country: snap.country,
              incorporated_at: snap.incorporated_at,
              note: `Zdroj: ${snap.source} (Hash: ${snap.source_hash.slice(0, 16)}...)`,
            });
          }
        }

        // 3. Vloženie štatutárov a väzieb
        for (const sp of snap.statutory_persons) {
          if (this.failOnInsertPerson) {
            throw new Error(
              "Chyba databázy: Zápis osoby zlyhal (simulovaný rollback).",
            );
          }

          const spName = sp.name.trim();
          const spRole = sp.role?.trim() || "štatutárny orgán";
          const spValidFrom = sp.validFrom?.trim();
          const relLabel = spRole + (spValidFrom ? ` (od ${spValidFrom})` : "");

          // Hľadáme osobu naviazanú na TÚTO firmu (nezlučujeme podľa mena z iných firiem)
          let personId: string | undefined;
          for (const rel of this.relations.values()) {
            if (rel.to_id === compId && rel.case_id === caseId) {
              const p = this.entities.get(rel.from_id);
              if (
                p &&
                p.kind === "person" &&
                p.name.toLowerCase() === spName.toLowerCase()
              ) {
                personId = p.id;
                break;
              }
            }
          }

          if (!personId) {
            personId = `pers-${crypto.randomUUID()}`;
            this.entities.set(personId, {
              id: personId,
              case_id: caseId,
              user_id: userId,
              name: spName,
              kind: "person",
              role: spRole,
              country: snap.country,
              note: `Štatutár spoločnosti ${snap.legal_name}`,
            });
          }

          // Kontrola existencie relácie
          let relExists = false;
          for (const rel of this.relations.values()) {
            if (
              rel.case_id === caseId &&
              rel.from_id === personId &&
              rel.to_id === compId &&
              rel.label === relLabel
            ) {
              relExists = true;
              break;
            }
          }

          if (!relExists) {
            const relId = `rel-${crypto.randomUUID()}`;
            this.relations.set(relId, {
              id: relId,
              case_id: caseId,
              user_id: userId,
              from_id: personId,
              to_id: compId,
              label: relLabel,
            });
          }
        }

        // 4. Previazanie snapshotu s vytvorenou entitou
        snap.entity_id = compId;
        snap.updated_at = new Date().toISOString();

        return {
          company_id: compId,
          idempotent: false,
          action: "created",
        };
      } catch (innerErr) {
        // ROLLBACK: obnovenie predchádzajúceho stavu
        this.entities = entitiesBackup;
        this.relations = relationsBackup;
        snap.entity_id = null;
        throw innerErr;
      }
    } finally {
      this.locks.delete(snapshotId);
    }
  }

  createSupabaseClient(activeUserId: string) {
    const db = this;
    return {
      from: (table: string) => {
        const filters: Record<string, any> = {};
        const builder: any = {
          select: () => builder,
          eq: (col: string, val: any) => {
            filters[col] = val;
            return builder;
          },
          maybeSingle: async () => {
            let list: any[] = [];
            if (table === "cases") list = Array.from(db.cases.values());
            else if (table === "company_registry_profiles")
              list = Array.from(db.snapshots.values());
            else if (table === "case_entities")
              list = Array.from(db.entities.values());
            else if (table === "case_relations")
              list = Array.from(db.relations.values());

            const match = list.find((item) => {
              return Object.entries(filters).every(([k, v]) => item[k] === v);
            });
            return { data: match || null, error: null };
          },
          single: async () => {
            const res = await builder.maybeSingle();
            if (!res.data)
              return { data: null, error: { message: "Not found" } };
            return res;
          },
          insert: (record: any) => {
            const id = record.id || `rec-${crypto.randomUUID()}`;
            const full = { ...record, id };
            if (table === "company_registry_profiles") {
              db.snapshots.set(id, full);
            } else if (table === "case_entities") {
              db.entities.set(id, full);
            } else if (table === "case_relations") {
              db.relations.set(id, full);
            }
            return {
              select: () => ({
                single: async () => ({ data: full, error: null }),
              }),
            };
          },
          update: (fields: any) => {
            return {
              eq: (col: string, val: string) => {
                let list: any[] = [];
                if (table === "company_registry_profiles")
                  list = Array.from(db.snapshots.values());
                else if (table === "case_entities")
                  list = Array.from(db.entities.values());
                for (const item of list) {
                  if (item[col] === val) {
                    Object.assign(item, fields);
                  }
                }
                return Promise.resolve({ error: null });
              },
            };
          },
        };
        return builder;
      },
      rpc: async (fnName: string, args: any) => {
        if (fnName === "commit_company_registry_import") {
          try {
            const res = await db.rpcCommitImport(
              args._case_id,
              args._snapshot_id,
              activeUserId,
              args._mode,
              args._existing_entity_id,
            );
            return { data: res, error: null };
          } catch (err: any) {
            return {
              data: null,
              error: {
                message: err.message,
                code: err.code || "P0001",
              },
            };
          }
        }
        return { data: null, error: { message: "Unknown RPC" } };
      },
    };
  }
}

describe("Transakčný a dôveryhodný import ICO Atlas (Databázová integrita & Laravel kontrakt)", () => {
  const db = new InMemoryDatabase();
  const validCaseId = "11111111-1111-4111-8111-111111111111";
  const foreignCaseId = "22222222-2222-4222-8222-222222222222";
  const userId = "usr-investigator-01";
  const foreignUserId = "usr-stranger-99";

  const sampleLaravelResponse = {
    ico: "31322832",
    legalName: "SLOVNAFT, a.s.",
    legalForm: "akciová spoločnosť",
    registeredAddress: "Vlčie hrdlo 1, 824 12 Bratislava",
    country: "SK",
    status: "active",
    incorporatedAt: "1992-05-01",
    statutoryPersons: [
      {
        name: "Ing. Marek Senkovič",
        role: "predseda predstavenstva",
        validFrom: "2020-07-01",
      },
      {
        name: "Dr. Oszkár Világi",
        role: "člen predstavenstva",
        validFrom: "2010-04-15",
      },
    ],
    businessActivities: ["Spracovanie ropy"],
    source: {
      source: "orsr",
      sourceUrl: "https://www.orsr.sk/vypis.asp?ID=31322832",
      capturedAt: "2026-09-14T10:00:00Z",
    },
  };

  beforeEach(() => {
    db.reset();
    db.cases.set(validCaseId, {
      id: validCaseId,
      user_id: userId,
      name: "Prípad Slovnaft / Podvody",
    });
    db.cases.set(foreignCaseId, {
      id: foreignCaseId,
      user_id: foreignUserId,
      name: "Cudzí prípad",
    });

    process.env["ICO_ATLAS_API_URL"] = "https://icoatlas.forendo.internal";
    process.env["ICO_ATLAS_API_KEY"] = "secret-test-token-forendo-2026";
  });

  // SCENÁR 1: Dva súbežné importy rovnakého snapshotu
  it("1. Dva súbežné importy rovnakého snapshotu (Concurrency & Idempotence) nevytvoria duplicity", async () => {
    const supabase = db.createSupabaseClient(userId);

    // Najprv vytvoríme serverový snapshot cez lookup s overeným hash
    const customFetch = async () =>
      new Response(JSON.stringify(sampleLaravelResponse), { status: 200 });

    const lookupRes = await handleLookupCompanyRegistryByIco(
      { caseId: validCaseId, ico: "31322832", country: "SK" },
      { supabase, userId, adminClient: supabase },
      customFetch as any,
    );
    expect(lookupRes.ok).toBe(true);
    const snapshotId = lookupRes.snapshotId;

    // Spustíme DVA SÚBEŽNÉ potvrdenia importu v rovnakom čase
    const [res1, res2] = await Promise.all([
      handleConfirmCompanyRegistryImport(
        { caseId: validCaseId, snapshotId, mode: "auto" },
        { supabase, userId },
      ),
      handleConfirmCompanyRegistryImport(
        { caseId: validCaseId, snapshotId, mode: "auto" },
        { supabase, userId },
      ),
    ]);

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    expect(res1.companyEntityId).toBe(res2.companyEntityId);

    // Overenie, že v databáze vznikla presne JEDNA firma a žiadne duplicitné subjekty
    const companies = Array.from(db.entities.values()).filter(
      (e) => e.kind === "company" && e.case_id === validCaseId,
    );
    expect(companies.length).toBe(1);
    expect(companies[0]?.ico).toBe("31322832");

    // Overenie, že osoby a relácie nie sú zdvojené
    const persons = Array.from(db.entities.values()).filter(
      (e) => e.kind === "person" && e.case_id === validCaseId,
    );
    expect(persons.length).toBe(2);

    const rels = Array.from(db.relations.values()).filter(
      (r) => r.case_id === validCaseId,
    );
    expect(rels.length).toBe(2);
  });

  // SCENÁR 2: Opakovanie po prerušení spojenia
  it("2. Opakovanie po prerušení spojenia vráti existujúci výsledok s idempotent: true", async () => {
    const supabase = db.createSupabaseClient(userId);

    const customFetch = async () =>
      new Response(JSON.stringify(sampleLaravelResponse), { status: 200 });

    const lookup = await handleLookupCompanyRegistryByIco(
      { caseId: validCaseId, ico: "31322832", country: "SK" },
      { supabase, userId, adminClient: supabase },
      customFetch as any,
    );

    // Prvý zápis prebehne v poriadku
    const firstImport = await handleConfirmCompanyRegistryImport(
      { caseId: validCaseId, snapshotId: lookup.snapshotId },
      { supabase, userId },
    );
    expect(firstImport.ok).toBe(true);
    expect(firstImport.idempotent).toBe(false);

    // Klient stratil spojenie a posiela potvrdenie znova (retry)
    const retryImport = await handleConfirmCompanyRegistryImport(
      { caseId: validCaseId, snapshotId: lookup.snapshotId },
      { supabase, userId },
    );
    expect(retryImport.ok).toBe(true);
    expect(retryImport.idempotent).toBe(true);
    expect(retryImport.companyEntityId).toBe(firstImport.companyEntityId);

    // Žiadne nové subjekty nepribudli
    expect(db.entities.size).toBe(3); // 1 firma + 2 štatutári
  });

  // SCENÁR 3: Rollback pri chybe vloženia osoby alebo vzťahu
  it("3. Rollback pri zlyhaní zápisu osoby nezanechá osirotenú firmu ani čiastočný stav", async () => {
    const supabase = db.createSupabaseClient(userId);

    const customFetch = async () =>
      new Response(JSON.stringify(sampleLaravelResponse), { status: 200 });

    const lookup = await handleLookupCompanyRegistryByIco(
      { caseId: validCaseId, ico: "31322832", country: "SK" },
      { supabase, userId, adminClient: supabase },
      customFetch as any,
    );

    // Simulujeme pád transakcie pri zápise osôb
    db.failOnInsertPerson = true;

    await expect(
      handleConfirmCompanyRegistryImport(
        { caseId: validCaseId, snapshotId: lookup.snapshotId },
        { supabase, userId },
      ),
    ).rejects.toThrow("Chyba databázy: Zápis osoby zlyhal");

    // Overenie čistého rollbacku: žiadna entita (ani firma) nebola zapísaná
    expect(db.entities.size).toBe(0);
    expect(db.relations.size).toBe(0);

    // Snapshot ostal v pôvodnom stave bez priradenej entity
    const snap = db.snapshots.get(lookup.snapshotId);
    expect(snap?.entity_id).toBeFalsy();
  });

  // SCENÁR 4: Podvrhnutý snapshot, cudzí používateľ a cudzí prípad
  it("4. Podvrhnutý snapshot, cudzí používateľ a cudzí prípad sú striktne odmietnuté", async () => {
    const supabaseUser = db.createSupabaseClient(userId);
    const supabaseForeign = db.createSupabaseClient(foreignUserId);

    const customFetch = async () =>
      new Response(JSON.stringify(sampleLaravelResponse), { status: 200 });

    const lookup = await handleLookupCompanyRegistryByIco(
      { caseId: validCaseId, ico: "31322832", country: "SK" },
      { supabase: supabaseUser, userId, adminClient: supabaseUser },
      customFetch as any,
    );

    // 4a. Cudzí používateľ sa pokúša potvrdiť import cudzieho snapshotu
    await expect(
      handleConfirmCompanyRegistryImport(
        { caseId: validCaseId, snapshotId: lookup.snapshotId },
        { supabase: supabaseForeign, userId: foreignUserId },
      ),
    ).rejects.toThrow();

    // 4b. Používateľ sa pokúša použiť snapshot v inom (cudzom) prípade
    await expect(
      handleConfirmCompanyRegistryImport(
        { caseId: foreignCaseId, snapshotId: lookup.snapshotId },
        { supabase: supabaseUser, userId },
      ),
    ).rejects.toThrow();

    // 4c. Snapshot bez platného serverového hashu
    const tamperedSnapId = "33333333-3333-4333-8333-333333333333";
    db.snapshots.set(tamperedSnapId, {
      ...db.snapshots.get(lookup.snapshotId)!,
      id: tamperedSnapId,
      source_hash: "", // prázdny / neplatný hash
    });

    await expect(
      handleConfirmCompanyRegistryImport(
        { caseId: validCaseId, snapshotId: tamperedSnapId },
        { supabase: supabaseUser, userId },
      ),
    ).rejects.toThrow("chýba dôveryhodný serverový hash");
  });

  // SCENÁR 5: Rozdielni ľudia s rovnakým menom
  it("5. Rozdielni ľudia s rovnakým menom z rôznych firiem sa nezlučujú naslepo", async () => {
    const supabase = db.createSupabaseClient(userId);

    // Firma 1: má štatutára "Ján Kováč"
    const company1Response = {
      ...sampleLaravelResponse,
      ico: "11111111",
      legalName: "ALFA s.r.o.",
      statutoryPersons: [{ name: "Ján Kováč", role: "konateľ" }],
    };

    // Firma 2: má tiež štatutára "Ján Kováč", ale ide o inú firmu
    const company2Response = {
      ...sampleLaravelResponse,
      ico: "22222222",
      legalName: "BETA s.r.o.",
      statutoryPersons: [{ name: "Ján Kováč", role: "konateľ" }],
    };

    let curResp = company1Response;
    const fetchMock = async () =>
      new Response(JSON.stringify(curResp), { status: 200 });

    const lookup1 = await handleLookupCompanyRegistryByIco(
      { caseId: validCaseId, ico: "11111111", country: "SK" },
      { supabase, userId, adminClient: supabase },
      fetchMock as any,
    );
    await handleConfirmCompanyRegistryImport(
      { caseId: validCaseId, snapshotId: lookup1.snapshotId },
      { supabase, userId },
    );

    curResp = company2Response;
    const lookup2 = await handleLookupCompanyRegistryByIco(
      { caseId: validCaseId, ico: "22222222", country: "SK" },
      { supabase, userId, adminClient: supabase },
      fetchMock as any,
    );
    await handleConfirmCompanyRegistryImport(
      { caseId: validCaseId, snapshotId: lookup2.snapshotId },
      { supabase, userId },
    );

    // Overenie: existujú dve rôzne entity osôb a každá patrí svojej firme
    const persons = Array.from(db.entities.values()).filter(
      (e) => e.kind === "person",
    );
    expect(persons.length).toBe(2);
    expect(persons[0]?.id).not.toBe(persons[1]?.id);
    expect(persons[0]?.name).toBe("Ján Kováč");
    expect(persons[1]?.name).toBe("Ján Kováč");
  });

  // SCENÁR 6: Historické a viacnásobné roly
  it("6. Historické a viacnásobné roly patria k vzťahu s firmou a neprepíšu rolu osoby", async () => {
    const supabase = db.createSupabaseClient(userId);

    const profileWithDatedRoles = {
      ...sampleLaravelResponse,
      ico: "31322832",
      statutoryPersons: [
        {
          name: "Ing. Marek Senkovič",
          role: "predseda predstavenstva",
          validFrom: "2020-07-01",
        },
      ],
    };

    const fetchMock = async () =>
      new Response(JSON.stringify(profileWithDatedRoles), { status: 200 });

    const lookup = await handleLookupCompanyRegistryByIco(
      { caseId: validCaseId, ico: "31322832", country: "SK" },
      { supabase, userId, adminClient: supabase },
      fetchMock as any,
    );

    const res = await handleConfirmCompanyRegistryImport(
      { caseId: validCaseId, snapshotId: lookup.snapshotId },
      { supabase, userId },
    );

    expect(res.ok).toBe(true);

    const relations = Array.from(db.relations.values()).filter(
      (r) => r.to_id === res.companyEntityId,
    );
    expect(relations.length).toBe(1);
    expect(relations[0]?.label).toBe("predseda predstavenstva (od 2020-07-01)");
  });

  // SCENÁR 7: Nezhodné IČO v odpovedi API
  it("7. Nezhodné IČO alebo krajina v odpovedi API vyvolá bezpečnostnú chybu a neuloží snapshot", async () => {
    const supabase = db.createSupabaseClient(userId);

    // Požadujeme 31322832, ale server vráti 99999999
    const poisonedResponse = {
      ...sampleLaravelResponse,
      ico: "99999999",
    };

    const customFetch = async () =>
      new Response(JSON.stringify(poisonedResponse), { status: 200 });

    await expect(
      handleLookupCompanyRegistryByIco(
        { caseId: validCaseId, ico: "31322832", country: "SK" },
        { supabase, userId, adminClient: supabase },
        customFetch as any,
      ),
    ).rejects.toThrow(
      "Bezpečnostná chyba: Vrátené IČO alebo krajina nezodpovedá zadanej požiadavke",
    );

    // V databáze nesmie byť vytvorený žiadny snapshot
    expect(db.snapshots.size).toBe(0);
  });

  // SCENÁR 8: Chýbajúca konfigurácia a zlyhania poskytovateľa
  it("8. Chýbajúca konfigurácia a chybové stavy Laravel backendu sú presne rozlíšené a nikdy negenerujú mock", async () => {
    const supabase = db.createSupabaseClient(userId);

    // 8a. Chýbajúca konfigurácia (API URL / KEY)
    delete process.env["ICO_ATLAS_API_KEY"];
    await expect(
      handleLookupCompanyRegistryByIco(
        { caseId: validCaseId, ico: "31322832", country: "SK" },
        { supabase, userId },
      ),
    ).rejects.toThrow(
      "Konfigurácia ICO Atlas (ICO_ATLAS_API_URL / ICO_ATLAS_API_KEY) chýba na serveri",
    );

    process.env["ICO_ATLAS_API_KEY"] = "secret-test-token-forendo-2026";

    // 8b. 404 Nenájdený subjekt
    const fetch404 = async () => new Response("Not Found", { status: 404 });
    await expect(
      handleLookupCompanyRegistryByIco(
        { caseId: validCaseId, ico: "31322832", country: "SK" },
        { supabase, userId },
        fetch404 as any,
      ),
    ).rejects.toThrow("sa v registri SK nenašiel");

    // 8c. 422 Neplatný formát identifikátora
    const fetch422 = async () =>
      new Response(
        JSON.stringify({ message: "Neplatné kontrolné číslo IČO." }),
        {
          status: 422,
        },
      );
    await expect(
      handleLookupCompanyRegistryByIco(
        { caseId: validCaseId, ico: "31322832", country: "SK" },
        { supabase, userId },
        fetch422 as any,
      ),
    ).rejects.toThrow("Neplatné kontrolné číslo IČO.");

    // 8d. 401/403 Neautorizovaný prístup
    const fetch401 = async () => new Response("Unauthorized", { status: 401 });
    await expect(
      handleLookupCompanyRegistryByIco(
        { caseId: validCaseId, ico: "31322832", country: "SK" },
        { supabase, userId },
        fetch401 as any,
      ),
    ).rejects.toThrow("Chyba autentifikácie");

    // 8e. 429 Prekročený rate limit
    const fetch429 = async () =>
      new Response("Rate limit exceeded", { status: 429 });
    await expect(
      handleLookupCompanyRegistryByIco(
        { caseId: validCaseId, ico: "31322832", country: "SK" },
        { supabase, userId },
        fetch429 as any,
      ),
    ).rejects.toThrow("Prekročený limit volaní registra");

    // 8f. Zlyhanie spojenia (backend nedostupný) -> NIKDY nevytvára fallback dummy dáta!
    const fetchNetworkError = async () => {
      throw new Error("ECONNREFUSED");
    };
    await expect(
      handleLookupCompanyRegistryByIco(
        { caseId: validCaseId, ico: "31322832", country: "SK" },
        { supabase, userId },
        fetchNetworkError as any,
      ),
    ).rejects.toThrow("Služba ICO Atlas nie je dostupná");

    // Databáza ostáva čistá, žiadne mock dáta neboli zapísané
    expect(db.snapshots.size).toBe(0);
    expect(db.entities.size).toBe(0);
  });

  it("9. Kanonická serializácia: canonicalJsonStringify generuje identický SHA-256 hash nezávisle od poradia kľúčov", () => {
    const objA = {
      ico: "31322832",
      legalName: "SLOVNAFT, a.s.",
      details: {
        registeredAddress: "Vlčie hrdlo 1",
        country: "SK",
        active: true,
      },
      tags: ["oil", "refinery"],
    };

    const objB = {
      tags: ["oil", "refinery"],
      details: {
        country: "SK",
        active: true,
        registeredAddress: "Vlčie hrdlo 1",
      },
      legalName: "SLOVNAFT, a.s.",
      ico: "31322832",
    };

    const strA = canonicalJsonStringify(objA);
    const strB = canonicalJsonStringify(objB);

    expect(strA).toBe(strB);

    const hashA = crypto.createHash("sha256").update(strA).digest("hex");
    const hashB = crypto.createHash("sha256").update(strB).digest("hex");
    expect(hashA).toBe(hashB);
  });

  it("10. Zosúladenie kontraktu: Zod parser znesie null v nepovinných poliach z Laravel backendu", () => {
    const rawLaravelPayload = {
      ico: "31322832",
      legalName: "SLOVNAFT, a.s.",
      legalForm: null,
      registeredAddress: null,
      country: "SK",
      status: null,
      incorporatedAt: null,
      dissolvedAt: null,
      statutoryPersons: [
        {
          name: "Ing. Marek Senkovič",
          role: null,
          validFrom: null,
          validTo: null,
          sourcePersonId: null,
        },
      ],
      businessActivities: [],
      addressHistory: null,
      source: {
        id: "src-test",
        source: "orsr",
        capturedAt: "2026-09-14T10:00:00Z",
        sourceVersion: null,
        sourceUrl: null,
        sourceHash: null,
        confidence: null,
        rawReference: null,
      },
    };

    const parsed = parseCompanyRegistryProfile(rawLaravelPayload);
    expect(parsed.ico).toBe("31322832");
    expect(parsed.legalName).toBe("SLOVNAFT, a.s.");
    expect(parsed.legalForm).toBeUndefined();
    expect(parsed.registeredAddress).toBeUndefined();
    expect(parsed.statutoryPersons[0]?.role).toBeUndefined();
    expect(parsed.statutoryPersons[0]?.validFrom).toBeUndefined();
    expect(parsed.source.capturedAt).toBe("2026-09-14T10:00:00Z");
    expect(parsed.source.confidence).toBeUndefined();
  });

  it("11. Odstránenie fallbacku: handleConfirmCompanyRegistryImport zlyhá bez zápisu dát pri neprítomnosti alebo chybe RPC", async () => {
    const caseId = "case-strict-rpc";
    const snapId = "snap-strict-rpc";
    db.cases.set(caseId, {
      id: caseId,
      user_id: userId,
      name: "Prípad bez RPC",
    });
    db.snapshots.set(snapId, {
      id: snapId,
      case_id: caseId,
      user_id: userId,
      ico: "31322832",
      legal_name: "SLOVNAFT, a.s.",
      legal_form: "a.s.",
      registered_address: "Bratislava",
      country: "SK",
      status: "active",
      incorporated_at: null,
      dissolved_at: null,
      statutory_persons: [],
      business_activities: [],
      address_history: [],
      source: "orsr",
      source_url: null,
      source_hash: "sha256:abc1234567890123456",
      captured_at: "2026-09-14T10:00:00Z",
      raw_payload: {},
    });

    // Simulácia klienta, kde RPC funkcia neexistuje v databáze
    const mockQueryBuilder = (dataResult: any) => {
      const b: any = {
        select: () => b,
        eq: () => b,
        maybeSingle: async () => ({ data: dataResult, error: null }),
        insert: () => {
          throw new Error(
            "Kritická chyba: nesmie sa vykonať žiadny priamy zápis!",
          );
        },
      };
      return b;
    };

    const mockSupabaseMissingRpc = {
      from: (table: string) => {
        if (table === "cases") {
          return mockQueryBuilder({ id: caseId });
        }
        if (table === "company_registry_profiles") {
          return mockQueryBuilder(db.snapshots.get(snapId));
        }
        return mockQueryBuilder(null);
      },
      rpc: async () => {
        return {
          data: null,
          error: {
            code: "42883",
            message: "function commit_company_registry_import does not exist",
          },
        };
      },
    };

    await expect(
      handleConfirmCompanyRegistryImport(
        { caseId, snapshotId: snapId },
        { supabase: mockSupabaseMissingRpc as any, userId },
      ),
    ).rejects.toThrow(
      "Transakčný import zlyhal: function commit_company_registry_import does not exist",
    );

    // Overenie: V databáze nevznikli žiadne entity
    expect(db.entities.size).toBe(0);
    expect(db.relations.size).toBe(0);
  });
});
