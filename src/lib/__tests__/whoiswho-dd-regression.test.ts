import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadDueDiligencePdf,
  generateAndDownloadDueDiligencePdfFn,
  getWhoIsWhoConfig,
  startDueDiligenceReport,
  startDueDiligenceReportFn,
  downloadDueDiligencePdfFn,
} from "../whoiswho.functions";

describe("WhoIsWho SK — Due Diligence PDF Regression Suite", () => {
  const MOCK_API_URL = "https://mock.whoiswho.test";
  const MOCK_API_KEY = "whoiswho_secret_key_prod_test";

  const originalUrl = process.env["WHOISWHO_API_URL"];
  const originalKey = process.env["WHOISWHO_API_KEY"];
  const originalEnabled = process.env["WHOISWHO_ENABLED"];

  beforeEach(() => {
    process.env["WHOISWHO_API_URL"] = MOCK_API_URL;
    process.env["WHOISWHO_API_KEY"] = MOCK_API_KEY;
    process.env["WHOISWHO_ENABLED"] = "1";
  });

  afterEach(() => {
    process.env["WHOISWHO_API_URL"] = originalUrl;
    process.env["WHOISWHO_API_KEY"] = originalKey;
    process.env["WHOISWHO_ENABLED"] = originalEnabled;
  });

  // --- 1. Bezpečnosť tajomstiev a konfigurácie ---
  describe("Security & Configuration Boundary", () => {
    it("zlyhá so zrozumiteľnou správou ak chýba API URL alebo API KEY", async () => {
      process.env["WHOISWHO_API_URL"] = "";
      process.env["WHOISWHO_API_KEY"] = "";

      await expect(startDueDiligenceReport("31333532")).rejects.toThrow(
        /Konfigurácia WhoIsWho SK.*chýba na serveri/,
      );
      await expect(downloadDueDiligencePdf("test-job-id")).rejects.toThrow(
        /Konfigurácia WhoIsWho SK.*chýba na serveri/,
      );
    });

    it("nikdy nevracia API kľúč vo výstupnom objekte", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              job_id: "sec-job-uuid",
              status: "ready",
              ico: "31333532",
              tier: "lite",
              pdf: { sha256: "aabbcc1122", size_bytes: 1024 },
            },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      );

      const res = await startDueDiligenceReport("31333532", "lite", mockFetch);
      const str = JSON.stringify(res);
      expect(str).not.toContain(MOCK_API_KEY);
      expect(res.data.job_id).toBe("sec-job-uuid");
    });
  });

  // --- 2. Validácia a normalizácia vstupov ---
  describe("Input Normalization & Validation", () => {
    it("správne normalizuje IČO s medzerami alebo pomlčkami", async () => {
      let capturedBody: any = null;
      const mockFetch: typeof fetch = vi
        .fn()
        .mockImplementation(async (_, init) => {
          capturedBody = JSON.parse(String(init?.body || "{}"));
          return new Response(
            JSON.stringify({
              data: { job_id: "norm-1", status: "ready", ico: "31333532" },
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        });

      await startDueDiligenceReport(" 31 333 532 ", "lite", mockFetch);
      expect(capturedBody.ico).toBe("31333532");
    });

    it.each([
      ["", "Neplatný formát IČO."],
      ["   ", "Neplatný formát IČO."],
    ])(
      "odmietne prázdne IČO %j pred odoslaním na sieť",
      async (badIco, expectedMsg) => {
        const fetchSpy = vi.fn();
        await expect(
          startDueDiligenceReport(badIco, "lite", fetchSpy),
        ).rejects.toThrow(expectedMsg);
        expect(fetchSpy).not.toHaveBeenCalled();
      },
    );

    it.each(["", "   "])(
      "odmietne neplatný jobId %j pri sťahovaní bez sieťového volania",
      async (badJobId) => {
        const fetchSpy = vi.fn();
        await expect(
          downloadDueDiligencePdf(badJobId, fetchSpy),
        ).rejects.toThrow("Neplatné ID reportu.");
        expect(fetchSpy).not.toHaveBeenCalled();
      },
    );
  });

  // --- 3. Generovanie Due Diligence reportu (POST 201) ---
  describe("startDueDiligenceReport Contract", () => {
    it("správne posiela autorizáciu, hlavičky a spracuje 201 Created", async () => {
      let capturedUrl = "";
      let capturedMethod = "";
      let capturedHeaders: any = {};
      let capturedBody: any = null;

      const mockFetch: typeof fetch = vi
        .fn()
        .mockImplementation(async (url, init) => {
          capturedUrl = String(url);
          capturedMethod = init?.method || "";
          capturedHeaders = init?.headers || {};
          capturedBody = JSON.parse(String(init?.body || "{}"));

          return new Response(
            JSON.stringify({
              data: {
                job_id: "dd-job-9999",
                status: "ready",
                ico: "31333532",
                tier: "lite",
                pdf: {
                  sha256:
                    "3a03aa9d236b876e1a72d49f51a41b88386308e5aebff00d62561d4154d89191",
                  size_bytes: 29954,
                },
                download_url: "/api/v1/reports/dd-job-9999/download",
              },
              meta: {
                retrieved_at: "2026-09-25T19:00:00Z",
                disclaimer: "Informatívny report",
              },
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        });

      const res = await startDueDiligenceReport("31333532", "lite", mockFetch);

      expect(capturedUrl).toBe(`${MOCK_API_URL}/api/v1/reports/due-diligence`);
      expect(capturedMethod).toBe("POST");
      expect(capturedHeaders["Authorization"]).toBe(`Bearer ${MOCK_API_KEY}`);
      expect(capturedHeaders["Content-Type"]).toBe("application/json");
      expect(capturedHeaders["Accept"]).toBe("application/json");
      expect(capturedHeaders["X-Caller"]).toBe("forenx");
      expect(capturedBody).toEqual({ ico: "31333532", tier: "lite" });

      expect(res.data.job_id).toBe("dd-job-9999");
      expect(res.data.status).toBe("ready");
      expect(res.data.pdf?.size_bytes).toBe(29954);
      expect(res.data.pdf?.sha256).toBe(
        "3a03aa9d236b876e1a72d49f51a41b88386308e5aebff00d62561d4154d89191",
      );
    });

    it.each([
      [401, "WhoIsWho SK odmietol autorizačný kľúč (401/403)."],
      [403, "WhoIsWho SK odmietol autorizačný kľúč (401/403)."],
      [
        404,
        "Subjekt sa nenašiel pre vytvorenie Due Diligence reportu (404). Najprv overte subjekt.",
      ],
      [
        429,
        "Prekročený limit požiadaviek (rate limit 429). Skúste to o minútu.",
      ],
      [500, "WhoIsWho SK vrátil neočakávanú chybu 500: Internal Server Error"],
    ])("správne mapuje HTTP %s chybu", async (status, expectedMsg) => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue(
        new Response("Server Error", {
          status: Number(status),
          statusText: status === 500 ? "Internal Server Error" : "Error",
        }),
      );

      await expect(
        startDueDiligenceReport("31333532", "lite", mockFetch),
      ).rejects.toThrow(expectedMsg);
    });

    it("spracuje validačnú chybu 422 a vráti backend správu", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: "IČO 76543210 sa nenachádza v evidencii registrov.",
          }),
          { status: 422, headers: { "Content-Type": "application/json" } },
        ),
      );

      await expect(
        startDueDiligenceReport("76543210", "lite", mockFetch),
      ).rejects.toThrow("IČO 76543210 sa nenachádza v evidencii registrov.");
    });

    it("spracuje vypršanie časového limitu (AbortError)", async () => {
      const mockFetch: typeof fetch = vi
        .fn()
        .mockRejectedValue(
          new DOMException("The user aborted a request.", "AbortError"),
        );

      await expect(
        startDueDiligenceReport("31333532", "lite", mockFetch, 1000),
      ).rejects.toThrow(
        /Časový limit generovania Due Diligence reportu vypršal/,
      );
    });
  });

  // --- 4. Sťahovanie PDF a kontrola integrity (GET 200) ---
  describe("downloadDueDiligencePdf Contract & Integrity", () => {
    const fixturePdfContent =
      "%PDF-1.4\n1 0 obj\n<< /Title (Due Diligence Report) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF";
    const fixtureBuffer = new TextEncoder().encode(fixturePdfContent);
    const fixtureSha256 = crypto
      .createHash("sha256")
      .update(fixtureBuffer)
      .digest("hex");

    it("stiahne binárny PDF buffer, extrahuje X-Report-Sha256 a Content-Disposition filename", async () => {
      let capturedUrl = "";
      let capturedHeaders: any = {};

      const mockFetch: typeof fetch = vi
        .fn()
        .mockImplementation(async (url, init) => {
          capturedUrl = String(url);
          capturedHeaders = init?.headers || {};

          return new Response(fixtureBuffer, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition":
                'attachment; filename="whoiswho-dd-31333532.pdf"',
              "X-Report-Sha256": fixtureSha256,
            },
          });
        });

      const res = await downloadDueDiligencePdf("test-uuid-555", mockFetch);

      expect(capturedUrl).toBe(
        `${MOCK_API_URL}/api/v1/reports/test-uuid-555/download`,
      );
      expect(capturedHeaders["Authorization"]).toBe(`Bearer ${MOCK_API_KEY}`);
      expect(capturedHeaders["Accept"]).toBe("application/pdf");
      expect(capturedHeaders["X-Caller"]).toBe("forenx");

      expect(res.contentType).toBe("application/pdf");
      expect(res.filename).toBe("whoiswho-dd-31333532.pdf");
      expect(res.sha256).toBe(fixtureSha256);

      // Overenie magických bajtov %PDF
      const magic = new TextDecoder().decode(res.buffer.slice(0, 4));
      expect(magic).toBe("%PDF");
    });

    it("automaticky vypočíta SHA-256 ak serverová hlavička chýba", async () => {
      const mockFetch: typeof fetch = vi.fn().mockResolvedValue(
        new Response(fixtureBuffer, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
          },
        }),
      );

      const res = await downloadDueDiligencePdf("no-sha-header", mockFetch);
      expect(res.sha256).toBe(fixtureSha256);
      expect(res.filename).toBe("whoiswho-dd-no-sha-header.pdf");
    });

    it("správne ohlási chybu 404 ak report na serveri neexistuje", async () => {
      const mockFetch: typeof fetch = vi
        .fn()
        .mockResolvedValue(new Response("Report not found", { status: 404 }));

      await expect(
        downloadDueDiligencePdf("non-existent-uuid", mockFetch),
      ).rejects.toThrow(
        "Due Diligence report non-existent-uuid sa nenašiel (404).",
      );
    });

    it("spracuje vypršanie časového limitu sťahovania", async () => {
      const mockFetch: typeof fetch = vi
        .fn()
        .mockRejectedValue(
          new DOMException("The user aborted a request.", "AbortError"),
        );

      await expect(
        downloadDueDiligencePdf("timeout-uuid", mockFetch, 500),
      ).rejects.toThrow(/Časový limit sťahovania Due Diligence PDF vypršal/);
    });
  });

  // --- 5. All-in-one generovanie a prevod na Base64 pre klientske stiahnutie ---
  describe("generateAndDownloadDueDiligencePdf Workflow & Base64", () => {
    it("kompletne reťazí vytvorenie, stiahnutie a base64 zakódovanie PDF", async () => {
      const fixturePdfText = "%PDF-1.4\nESET Due Diligence Report Validated";
      const fixtureBytes = new TextEncoder().encode(fixturePdfText);
      const expectedSha = crypto
        .createHash("sha256")
        .update(fixtureBytes)
        .digest("hex");

      const mockFetch: typeof fetch = vi
        .fn()
        .mockImplementation(async (url) => {
          const u = String(url);
          if (u.endsWith("/reports/due-diligence")) {
            return new Response(
              JSON.stringify({
                data: {
                  job_id: "auto-chain-job-1",
                  status: "ready",
                  ico: "31333532",
                  pdf: {
                    sha256: expectedSha,
                    size_bytes: fixtureBytes.byteLength,
                  },
                },
              }),
              { status: 201, headers: { "Content-Type": "application/json" } },
            );
          }
          if (u.includes("/reports/auto-chain-job-1/download")) {
            return new Response(fixtureBytes, {
              status: 200,
              headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition":
                  'attachment; filename="whoiswho-dd-31333532.pdf"',
                "X-Report-Sha256": expectedSha,
              },
            });
          }
          return new Response("Not Found", { status: 404 });
        });

      // Krok 1: Spustenie a stiahnutie cez core funkcie
      const report = await startDueDiligenceReport(
        "31333532",
        "lite",
        mockFetch,
      );
      expect(report.data.job_id).toBe("auto-chain-job-1");

      const download = await downloadDueDiligencePdf(
        report.data.job_id,
        mockFetch,
      );
      expect(download.sha256).toBe(expectedSha);

      // Krok 2: Prevod do base64 (ako v ServerFn)
      const base64 = Buffer.from(download.buffer).toString("base64");
      expect(base64.length).toBeGreaterThan(0);

      // Krok 3: Klientska rekonštrukcia (simulácia browser atob -> Uint8Array -> Blob)
      const binaryString = atob(base64);
      const reconstructedBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        reconstructedBytes[i] = binaryString.charCodeAt(i);
      }

      const reconstructedSha = crypto
        .createHash("sha256")
        .update(reconstructedBytes)
        .digest("hex");

      expect(reconstructedSha).toBe(expectedSha);
      expect(new TextDecoder().decode(reconstructedBytes)).toBe(fixturePdfText);
    });
  });
});
