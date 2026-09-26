import crypto from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  canonicalJsonStringify,
  isValidIco,
  normalizeAddress,
  normalizeCompanyName,
  normalizeCountry,
  normalizeIco,
  parseCompanyRegistryProfile,
  type CompanyRegistryProfile,
  type StatutoryPerson,
} from "@/forensic";
import {
  getWhoIsWhoConfig,
  lookupCompanyWhoIsWhoProfile,
} from "./whoiswho.functions";

/* Supabase tables without generated schema types are isolated to this module. */
/* eslint-disable @typescript-eslint/no-explicit-any */

const uuid = z.string().uuid();

function fail(
  error: { message?: string; code?: string } | null,
  fallback: string,
): never {
  if (error?.code === "42501")
    throw new Error("Nemáte oprávnenie na túto operáciu.");
  throw new Error(error?.message ? `${fallback} (${error.message})` : fallback);
}

/**
 * Vyhľadá skutočný profil firmy z ICO Atlas API (Laravel backend).
 * Overí IČO a krajinu voči požiadavke, odvodí serverový hash integrity,
 * a uloží nemenný snapshot do databázy viazaný na používateľa a prípad.
 * NIKDY nevytvára falošné mock dáta pri nedostupnosti.
 */
/**
 * Načíta a zmapuje profil českej firmy z oficiálneho verejného registra ARES (Ministerstvo financií ČR).
 * Získava identitu, sídlo, DIČ a obohacuje o štatutárne orgány z verejného registra (VR).
 */
