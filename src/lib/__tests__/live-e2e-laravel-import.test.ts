import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { assertStrictLocalDatabaseUrl } from "./test-db-safety";
import {
  handleLookupCompanyRegistryByIco,
  handleConfirmCompanyRegistryImport,
} from "../registry.functions";

const TEST_DB_URL = assertStrictLocalDatabaseUrl(
  process.env["TEST_DATABASE_URL"] ||
    "postgres://postgres:postgres@localhost:54322/forendetect_test",
);

import fs from "node:fs";
import path from "node:path";

if (typeof process.loadEnvFile === "function" && fs.existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Ignore
  }
}

const LARAVEL_API_URL =
  process.env["ICO_ATLAS_API_URL"] || "http://127.0.0.1:8000";
const LARAVEL_API_KEY =
  process.env["ICO_ATLAS_API_KEY"] ||
  "1369aa7e230ea5d26360f661b5898d3f702f0369bec01cdbd1dc5f71224743fa";
describe("Live E2E: Forendo <-> Laravel ICO Atlas <-> ORSR Register", () => {
  let adminDbClient: Client;
  let userDbClient: Client;

  const testUserId = "a0000000-0000-4000-a000-000000000099";
  const testCaseId = "c0000000-0000-4000-a000-000000000099";

  beforeAll(async () => {
    process.env["ICO_ATLAS_API_URL"] = LARAVEL_API_URL;
    process.env["ICO_ATLAS_API_KEY"] = LARAVEL_API_KEY;
    process.env["SUPABASE_SERVICE_ROLE_KEY"] =
      "test-service-role-key-for-local-tests";

    // 1. Overenie dostupnosti lokálneho Laravel backendu
    try {
      const pingRes = await fetch(
        `${LARAVEL_API_URL}/api/v1/companies/SK/31322832`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${LARAVEL_API_KEY}`,
          },
        },
      );
      if (!pingRes.ok) {
        throw new Error(`Laravel ping zlyhal so stavom ${pingRes.status}`);
      }
    } catch (err: any) {
      throw new Error(
        `Lokálny Laravel ICO Atlas na ${LARAVEL_API_URL} nie je dostupný (${err.message}). Uistite sa, že beží 'php artisan serve'.`,
      );
    }

    // 2. Pripojenie k izolovanému lokálnemu PostgreSQL
    adminDbClient = new Client({ connectionString: TEST_DB_URL });
    await adminDbClient.connect();

    userDbClient = new Client({ connectionString: TEST_DB_URL });
    await userDbClient.connect();

    // Zabezpečenie schémy a migrácií
    const tableCheck = await adminDbClient.query(`
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_registry_profiles';
    `);
    if (tableCheck.rowCount === 0) {
      const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      for (const file of migrationFiles) {
        try {
          const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
          await adminDbClient.query(sql);
        } catch {
          // Ignore already created types/tables
        }
      }
    }

    // Vloženie testovacieho používateľa a prípadu
    await adminDbClient.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, 'e2e-user@forendetect.internal', '{}'::jsonb) ON CONFLICT (id) DO NOTHING;`,
      [testUserId],
    );

    await adminDbClient.query(
      `INSERT INTO public.cases (id, user_id, name) VALUES ($1, $2, 'Živý E2E Test Prípad')
       ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, name = EXCLUDED.name;`,
      [testCaseId, testUserId],
    );
  });

  afterAll(async () => {
    if (adminDbClient) {
      await adminDbClient.query(`DELETE FROM public.cases WHERE id = $1;`, [
        testCaseId,
      ]);
      await adminDbClient.query(`DELETE FROM auth.users WHERE id = $1;`, [
        testUserId,
      ]);
      await adminDbClient.end();
    }
    if (userDbClient) {
      await userDbClient.end();
    }
  });

  // Vytvorenie reťaziteľného mocku pre Supabase PostgREST dotazy
  function createChainableQuery(table: string, client: Client) {
    const filters: { col: string; val: any }[] = [];
    let selectCols = "*";

    const queryObj: any = {
      select: (cols: string) => {
        selectCols = cols;
        return queryObj;
      },
      eq: (col: string, val: any) => {
        filters.push({ col, val });
        return queryObj;
      },
      maybeSingle: async () => {
        const whereClauses = filters
          .map((f, i) => `${f.col} = $${i + 1}`)
          .join(" AND ");
        const vals = filters.map((f) => f.val);
        const sql = `SELECT ${selectCols} FROM public.${table}${whereClauses ? ` WHERE ${whereClauses}` : ""} LIMIT 1;`;
        const res = await client.query(sql, vals);
        return { data: res.rows[0] || null, error: null };
      },
      insert: (row: Record<string, any>) => ({
        select: (selectCol: string) => ({
          single: async () => {
            const keys = Object.keys(row);
            const vals = Object.values(row).map((v) =>
              typeof v === "object" && v !== null ? JSON.stringify(v) : v,
            );
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
            const res = await client.query(
              `INSERT INTO public.${table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING ${selectCol};`,
              vals,
            );
            return { data: res.rows[0], error: null };
          },
        }),
      }),
    };

    return queryObj;
  }

  // Vytvorenie testovacieho Supabase kontextu s emulovaným Supabase clientom nad Postgresom
  function createTestContext(userId: string, caseId: string) {
    const userClient = {
      from: (table: string) => createChainableQuery(table, adminDbClient),
      rpc: async (fnName: string, params: Record<string, any>) => {
        await userDbClient.query("BEGIN;");
        try {
          await userDbClient.query(
            `SET LOCAL request.jwt.claim.sub = '${userId}';`,
          );
          const caseIdParam = params["_case_id"] || params["p_case_id"];
          const snapIdParam = params["_snapshot_id"] || params["p_snapshot_id"];
          const modeParam = params["_mode"] || params["p_mode"] || "auto";
          const existingIdParam =
            params["_existing_entity_id"] ||
            params["p_existing_entity_id"] ||
            null;

          const res = await userDbClient.query(
            `SELECT public.${fnName}($1, $2, $3, $4) as result;`,
            [caseIdParam, snapIdParam, modeParam, existingIdParam],
          );
          await userDbClient.query("COMMIT;");
          return { data: res.rows[0].result, error: null };
        } catch (err: any) {
          await userDbClient.query("ROLLBACK;");
          return { data: null, error: err };
        }
      },
    };

    const adminClient = {
      from: (table: string) => createChainableQuery(table, adminDbClient),
    };

    return {
      supabase: userClient as any,
      adminClient: adminClient as any,
      userId,
    };
  }

  it("1. Živé načítanie SLOVNAFT, a.s. (IČO 31322832) cez Laravel a transakčný import do prípadu", async () => {
    const context = createTestContext(testUserId, testCaseId);

    // 1a. Vyhľadanie v registri cez skutočný Laravel a ORSR
    const lookupStartTime = Date.now();
    const lookupResult = await handleLookupCompanyRegistryByIco(
      { caseId: testCaseId, ico: "31322832", country: "SK" },
      context,
    );
    const lookupDurationMs = Date.now() - lookupStartTime;

    expect(lookupResult).toBeDefined();
    expect(lookupResult.profile).toBeDefined();
    expect(lookupResult.snapshotId).toBeDefined();

    const profile = lookupResult.profile;
    expect(profile.ico).toBe("31322832");
    expect(profile.legalName).toBe("SLOVNAFT, a.s.");
    expect(profile.country).toBe("SK");
    expect(profile.status).toBe("Aktívna");
    expect(profile.legalForm).toBe("Akciová spoločnosť");
    expect(profile.registeredAddress).toContain("Vlčie hrdlo");
    expect(profile.source.source).toBe("orsr");
    expect(profile.source.sourceVersion).toBe("orsr-v4.1");
    expect(profile.source.sourceHash).toMatch(/^sha256:[a-f0-9]{64}$/);

    // Overenie prítomnosti štatutárnych orgánov z reálneho registra
    expect(profile.statutoryPersons.length).toBeGreaterThanOrEqual(5);
    const predseda = profile.statutoryPersons.find((p) =>
      p.role?.toLowerCase().includes("predseda"),
    );
    expect(predseda).toBeDefined();
    expect(predseda?.name).toBeTruthy();

    console.log(
      `[SMOKE TEST 1 SUCCESS] SLOVNAFT načítaný za ${lookupDurationMs}ms, štatutárov: ${profile.statutoryPersons.length}`,
    );

    // 1b. Overenie uloženia snapshotu v PostgreSQL
    const snapRow = await adminDbClient.query(
      `SELECT * FROM public.company_registry_profiles WHERE id = $1;`,
      [lookupResult.snapshotId],
    );
    expect(snapRow.rows).toHaveLength(1);
    expect(snapRow.rows[0].ico).toBe("31322832");
    expect(snapRow.rows[0].legal_name).toBe("SLOVNAFT, a.s.");
    expect(snapRow.rows[0].source_hash).toBe(profile.source.sourceHash);

    // 1c. Transakčné potvrdenie importu cez RPC commit_company_registry_import
    const confirmResult = await handleConfirmCompanyRegistryImport(
      {
        caseId: testCaseId,
        snapshotId: lookupResult.snapshotId,
        mode: "auto",
      },
      context,
    );

    expect(confirmResult.ok).toBe(true);
    expect(confirmResult.companyEntityId).toBeDefined();

    // 1d. Overenie vytvorených entít a relácií v PostgreSQL
    const companyEntity = await adminDbClient.query(
      `SELECT * FROM public.case_entities WHERE id = $1;`,
      [confirmResult.companyEntityId],
    );
    expect(companyEntity.rows).toHaveLength(1);
    expect(companyEntity.rows[0].kind).toBe("company");
    expect(companyEntity.rows[0].ico).toBe("31322832");
    expect(companyEntity.rows[0].source_provider).toBe("orsr");

    const relations = await adminDbClient.query(
      `SELECT * FROM public.case_relations WHERE to_id = $1;`,
      [confirmResult.companyEntityId],
    );
    expect(relations.rows).toHaveLength(profile.statutoryPersons.length);

    // 1e. Overenie idempotencie: opakované potvrdenie rovnakého snapshotu nevytvorí duplicity
    const repeatResult = await handleConfirmCompanyRegistryImport(
      {
        caseId: testCaseId,
        snapshotId: lookupResult.snapshotId,
        mode: "auto",
      },
      context,
    );
    expect(repeatResult.ok).toBe(true);
    expect(repeatResult.idempotent).toBe(true);
    expect(repeatResult.companyEntityId).toBe(confirmResult.companyEntityId);

    const companyEntitiesCount = await adminDbClient.query(
      `SELECT COUNT(*) FROM public.case_entities WHERE case_id = $1 AND ico = '31322832';`,
      [testCaseId],
    );
    expect(parseInt(companyEntitiesCount.rows[0].count, 10)).toBe(1);
  }, 15000);

  it("2. Živé načítanie ESET, spol. s r.o. (IČO 31333532) s overením konateľov a importu", async () => {
    const context = createTestContext(testUserId, testCaseId);

    const lookupResult = await handleLookupCompanyRegistryByIco(
      { caseId: testCaseId, ico: "31333532", country: "SK" },
      context,
    );

    expect(lookupResult.profile.ico).toBe("31333532");
    expect(lookupResult.profile.legalName).toContain("ESET");
    expect(lookupResult.profile.country).toBe("SK");
    expect(lookupResult.profile.status).toBe("Aktívna");
    expect(lookupResult.profile.statutoryPersons.length).toBeGreaterThanOrEqual(
      3,
    );

    console.log(
      `[SMOKE TEST 2 SUCCESS] ESET načítaný, štatutárov: ${lookupResult.profile.statutoryPersons.length}`,
    );

    const confirmResult = await handleConfirmCompanyRegistryImport(
      {
        caseId: testCaseId,
        snapshotId: lookupResult.snapshotId,
        mode: "auto",
      },
      context,
    );
    expect(confirmResult.ok).toBe(true);
    expect(confirmResult.companyEntityId).toBeDefined();
  }, 15000);

  it("3. Správne spracovanie nenájdeného IČO (404) z registra", async () => {
    const context = createTestContext(testUserId, testCaseId);

    await expect(
      handleLookupCompanyRegistryByIco(
        { caseId: testCaseId, ico: "00000000", country: "SK" },
        context,
      ),
    ).rejects.toThrow(/Subjekt s IČO 00000000 sa v registri SK nenašiel/);
  }, 15000);

  it("4. Odmietnutie neplatného formátu IČO (422 / validation)", async () => {
    const context = createTestContext(testUserId, testCaseId);

    await expect(
      handleLookupCompanyRegistryByIco(
        { caseId: testCaseId, ico: "neplatne-ico", country: "SK" },
        context,
      ),
    ).rejects.toThrow(/neplatný formát/i);
  });

  it("5. Autentifikácia servisného kľúča: Laravel odmietne neautorizovanú požiadavku (401)", async () => {
    const res = await fetch(`${LARAVEL_API_URL}/api/v1/companies/SK/31322832`, {
      headers: {
        Accept: "application/json",
        Authorization: "Bearer invalid-token-12345",
      },
    });

    expect(res.status).toBe(401);
  });
});
