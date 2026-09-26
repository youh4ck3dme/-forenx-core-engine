import { describe, expect, it } from "./harness";
import {
  buildCompanyEntity,
  buildRegistryFindings,
  buildRegistryRelations,
  buildStatutoryPersonEntities,
  findEntityByIco,
  parseCompanyRegistryProfile,
  type CompanyRegistryProfile,
} from "../ico-atlas";
import { normalizeAddress } from "../normalization";
import type { Entity } from "../types";

describe("ICO Atlas Adapter", () => {
  const validPayload = {
    ico: "51234567",
    legalName: "Example s.r.o.",
    legalForm: "s.r.o.",
    registeredAddress: "Bratislava, Priemyselná 4",
    country: "SK",
    status: "active",
    incorporatedAt: "2020-01-10",
    statutoryPersons: [
      {
        name: "Ján Novák",
        role: "konateľ",
        validFrom: "2020-01-10",
      },
      {
        name: "Ján Novák",
        role: "konateľ",
        validFrom: "2020-01-10",
      },
    ],
    businessActivities: [
      "kúpa tovaru na účely jeho predaja",
      "kúpa tovaru na účely jeho predaja",
    ],
    source: {
      source: "ico-atlas",
      capturedAt: "2026-09-09T12:00:00.000Z",
      sourceUrl: "https://example.invalid/company/51234567",
      sourceHash: "sha256:abc123",
      confidence: 95,
    },
  };

  it("1. spracuje a rozparsuje validný profil", () => {
    const profile = parseCompanyRegistryProfile(validPayload);
    expect(profile.ico).toBe("51234567");
    expect(profile.legalName).toBe("Example s.r.o.");
    expect(profile.country).toBe("SK");
    expect(profile.source.confidence).toBe(95);
  });

  it("2. odmietne neplatné IČO", () => {
    expect(() =>
      parseCompanyRegistryProfile({
        ...validPayload,
        ico: "",
      }),
    ).toThrow();
  });

  it("3. odmietne chýbajúci názov firmy", () => {
    expect(() =>
      parseCompanyRegistryProfile({
        ...validPayload,
        legalName: "",
      }),
    ).toThrow();
  });

  it("4. vykoná normalizáciu adresy a 8-miestneho IČO", () => {
    const profile = parseCompanyRegistryProfile({
      ...validPayload,
      ico: "123456",
      registeredAddress: "  Bratislava ,   Priemyselná   4  ",
    });
    expect(profile.ico).toBe("00123456");
    expect(profile.registeredAddress).toBe("Bratislava , Priemyselná 4");
    expect(normalizeAddress("  Košice , Hlavná 1 ")).toBe("Košice , Hlavná 1");
  });

  it("5. deduplikuje štatutárov a predmety činnosti", () => {
    const profile = parseCompanyRegistryProfile(validPayload);
    expect(profile.statutoryPersons.length).toBe(1);
    expect(profile.businessActivities.length).toBe(1);
  });

  it("6. vyhľadá existujúcu firmu podľa IČO", () => {
    const entities: Entity[] = [
      {
        id: "e1",
        name: "Example s.r.o.",
        kind: "company",
        role: "s.r.o.",
        ico: "51234567",
        country: "SK",
        x: 0,
        y: 0,
      },
    ];
    const found = findEntityByIco(entities, "051234567");
    expect(found?.id).toBe("e1");
  });

  it("7. vytvorí reláciu medzi firmou a štatutárom", () => {
    const profile = parseCompanyRegistryProfile(validPayload);
    const company = buildCompanyEntity(profile, "case1");
    const persons = buildStatutoryPersonEntities(profile, company.id);
    const relations = buildRegistryRelations(
      profile,
      company.id,
      persons.map((p) => p.id),
    );

    expect(persons.length).toBe(1);
    expect(relations.length).toBe(1);
    expect(relations[0]?.toId).toBe(company.id);
    expect(relations[0]?.fromId).toBe(persons[0]?.id);
  });

  it("8. vytvorí neutrálny heuristický flag pri rozdiele v adrese", () => {
    const profile = parseCompanyRegistryProfile({
      ...validPayload,
      registeredAddress: "Bratislava, Priemyselná 4",
      status: "suspended",
    });
    const existing: Entity = {
      id: "e1",
      name: "Example s.r.o.",
      kind: "company",
      role: "s.r.o.",
      ico: "51234567",
      address: "Košice, Hlavná 10",
      country: "SK",
      x: 0,
      y: 0,
    };
    const flags = buildRegistryFindings(profile, existing);
    expect(flags.length).toBeGreaterThanOrEqual(2);
    expect(flags[0]?.detail).toContain("Indikátor vyžadujúci preverenie");
    expect(flags[0]?.detail).not.toContain("biely kôň");
  });

  it("9. odmietne chýbajúce metadata zdroja (capturedAt)", () => {
    expect(() =>
      parseCompanyRegistryProfile({
        ...validPayload,
        source: {
          source: "ico-atlas",
          capturedAt: "",
        },
      }),
    ).toThrow();
  });
});