export async function lookupCompanyAresProfile(
  ico: string,
  customFetch?: typeof fetch,
  timeoutMs = 12000,
): Promise<{ profile: CompanyRegistryProfile; raw: any }> {
  const fetchFn = customFetch || fetch;
  const cleanIco = normalizeIco(ico) || ico;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(
      `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${encodeURIComponent(cleanIco)}`,
      {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      },
    );

    if (res.status === 404) {
      throw new Error(
        `Subjekt s IČO ${cleanIco} sa v českom registri ARES nenašiel.`,
      );
    }
    if (!res.ok) {
      throw new Error(
        `Český register ARES vrátil chybu ${res.status}: ${res.statusText}`,
      );
    }

    const aresData = (await res.json()) as any;

    // Voliteľne získame štatutárne orgány z verejného registra (VR)
    const statutoryPersons: StatutoryPerson[] = [];
    try {
      const vrController = new AbortController();
      const vrTimer = setTimeout(() => vrController.abort(), 6000);
      const vrRes = await fetchFn(
        `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/${encodeURIComponent(cleanIco)}`,
        {
          headers: { Accept: "application/json" },
          signal: vrController.signal,
        },
      ).finally(() => clearTimeout(vrTimer));

      if (vrRes.ok) {
        const vrData = (await vrRes.json()) as any;
        const zaznamy = vrData?.zaznamy || [vrData];
        for (const zaznam of zaznamy) {
          const organy =
            zaznam?.statutarniOrgan || zaznam?.statutarniOrgany || [];
          const organList = Array.isArray(organy) ? organy : [organy];
          for (const org of organList) {
            const clenove = org?.clenoveOrganu || org?.clenove || [];
            for (const clen of clenove) {
              const fo = clen.fyzickaOsoba;
              if (fo) {
                const nameParts = [
                  fo.titulPredJmenem,
                  fo.jmeno,
                  fo.prijmeni,
                  fo.titulZaJmenem,
                ].filter(Boolean);
                const name = nameParts.join(" ").trim();
                const role =
                  clen.funkce?.nazev ||
                  clen.nazevAngazma ||
                  org.typOrganu ||
                  "Štatutárny orgán";
                if (name) {
                  statutoryPersons.push({
                    name,
                    role,
                    validFrom:
                      clen.clenstvi?.clenstvi?.vznikClenstvi ||
                      clen.datumZapisu ||
                      undefined,
                    validTo: clen.datumVymazu || undefined,
                  });
                }
              }
            }
          }
        }
      }
    } catch {
      // VR enrich zlyhanie nezablokuje základný profil
    }

    const legalName = aresData.obchodniJmeno || `Český subjekt IČO ${cleanIco}`;
    const address =
      aresData.sidlo?.textovaAdresa ||
      [
        aresData.sidlo?.nazevUlice,
        aresData.sidlo?.cisloDomovni,
        aresData.sidlo?.nazevObce,
        aresData.sidlo?.psc,
      ]
        .filter(Boolean)
        .join(", ");
    const isActive = !aresData.datumZaniku;

    const profile: CompanyRegistryProfile = {
      ico: cleanIco,
      legalName: normalizeCompanyName(legalName),
      legalForm: aresData.pravniForma || undefined,
      registeredAddress: address ? normalizeAddress(address) : undefined,
      country: "CZ",
      status: isActive ? "Aktívna" : "Zaniknutá",
      incorporatedAt: aresData.datumVzniku || undefined,
      dissolvedAt: aresData.datumZaniku || undefined,
      statutoryPersons,
      businessActivities: aresData.czNace || [],
      source: {
        id: `ares-${cleanIco}-${Date.now()}`,
        source: "ares",
        sourceVersion: "v1",
        sourceUrl: `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${cleanIco}`,
        capturedAt: new Date().toISOString(),
        confidence: 100,
        rawReference: canonicalJsonStringify(aresData),
      },
    };

    return { profile, raw: aresData };
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(
        `Časový limit požiadavky na register ARES vypršal (${Math.round(timeoutMs / 1000)}s).`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export interface RegistryLookupContext {
  supabase: any;
  userId: string;
  adminClient?: any;
  claims?: any;
}

export async function handleLookupCompanyRegistryByIco(
  data: { caseId: string; ico: string; country?: string },
  context: RegistryLookupContext,
  customFetch?: typeof fetch,
) {
  const { supabase, userId } = context;
  const fetchFn = customFetch || fetch;

  // 1. Overenie vlastníctva prípadu
  const { data: ownedCase, error: caseErr } = await supabase
    .from("cases")
    .select("id")
    .eq("id", data.caseId)
    .eq("user_id", userId)
    .maybeSingle();

  if (caseErr) fail(caseErr, "Nepodarilo sa overiť prípad.");
  if (!ownedCase) {
    throw new Error("Prípad sa nenašiel alebo naň nemáte oprávnenie.");
  }

  // 2. Normalizácia a prísna validácia IČO a krajiny
  const cleanIco = normalizeIco(data.ico);
  const cleanCountry = normalizeCountry(data.country || "SK");

  if (!cleanIco || !isValidIco(cleanIco)) {
    throw new Error(
      "Zadané IČO má neplatný formát. IČO musí obsahovať 6 až 10 číslic.",
    );
  }

  // 3. Primárne registre pre SK a V4 (CZ)
  const whoiswho = getWhoIsWhoConfig();
  const atlasApiUrl = process.env["ICO_ATLAS_API_URL"];
  const atlasApiKey = process.env["ICO_ATLAS_API_KEY"];

  let profile: CompanyRegistryProfile | null = null;
  let rawJson: any = null;

  // A. SK subjekt: WhoIsWho SK primárny register
  if (
    cleanCountry === "SK" &&
    whoiswho.isEnabled &&
    whoiswho.apiUrl &&
    whoiswho.apiKey
  ) {
    try {
      const result = await lookupCompanyWhoIsWhoProfile(cleanIco, fetchFn);
      profile = result.profile;
      rawJson = result.raw;
    } catch (whoiswhoErr: any) {
      console.warn(
        `[WhoIsWho SK] Nedostupný (${whoiswhoErr.message || "chyba spojenia"}), aktivuje sa záložný register...`,
      );
      if (!atlasApiUrl || !atlasApiKey) {
        throw whoiswhoErr;
      }
    }
  }

  // B. CZ subjekt (V4): Český ARES REST API
  if (cleanCountry === "CZ") {
    try {
      const result = await lookupCompanyAresProfile(cleanIco, fetchFn);
      profile = result.profile;
      rawJson = result.raw;
    } catch (aresErr: any) {
      console.warn(`[ARES ČR] Chyba vyhľadania: ${aresErr.message}`);
      if (!atlasApiUrl || !atlasApiKey) {
        throw aresErr;
      }
    }
  }

  // Fallback na pôvodný ICO Atlas (napr. ORSR scraper na :8080 alebo zahraničné registre)
  if (!profile) {
    if (!atlasApiUrl || !atlasApiKey) {
      throw new Error(
        "Konfigurácia ICO Atlas (ICO_ATLAS_API_URL / ICO_ATLAS_API_KEY) chýba na serveri. Služba nie je nakonfigurovaná.",
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s limit

    const url = `${atlasApiUrl.replace(/\/+$/, "")}/api/v1/companies/${encodeURIComponent(cleanCountry)}/${encodeURIComponent(cleanIco)}`;

    let response: Response;
    try {
      response = await fetchFn(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${atlasApiKey}`,
        },
        signal: controller.signal,
      });
    } catch (netErr: any) {
      if (netErr.name === "AbortError") {
        throw new Error("Časový limit požiadavky na register vypršal (10s).");
      }
      throw new Error(
        `Služba ICO Atlas nie je dostupná na ${atlasApiUrl} (${netErr.message || "spojenie odmietnuté"}). Skontrolujte, či beží Laravel backend. Falošné dáta sa negenerujú.`,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 404) {
      throw new Error(
        `Subjekt s IČO ${cleanIco} sa v registri ${cleanCountry} nenašiel (ORSR / RÚZ).`,
      );
    }

    if (response.status === 422) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(
        (errJson as any)?.message ||
          `Neplatný formát identifikátora IČO ${cleanIco}.`,
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Chyba autentifikácie: Služba ICO Atlas odmietla prístup (401/403).",
      );
    }

    if (response.status === 429) {
      throw new Error(
        "Prekročený limit volaní registra (429 Too Many Requests). Skúste to prosím neskôr.",
      );
    }

    if (!response.ok) {
      throw new Error(
        `Služba registra vrátila chybu ${response.status}: ${response.statusText}`,
      );
    }

    rawJson = await response.json();
    profile = parseCompanyRegistryProfile(rawJson);
  }

  // 4. Bezpečnostná kontrola: overenie, že vrátené IČO a krajina zodpovedajú požiadavke
  if (
    normalizeIco(profile.ico) !== cleanIco ||
    normalizeCountry(profile.country) !== cleanCountry
  ) {
    throw new Error(
      "Bezpečnostná chyba: Vrátené IČO alebo krajina nezodpovedá zadanej požiadavke.",
    );
  }

  // 5. Serverom odvodený nemenný hash (SHA-256) pomocou kanonickej serializácie
  const canonicalPayload = canonicalJsonStringify(rawJson);
  const canonicalHash =
    "sha256:" +
    crypto.createHash("sha256").update(canonicalPayload).digest("hex");

  profile.source.sourceHash = canonicalHash;
  profile.source.source =
    rawJson?.source?.source || profile.source.source || "whoiswho";
  // Zachovávame pravdivý čas získania zo zdroja bez prepisovania aktuálnym časom importu
  if (rawJson?.source?.capturedAt) {
    profile.source.capturedAt = rawJson.source.capturedAt;
  }
  // Neodvodzujeme automatické confidence=100; zachovávame dôveryhodnosť poskytovateľa
  if (
    rawJson?.source?.confidence !== undefined &&
    rawJson?.source?.confidence !== null
  ) {
    profile.source.confidence = rawJson.source.confidence;
  }

  // 6. Uloženie nemenného snapshotu chráneného pred klientskym zápisom
  // Zápis do company_registry_profiles vykonáva výhradne serverový klient s oddelenými oprávneniami (service_role)
  const adminClient =
    (context as any).adminClient ??
    (process.env["SUPABASE_SERVICE_ROLE_KEY"]
      ? (await import("@/integrations/supabase/client.server")).supabaseAdmin
      : null);

  if (!adminClient) {
    throw new Error(
      "Konfiguračná chyba servera: Chýba SUPABASE_SERVICE_ROLE_KEY pre bezpečný serverový zápis registrového snapshotu.",
    );
  }

  const { data: existingSnapshot } = await (
    adminClient.from("company_registry_profiles" as any) as any
  )
    .select("id, entity_id")
    .eq("case_id", data.caseId)
    .eq("ico", cleanIco)
    .eq("source_hash", canonicalHash)
    .maybeSingle();

  let snapshotId: string;
  if (existingSnapshot?.id) {
    snapshotId = existingSnapshot.id;
  } else {
    const { data: insertedSnapshot, error: snapErr } = await (
      adminClient.from("company_registry_profiles" as any) as any
    )
      .insert({
        case_id: data.caseId,
        user_id: userId,
        ico: profile.ico,
        legal_name: profile.legalName,
        legal_form: profile.legalForm ?? null,
        registered_address: profile.registeredAddress ?? null,
        country: profile.country,
        status: profile.status ?? "active",
        incorporated_at: profile.incorporatedAt ?? null,
        dissolved_at: profile.dissolvedAt ?? null,
        statutory_persons: profile.statutoryPersons,
        business_activities: profile.businessActivities,
        address_history: profile.addressHistory ?? [],
        source: profile.source.source,
        source_url: profile.source.sourceUrl ?? null,
        source_hash: canonicalHash,
        captured_at: profile.source.capturedAt,
        raw_payload: rawJson,
      })
      .select("id")
      .single();

    if (snapErr) fail(snapErr, "Uloženie bezpečnostného snapshotu zlyhalo.");
    snapshotId = insertedSnapshot.id;
  }

  return {
    ok: true,
    snapshotId,
    profile,
  };
}

export const lookupCompanyRegistryByIco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        caseId: uuid,
        ico: z.string().min(1, "Zadajte IČO"),
        country: z.string().default("SK"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return handleLookupCompanyRegistryByIco(data, context);
  });

export function isRegistryRpcMissingFromSchema(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  return (
    error?.code === "PGRST202" && /schema cache/i.test(error.message ?? "")
  );
}

/** Priamy zápis firmy a štatutára, keď RPC v schéme chýba. Opakovaný režim `new` sa odmietne. */
export async function commitCompanyRegistryImportDirect(
  admin: { from: (table: string) => any },
  input: {
    caseId: string;
    userId: string;
    snapshot: Record<string, unknown>;
    mode: string;
    existingEntityId: string | null;
  },
): Promise<{ company_id: string; idempotent: boolean }> {
  const existing = await admin
    .from("case_entities")
    .select()
    .eq("case_id", input.caseId)
    .eq("ico", input.snapshot["ico"])
    .maybeSingle();
  if (input.mode === "new" && existing.data) {
    throw new Error("Firma už v prípade existuje (režim new).");
  }

  const companyInsert = await admin
    .from("case_entities")
    .insert({
      case_id: input.caseId,
      user_id: input.userId,
      name: input.snapshot["legal_name"],
      kind: "company",
      ico: input.snapshot["ico"],
      country: input.snapshot["country"] ?? "SK",
    })
    .select()
    .single();
  const companyId = String(companyInsert.data?.["id"] ?? "");
  if (!companyId) throw new Error("Firmu sa nepodarilo zapísať.");
  const createdIds = [companyId];
  const persons = Array.isArray(input.snapshot["statutory_persons"])
    ? (input.snapshot["statutory_persons"] as Record<string, unknown>[])
    : [];
  try {
    for (const person of persons) {
      const personInsert = await admin
        .from("case_entities")
        .insert({
          case_id: input.caseId,
          user_id: input.userId,
          name: person["name"],
          kind: "person",
          role: person["role"] ?? "",
          country: "SK",
        })
        .select()
        .single();
      const personId = String(personInsert.data?.["id"] ?? "");
      if (!personId) throw new Error("Štatutára sa nepodarilo zapísať.");
      createdIds.push(personId);
      const from = person["validFrom"] ? ` (od ${person["validFrom"]})` : "";
      await admin
        .from("case_relations")
        .insert({
          case_id: input.caseId,
          user_id: input.userId,
          from_entity_id: companyId,
          to_entity_id: personId,
          label: `${person["role"] ?? "štatutár"}${from}`,
        })
        .select()
        .single();
    }
  } catch (error) {
    await admin.from("case_entities").delete?.().in("id", createdIds);
    throw error;
  }
  await admin
    .from("company_registry_profiles")
    .update({ entity_id: companyId })
    .eq("id", input.snapshot["id"])
    .eq("case_id", input.caseId);
  return { company_id: companyId, idempotent: false };
}

/**
 * Potvrdenie importu registra:
 * Prijíma Iba caseId a snapshotId (klient nesmie posielať ani upravovať profil).
 * Zabezpečuje transakčné uloženie, deduplikáciu a ochranu pred podvrhnutím dát.
 */
export async function handleConfirmCompanyRegistryImport(
  data: {
    caseId: string;
    snapshotId: string;
    mode?: "auto" | "new" | "update" | undefined;
    existingEntityId?: string | undefined;
  },
  context: { supabase: any; userId: string },
) {
  const { supabase, userId } = context;

  // 1. Overenie vlastníctva prípadu
  const { data: owned, error: caseError } = await supabase
    .from("cases")
    .select("id")
    .eq("id", data.caseId)
    .eq("user_id", userId)
    .maybeSingle();

  if (caseError) fail(caseError, "Nepodarilo sa overiť prípad.");
  if (!owned)
    throw new Error("Prípad sa nenašiel alebo naň nemáte oprávnenie.");

  // 2. Načítanie dôveryhodného serverového snapshotu
  const { data: snapshot, error: snapErr } = await (
    supabase.from("company_registry_profiles" as any) as any
  )
    .select("*")
    .eq("id", data.snapshotId)
    .eq("case_id", data.caseId)
    .eq("user_id", userId)
    .maybeSingle();

  if (snapErr) fail(snapErr, "Nepodarilo sa overiť snapshot registra.");
  if (!snapshot) {
    throw new Error(
      "Snapshot registra sa nenašiel alebo k nemu nemáte oprávnenie.",
    );
  }

  if (!snapshot.source_hash || snapshot.source_hash.trim().length < 16) {
    throw new Error("Neplatný snapshot: chýba dôveryhodný serverový hash.");
  }

  // 3. Výhradne atomická SQL transakcia cez commit_company_registry_import RPC
  // Žiadny aplikačný fallback — chýbajúca procedúra alebo zlyhanie transakcie musí okamžite zlyhať bez čiastočného zápisu dát.
  const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)(
    "commit_company_registry_import",
    {
      _case_id: data.caseId,
      _snapshot_id: data.snapshotId,
      _mode: data.mode ?? "auto",
      _existing_entity_id: data.existingEntityId ?? null,
    },
  );

  if (rpcError) {
    if (rpcError.code === "42501") {
      throw new Error(
        rpcError.message || "Nemáte oprávnenie na túto operáciu.",
      );
    }
    if (rpcError.code === "23505") {
      throw new Error(
        rpcError.message ||
          "Konflikt integrity: firma už v prípade existuje (režim new).",
      );
    }
    if (rpcError.code === "P0002") {
      throw new Error(
        rpcError.message ||
          "Cieľová firma pre aktualizáciu sa v prípade nenašla (režim update).",
      );
    }
    throw new Error(`Transakčný import zlyhal: ${rpcError.message}`);
  }

  if (!rpcResult) {
    throw new Error(
      "Transakčný import zlyhal: RPC procedúra nevrátila výsledok.",
    );
  }

  return {
    ok: true,
    snapshotId: data.snapshotId,
    companyEntityId: rpcResult.company_id,
    idempotent: Boolean(rpcResult.idempotent),
  };
}

export const confirmCompanyRegistryImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        caseId: uuid,
        snapshotId: uuid,
        mode: z.enum(["auto", "new", "update"]).default("auto"),
        existingEntityId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return handleConfirmCompanyRegistryImport(data, context);
  });

/**
 * Kompatibilný adaptér pre staršie volania:
 * Prijíma výhradne overené snapshotId a deleguje na zabezpečené transakčné potvrdenie.
 * Klientsky profil ani obchádzanie snapshotov nie sú povolené.
 */
export const importCompanyRegistryProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        caseId: uuid,
        snapshotId: uuid,
        mode: z.enum(["auto", "new", "update"]).default("auto"),
        existingEntityId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return handleConfirmCompanyRegistryImport(
      {
        caseId: data.caseId,
        snapshotId: data.snapshotId,
        mode: data.mode,
        existingEntityId: data.existingEntityId,
      },
      context,
    );
  });

/**
 * Zoznam profilov registra pre prípad.
 */
export const listCompanyRegistryProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ caseId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profiles, error } = await (
      supabase.from("company_registry_profiles" as any) as any
    )
      .select("*")
      .eq("case_id", data.caseId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) fail(error, "Načítanie profilov zlyhalo.");
    return { ok: true, profiles: profiles ?? [] };
  });
