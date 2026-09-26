import crypto from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  canonicalJsonStringify,
  normalizeAddress,
  normalizeCompanyName,
  normalizeCountry,
  normalizeIco,
  type CompanyRegistryProfile,
  type StatutoryPerson,
} from "@/forensic";
import { parseOfficialRpoEntity } from "@/lib/rpo-parser";

/**
 * WhoIsWho SK DTO typy
 */
export interface WhoIsWhoCompanyData {
  ico: string;
  name: string | null;
  name_norm?: string | null;
  status?: string | null;
  legal_form?: string | null;
  legal_form_code?: string | null;
  seat_norm?: string | null;
  street?: string | null;
  municipality?: string | null;
  postal_code?: string | null;
  country?: string | null;
  dic?: string | null;
  ic_dph?: string | null;
  established_on?: string | null;
  terminated_on?: string | null;
  sources?: string[];
  source_urls?: string[];
  is_public_sector_partner?: boolean;
  retrieved_at?: string;
  raw?: Record<string, unknown>;
}

export interface WhoIsWhoMeta {
  sources?: string[];
  source_url?: string[];
  retrieved_at?: string;
  disclaimer?: string;
  note?: string;
}

export interface WhoIsWhoCompanyResponse {
  data: WhoIsWhoCompanyData;
  meta: WhoIsWhoMeta;
}

export interface WhoIsWhoRiskFlag {
  code: string;
  label?: string;
  description?: string;
  severity?: "low" | "medium" | "high" | "critical";
  meta?: Record<string, unknown>;
}

export interface WhoIsWhoRiskData {
  ico: string;
  score: number;
  flags: (string | WhoIsWhoRiskFlag)[];
  sources?: string[];
  computed_at?: string;
}

export interface WhoIsWhoRiskResponse {
  data: WhoIsWhoRiskData;
  meta: WhoIsWhoMeta;
}

export interface WhoIsWhoGraphNode {
  id: string;
  type: "company" | "person";
  label: string;
  name?: string | null;
  ico?: string | null;
  status?: string | null;
  legal_form?: string | null;
  seat?: string | null;
  retrieved_at?: string | null;
  known?: boolean;
}

