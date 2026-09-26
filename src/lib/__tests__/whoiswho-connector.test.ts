import { describe, expect, it } from "vitest";
import {
  downloadDueDiligencePdf,
  getWhoIsWhoConfig,
  mapWhoIsWhoToCompanyRegistryProfile,
  startDueDiligenceReport,
  type WhoIsWhoCompanyResponse,
  type WhoIsWhoGraphResponse,
} from "../whoiswho.functions";

describe("WhoIsWho SK Connector", () => {
  it("správne načíta konfiguráciu zo serverového prostredia", () => {
    const originalUrl = process.env["WHOISWHO_API_URL"];
    const originalKey = process.env["WHOISWHO_API_KEY"];

    try {
      process.env["WHOISWHO_API_URL"] = "http://2.29.52.59:8000/";
      process.env["WHOISWHO_API_KEY"] = "test_key_123";

      const config = getWhoIsWhoConfig();
      expect(config.apiUrl).toBe("http://2.29.52.59:8000");
      expect(config.apiKey).toBe("test_key_123");
      expect(config.isEnabled).toBe(true);
    } finally {
      process.env["WHOISWHO_API_URL"] = originalUrl;
      process.env["WHOISWHO_API_KEY"] = originalKey;
    }
  });

  it("mapuje WhoIsWhoCompanyResponse a graph uzly na CompanyRegistryProfile", () => {
    const mockCompanyRes: WhoIsWhoCompanyResponse = {
      data: {
        ico: "31333532",
        name: "ESET, spol. s r.o.",
        status: "Aktívna",
        legal_form: "Spoločnosť s ručením obmedzeným",
        street: "Einsteinova",
        municipality: "Bratislava",
        postal_code: "85101",
        country: "SK",
        dic: "2020317068",
        established_on: "1992-09-17",
        terminated_on: null,
        sources: ["rpo", "ruz", "rpvs"],
        source_urls: ["https://api.statistics.sk/rpo/v1/entity/937053"],
        is_public_sector_partner: true,
        retrieved_at: "2026-09-25T15:00:00Z",
      },
      meta: {
        sources: ["rpo", "ruz", "rpvs"],
        source_url: ["https://api.statistics.sk/rpo/v1/entity/937053"],
        retrieved_at: "2026-09-25T15:00:00Z",
        disclaimer: "Informatívny výpis z registrov SR",
      },
    };

    const mockGraphRes: WhoIsWhoGraphResponse = {
      data: {
        root: "company:31333532",
        depth: 1,
        nodes: [
          {
            id: "31333532",
            type: "company",
            label: "ESET, spol. s r.o.",
            name: "ESET, spol. s r.o.",
          },
          {
            id: "1",
            type: "person",
            label: "Miroslav Trnka",
            name: "Miroslav Trnka",
          },
          {
            id: "2",
            type: "person",
            label: "Richard Marko",
            name: "Richard Marko",
          },
        ],
        edges: [
          {
            from: "company:31333532",
            to: "person:1",
            type: "STATUTORY",
            source: "rpo",
            confidence: 0.95,
            valid_from: "1992-09-17",
            payload: { role: "Konateľ" },
          },
          {
            from: "company:31333532",
            to: "person:2",
            type: "STATUTORY",
            source: "rpo",
            confidence: 0.95,
            valid_from: "2023-12-16",
            payload: { role: "Konateľ" },
          },
          {
            from: "person:1",
            to: "company:31333532",
            type: "SHAREHOLDER",
            source: "rpo",
            confidence: 0.85,
            payload: { deposit_amount: 31850 },
          },
        ],
        counts: { nodes: 3, edges: 3 },
      },
      meta: {
        retrieved_at: "2026-09-25T15:00:00Z",
        disclaimer: "Informatívny výpis",
      },
    };

    const profile = mapWhoIsWhoToCompanyRegistryProfile(
      mockCompanyRes,
      mockGraphRes,
    );

    expect(profile.ico).toBe("31333532");
    expect(profile.legalName).toBe("ESET, spol. s r.o.");
    expect(profile.country).toBe("SK");
    expect(profile.status).toBe("Aktívna");
    expect(profile.registeredAddress).toContain("Einsteinova");
    expect(profile.registeredAddress).toContain("Bratislava");
    expect(profile.source.source).toBe("whoiswho");
    expect(profile.source.sourceVersion).toBe("v1");
    expect(profile.source.confidence).toBe(95);

    // Štatutári z grafu
    expect(profile.statutoryPersons.length).toBe(2);
    expect(profile.statutoryPersons[0]?.name).toBe("Miroslav Trnka");
    expect(profile.statutoryPersons[0]?.role).toBe("Konateľ");
    expect(profile.statutoryPersons[1]?.name).toBe("Richard Marko");
  });

  describe("Due Diligence Report (F5)", () => {
    const originalUrl = process.env["WHOISWHO_API_URL"];
    const originalKey = process.env["WHOISWHO_API_KEY"];

    const setupEnv = () => {
      process.env["WHOISWHO_API_URL"] = "https://mock.whoiswho.test";
      process.env["WHOISWHO_API_KEY"] = "mock_secret_key";
    };

    const restoreEnv = () => {
      process.env["WHOISWHO_API_URL"] = originalUrl;
      process.env["WHOISWHO_API_KEY"] = originalKey;
    };

    it("startDueDiligenceReport úspešne odošle POST na /reports/due-diligence a spracuje 201", async () => {
      setupEnv();
      try {
        let capturedUrl = "";
        let capturedMethod = "";
        let capturedHeaders: any = {};
        let capturedBody = "";

        const mockFetch: typeof fetch = async (url, init) => {
          capturedUrl = String(url);
          capturedMethod = init?.method || "GET";
          capturedHeaders = init?.headers || {};
          capturedBody = String(init?.body || "");

          return new Response(
            JSON.stringify({
              data: {
                job_id: "test-job-uuid-1234",
                status: "ready",
                ico: "31333532",
                tier: "lite",
                pdf: {
                  sha256:
                    "b353a49b298338744597853da047ce81ca56b8db024629c382f22e2534d5206d",
                  size_bytes: 29840,
                },
                download_url: "/api/v1/reports/test-job-uuid-1234/download",
              },
              meta: {
                disclaimer: "Informatívny report",
              },
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          );
        };

        const res = await startDueDiligenceReport(
          "31333532",
          "lite",
          mockFetch,
        );

        expect(capturedUrl).toBe(
          "https://mock.whoiswho.test/api/v1/reports/due-diligence",
        );
        expect(capturedMethod).toBe("POST");
        expect(capturedHeaders["Authorization"]).toBe("Bearer mock_secret_key");
        expect(capturedHeaders["Content-Type"]).toBe("application/json");
        expect(capturedHeaders["X-Caller"]).toBe("forenx");
        expect(JSON.parse(capturedBody)).toEqual({
          ico: "31333532",
          tier: "lite",
        });

        expect(res.data.job_id).toBe("test-job-uuid-1234");
        expect(res.data.status).toBe("ready");
        expect(res.data.pdf?.sha256).toBe(
          "b353a49b298338744597853da047ce81ca56b8db024629c382f22e2534d5206d",
        );
      } finally {
        restoreEnv();
      }
    });

    it("startDueDiligenceReport mapuje chyby 401, 404, 422 na slovenské hlášky", async () => {
      setupEnv();
      try {
        const mockFetch401: typeof fetch = async () =>
          new Response("Unauthorized", { status: 401 });
        await expect(
          startDueDiligenceReport("31333532", "lite", mockFetch401),
        ).rejects.toThrow("WhoIsWho SK odmietol autorizačný kľúč (401/403).");

        const mockFetch404: typeof fetch = async () =>
          new Response("Not Found", { status: 404 });
        await expect(
          startDueDiligenceReport("31333532", "lite", mockFetch404),
        ).rejects.toThrow(
          "Subjekt sa nenašiel pre vytvorenie Due Diligence reportu (404). Najprv overte subjekt.",
        );

        const mockFetch422: typeof fetch = async () =>
          new Response(
            JSON.stringify({ message: "IČO musí mať presne 8 číslic." }),
            {
              status: 422,
              headers: { "Content-Type": "application/json" },
            },
          );
        await expect(
          startDueDiligenceReport("31333532", "lite", mockFetch422),
        ).rejects.toThrow("IČO musí mať presne 8 číslic.");
      } finally {
        restoreEnv();
      }
    });

    it("downloadDueDiligencePdf stiahne binárne PDF a extrahuje hlavičku X-Report-Sha256", async () => {
      setupEnv();
      try {
        let capturedUrl = "";
        let capturedHeaders: any = {};

        const pdfBytes = new TextEncoder().encode(
          "%PDF-1.4\n1 0 obj << /Title (WhoIsWho DD) >> endobj",
        );

        const mockFetch: typeof fetch = async (url, init) => {
          capturedUrl = String(url);
          capturedHeaders = init?.headers || {};

          return new Response(pdfBytes, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition":
                'attachment; filename="whoiswho-dd-31333532.pdf"',
              "X-Report-Sha256": "abcdef1234567890",
            },
          });
        };

        const res = await downloadDueDiligencePdf(
          "test-job-uuid-1234",
          mockFetch,
        );

        expect(capturedUrl).toBe(
          "https://mock.whoiswho.test/api/v1/reports/test-job-uuid-1234/download",
        );
        expect(capturedHeaders["Authorization"]).toBe("Bearer mock_secret_key");
        expect(capturedHeaders["Accept"]).toBe("application/pdf");

        expect(res.contentType).toBe("application/pdf");
        expect(res.filename).toBe("whoiswho-dd-31333532.pdf");
        expect(res.sha256).toBe("abcdef1234567890");

        const bufferStr = new TextDecoder().decode(res.buffer);
        expect(bufferStr.startsWith("%PDF")).toBe(true);
      } finally {
        restoreEnv();
      }
    });

    it("downloadDueDiligencePdf mapuje 404 na zrozumiteľnú hlášku", async () => {
      setupEnv();
      try {
        const mockFetch404: typeof fetch = async () =>
          new Response("Not Found", { status: 404 });
        await expect(
          downloadDueDiligencePdf("missing-uuid", mockFetch404),
        ).rejects.toThrow(
          "Due Diligence report missing-uuid sa nenašiel (404).",
        );
      } finally {
        restoreEnv();
      }
    });
  });
});
