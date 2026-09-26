import { describe, it, expect } from "vitest";
import {
  parseCompanyRegistryProfile,
  CompanyRegistryProfileSchema,
} from "@/forensic/ico-atlas";
import fs from "fs";
import path from "path";

describe("Laravel ICO Atlas <-> Forendo Contract Test", () => {
  it("validates Laravel JSON response against Forendo CompanyRegistryProfileSchema", () => {
    // Exact JSON structure produced by Laravel 13 OrsrParser for Slovnaft (31322832)
    const laravelResponse = {
      ico: "31322832",
      legalName: "SLOVNAFT, a.s.",
      country: "SK",
      legalForm: "Akciová spoločnosť",
      registeredAddress: "Vlčie hrdlo 1, 824 12 Bratislava",
      status: "Aktívna",
      incorporatedAt: "1992-05-01",
      statutoryPersons: [
        {
          name: "Gabriel Szabó",
          role: "Predseda predstavenstva",
          validFrom: "2019-07-16",
        },
        {
          name: "Marek Senkovič",
          role: "Podpredseda predstavenstva",
          validFrom: "2020-07-27",
        },
        {
          name: "Ábel Galácz",
          role: "Člen predstavenstva",
          validFrom: "2020-07-27",
        },
        {
          name: "Peter Chmurčiak",
          role: "Člen predstavenstva",
          validFrom: "2020-07-27",
        },
        {
          name: "Timea Reicher",
          role: "Člen predstavenstva",
          validFrom: "2020-07-27",
        },
        {
          name: "Ing. Vladimír Kestler, PhD.",
          role: "Člen predstavenstva",
          validFrom: "2020-07-27",
        },
        {
          name: "Görgy Bacsa",
          role: "Člen predstavenstva",
          validFrom: "2022-07-01",
        },
        {
          name: "Dr. Andrea Palkó",
          role: "Člen predstavenstva",
          validFrom: "2025-06-25",
        },
      ],
      businessActivities: [
        "výroba a spracovanie ropy a produktov z ropy",
        "veľkoobchodná a maloobchodná činnosť",
        "výskum a vývoj v oblasti ropného a plynárenského priemyslu",
      ],
      source: {
        id: "src-orsr-31322832",
        source: "orsr",
        sourceVersion: "orsr-v4.1",
        sourceUrl: "https://www.orsr.sk/vypis.asp?ID=1000&SID=2&P=0",
        capturedAt: "2026-09-14T14:30:00.000000Z",
      },
    };

    // 1. Zod schema validation
    const zodResult = CompanyRegistryProfileSchema.safeParse(laravelResponse);
    expect(zodResult.success).toBe(true);

    // 2. Forendo profile parser
    const profile = parseCompanyRegistryProfile(laravelResponse);

    expect(profile.ico).toBe("31322832");
    expect(profile.legalName).toBe("SLOVNAFT, a.s.");
    expect(profile.country).toBe("SK");
    expect(profile.legalForm).toBe("Akciová spoločnosť");
    expect(profile.registeredAddress).toBe("Vlčie hrdlo 1, 824 12 Bratislava");
    expect(profile.status).toBe("Aktívna");
    expect(profile.incorporatedAt).toBe("1992-05-01");
    expect(profile.dissolvedAt).toBeUndefined();

    // 3. Statutory persons
    expect(profile.statutoryPersons).toHaveLength(8);
    expect(profile.statutoryPersons[0]).toEqual({
      name: "Gabriel Szabó",
      role: "Predseda predstavenstva",
      validFrom: "2019-07-16",
    });
    expect(profile.statutoryPersons[5]?.name).toBe(
      "Ing. Vladimír Kestler, PhD.",
    );

    // 4. Source metadata
    expect(profile.source.source).toBe("orsr");
    expect(profile.source.sourceVersion).toBe("orsr-v4.1");
    expect(profile.source.sourceUrl).toContain("orsr.sk");
    expect(profile.source.capturedAt).toBe("2026-09-14T14:30:00.000000Z");
    // Contract check: confidence is not arbitrarily fabricated
    expect(profile.source.confidence).toBeUndefined();
  });

  it("fails when response is wrapped in 'data' envelope", () => {
    const wrapped = {
      data: {
        ico: "31322832",
        legalName: "SLOVNAFT, a.s.",
        country: "SK",
        source: {
          source: "orsr",
          capturedAt: "2026-09-14T14:00:00Z",
        },
      },
    };

    expect(() => parseCompanyRegistryProfile(wrapped)).toThrow(
      /Neplatné dáta profilu ICO Atlas/,
    );
  });

  it("fails when required fields are missing", () => {
    const missingIco = {
      legalName: "Test s.r.o.",
      country: "SK",
      source: {
        source: "orsr",
        capturedAt: "2026-09-14T14:00:00Z",
      },
    };

    expect(() => parseCompanyRegistryProfile(missingIco)).toThrow(/ico/i);

    const missingLegalName = {
      ico: "12345678",
      country: "SK",
      source: {
        source: "orsr",
        capturedAt: "2026-09-14T14:00:00Z",
      },
    };

    expect(() => parseCompanyRegistryProfile(missingLegalName)).toThrow(
      /legalName/i,
    );
  });

  it("verifies fixture file from Laravel project if present", () => {
    const fixturePath =
      "C:/Users/42195/Documents/ico-atlas-laravel/tests/Fixtures/orsr_slovnaft.html";
    if (fs.existsSync(fixturePath)) {
      const html = fs.readFileSync(fixturePath, "utf8");
      expect(html).toContain("SLOVNAFT, a.s.");
      expect(html).toContain("31 322 832");
      expect(html).toContain("Gabriel");
      expect(html).toContain("Szabó");
    }
  });
});