export interface WhoIsWhoGraphEdge {
  from: string;
  to: string;
  type: string;
  source: string;
  source_url?: string | null;
  retrieved_at?: string | null;
  confidence?: number;
  valid_from?: string | null;
  valid_to?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface WhoIsWhoGraphData {
  root: string;
  depth: number;
  nodes: WhoIsWhoGraphNode[];
  edges: WhoIsWhoGraphEdge[];
  counts: { nodes: number; edges: number };
}

export interface WhoIsWhoGraphResponse {
  data: WhoIsWhoGraphData;
  meta: WhoIsWhoMeta;
}

/**
 * Získa URL a API kľúč pre WhoIsWho SK službu.
 */
export function getWhoIsWhoConfig() {
  const apiUrl =
    process.env["WHOISWHO_API_URL"] ||
    process.env["VITE_WHOISWHO_API_URL"] ||
    "";
  const apiKey =
    process.env["WHOISWHO_API_KEY"] ||
    process.env["VITE_WHOISWHO_API_KEY"] ||
    "";
  const isEnabled =
    process.env["WHOISWHO_ENABLED"] === "1" ||
    process.env["WHOISWHO_ENABLED"] === "true" ||
    Boolean(apiUrl);

  return { apiUrl: apiUrl.replace(/\/+$/, ""), apiKey, isEnabled };
}

/**
 * Mapuje odpoveď WhoIsWho na štandardný profil CompanyRegistryProfile aplikácie ForenX.
 */
export function mapWhoIsWhoToCompanyRegistryProfile(
  companyRes: WhoIsWhoCompanyResponse,
  graphRes?: WhoIsWhoGraphResponse | null,
): CompanyRegistryProfile {
  const c = companyRes.data;
  const meta = companyRes.meta;
  const data = c as unknown as Record<string, unknown>;
  const raw =
    c.raw && typeof c.raw === "object" && !Array.isArray(c.raw) ? c.raw : {};
  const parsedRpo = parseOfficialRpoEntity(raw);

  const cleanIco = normalizeIco(c.ico) || c.ico;
  const cleanName =
    normalizeCompanyName(c.name || parsedRpo.name || "") ||
    `Subjekt IČO ${cleanIco}`;

  // Adresa zo zložiek
  const addressParts = [c.street, c.municipality, c.postal_code]
    .filter(Boolean)
    .map((s) => String(s).trim());
  const rawAddress = addressParts.join(", ");
  const registeredAddress = rawAddress
    ? normalizeAddress(rawAddress)
    : parsedRpo.address || undefined;

  const rawActivities =
    data["activities"] ??
    data["businessActivities"] ??
    data["business_activities"] ??
    raw["activities"] ??
    [];
  const businessActivities = Array.isArray(rawActivities)
    ? rawActivities
        .map((activity) => {
          if (typeof activity === "string") return activity;
          if (!activity || typeof activity !== "object") return undefined;
          const value = activity as Record<string, unknown>;
          return (
            value["economicActivityDescription"] ??
            value["name"] ??
            value["description"] ??
            value["value"]
          );
        })
        .filter(
          (activity): activity is string =>
            typeof activity === "string" && activity.trim().length > 0,
        )
        .map((activity) => activity.trim())
    : [];

  const rawStakeholders = data["stakeholders"] ?? raw["stakeholders"] ?? [];
  const stakeholders = Array.isArray(rawStakeholders)
    ? rawStakeholders
        .map((stakeholder) => {
          if (!stakeholder || typeof stakeholder !== "object") return null;
          const value = stakeholder as Record<string, unknown>;
          const personName =
            value["personName"] &&
            typeof value["personName"] === "object" &&
            !Array.isArray(value["personName"])
              ? (value["personName"] as Record<string, unknown>)
              : {};
          const stakeholderType =
            value["stakeholderType"] &&
            typeof value["stakeholderType"] === "object" &&
            !Array.isArray(value["stakeholderType"])
              ? (value["stakeholderType"] as Record<string, unknown>)
              : {};
          const formattedName = personName["formatedName"];
          const givenNames = Array.isArray(personName["givenNames"])
            ? personName["givenNames"].filter(
                (name): name is string => typeof name === "string",
              )
            : [];
          const familyNames = Array.isArray(personName["familyNames"])
            ? personName["familyNames"].filter(
                (name): name is string => typeof name === "string",
              )
            : [];
          const name =
            (typeof formattedName === "string" && formattedName.trim()) ||
            (typeof value["name"] === "string" && value["name"].trim()) ||
            [...givenNames, ...familyNames].join(" ").trim();
          if (!name) return null;

          const type =
            (typeof stakeholderType["value"] === "string" &&
              stakeholderType["value"]) ||
            (typeof value["type"] === "string" && value["type"]) ||
            "Spoločník s.r.o.";
          const isLimitedLiabilityCompany =
            /ručením obmedzeným|s\.?\s*r\.?\s*o\.?/i.test(
              c.legal_form || parsedRpo.legalForm || "",
            );
          return {
            name,
            type:
              type === "Spoločník v.o.s. / s.r.o." && isLimitedLiabilityCompany
                ? "Spoločník s.r.o."
                : type,
          };
        })
        .filter(
          (stakeholder): stakeholder is { name: string; type: string } =>
            stakeholder !== null,
        )
    : [];

  // Štatutári z grafu, ak je k dispozícii
  const statutoryPersons: StatutoryPerson[] = [];
  if (graphRes?.data?.nodes && graphRes.data.edges) {
    const nodeMap = new Map(graphRes.data.nodes.map((n) => [n.id, n]));
    for (const edge of graphRes.data.edges) {
      if (edge.type === "STATUTORY") {
        const personId = edge.to.replace(/^person:/, "");
        const personNode = nodeMap.get(personId);
        const name = personNode?.name || personNode?.label;
        if (name) {
          const role =
            (edge.payload as any)?.role ||
            (edge.payload as any)?.function ||
            "Štatutárny orgán";
          statutoryPersons.push({
            name,
            role,
            validFrom: edge.valid_from || undefined,
            validTo: edge.valid_to || undefined,
            sourcePersonId: personId,
          });
        }
      }
    }
  }

  const primarySourceUrl =
    c.source_urls?.[0] || meta.source_url?.[0] || undefined;
  const capturedAt =
    c.retrieved_at || meta.retrieved_at || new Date().toISOString();

  return {
    ico: cleanIco,
    legalName: cleanName,
    legalForm: c.legal_form || parsedRpo.legalForm || undefined,
    registeredAddress,
    country: normalizeCountry(c.country || "SK"),
    status: c.status || undefined,
    incorporatedAt: c.established_on || undefined,
    dissolvedAt: c.terminated_on || undefined,
    statutoryPersons,
    businessActivities:
      businessActivities.length > 0 ? businessActivities : parsedRpo.activities,
    stakeholders:
      stakeholders.length > 0
        ? stakeholders
        : parsedRpo.stakeholders.map((stakeholder) => ({
            name: stakeholder.name,
            ...(stakeholder.typeLabel ? { type: stakeholder.typeLabel } : {}),
          })),
    registrationCourt: parsedRpo.registrationCourt || undefined,
    registrationNumber: parsedRpo.registrationNumber || undefined,
    shareCapital: parsedRpo.shareCapital
      ? { amount: parsedRpo.shareCapital.amount }
      : undefined,
    mainActivity: parsedRpo.mainActivity,
    source: {
      id: `whoiswho-${cleanIco}-${Date.now()}`,
      source: "whoiswho",
      sourceVersion: "v1",
      sourceUrl: primarySourceUrl,
      capturedAt,
      confidence: 95,
      rawReference: canonicalJsonStringify(companyRes),
    },
  };
}

/**
 * Volá endpoint WhoIsWho SK s timeoutom a overením autorizácie.
 */
async function callWhoIsWhoApi<T>(
  endpoint: string,
  customFetch?: typeof fetch,
  timeoutMs = 15000,
): Promise<T> {
  const { apiUrl, apiKey } = getWhoIsWhoConfig();
  if (!apiUrl || !apiKey) {
    throw new Error(
      "Konfigurácia WhoIsWho SK (WHOISWHO_API_URL / WHOISWHO_API_KEY) chýba na serveri.",
    );
  }

  const fetchFn = customFetch || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const fullUrl = `${apiUrl}${cleanEndpoint}`;

  try {
    const res = await fetchFn(fullUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Caller": "forenx",
      },
      signal: controller.signal,
    });

