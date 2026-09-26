import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { assertStrictLocalDatabaseUrl } from "./test-db-safety";

const TEST_DB_URL = assertStrictLocalDatabaseUrl(
  process.env["TEST_DATABASE_URL"] ||
    "postgres://postgres:postgres@localhost:54322/forendetect_test",
);

describe("ICO Atlas - Reálny PostgreSQL a Supabase transakčný import", () => {
  let adminClient: Client;
  let clientA: Client;
  let clientB: Client;

  const testUserId = "a0000000-0000-4000-a000-000000000001";
  const otherUserId = "b0000000-0000-4000-a000-000000000002";
  const testCaseId = "c0000000-0000-4000-a000-000000000001";
  const otherCaseId = "c0000000-0000-4000-a000-000000000002";

  beforeAll(async () => {
    adminClient = new Client({ connectionString: TEST_DB_URL });
    await adminClient.connect();

    // 1. Inicializácia základných rozšírení a autentifikačnej infraštruktúry Supabase
    await adminClient.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role, public;

      CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
      CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255)
      );

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
        SELECT coalesce(current_setting('request.jwt.claim.role', true), 'anon');
      $$;
      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
        SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
      $$;

      CREATE SCHEMA IF NOT EXISTS storage;
      CREATE TABLE IF NOT EXISTS storage.objects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id TEXT,
        name TEXT,
        owner UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, postgres;
      GRANT SELECT ON auth.users TO anon, authenticated, service_role, postgres;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role, postgres;

      GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role, postgres;
      GRANT ALL ON storage.objects TO anon, authenticated, service_role, postgres;
    `);

    // 2. Aplikácia skutočného projektového migračného reťazca v poradí
    const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await adminClient.query(sql);
    }

    // 3. Inicializácia dvoch nezávislých spojení pre concurrency a transakčné testy
    clientA = new Client({ connectionString: TEST_DB_URL });
    clientB = new Client({ connectionString: TEST_DB_URL });
    await clientA.connect();
    await clientB.connect();
  });

  afterAll(async () => {
    if (clientA) await clientA.end();
    if (clientB) await clientB.end();
    if (adminClient) await adminClient.end();
  });

  beforeEach(async () => {
    // Čistenie dát pred každým testom
    await adminClient.query(`DELETE FROM public.case_relations;`);
    await adminClient.query(`DELETE FROM public.case_entities;`);
    await adminClient.query(`DELETE FROM public.company_registry_profiles;`);
    await adminClient.query(`DELETE FROM public.cases;`);

    // Vloženie základných prípadov
    await adminClient.query(
      `INSERT INTO public.cases (id, user_id, name) VALUES ($1, $2, $3), ($4, $5, $6);`,
      [
        testCaseId,
        testUserId,
        "Hlavný vyšetrovací prípad",
        otherCaseId,
        otherUserId,
        "Cudzí prípad",
      ],
    );
  });

  // Pomocná funkcia na simuláciu volania RPC ako authenticated používateľ
  async function callRpc(
    client: Client,
    userId: string | null,
    caseId: string,
    snapshotId: string,
    mode = "auto",
    existingEntityId: string | null = null,
  ) {
    await client.query("BEGIN;");
    try {
      if (userId) {
        await client.query(`SET LOCAL request.jwt.claim.sub = '${userId}';`);
      } else {
        await client.query(`SET LOCAL request.jwt.claim.sub = '';`);
      }

      const res = await client.query(
        `SELECT public.commit_company_registry_import($1, $2, $3, $4) as result;`,
        [caseId, snapshotId, mode, existingEntityId],
      );
      await client.query("COMMIT;");
      return res.rows[0].result;
    } catch (err) {
      await client.query("ROLLBACK;");
      throw err;
    }
  }

  interface SnapshotCustom {
    id?: string;
    ico?: string;
    legal_name?: string;
    legal_form?: string;
    registered_address?: string;
    country?: string;
    status?: string;
    source?: string;
    source_hash?: string;
    case_id?: string;
    user_id?: string;
    statutory_persons?: any[];
  }

  // Pomocná funkcia na vloženie snapshotu cez admin (service_role)
  async function insertSnapshot(custom: SnapshotCustom = {}) {
    const snapId =
      custom.id ||
      "d0000000-0000-4000-a000-" +
        Math.random().toString(16).slice(2, 14).padEnd(12, "0");
    const ico = custom.ico || "31322832";
    const legalName = custom.legal_name || "SLOVNAFT, a.s.";
    const hash = custom.source_hash || "sha256:abcd1234ef5678901234567890";
    const caseId = custom.case_id || testCaseId;
    const userId = custom.user_id || testUserId;
    const persons = custom.statutory_persons || [
      {
        name: "Ing. Marek Senkovič",
        role: "predseda predstavenstva",
        validFrom: "2020-07-01",
        sourcePersonId: "orsr:101",
      },
      {
        name: "Dr. Oszkár Világi",
        role: "člen predstavenstva",
        validFrom: "2010-04-15",
        sourcePersonId: "orsr:102",
      },
    ];

    await adminClient.query(
      `INSERT INTO public.company_registry_profiles (
        id, case_id, user_id, ico, legal_name, legal_form, registered_address,
        country, status, source, source_hash, statutory_persons
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
      [
        snapId,
        caseId,
        userId,
        ico,
        legalName,
        custom.legal_form || "a.s.",
        custom.registered_address || "Vlčie hrdlo 1, Bratislava",
        custom.country || "SK",
        custom.status || "active",
        custom.source || "orsr",
        hash,
        JSON.stringify(persons),
      ],
    );

    return snapId;
  }

  it("1. Reálny súbeh: Dve nezávislé databázové spojenia commitujúce ten istý snapshot nevytvoria duplicity (Advisory Lock)", async () => {
    const snapId = await insertSnapshot();

    // Spustíme paralelne commit cez dve úplne nezávislé PostgreSQL TCP spojenia
    const [resA, resB] = await Promise.all([
      callRpc(clientA, testUserId, testCaseId, snapId, "auto"),
      callRpc(clientB, testUserId, testCaseId, snapId, "auto"),
    ]);

    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);
    expect(resA.company_id).toBe(resB.company_id);

    // Práve jedno volanie commitlo firmu a druhé bolo idempotentné (alebo obe v bezpečí vrátili rovnakú entitu)
    expect(resA.idempotent || resB.idempotent).toBe(true);

    // V databáze existuje presne 1 firma
    const companies = await adminClient.query(
      `SELECT * FROM public.case_entities WHERE kind = 'company';`,
    );
    expect(companies.rowCount).toBe(1);
    expect(companies.rows[0].ico).toBe("31322832");

    // Štatutári nie sú zdvojení
    const persons = await adminClient.query(
      `SELECT * FROM public.case_entities WHERE kind = 'person';`,
    );
    expect(persons.rowCount).toBe(2);

    // Relácie nie sú zdvojené
    const rels = await adminClient.query(
      `SELECT * FROM public.case_relations;`,
    );
    expect(rels.rowCount).toBe(2);
  });

  it("2. Súbeh dvoch RÔZNYCH snapshotov rovnakej firmy v rovnakom prípade nezlyhá ani nevytvorí duplicitnú firmu", async () => {
    // Prvý snapshot (staršia verzia)
    const snap1 = await insertSnapshot({
      source_hash: "sha256:1111111111111111111111",
      registered_address: "Stará adresa 10, Bratislava",
    });

    // Druhý snapshot (novšia verzia tej istej firmy)
    const snap2 = await insertSnapshot({
      source_hash: "sha256:2222222222222222222222",
      registered_address: "Nová adresa 20, Bratislava",
    });

    // Spustíme paralelne commit oboch snapshotov cez nezávislé spojenia
    const [res1, res2] = await Promise.all([
      callRpc(clientA, testUserId, testCaseId, snap1, "auto"),
      callRpc(clientB, testUserId, testCaseId, snap2, "auto"),
    ]);

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    expect(res1.company_id).toBe(res2.company_id);

    // V databáze existuje stále výhradne JEDNA entita firmy s týmto IČO v danom prípade
    const companies = await adminClient.query(
      `SELECT * FROM public.case_entities WHERE kind = 'company' AND case_id = $1;`,
      [testCaseId],
    );
    expect(companies.rowCount).toBe(1);

    // Obe snapshoty sú správne prepojené na túto entitu
    const snaps = await adminClient.query(
      `SELECT id, entity_id FROM public.company_registry_profiles WHERE case_id = $1;`,
      [testCaseId],
    );
    expect(snaps.rows[0].entity_id).toBe(res1.company_id);
    expect(snaps.rows[1].entity_id).toBe(res1.company_id);
  });

  it("3. Skutočný Rollback v PostgreSQL: Chyba pri vkladaní relácie vráti celú transakciu do pôvodného stavu", async () => {
    const snapId = await insertSnapshot();

    // Dočasne vytvoríme trigger, ktorý simuluje zlyhanie databázy pri zápise relácie
    await adminClient.query(`
      CREATE OR REPLACE FUNCTION test_fail_trigger() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Simulovaná chyba databázy pri zápise relácie.' USING errcode = 'P0001';
      END;
      $$;

      CREATE TRIGGER trg_test_fail_rel
      BEFORE INSERT ON public.case_relations
      FOR EACH ROW EXECUTE FUNCTION test_fail_trigger();
    `);

    try {
      await expect(
        callRpc(clientA, testUserId, testCaseId, snapId, "auto"),
      ).rejects.toThrow("Simulovaná chyba databázy pri zápise relácie.");

      // Overenie ROLLBACKU: V databáze NESMIE ostať žiadna firma ani žiadna osoba
      const companies = await adminClient.query(
        `SELECT * FROM public.case_entities WHERE kind = 'company';`,
      );
      expect(companies.rowCount).toBe(0);

      const persons = await adminClient.query(
        `SELECT * FROM public.case_entities WHERE kind = 'person';`,
      );
      expect(persons.rowCount).toBe(0);

      // Snapshot nesmie byť označený ako importovaný (entity_id je stále NULL)
      const snap = await adminClient.query(
        `SELECT entity_id FROM public.company_registry_profiles WHERE id = $1;`,
        [snapId],
      );
      expect(snap.rows[0].entity_id).toBeNull();
    } finally {
      await adminClient.query(
        `DROP TRIGGER IF EXISTS trg_test_fail_rel ON public.case_relations;`,
      );
      await adminClient.query(`DROP FUNCTION IF EXISTS test_fail_trigger();`);
    }
  });

  it("4. Režimy importu: auto (vytvorenie/update), new (odmietnutie duplicity) a update (vyžaduje existenciu)", async () => {
    const snap1 = await insertSnapshot({
      ico: "44556677",
      source_hash: "sha256:hash_mode_test_12345678",
      legal_name: "ALFA, s.r.o.",
    });

    // 4a. Režim 'update' na neexistujúcej firme musí zlyhať s kódom P0002
    await expect(
      callRpc(clientA, testUserId, testCaseId, snap1, "update"),
    ).rejects.toThrow("Cieľová firma pre aktualizáciu sa v prípade nenašla");

    // 4b. Režim 'new' na neexistujúcej firme úspešne vytvorí firmu
    const resNew = await callRpc(clientA, testUserId, testCaseId, snap1, "new");
    expect(resNew.ok).toBe(true);
    const compId = resNew.company_id;

    // 4c. Režim 'new' na už existujúcej firme musí vyvolať konflikt s kódom 23505
    const snap2 = await insertSnapshot({
      ico: "44556677",
      source_hash: "sha256:hash_mode_test_87654321",
      legal_name: "ALFA, s.r.o. - Nová revízia",
    });

    await expect(
      callRpc(clientA, testUserId, testCaseId, snap2, "new"),
    ).rejects.toThrow("režim new zakazuje duplicitu");

    // 4d. Režim 'update' na existujúcej firme úspešne zaktualizuje názov
    const resUpdate = await callRpc(
      clientA,
      testUserId,
      testCaseId,
      snap2,
      "update",
    );
    expect(resUpdate.ok).toBe(true);
    expect(resUpdate.company_id).toBe(compId);

    const comp = await adminClient.query(
      `SELECT name FROM public.case_entities WHERE id = $1;`,
      [compId],
    );
    expect(comp.rows[0].name).toBe("ALFA, s.r.o. - Nová revízia");
  });

  it("5. Validácia existingEntityId: Odmietne entitu osoby, inú firmu, cudzí prípad alebo neexistujúce ID", async () => {
    const snapId = await insertSnapshot({
      ico: "11223344",
      source_hash: "sha256:validation_target_hash123",
    });

    // Vytvoríme entitu osoby (kind = 'person')
    const personEnt = await adminClient.query(
      `INSERT INTO public.case_entities (case_id, user_id, name, kind) VALUES ($1, $2, 'Jozef Tester', 'person') RETURNING id;`,
      [testCaseId, testUserId],
    );
    const personId = personEnt.rows[0].id;

    // Vytvoríme firmu s iným IČO
    const otherComp = await adminClient.query(
      `INSERT INTO public.case_entities (case_id, user_id, name, kind, ico) VALUES ($1, $2, 'Iná Firma s.r.o.', 'company', '99999999') RETURNING id;`,
      [testCaseId, testUserId],
    );
    const otherCompId = otherComp.rows[0].id;

    // 5a. Neexistujúce ID -> P0002
    await expect(
      callRpc(
        clientA,
        testUserId,
        testCaseId,
        snapId,
        "auto",
        "e0000000-0000-4000-a000-000000000999",
      ),
    ).rejects.toThrow("Určená cieľová firma sa nenašla");

    // 5b. Cieľová entita je osoba, nie firma -> 22000
    await expect(
      callRpc(clientA, testUserId, testCaseId, snapId, "auto", personId),
    ).rejects.toThrow("Cieľová entita nie je firma");

    // 5c. Cieľová entita má iné IČO -> 22000
    await expect(
      callRpc(clientA, testUserId, testCaseId, snapId, "auto", otherCompId),
    ).rejects.toThrow(
      "IČO cieľovej firmy (99999999) sa nezhoduje s profilom registra (11223344)",
    );

    // 5d. Cieľová entita patrí cudziemu prípadu -> 42501
    const foreignComp = await adminClient.query(
      `INSERT INTO public.case_entities (case_id, user_id, name, kind, ico) VALUES ($1, $2, 'Cudzia Firma', 'company', '11223344') RETURNING id;`,
      [otherCaseId, otherUserId],
    );
    await expect(
      callRpc(
        clientA,
        testUserId,
        testCaseId,
        snapId,
        "auto",
        foreignComp.rows[0].id,
      ),
    ).rejects.toThrow("Nemáte oprávnenie na určenú cieľovú entitu");
  });

  it("6. Menovci a sourcePersonId: Rovnaké meno nesmie zlúčiť rôznych ľudí v rámci firmy", async () => {
    // Dve osoby s rovnakým menom, ale rôznym sourcePersonId (napr. otec a syn)
    const snapId = await insertSnapshot({
      ico: "55667788",
      source_hash: "sha256:namesakes_hash_1234567890",
      statutory_persons: [
        {
          name: "Peter Kováč",
          role: "konateľ",
          validFrom: "2015-01-01",
          sourcePersonId: "orsr:p-senior-1",
        },
        {
          name: "Peter Kováč",
          role: "konateľ",
          validFrom: "2022-01-01",
          sourcePersonId: "orsr:p-junior-2",
        },
      ],
    });

    const res = await callRpc(clientA, testUserId, testCaseId, snapId, "auto");
    expect(res.ok).toBe(true);

    // Musia vzniknúť DVE samostatné person entity
    const persons = await adminClient.query(
      `SELECT id, name, note, source_provider, source_person_id FROM public.case_entities WHERE kind = 'person' AND case_id = $1;`,
      [testCaseId],
    );
    expect(persons.rowCount).toBe(2);
    expect(persons.rows[0].name).toBe("Peter Kováč");
    expect(persons.rows[1].name).toBe("Peter Kováč");
    expect(persons.rows[0].id).not.toBe(persons.rows[1].id);

    // Obe entity majú presnú štruktúrovanú väzbu v stĺpcoch source_provider a source_person_id
    expect(
      persons.rows.some(
        (p: any) =>
          p.source_provider === "orsr" &&
          p.source_person_id === "orsr:p-senior-1",
      ),
    ).toBe(true);
    expect(
      persons.rows.some(
        (p: any) =>
          p.source_provider === "orsr" &&
          p.source_person_id === "orsr:p-junior-2",
      ),
    ).toBe(true);

    // Poznámka je čistá a neobsahuje hack [source_person_id: ...]
    expect(persons.rows[0].note).not.toContain("[source_person_id:");
    expect(persons.rows[1].note).not.toContain("[source_person_id:");
  });

  it("7. Viacnásobné a historické roly: Ukladá validFrom aj validTo a zachováva viacnásobné roly", async () => {
    const snapId = await insertSnapshot({
      ico: "66778899",
      source_hash: "sha256:roles_history_hash_123456",
      statutory_persons: [
        {
          name: "Ján Novák",
          role: "konateľ",
          validFrom: "2018-01-01",
          validTo: "2021-12-31",
          sourcePersonId: "orsr:novak-1",
        },
        {
          name: "Ján Novák",
          role: "spoločník",
          validFrom: "2022-01-01",
          sourcePersonId: "orsr:novak-1",
        },
      ],
    });

    const res = await callRpc(clientA, testUserId, testCaseId, snapId, "auto");
    expect(res.ok).toBe(true);

    // Osoba bola vytvorená práve raz (pretože štruktúrovaný source_person_id je rovnaký)
    const persons = await adminClient.query(
      `SELECT id, source_provider, source_person_id FROM public.case_entities WHERE kind = 'person' AND case_id = $1;`,
      [testCaseId],
    );
    expect(persons.rowCount).toBe(1);
    expect(persons.rows[0].source_provider).toBe("orsr");
    expect(persons.rows[0].source_person_id).toBe("orsr:novak-1");

    // Boli vytvorené DVE relácie s presnými obdobiami platnosti
    const rels = await adminClient.query(
      `SELECT label FROM public.case_relations WHERE case_id = $1 ORDER BY label;`,
      [testCaseId],
    );
    expect(rels.rowCount).toBe(2);
    expect(rels.rows[0].label).toBe("konateľ (od 2018-01-01 do 2021-12-31)");
    expect(rels.rows[1].label).toBe("spoločník (od 2022-01-01)");
  });

  it("8. Bezpečnosť a autorizácia: RPC odmietne chýbajúce auth.uid(), cudzí prípad aj cudzí snapshot", async () => {
    const snapId = await insertSnapshot();

    // 8a. Chýbajúci auth.uid() (neautentifikovaný)
    await expect(
      callRpc(clientA, null, testCaseId, snapId, "auto"),
    ).rejects.toThrow("Autentifikácia je povinná.");

    // 8b. Cudzí používateľ volajúci snapshot iného používateľa
    await expect(
      callRpc(clientA, otherUserId, testCaseId, snapId, "auto"),
    ).rejects.toThrow("Prípad sa nenašiel alebo naň nemáte oprávnenie.");

    // 8c. Snapshot patriaci inému používateľovi v inom prípade
    const foreignSnapId = await insertSnapshot({
      case_id: otherCaseId,
      user_id: otherUserId,
      source_hash: "sha256:foreign_snap_hash_12345678",
    });

    await expect(
      callRpc(clientA, testUserId, testCaseId, foreignSnapId, "auto"),
    ).rejects.toThrow("Nemáte oprávnenie na tento snapshot.");
  });

  it("9. Ochrana RLS a GRANT: authenticated používateľ NESMIE priamo vytvárať ani upravovať snapshoty v databáze", async () => {
    // Prepnutie na rolu authenticated
    await clientA.query("BEGIN;");
    await clientA.query("SET ROLE authenticated;");
    await clientA.query(`SET LOCAL request.jwt.claim.sub = '${testUserId}';`);

    // 9a. Priamy pokus o INSERT do company_registry_profiles ako authenticated klient -> Odmietnutý
    await expect(
      clientA.query(
        `INSERT INTO public.company_registry_profiles (case_id, user_id, ico, legal_name, source_hash)
         VALUES ($1, $2, '99887766', 'Falošná firma', 'sha256:fakehash1234567890');`,
        [testCaseId, testUserId],
      ),
    ).rejects.toThrow(/permission denied for table company_registry_profiles/i);

    await clientA.query("ROLLBACK;");

    // 9b. Priamy pokus o UPDATE entity_id na existujúcom snapshote ako authenticated klient -> Odmietnutý
    const snapId = await insertSnapshot();

    await clientA.query("BEGIN;");
    await clientA.query("SET ROLE authenticated;");
    await clientA.query(`SET LOCAL request.jwt.claim.sub = '${testUserId}';`);

    await expect(
      clientA.query(
        `UPDATE public.company_registry_profiles SET entity_id = 'e0000000-0000-4000-a000-000000000001' WHERE id = $1;`,
        [snapId],
      ),
    ).rejects.toThrow(/permission denied for table company_registry_profiles/i);

    await clientA.query("ROLLBACK;");
    await clientA.query("RESET ROLE;");
  });

  it("10. Diagnostika: Chýbajúca RPC funkcia alebo neexistujúca procedúra nezapíše čiastočné dáta", async () => {
    // Volanie neexistujúcej procedúry
    await expect(
      clientA.query(`SELECT public.non_existent_import_function();`),
    ).rejects.toThrow(
      /function public\.non_existent_import_function\(\) does not exist/i,
    );

    // Overenie čistého stavu
    const entities = await adminClient.query(
      `SELECT count(*) FROM public.case_entities;`,
    );
    expect(Number(entities.rows[0].count)).toBe(0);
  });

  it("11. Bezpečnostná ochrana runnera: assertStrictLocalDatabaseUrl odmietne neurčenú aj vzdialenú databázu", () => {
    // 11a. Prázdna alebo neurčená databáza
    expect(() => assertStrictLocalDatabaseUrl(undefined)).toThrow(
      /TEST_DATABASE_URL nie je definovaná/,
    );
    expect(() => assertStrictLocalDatabaseUrl("")).toThrow(
      /TEST_DATABASE_URL nie je definovaná/,
    );

    // 11b. Vzdialená alebo produkčná databáza
    expect(() =>
      assertStrictLocalDatabaseUrl(
        "postgres://postgres:secret@db.rtkfstyndmrwuztsmppm.supabase.co:5432/postgres",
      ),
    ).toThrow(
      /BEZPEČNOSTNÝ STOP: Testovací runner odmieta vzdialenú alebo produkčnú databázu/,
    );

    expect(() =>
      assertStrictLocalDatabaseUrl(
        "postgres://admin:pass@192.168.1.50:5432/production",
      ),
    ).toThrow(/BEZPEČNOSTNÝ STOP/);

    // 11c. Lokálny PostgreSQL je akceptovaný
    expect(
      assertStrictLocalDatabaseUrl(
        "postgres://postgres:postgres@localhost:54322/forendetect_test",
      ),
    ).toBe("postgres://postgres:postgres@localhost:54322/forendetect_test");
    expect(
      assertStrictLocalDatabaseUrl(
        "postgres://postgres:postgres@127.0.0.1:54322/forendetect_test",
      ),
    ).toBe("postgres://postgres:postgres@127.0.0.1:54322/forendetect_test");
  });

  it("12. Bezpečný serverový zápis: handleLookupCompanyRegistryByIco vyhodí konfiguračnú chybu pri chýbajúcom SUPABASE_SERVICE_ROLE_KEY", async () => {
    const { handleLookupCompanyRegistryByIco } =
      await import("../registry.functions");

    const origKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const origApiUrl = process.env["ICO_ATLAS_API_URL"];
    const origApiKey = process.env["ICO_ATLAS_API_KEY"];

    delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
    process.env["ICO_ATLAS_API_URL"] = "http://127.0.0.1:8000";
    process.env["ICO_ATLAS_API_KEY"] = "test-key";

    try {
      const mockUserClient = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: testCaseId },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      const mockFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            ico: "12345678",
            legalName: "Test Firma, s.r.o.",
            country: "SK",
            source: {
              source: "orsr",
              capturedAt: new Date().toISOString(),
              sourceUrl: "https://www.orsr.sk/test",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

      await expect(
        handleLookupCompanyRegistryByIco(
          { caseId: testCaseId, ico: "12345678", country: "SK" },
          { supabase: mockUserClient as any, userId: testUserId },
          mockFetch,
        ),
      ).rejects.toThrow(
        /Konfiguračná chyba servera: Chýba SUPABASE_SERVICE_ROLE_KEY/,
      );
    } finally {
      if (origKey !== undefined) {
        process.env["SUPABASE_SERVICE_ROLE_KEY"] = origKey;
      }
      if (origApiUrl !== undefined) {
        process.env["ICO_ATLAS_API_URL"] = origApiUrl;
      } else {
        delete process.env["ICO_ATLAS_API_URL"];
      }
      if (origApiKey !== undefined) {
        process.env["ICO_ATLAS_API_KEY"] = origApiKey;
      } else {
        delete process.env["ICO_ATLAS_API_KEY"];
      }
    }
  });
});