    if (res.status === 404) {
      throw new Error(`Subjekt sa v registri WhoIsWho SK nenašiel (404).`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`WhoIsWho SK odmietol autorizačný kľúč (401/403).`);
    }
    if (!res.ok) {
      throw new Error(
        `WhoIsWho SK vrátil chybu ${res.status}: ${res.statusText}`,
      );
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(
        `Časový limit požiadavky na WhoIsWho SK vypršal (${Math.round(timeoutMs / 1000)}s).`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Načíta profil firmy z WhoIsWho SK.
 */
export async function fetchWhoIsWhoCompany(
  ico: string,
  customFetch?: typeof fetch,
): Promise<WhoIsWhoCompanyResponse> {
  const cleanIco = normalizeIco(ico);
  if (!cleanIco) throw new Error("Neplatný formát IČO.");
  return callWhoIsWhoApi<WhoIsWhoCompanyResponse>(
    `/api/v1/companies/${encodeURIComponent(cleanIco)}`,
    customFetch,
  );
}

/**
 * Načíta graf väzieb firmy z WhoIsWho SK.
 */
export async function fetchWhoIsWhoGraph(
  ico: string,
  depth = 1,
  customFetch?: typeof fetch,
): Promise<WhoIsWhoGraphResponse> {
  const cleanIco = normalizeIco(ico);
  if (!cleanIco) throw new Error("Neplatný formát IČO.");
  return callWhoIsWhoApi<WhoIsWhoGraphResponse>(
    `/api/v1/companies/${encodeURIComponent(cleanIco)}/graph?depth=${depth}`,
    customFetch,
  );
}

/**
 * Načíta risk profil a deterministické vlajky firmy z WhoIsWho SK.
 */
export async function fetchWhoIsWhoRisk(
  ico: string,
  customFetch?: typeof fetch,
): Promise<WhoIsWhoRiskResponse> {
  const cleanIco = normalizeIco(ico);
  if (!cleanIco) throw new Error("Neplatný formát IČO.");
  return callWhoIsWhoApi<WhoIsWhoRiskResponse>(
    `/api/v1/companies/${encodeURIComponent(cleanIco)}/risk`,
    customFetch,
  );
}

/**
 * Kompletný lookup subjektu s obohatením o graf a risk skóre.
 */
export async function lookupCompanyWhoIsWhoProfile(
  ico: string,
  customFetch?: typeof fetch,
): Promise<{
  profile: CompanyRegistryProfile;
  risk: WhoIsWhoRiskResponse | null;
  graph: WhoIsWhoGraphResponse | null;
  raw: WhoIsWhoCompanyResponse;
}> {
  const company = await fetchWhoIsWhoCompany(ico, customFetch);

  // Paralelné volanie grafu a risk skóre (odolné voči zlyhaniu)
  const [graphRes, riskRes] = await Promise.allSettled([
    fetchWhoIsWhoGraph(ico, 1, customFetch),
    fetchWhoIsWhoRisk(ico, customFetch),
  ]);

  const graph = graphRes.status === "fulfilled" ? graphRes.value : null;
  const risk = riskRes.status === "fulfilled" ? riskRes.value : null;

  const profile = mapWhoIsWhoToCompanyRegistryProfile(company, graph);

  return {
    profile,
    risk,
    graph,
    raw: company,
  };
}

export interface WhoIsWhoReportJobData {
  job_id: string;
  status: string;
  ico: string;
  tier?: string;
  pdf?: {
    sha256?: string;
    size_bytes?: number;
    path?: string;
  };
  download_url?: string;
}

export interface WhoIsWhoReportResponse {
  data: WhoIsWhoReportJobData;
  meta?: WhoIsWhoMeta;
}

export interface WhoIsWhoPdfDownloadResult {
  buffer: ArrayBuffer;
  sha256: string | null;
  contentType: string;
  filename: string;
}

export interface DownloadDueDiligencePdfResponse {
  base64: string;
  sha256: string | null;
  filename: string;
  contentType: string;
}

/**
 * Server Function: Bezpečné získanie rizika firmy pre UI/asistenta z frontendu.
 */
export const getCompanyRiskFn = createServerFn({ method: "GET" })
  .validator((d: { ico: string }) => {
    const ico = normalizeIco(d.ico);
    if (!ico) throw new Error("Neplatné IČO.");
    return { ico };
  })
  .handler(async ({ data }): Promise<any> => {
    const res = await fetchWhoIsWhoRisk(data.ico);
    return res as any;
  });

/**
 * Server Function: Bezpečné získanie grafu väzieb pre UI/asistenta z frontendu.
 */
export const getCompanyGraphFn = createServerFn({ method: "GET" })
  .validator((d: { ico: string; depth?: number }) => {
    const ico = normalizeIco(d.ico);
    if (!ico) throw new Error("Neplatné IČO.");
    return { ico, depth: d.depth || 1 };
  })
  .handler(async ({ data }): Promise<any> => {
    const res = await fetchWhoIsWhoGraph(data.ico, data.depth);
    return res as any;
  });

/**
 * Vytvorí nový Due Diligence report pre zadané IČO v WhoIsWho SK (POST 201).
 */
export async function startDueDiligenceReport(
  ico: string,
  tier: "lite" | "full" = "lite",
  customFetch?: typeof fetch,
  timeoutMs = 60000,
): Promise<WhoIsWhoReportResponse> {
  const cleanIco = normalizeIco(ico);
  if (!cleanIco) throw new Error("Neplatný formát IČO.");

  const { apiUrl, apiKey } = getWhoIsWhoConfig();
  if (!apiUrl || !apiKey) {
    throw new Error(
      "Konfigurácia WhoIsWho SK (WHOISWHO_API_URL / WHOISWHO_API_KEY) chýba na serveri.",
    );
  }

  const fetchFn = customFetch || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const fullUrl = `${apiUrl}/api/v1/reports/due-diligence`;

  try {
    const res = await fetchFn(fullUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Caller": "forenx",
      },
      body: JSON.stringify({ ico: cleanIco, tier }),
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error(`WhoIsWho SK odmietol autorizačný kľúč (401/403).`);
    }
    if (res.status === 404) {
      throw new Error(
        `Subjekt sa nenašiel pre vytvorenie Due Diligence reportu (404). Najprv overte subjekt.`,
      );
    }
    if (res.status === 422) {
      const errJson = await res.json().catch(() => null);
      const msg =
        errJson?.message || "Neplatné parametre požiadavky na report (422).";
      throw new Error(msg);
    }
    if (res.status === 429) {
      throw new Error(
        "Prekročený limit požiadaviek (rate limit 429). Skúste to o minútu.",
      );
    }
    if (res.status !== 201 && !res.ok) {
      throw new Error(
        `WhoIsWho SK vrátil neočakávanú chybu ${res.status}: ${res.statusText}`,
      );
    }

    return (await res.json()) as WhoIsWhoReportResponse;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(
        `Časový limit generovania Due Diligence reportu vypršal (${Math.round(timeoutMs / 1000)}s).`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Stiahne vygenerovaný PDF Due Diligence report podľa jobId.
 */
export async function downloadDueDiligencePdf(
  jobId: string,
  customFetch?: typeof fetch,
  timeoutMs = 60000,
): Promise<WhoIsWhoPdfDownloadResult> {
  const cleanJobId = jobId ? jobId.trim() : "";
  if (!cleanJobId) throw new Error("Neplatné ID reportu.");

  const { apiUrl, apiKey } = getWhoIsWhoConfig();
  if (!apiUrl || !apiKey) {
    throw new Error(
      "Konfigurácia WhoIsWho SK (WHOISWHO_API_URL / WHOISWHO_API_KEY) chýba na serveri.",
    );
  }

  const fetchFn = customFetch || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const fullUrl = `${apiUrl}/api/v1/reports/${encodeURIComponent(cleanJobId)}/download`;

  try {
    const res = await fetchFn(fullUrl, {
      method: "GET",
      headers: {
        Accept: "application/pdf",
        Authorization: `Bearer ${apiKey}`,
        "X-Caller": "forenx",
      },
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error(`WhoIsWho SK odmietol autorizačný kľúč (401/403).`);
    }
    if (res.status === 404) {
      throw new Error(`Due Diligence report ${cleanJobId} sa nenašiel (404).`);
    }
    if (!res.ok) {
      throw new Error(
        `Sťahovanie PDF zlyhalo: ${res.status} ${res.statusText}`,
      );
    }

    const sha256Header =
      res.headers.get("x-report-sha256") || res.headers.get("X-Report-Sha256");
    const contentDisposition =
      res.headers.get("content-disposition") ||
      res.headers.get("Content-Disposition") ||
      "";
    let filename = `whoiswho-dd-${cleanJobId}.pdf`;
    const filenameMatch = contentDisposition.match(
      /filename\*?=(?:UTF-8'')?"?([^";\n]+)"?/i,
    );
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].trim();
    }

    const contentType = res.headers.get("content-type") || "application/pdf";
    const buffer = await res.arrayBuffer();

    // Vypočítame kontrolný súčet ak hlavička chýba, alebo pre overenie
    const computedSha = crypto
      .createHash("sha256")
      .update(Buffer.from(buffer))
      .digest("hex");

    return {
      buffer,
      sha256: sha256Header || computedSha,
      contentType,
      filename,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(
        `Časový limit sťahovania Due Diligence PDF vypršal (${Math.round(timeoutMs / 1000)}s).`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Server Function: Vytvorenie Due Diligence reportu (POST 201).
 */
export const startDueDiligenceReportFn = createServerFn({ method: "POST" })
  .validator((d: { ico: string; tier?: "lite" | "full" }) => {
    const ico = normalizeIco(d.ico);
    if (!ico) throw new Error("Neplatné IČO.");
    return { ico, tier: d.tier || "lite" };
  })
  .handler(async ({ data }) => {
    return await startDueDiligenceReport(data.ico, data.tier);
  });

/**
 * Server Function: Stiahnutie PDF reportu ako base64 + sha256 + filename.
 */
export const downloadDueDiligencePdfFn = createServerFn({ method: "POST" })
  .validator((d: { jobId: string; ico?: string }) => {
    if (!d.jobId || typeof d.jobId !== "string") {
      throw new Error("Neplatné ID reportu.");
    }
    return {
      jobId: d.jobId.trim(),
      ico: d.ico ? normalizeIco(d.ico) : undefined,
    };
  })
  .handler(async ({ data }): Promise<DownloadDueDiligencePdfResponse> => {
    const res = await downloadDueDiligencePdf(data.jobId);
    const base64 = Buffer.from(res.buffer).toString("base64");
    const filename =
      res.filename ||
      (data.ico
        ? `whoiswho-dd-${data.ico}.pdf`
        : `whoiswho-dd-${data.jobId}.pdf`);
    return {
      base64,
      sha256: res.sha256,
      filename,
      contentType: res.contentType,
    };
  });

/**
 * Server Function: All-in-one vytvorenie a stiahnutie Due Diligence reportu pre frontend.
 */
export const generateAndDownloadDueDiligencePdfFn = createServerFn({
  method: "POST",
})
  .validator((d: { ico: string; tier?: "lite" | "full" }) => {
    const ico = normalizeIco(d.ico);
    if (!ico) throw new Error("Neplatné IČO.");
    return { ico, tier: d.tier || "lite" };
  })
  .handler(
    async ({
      data,
    }): Promise<DownloadDueDiligencePdfResponse & { jobId: string }> => {
      const jobRes = await startDueDiligenceReport(data.ico, data.tier);
      const jobId = jobRes.data.job_id;
      const res = await downloadDueDiligencePdf(jobId);
      const base64 = Buffer.from(res.buffer).toString("base64");
      const filename = res.filename || `whoiswho-dd-${data.ico}.pdf`;
      return {
        jobId,
        base64,
        sha256: res.sha256,
        filename,
        contentType: res.contentType,
      };
    },
  );
